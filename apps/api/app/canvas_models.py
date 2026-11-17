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
from typing import Optional

from pydantic import BaseModel, Field


class CanvasErrorCode(str, Enum):
    INVALID_URL = "invalid_url"
    UNAUTHORIZED = "unauthorized"
    FORBIDDEN = "forbidden"
    UNREACHABLE = "unreachable"
    CANVAS_ERROR = "canvas_error"
    INVALID_REQUEST = "invalid_request"


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


class CanvasAssignmentsRequest(BaseModel):
    """Payload to fetch assignments given a live session credential."""

    canvas_url: str = Field(min_length=10, max_length=512)
    access_token: str = Field(min_length=1, max_length=512)
    course_ids: Optional[list[str]] = Field(  # noqa: UP045 -- keep Optional for 3.9 compat
        default=None,
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


class CanvasAssignment(BaseModel):
    """Assignment as returned from Canvas, before the student reviews or approves it."""

    id: str
    course_id: str
    title: str
    due_at: str | None = None  # ISO-8601 datetime string from Canvas, or None
    points_possible: Optional[float] = None  # noqa: UP045
    html_url: Optional[str] = None  # noqa: UP045
    description: Optional[str] = None  # noqa: UP045 -- fetched separately on demand


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------


class CanvasConnectResponse(BaseModel):
    """Returned after a successful connection validation."""

    display_name: str = Field(description="Canvas account display name for the authenticated user.")
    canvas_url: str = Field(description="Normalised Canvas base URL.")
    # Courses are returned immediately to avoid a second round-trip in the UI.
    courses: list[CanvasCourse]


class CanvasSyncResponse(BaseModel):
    """Returned after a full assignment sync."""

    assignments: list[CanvasAssignment]
    courses_scanned: int
    assignments_found: int
