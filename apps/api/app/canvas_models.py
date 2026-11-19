"""Pydantic models for the Canvas integration layer.

These models are shared between canvas_client.py (which produces them) and the
route handlers (which validate inputs and serialize outputs).

Design choices
--------------
- CanvasError is raised as a Python exception inside the client and caught by
  the route layer, which converts it to an HTTP 4xx/5xx response. This keeps
  error semantics close to where they originate rather than spreading HTTP
  status decisions across the codebase.
- Tokens are never included in any response model. The route handlers enforce
  this by using only these response types in their return annotations.
"""

from __future__ import annotations

from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, Field


class CanvasErrorCode(str, Enum):
    INVALID_URL = "invalid_url"
    UNAUTHORIZED = "unauthorized"
    FORBIDDEN = "forbidden"
    UNREACHABLE = "unreachable"
    CANVAS_ERROR = "canvas_error"
    INVALID_REQUEST = "invalid_request"
    NOT_CONNECTED = "not_connected"


class CanvasError(Exception):
    """Raised by canvas_client when an API call cannot succeed."""

    def __init__(self, code: CanvasErrorCode, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message

    def to_response(self) -> CanvasErrorResponse:
        return CanvasErrorResponse(code=self.code, message=self.message)


class CanvasErrorResponse(BaseModel):
    code: CanvasErrorCode
    message: str


# ---------------------------------------------------------------------------
# Input models
# ---------------------------------------------------------------------------


class CanvasConnectRequest(BaseModel):
    """Payload for the initial connection / validation request."""

    canvas_url: str = Field(
        min_length=10,
        max_length=512,
        description="Base URL of the Canvas instance, e.g. https://canvas.yourschool.edu",
    )
    # Token is accepted server-side only. It must never be echoed in a response
    # or logged. Annotated Optional so callers can omit it to do URL-only
    # validation in a future two-step flow.
    access_token: str = Field(
        min_length=1,
        max_length=512,
        description="Canvas personal access token. Sent to the backend only; never stored.",
    )


class CanvasFeedConnectRequest(BaseModel):
    """Payload for connecting with the private Calendar Feed link."""

    feed_url: str = Field(
        min_length=20,
        max_length=512,
        description="Canvas Calendar Feed link, e.g. https://canvas.school.edu/feeds/calendars/user_….ics",
    )


class CanvasSyncRequest(BaseModel):
    """Fetch assignments using the Canvas connection stored for this session."""

    course_ids: Optional[list[str]] = Field(  # noqa: UP045 -- keep Optional for 3.9 compat
        default=None,
        max_length=100,
        description="Restrict to these course IDs. Omit to fetch all active courses.",
    )


# ---------------------------------------------------------------------------
# Domain models
# ---------------------------------------------------------------------------


class CanvasCourse(BaseModel):
    id: str
    name: str
    course_code: str
    term: Optional[str] = None  # noqa: UP045


class CanvasBusyEvent(BaseModel):
    """A timed Canvas calendar event (class meeting, section, office hours). No title is
    kept: only when it happens matters for planning."""

    start: str = Field(description="ISO-8601, UTC with Z when known, otherwise floating local.")
    end: str


class CanvasAssignment(BaseModel):
    """Assignment as returned from Canvas, before the student reviews or approves it."""

    id: str
    course_id: str
    title: str
    due_at: str | None = None  # ISO-8601 datetime string from Canvas, or None
    points_possible: Optional[float] = None  # noqa: UP045
    html_url: Optional[str] = None  # noqa: UP045
    # Plain-text instructions (truncated), read by the estimator. Never stored as-is.
    description: Optional[str] = None  # noqa: UP045


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class CanvasConnectResponse(BaseModel):
    """Returned after a successful connection validation."""

    display_name: str = Field(description="Canvas account display name for the authenticated user.")
    canvas_url: str = Field(description="Normalised Canvas base URL.")
    # Courses are returned immediately to avoid a second round-trip in the UI.
    courses: list[CanvasCourse]
    method: Literal["token", "feed"] = Field(
        default="token", description="How this session is connected to Canvas."
    )


class CanvasSyncResponse(BaseModel):
    """Returned after a full assignment sync."""

    assignments: list[CanvasAssignment]
    courses_scanned: int
    assignments_found: int
    busy: list[CanvasBusyEvent] = Field(
        default_factory=list, description="Timed Canvas events (feed connections only)."
    )
