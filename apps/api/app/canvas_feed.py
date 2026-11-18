"""Canvas calendar-feed import: the no-token way to bring in assignments.

Many schools turn off personal access tokens for students, which blocks the
token flow entirely. Every Canvas user can still copy their private calendar
feed (Calendar → Calendar Feed), an iCalendar file that lists assignment due
dates alongside the course they belong to. One paste is all StudyFlow needs.

Security model
--------------
- The feed link is a bearer secret (anyone holding it can read the calendar),
  so it is treated exactly like an access token: encrypted at rest, never
  logged, never returned to the browser.
- Only links shaped like a Canvas feed are accepted: HTTPS, a public hostname
  (the same SSRF guard as the token flow), and the path
  ``/feeds/calendars/user_<id>.ics``. That keeps the server from being pointed
  at arbitrary URLs.
- Redirects are not followed and the response is capped in size.

What a feed can and can't tell us
---------------------------------
It has titles, due dates, the course, and a link per assignment. It has no
points or submission status, so the student sets estimates during review
(which StudyFlow already asks for) and marks work done in StudyFlow.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx

from app.canvas_client import _validate_canvas_url
from app.canvas_models import CanvasAssignment, CanvasCourse, CanvasError, CanvasErrorCode

# Feeds for a busy student run a few hundred KB; this is generous headroom.
MAX_FEED_BYTES = 5 * 1024 * 1024

_FEED_PATH_RE = re.compile(r"^/feeds/calendars/user_[A-Za-z0-9]{10,128}\.ics$")
_COURSE_ID_RES = (
    re.compile(r"/courses/(\d+)"),
    re.compile(r"course_(\d+)"),
)
_ASSIGNMENT_ID_RES = (
    re.compile(r"event-assignment-(?:override-)?(\d+)"),
    re.compile(r"assignment_(\d+)"),
    re.compile(r"/assignments/(\d+)"),
)
_BRACKET_RE = re.compile(r"^(?P<title>.*?)\s*\[(?P<course>[^\[\]]+)\]\s*$")
_CALNAME_SUFFIX_RE = re.compile(r"\s*Calendar\s*\(Canvas\)\s*$", re.IGNORECASE)


@dataclass
class FeedEvent:
    uid: str = ""
    summary: str = ""
    url: str = ""
    start: str = ""
    start_params: dict[str, str] = field(default_factory=dict)


@dataclass
class ParsedFeed:
    calendar_name: str
    courses: list[CanvasCourse]
    assignments: list[CanvasAssignment]


def validate_feed_url(raw_url: str) -> str:
    """Return the normalised feed URL, or raise CanvasError(INVALID_URL)."""
    url = raw_url.strip()
    if url.startswith("webcal://"):
        url = "https://" + url[len("webcal://") :]
    parsed = urlparse(url if "://" in url else "https://" + url)
    base = _validate_canvas_url(f"{parsed.scheme}://{parsed.netloc}")
    if not _FEED_PATH_RE.match(parsed.path or ""):
        raise CanvasError(
            code=CanvasErrorCode.INVALID_URL,
            message="That isn't a Canvas calendar feed link. In Canvas, open Calendar, choose "
            "Calendar Feed (bottom right), and copy the link that ends in .ics.",
        )
    return f"{base}{parsed.path}"


def feed_base_url(feed_url: str) -> str:
    parsed = urlparse(feed_url)
    return f"https://{parsed.netloc}"


async def fetch_feed(feed_url: str) -> str:
    """Download the feed text. Raises CanvasError on any failure."""
    url = validate_feed_url(feed_url)
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
            async with client.stream("GET", url, headers={"Accept": "text/calendar"}) as response:
                if response.status_code in (401, 403, 404):
                    # Canvas answers 404 when a feed link was reset or never existed.
                    raise CanvasError(
                        code=CanvasErrorCode.UNAUTHORIZED,
                        message="Canvas doesn't recognise that feed link anymore. Copy a fresh "
                        "one from Calendar → Calendar Feed.",
                    )
                if response.is_redirect or not response.is_success:
                    raise CanvasError(
                        code=CanvasErrorCode.CANVAS_ERROR,
                        message="Canvas returned an unexpected response "
                        f"(HTTP {response.status_code}).",
                    )
                chunks: list[bytes] = []
                size = 0
                async for chunk in response.aiter_bytes():
                    size += len(chunk)
                    if size > MAX_FEED_BYTES:
                        raise CanvasError(
                            code=CanvasErrorCode.CANVAS_ERROR,
                            message="That calendar feed is too large to import.",
                        )
                    chunks.append(chunk)
    except (httpx.ConnectError, httpx.TimeoutException) as err:
        raise CanvasError(
            code=CanvasErrorCode.UNREACHABLE,
            message="StudyFlow couldn't reach Canvas. Check the link and try again.",
        ) from err
    text = b"".join(chunks).decode("utf-8", errors="replace")
    if "BEGIN:VCALENDAR" not in text[:2048]:
        raise CanvasError(
            code=CanvasErrorCode.INVALID_URL,
            message="That link didn't return a calendar. Copy the Calendar Feed link from Canvas.",
        )
    return text


# ---------------------------------------------------------------------------
# iCalendar parsing (RFC 5545 subset: what Canvas emits)
# ---------------------------------------------------------------------------


def _unfold(text: str) -> list[str]:
    lines: list[str] = []
    for raw in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        if raw.startswith((" ", "\t")) and lines:
            lines[-1] += raw[1:]
        else:
            lines.append(raw)
    return lines


def _unescape(value: str) -> str:
    return (
        value.replace("\\n", " ")
        .replace("\\N", " ")
        .replace("\\,", ",")
        .replace("\\;", ";")
        .replace("\\\\", "\\")
        .strip()
    )


def _split_property(line: str) -> tuple[str, dict[str, str], str]:
    head, _, value = line.partition(":")
    name, *raw_params = head.split(";")
    params: dict[str, str] = {}
    for item in raw_params:
        key, _, param_value = item.partition("=")
        params[key.upper()] = param_value.strip('"')
    return name.upper(), params, value


def _parse_when(value: str, params: dict[str, str]) -> Optional[str]:  # noqa: UP045
    """Return an ISO-8601 due time (UTC when known), or None if unparseable."""
    value = value.strip()
    try:
        if params.get("VALUE") == "DATE" or re.fullmatch(r"\d{8}", value):
            # An all-day due date: treat as due by the end of that day, student-local.
            day = datetime.strptime(value[:8], "%Y%m%d").date()
            return f"{day.isoformat()}T23:59:00"
        if value.endswith("Z"):
            moment = datetime.strptime(value, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
            return moment.isoformat().replace("+00:00", "Z")
        local = datetime.strptime(value, "%Y%m%dT%H%M%S")
        tzid = params.get("TZID")
        if tzid:
            try:
                from zoneinfo import ZoneInfo

                moment = local.replace(tzinfo=ZoneInfo(tzid)).astimezone(timezone.utc)
                return moment.isoformat().replace("+00:00", "Z")
            except Exception:  # unknown zone: fall back to floating local time
                pass
        return local.isoformat()
    except ValueError:
        return None


def _first_match(patterns: tuple[re.Pattern[str], ...], *values: str) -> Optional[str]:  # noqa: UP045
    for value in values:
        for pattern in patterns:
            match = pattern.search(value)
            if match:
                return match.group(1)
    return None


def parse_feed(text: str, now: Optional[datetime] = None) -> ParsedFeed:  # noqa: UP045
    """Extract upcoming assignments (and the courses they belong to) from a Canvas feed."""
    now = now or datetime.now(timezone.utc)
    calendar_name = ""
    events: list[FeedEvent] = []
    current: Optional[FeedEvent] = None  # noqa: UP045

    for line in _unfold(text):
        if not line:
            continue
        name, params, value = _split_property(line)
        if name == "BEGIN" and value.upper() == "VEVENT":
            current = FeedEvent()
        elif name == "END" and value.upper() == "VEVENT":
            if current is not None:
                events.append(current)
            current = None
        elif current is None:
            if name == "X-WR-CALNAME":
                calendar_name = _CALNAME_SUFFIX_RE.sub("", _unescape(value))
        elif name == "UID":
            current.uid = value.strip()
        elif name == "SUMMARY":
            current.summary = _unescape(value)
        elif name == "URL":
            current.url = value.strip()
        elif name == "DTSTART":
            current.start, current.start_params = value, params

    courses: dict[str, CanvasCourse] = {}
    assignments: dict[str, CanvasAssignment] = {}
    today = now.date()
    for event in events:
        # Canvas UIDs: event-assignment-<id> for due dates, event-calendar-event-<id> for
        # class meetings and other events. Only due dates become tasks.
        if "assignment" not in event.uid:
            continue
        assignment_id = _first_match(_ASSIGNMENT_ID_RES, event.uid, event.url)
        due_at = _parse_when(event.start, event.start_params)
        if not assignment_id or not due_at or _is_past(due_at, now, today):
            continue

        title, course_label = event.summary or "Untitled assignment", ""
        match = _BRACKET_RE.match(title)
        if match:
            title = match.group("title").strip() or title
            course_label = match.group("course").strip()
        course_id = _first_match(_COURSE_ID_RES, event.url) or _stable_id(course_label or "canvas")
        courses.setdefault(
            course_id,
            CanvasCourse(
                id=course_id, name=course_label or "Canvas", course_code=course_label or "Canvas"
            ),
        )
        assignments[assignment_id] = CanvasAssignment(
            id=assignment_id,
            course_id=course_id,
            title=title,
            due_at=due_at,
            points_possible=None,
            html_url=_assignment_link(event.url, course_id, assignment_id),
        )

    ordered = sorted(assignments.values(), key=lambda item: item.due_at or "")
    return ParsedFeed(
        calendar_name=calendar_name,
        courses=sorted(courses.values(), key=lambda course: course.name.lower()),
        assignments=ordered,
    )


def _is_past(due_at: str, now: datetime, today: date) -> bool:
    if due_at.endswith("Z"):
        return datetime.fromisoformat(due_at.replace("Z", "+00:00")) <= now
    # Floating local time: compare by day so time zones can't hide work due today.
    return date.fromisoformat(due_at[:10]) < today


def _stable_id(label: str) -> str:
    return "feed-" + hashlib.sha256(label.encode()).hexdigest()[:10]


def _assignment_link(url: str, course_id: str, assignment_id: str) -> Optional[str]:  # noqa: UP045
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        return None
    if course_id.isdigit():
        return f"https://{parsed.netloc}/courses/{course_id}/assignments/{assignment_id}"
    return url
