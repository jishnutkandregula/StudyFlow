"""FastAPI route handlers for Canvas LMS integration.

Security contract
-----------------
- The access token is sent once, to /connect. After Canvas accepts it, it is
  encrypted (crypto.py) and stored server-side against the caller's session.
  It is never logged, never returned in a response, and never sent back to the
  browser. /sync uses the stored token.
- If Canvas later rejects the stored token (expired or revoked), the stored
  connection is deleted and the student is asked to reconnect.
- DELETE /connection removes the token and connection details immediately.
- Route handlers catch CanvasError and return appropriate HTTP status codes;
  they never surface raw exception messages that might leak internal state.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app import crypto, storage
from app.canvas_client import (
    _validate_canvas_url,
    fetch_assignments,
    fetch_courses,
    validate_connection,
)
from app.canvas_feed import feed_base_url, fetch_feed, parse_feed, validate_feed_url
from app.canvas_models import (
    CanvasConnectRequest,
    CanvasConnectResponse,
    CanvasError,
    CanvasErrorCode,
    CanvasFeedConnectRequest,
    CanvasSyncRequest,
    CanvasSyncResponse,
)
from app.ratelimit import rate_limit
from app.session import require_session

logger = logging.getLogger(__name__)

# Stored credentials carry their kind: a feed link is saved as "feed:<url>", a token as-is.
# Both are encrypted the same way, so no schema change was needed to support feeds.
FEED_PREFIX = "feed:"
router = APIRouter(prefix="/api/v1/canvas", tags=["canvas"])

_ERROR_STATUS: dict[CanvasErrorCode, int] = {
    CanvasErrorCode.INVALID_URL: 422,
    CanvasErrorCode.UNAUTHORIZED: 401,
    CanvasErrorCode.FORBIDDEN: 403,
    CanvasErrorCode.UNREACHABLE: 502,
    CanvasErrorCode.CANVAS_ERROR: 502,
    CanvasErrorCode.INVALID_REQUEST: 400,
    CanvasErrorCode.NOT_CONNECTED: 409,
}


def _canvas_error_response(error: CanvasError) -> JSONResponse:
    return JSONResponse(
        status_code=_ERROR_STATUS.get(error.code, 500),
        content=error.to_response().model_dump(),
    )


def _unexpected() -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"code": "canvas_error", "message": "An unexpected error occurred."},
    )


@router.post(
    "/connect",
    response_model=CanvasConnectResponse,
    summary="Connect Canvas with a personal access token",
    description=(
        "Validates the Canvas URL and token, stores the token encrypted against this "
        "browser session, and returns the student's display name and active courses. "
        "The token is never echoed back."
    ),
)
async def connect_canvas(
    request: CanvasConnectRequest,
    record: storage.SessionRecord = Depends(require_session),
    _: None = Depends(rate_limit("canvas-connect", limit=5, window_seconds=600)),
) -> CanvasConnectResponse | JSONResponse:
    try:
        canvas_url = _validate_canvas_url(request.canvas_url)
        display_name = await validate_connection(canvas_url, request.access_token)
        courses = await fetch_courses(canvas_url, request.access_token)
    except CanvasError as error:
        logger.info("Canvas connect failed: %s", error.code.value)
        return _canvas_error_response(error)
    except Exception:
        logger.exception("Unexpected error during Canvas connect")
        return _unexpected()
    storage.save_canvas_connection(
        record.id_hash, canvas_url, display_name, crypto.encrypt(request.access_token)
    )
    return CanvasConnectResponse(display_name=display_name, canvas_url=canvas_url, courses=courses)


@router.post(
    "/connect-feed",
    response_model=CanvasConnectResponse,
    summary="Connect Canvas with the student's calendar feed link (no token needed)",
    description=(
        "For schools that block personal access tokens. Validates and reads the private "
        "Calendar Feed link, stores it encrypted against this browser session, and returns "
        "the courses that have upcoming assignments. The link is never echoed back."
    ),
)
async def connect_canvas_feed(
    request: CanvasFeedConnectRequest,
    record: storage.SessionRecord = Depends(require_session),
    _: None = Depends(rate_limit("canvas-connect", limit=5, window_seconds=600)),
) -> CanvasConnectResponse | JSONResponse:
    try:
        feed_url = validate_feed_url(request.feed_url)
        parsed = parse_feed(await fetch_feed(feed_url))
    except CanvasError as error:
        logger.info("Canvas feed connect failed: %s", error.code.value)
        return _canvas_error_response(error)
    except Exception:
        logger.exception("Unexpected error during Canvas feed connect")
        return _unexpected()
    display_name = parsed.calendar_name or "your Canvas calendar"
    canvas_url = feed_base_url(feed_url)
    storage.save_canvas_connection(
        record.id_hash, canvas_url, display_name, crypto.encrypt(FEED_PREFIX + feed_url)
    )
    return CanvasConnectResponse(
        display_name=display_name, canvas_url=canvas_url, courses=parsed.courses, method="feed"
    )


@router.get(
    "/courses",
    response_model=CanvasConnectResponse,
    summary="List courses using the stored Canvas connection",
)
async def list_courses(
    record: storage.SessionRecord = Depends(require_session),
    _: None = Depends(rate_limit("canvas-courses", limit=20, window_seconds=600)),
) -> CanvasConnectResponse | JSONResponse:
    try:
        credential = _stored_token(record)
        if credential.startswith(FEED_PREFIX):
            parsed = parse_feed(await fetch_feed(credential[len(FEED_PREFIX) :]))
            return CanvasConnectResponse(
                display_name=record.canvas_display_name or "",
                canvas_url=record.canvas_url or "",
                courses=parsed.courses,
                method="feed",
            )
        courses = await fetch_courses(record.canvas_url or "", credential)
    except CanvasError as error:
        return _handle_stored_token_error(record, error, "courses")
    except Exception:
        logger.exception("Unexpected error listing Canvas courses")
        return _unexpected()
    return CanvasConnectResponse(
        display_name=record.canvas_display_name or "",
        canvas_url=record.canvas_url or "",
        courses=courses,
    )


@router.post(
    "/sync",
    response_model=CanvasSyncResponse,
    summary="Fetch upcoming assignments with the stored Canvas connection",
    description=(
        "Fetches upcoming assignments across all active courses (or a subset if course_ids "
        "is provided) using the token saved at /connect. Completed and graded assignments "
        "are excluded."
    ),
)
async def sync_canvas(
    request: CanvasSyncRequest,
    record: storage.SessionRecord = Depends(require_session),
    _: None = Depends(rate_limit("canvas-sync", limit=20, window_seconds=600)),
) -> CanvasSyncResponse | JSONResponse:
    try:
        token = _stored_token(record)
        canvas_url = record.canvas_url or ""
        if token.startswith(FEED_PREFIX):
            parsed = parse_feed(await fetch_feed(token[len(FEED_PREFIX) :]))
            wanted = set(request.course_ids or [course.id for course in parsed.courses])
            picked = [item for item in parsed.assignments if item.course_id in wanted]
            storage.mark_canvas_synced(record.id_hash)
            return CanvasSyncResponse(
                assignments=picked,
                courses_scanned=len(wanted),
                assignments_found=len(picked),
                busy=parsed.busy,
            )
        assignments = await fetch_assignments(canvas_url, token, request.course_ids)
        courses_scanned = len(request.course_ids) if request.course_ids else None
        if courses_scanned is None:
            courses_scanned = len(await fetch_courses(canvas_url, token))
    except CanvasError as error:
        return _handle_stored_token_error(record, error, "sync")
    except Exception:
        logger.exception("Unexpected error during Canvas sync")
        return _unexpected()
    storage.mark_canvas_synced(record.id_hash)
    return CanvasSyncResponse(
        assignments=assignments,
        courses_scanned=courses_scanned,
        assignments_found=len(assignments),
    )


@router.delete("/connection", status_code=204, summary="Disconnect Canvas and delete the token")
def disconnect_canvas(record: storage.SessionRecord = Depends(require_session)) -> None:
    storage.clear_canvas_connection(record.id_hash)


def _stored_token(record: storage.SessionRecord) -> str:
    if not record.canvas_connected:
        raise CanvasError(
            code=CanvasErrorCode.NOT_CONNECTED,
            message="Canvas isn't connected yet. Connect it first.",
        )
    try:
        return crypto.decrypt(record.canvas_token_enc or "")
    except crypto.CredentialError:
        storage.clear_canvas_connection(record.id_hash)
        raise CanvasError(
            code=CanvasErrorCode.NOT_CONNECTED,
            message="Your saved Canvas connection is no longer valid. Please reconnect.",
        ) from None


def _handle_stored_token_error(
    record: storage.SessionRecord, error: CanvasError, action: str
) -> JSONResponse:
    logger.info("Canvas %s failed: %s", action, error.code.value)
    if error.code == CanvasErrorCode.UNAUTHORIZED:
        # The saved token was revoked or expired; forget it so the UI asks to reconnect.
        storage.clear_canvas_connection(record.id_hash)
        error = CanvasError(
            code=CanvasErrorCode.UNAUTHORIZED,
            message="Canvas no longer accepts your saved connection (the token or feed link "
            "may have been reset). Please reconnect to keep syncing.",
        )
    return _canvas_error_response(error)
