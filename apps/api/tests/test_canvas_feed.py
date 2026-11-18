"""Tests for the Canvas calendar-feed import (the no-token path)."""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app import canvas_feed
from app.canvas_feed import parse_feed, validate_feed_url
from app.canvas_models import CanvasError, CanvasErrorCode

FEED_URL = "https://canvas.example.edu/feeds/calendars/user_AbCdEf0123456789xyz.ics"
NOW = datetime(2026, 11, 17, 12, 0, tzinfo=timezone.utc)
_REAL_ASYNC_CLIENT = httpx.AsyncClient

# Shaped like a real Canvas export: folded lines, escaped commas, a class meeting
# (not an assignment), a past assignment, an all-day due date, and a TZID time.
FEED = "\r\n".join(
    [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Instructure//Canvas//EN",
        "X-WR-CALNAME:Sam Student Calendar (Canvas)",
        "BEGIN:VEVENT",
        "UID:event-assignment-501",
        "DTSTART:20261120T075900Z",
        "DTEND:20261120T075900Z",
        "SUMMARY:Lab 6: Shortest paths [CSE 101-01 Fall 2026]",
        "URL;VALUE=URI:https://canvas.example.edu/calendar?include_contexts=course_42&month=11",
        " &year=2026#assignment_501",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:event-assignment-502",
        "DTSTART;VALUE=DATE:20261124",
        "SUMMARY:Essay draft\\, part 2 [WRIT 2]",
        "URL:https://canvas.example.edu/courses/77/assignments/502",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:event-assignment-503",
        "DTSTART;TZID=America/Los_Angeles:20261119T170000",
        "SUMMARY:Problem set 5 [STAT 131]",
        "URL:https://canvas.example.edu/courses/88/assignments/503",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:event-assignment-400",
        "DTSTART:20261101T075900Z",
        "SUMMARY:Old quiz [CSE 101-01 Fall 2026]",
        "URL:https://canvas.example.edu/courses/42/assignments/400",
        "END:VEVENT",
        "BEGIN:VEVENT",
        "UID:event-calendar-event-9001",
        "DTSTART:20261118T170000Z",
        "SUMMARY:Lecture [CSE 101-01 Fall 2026]",
        "END:VEVENT",
        "END:VCALENDAR",
        "",
    ]
)


# ---------------------------------------------------------------------------
# Link validation
# ---------------------------------------------------------------------------


def test_feed_link_is_accepted_and_normalised() -> None:
    assert validate_feed_url(f"  {FEED_URL}  ") == FEED_URL
    assert validate_feed_url(FEED_URL.replace("https://", "webcal://")) == FEED_URL
    assert validate_feed_url(FEED_URL.replace("https://", "")) == FEED_URL


@pytest.mark.parametrize(
    "url",
    [
        "https://canvas.example.edu/calendar",  # the calendar page, not the feed
        "https://canvas.example.edu/api/v1/users/self",
        "https://canvas.example.edu/feeds/calendars/user_short.ics",
        "https://localhost/feeds/calendars/user_AbCdEf0123456789xyz.ics",
        "https://10.0.0.5/feeds/calendars/user_AbCdEf0123456789xyz.ics",
        "ftp://canvas.example.edu/feeds/calendars/user_AbCdEf0123456789xyz.ics",
    ],
)
def test_non_feed_links_are_rejected(url: str) -> None:
    with pytest.raises(CanvasError) as exc_info:
        validate_feed_url(url)
    assert exc_info.value.code == CanvasErrorCode.INVALID_URL


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------


def test_parse_extracts_upcoming_assignments_with_courses() -> None:
    parsed = parse_feed(FEED, now=NOW)

    assert parsed.calendar_name == "Sam Student"
    titles = [item.title for item in parsed.assignments]
    assert titles == ["Problem set 5", "Lab 6: Shortest paths", "Essay draft, part 2"]
    assert "Lecture" not in json.dumps([a.model_dump() for a in parsed.assignments])
    assert {course.id: course.name for course in parsed.courses} == {
        "42": "CSE 101-01 Fall 2026",
        "88": "STAT 131",
        "77": "WRIT 2",
    }


def test_parse_handles_utc_tzid_and_all_day_times() -> None:
    by_id = {item.id: item for item in parse_feed(FEED, now=NOW).assignments}

    assert by_id["501"].due_at == "2026-11-20T07:59:00Z"
    assert by_id["503"].due_at == "2026-11-20T01:00:00Z"  # 5 PM Pacific
    assert by_id["502"].due_at == "2026-11-24T23:59:00"  # all-day: end of the student's day
    assert by_id["501"].course_id == "42"
    assert by_id["501"].html_url == "https://canvas.example.edu/courses/42/assignments/501"
    assert by_id["501"].points_possible is None


def test_parse_without_course_link_groups_by_bracket_label() -> None:
    text = FEED.replace(
        "URL:https://canvas.example.edu/courses/88/assignments/503", "URL:https://canvas.example.edu/"
    )
    stat = next(item for item in parse_feed(text, now=NOW).assignments if item.id == "503")
    assert stat.course_id.startswith("feed-")


def test_parse_empty_calendar() -> None:
    parsed = parse_feed("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", now=NOW)
    assert parsed.assignments == [] and parsed.courses == []


# ---------------------------------------------------------------------------
# Fetching
# ---------------------------------------------------------------------------


def _fetch_with(handler, monkeypatch) -> str:
    def client_factory(**kwargs):
        return _REAL_ASYNC_CLIENT(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(canvas_feed.httpx, "AsyncClient", client_factory)
    return asyncio.run(canvas_feed.fetch_feed(FEED_URL))


def test_fetch_returns_calendar_text(monkeypatch) -> None:
    text = _fetch_with(lambda request: httpx.Response(200, text=FEED), monkeypatch)
    assert "BEGIN:VCALENDAR" in text


def test_fetch_reset_link_means_reconnect(monkeypatch) -> None:
    with pytest.raises(CanvasError) as exc_info:
        _fetch_with(lambda request: httpx.Response(404), monkeypatch)
    assert exc_info.value.code == CanvasErrorCode.UNAUTHORIZED


def test_fetch_does_not_follow_redirects(monkeypatch) -> None:
    def redirect(request):
        return httpx.Response(302, headers={"location": "http://169.254.169.254/"})

    with pytest.raises(CanvasError) as exc_info:
        _fetch_with(redirect, monkeypatch)
    assert exc_info.value.code == CanvasErrorCode.CANVAS_ERROR


def test_fetch_rejects_non_calendar_and_oversized(monkeypatch) -> None:
    with pytest.raises(CanvasError):
        _fetch_with(lambda request: httpx.Response(200, text="<html>login</html>"), monkeypatch)
    monkeypatch.setattr(canvas_feed, "MAX_FEED_BYTES", 100)
    with pytest.raises(CanvasError):
        _fetch_with(lambda request: httpx.Response(200, text=FEED), monkeypatch)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


def _connect_feed(client):
    with patch("app.canvas_routes.fetch_feed", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = FEED
        return client.post("/api/v1/canvas/connect-feed", json={"feed_url": FEED_URL})


def test_connect_feed_stores_link_encrypted_and_never_returns_it(session_client) -> None:
    from app import storage
    from app.session import COOKIE_NAME

    response = _connect_feed(session_client)
    assert response.status_code == 200
    body = response.json()
    assert body["method"] == "feed"
    assert body["display_name"] == "Sam Student"
    assert body["canvas_url"] == "https://canvas.example.edu"
    assert "user_AbCdEf" not in json.dumps(body)

    record = storage.get_session(storage.hash_session_id(session_client.cookies.get(COOKIE_NAME)))
    assert "user_AbCdEf" not in (record.canvas_token_enc or "")

    status = session_client.get("/api/v1/workspace").json()["canvas"]
    assert status["method"] == "feed"
    assert "user_AbCdEf" not in json.dumps(status)


def test_connect_feed_rejects_a_non_feed_link(session_client) -> None:
    response = session_client.post(
        "/api/v1/canvas/connect-feed", json={"feed_url": "https://canvas.example.edu/calendar"}
    )
    assert response.status_code == 422
    assert session_client.get("/api/v1/workspace").json()["canvas"] is None


def test_feed_courses_and_sync_use_the_stored_link(session_client) -> None:
    _connect_feed(session_client)
    with patch("app.canvas_routes.fetch_feed", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = FEED
        courses = session_client.get("/api/v1/canvas/courses").json()
        synced = session_client.post("/api/v1/canvas/sync", json={"course_ids": ["42"]}).json()
    assert mock_fetch.call_args.args[0] == FEED_URL
    assert courses["method"] == "feed"
    assert {course["id"] for course in courses["courses"]} >= {"42", "77", "88"}
    assert [item["course_id"] for item in synced["assignments"]] == ["42"]
    assert session_client.get("/api/v1/workspace").json()["canvas"]["last_synced"]


def test_reset_feed_link_clears_the_connection(session_client) -> None:
    _connect_feed(session_client)
    with patch("app.canvas_routes.fetch_feed", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.side_effect = CanvasError(code=CanvasErrorCode.UNAUTHORIZED, message="gone")
        response = session_client.post("/api/v1/canvas/sync", json={})
    assert response.status_code == 401
    assert session_client.get("/api/v1/workspace").json()["canvas"] is None
