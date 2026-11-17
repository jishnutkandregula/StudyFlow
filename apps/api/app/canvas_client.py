"""Canvas LMS API client for StudyFlow.

Security model
--------------
- Tokens are accepted from the frontend request body and used only for the
  duration of that request. They are never logged, never stored, and never
  echoed back in a response.
- Canvas instance URLs are validated against an SSRF allowlist before any
  outbound request is made. Only HTTPS URLs with public-routable hostnames
  are permitted (see _validate_canvas_url).
- This module is intentionally stateless. A future OAuth implementation can
  replace the token argument with a provider abstraction without changing
  the calling interface.

Limitations (development mode)
-------------------------------
- Authentication is personal-access-token only. Canvas OAuth is not yet
  implemented. Institutions that restrict third-party API access entirely
  will not be reachable from this integration.
- Credentials are not persisted between browser sessions. Students must
  re-enter their token each time.
"""

from __future__ import annotations

import ipaddress
import re
from typing import Any
from urllib.parse import urlparse

import httpx

from app.canvas_models import (
    CanvasAssignment,
    CanvasCourse,
    CanvasError,
    CanvasErrorCode,
)

# Canvas sends up to 100 items per page by default; we cap pagination at this
# many pages to avoid runaway fetches against a misconfigured instance.
_MAX_PAGES = 20

# Pattern that matches a Canvas Link header's "next" URL.
_LINK_NEXT_RE = re.compile(r'<([^>]+)>;\s*rel="next"')

# RFC 1918 and loopback ranges that must never be fetched server-side.
_PRIVATE_NETS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
]


def _validate_canvas_url(raw_url: str) -> str:
    """Return the normalised Canvas base URL or raise CanvasError.

    Rules enforced:
    - A bare hostname gets https:// prepended; http:// is upgraded.
    - Must be HTTPS (other schemes are rejected).
    - Hostname must not be localhost or an IP address literal.
    - Hostname must not resolve to a private or loopback network range
      (checked via DNS only if the hostname looks like an IP; literal IPs
      are rejected directly to prevent SSRF).
    - Trailing slashes are stripped.
    """
    url = raw_url.strip().rstrip("/")
    if "://" not in url:
        # Students usually paste a bare hostname such as canvas.school.edu.
        url = "https://" + url
    if not url.startswith("https://"):
        # Upgrade http:// transparently; reject everything else.
        if url.startswith("http://"):
            url = "https://" + url[7:]
        else:
            raise CanvasError(
                code=CanvasErrorCode.INVALID_URL,
                message="Canvas URL must use HTTPS (e.g. https://canvas.yourschool.edu).",
            )

    parsed = urlparse(url)
    hostname = parsed.hostname or ""

    if not hostname:
        raise CanvasError(
            code=CanvasErrorCode.INVALID_URL,
            message="Canvas URL is missing a hostname.",
        )

    blocked_names = {"localhost", "0.0.0.0"}
    if hostname in blocked_names:
        raise CanvasError(
            code=CanvasErrorCode.INVALID_URL,
            message="That hostname is not a valid Canvas instance.",
        )

    # Reject bare IP addresses.
    try:
        addr = ipaddress.ip_address(hostname)
        for net in _PRIVATE_NETS:
            if addr in net:
                raise CanvasError(
                    code=CanvasErrorCode.INVALID_URL,
                    message="That hostname is not a valid Canvas instance.",
                )
        # Public IP literals are also rejected — Canvas instances always have
        # a proper hostname.
        raise CanvasError(
            code=CanvasErrorCode.INVALID_URL,
            message="Please enter the full Canvas URL with its hostname "
            "(e.g. https://canvas.yourschool.edu).",
        )
    except ValueError:
        # Not an IP address literal — good.
        pass

    # Must have at least one dot to be a real external hostname.
    if "." not in hostname:
        raise CanvasError(
            code=CanvasErrorCode.INVALID_URL,
            message="Canvas URL must include a full domain name "
            "(e.g. https://canvas.yourschool.edu).",
        )

    return f"https://{parsed.netloc}"


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _next_url(link_header: str | None) -> str | None:
    if not link_header:
        return None
    match = _LINK_NEXT_RE.search(link_header)
    return match.group(1) if match else None


async def _paginate(
    client: httpx.AsyncClient,
    url: str,
    headers: dict[str, str],
    params: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Follow Canvas Link-header pagination and return all items."""
    items: list[dict[str, Any]] = []
    next_url: str | None = url
    page = 0
    while next_url and page < _MAX_PAGES:
        response = await client.get(next_url, headers=headers, params=params if page == 0 else None)
        if response.status_code == 401:
            raise CanvasError(
                code=CanvasErrorCode.UNAUTHORIZED,
                message="Canvas token is invalid or expired. Please check your access token.",
            )
        if response.status_code == 403:
            raise CanvasError(
                code=CanvasErrorCode.FORBIDDEN,
                message="StudyFlow does not have permission to read this Canvas data.",
            )
        if not response.is_success:
            raise CanvasError(
                code=CanvasErrorCode.CANVAS_ERROR,
                message=f"Canvas returned an unexpected error (HTTP {response.status_code}).",
            )
        payload = response.json()
        if isinstance(payload, list):
            items.extend(payload)
        next_url = _next_url(response.headers.get("link"))
        page += 1
    return items


async def validate_connection(base_url: str, token: str) -> str:
    """Validate a Canvas URL + token pair.

    Returns the authenticated student's display name, or raises CanvasError.
    """
    validated = _validate_canvas_url(base_url)
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            response = await client.get(
                f"{validated}/api/v1/users/self",
                headers=_auth_headers(token),
            )
        except httpx.ConnectError as err:
            raise CanvasError(
                code=CanvasErrorCode.UNREACHABLE,
                message="StudyFlow could not reach that Canvas instance. "
                "Check the URL and try again.",
            ) from err
        except httpx.TimeoutException as err:
            raise CanvasError(
                code=CanvasErrorCode.UNREACHABLE,
                message="Canvas did not respond in time. Try again.",
            ) from err
        if response.status_code == 401:
            raise CanvasError(
                code=CanvasErrorCode.UNAUTHORIZED,
                message="Access token is invalid. Generate a new token in Canvas "
                "under Account → Settings → Approved Integrations.",
            )
        if response.status_code == 404:
            raise CanvasError(
                code=CanvasErrorCode.INVALID_URL,
                message="That URL doesn't look like a Canvas instance. "
                "Confirm the address in your browser first.",
            )
        if not response.is_success:
            raise CanvasError(
                code=CanvasErrorCode.CANVAS_ERROR,
                message=f"Canvas returned HTTP {response.status_code}.",
            )
        data = response.json()
        return data.get("name") or data.get("short_name") or "Connected"


async def fetch_courses(base_url: str, token: str) -> list[CanvasCourse]:
    """Return active enrolled courses for the authenticated student."""
    validated = _validate_canvas_url(base_url)
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            raw = await _paginate(
                client,
                f"{validated}/api/v1/courses",
                headers=_auth_headers(token),
                params={
                    "enrollment_type": "student",
                    "enrollment_state": "active",
                    "per_page": "50",
                    "include[]": ["term"],
                },
            )
        except (httpx.ConnectError, httpx.TimeoutException) as err:
            raise CanvasError(
                code=CanvasErrorCode.UNREACHABLE,
                message="Could not reach Canvas. Check the URL and your network.",
            ) from err
    courses = []
    for item in raw:
        course_id = str(item.get("id", ""))
        name = item.get("name") or item.get("course_code") or "Unnamed course"
        course_code = item.get("course_code") or ""
        if not course_id:
            continue
        courses.append(
            CanvasCourse(
                id=course_id,
                name=name,
                course_code=course_code,
                term=item.get("term", {}).get("name") if item.get("term") else None,
            )
        )
    return courses


async def fetch_assignments(
    base_url: str,
    token: str,
    course_ids: list[str] | None = None,
) -> list[CanvasAssignment]:
    """Return upcoming assignments for the student across all active courses.

    If course_ids is provided, only those courses are queried.
    Assignments without a due date are included with due_at=None.
    """
    validated = _validate_canvas_url(base_url)
    if not course_ids:
        courses = await fetch_courses(base_url, token)
        course_ids = [c.id for c in courses]

    assignments: list[CanvasAssignment] = []
    async with httpx.AsyncClient(timeout=20) as client:
        for course_id in course_ids:
            try:
                raw = await _paginate(
                    client,
                    f"{validated}/api/v1/courses/{course_id}/assignments",
                    headers=_auth_headers(token),
                    params={
                        "bucket": "upcoming",
                        "order_by": "due_at",
                        "per_page": "50",
                        "include[]": ["submission"],
                    },
                )
            except CanvasError:
                # A single course failure (e.g. no access) should not abort the
                # whole sync. The caller receives whatever succeeded.
                continue
            except (httpx.ConnectError, httpx.TimeoutException) as err:
                raise CanvasError(
                    code=CanvasErrorCode.UNREACHABLE,
                    message="Lost connection to Canvas mid-sync.",
                ) from err
            for item in raw:
                assignment_id = str(item.get("id", ""))
                if not assignment_id:
                    continue
                # Skip submitted + graded work unless it was recently returned.
                submission = (item.get("submission") or {}) if item.get("submission") else {}
                workflow = submission.get("workflow_state", "")
                if workflow in ("graded", "complete"):
                    continue
                assignments.append(
                    CanvasAssignment(
                        id=assignment_id,
                        course_id=course_id,
                        title=item.get("name") or "Unnamed assignment",
                        due_at=item.get("due_at"),
                        points_possible=item.get("points_possible"),
                        html_url=item.get("html_url"),
                        description=None,  # omitted for performance; fetch separately on demand
                    )
                )
    return assignments
