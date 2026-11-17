"""FastAPI route handlers for Canvas LMS integration.

Security contract
-----------------
- Access tokens arrive in the POST body over HTTPS and are used for the
  duration of the request only. They are never logged, never stored, and
  never included in any response.
- Route handlers catch CanvasError and return appropriate HTTP status codes;
  they never surface raw exception messages that might leak internal state.
- Input validation is handled by Pydantic models in canvas_models.py.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.canvas_client import fetch_assignments, fetch_courses, validate_connection
from app.canvas_models import (
    CanvasAssignmentsRequest,
    CanvasConnectRequest,
    CanvasConnectResponse,
    CanvasError,
    CanvasErrorCode,
    CanvasSyncResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/canvas", tags=["canvas"])

_ERROR_STATUS: dict[CanvasErrorCode, int] = {
    CanvasErrorCode.INVALID_URL: 422,
    CanvasErrorCode.UNAUTHORIZED: 401,
    CanvasErrorCode.FORBIDDEN: 403,
    CanvasErrorCode.UNREACHABLE: 502,
    CanvasErrorCode.CANVAS_ERROR: 502,
    CanvasErrorCode.INVALID_REQUEST: 400,
}


def _canvas_error_response(error: CanvasError) -> JSONResponse:
    return JSONResponse(
        status_code=_ERROR_STATUS.get(error.code, 500),
        content=error.to_response().model_dump(),
    )


@router.post(
    "/connect",
    response_model=CanvasConnectResponse,
    summary="Validate Canvas URL and personal access token",
    description=(
        "Validates the Canvas instance URL and personal access token, then returns the "
        "student's display name and their active courses. The token is used only for this "
        "request and is not stored or echoed back."
    ),
)
async def connect_canvas(request: CanvasConnectRequest) -> CanvasConnectResponse | JSONResponse:
    try:
        display_name = await validate_connection(request.canvas_url, request.access_token)
        courses = await fetch_courses(request.canvas_url, request.access_token)
    except CanvasError as error:
        logger.info("Canvas connect failed: %s", error.code.value)
        return _canvas_error_response(error)
    except Exception:
        logger.exception("Unexpected error during Canvas connect")
        return JSONResponse(
            status_code=500,
            content={"code": "canvas_error", "message": "An unexpected error occurred."},
        )
    return CanvasConnectResponse(
        display_name=display_name,
        canvas_url=request.canvas_url.strip().rstrip("/"),
        courses=courses,
    )


@router.post(
    "/sync",
    response_model=CanvasSyncResponse,
    summary="Fetch upcoming assignments from Canvas",
    description=(
        "Fetches upcoming assignments across all active courses (or a subset if course_ids "
        "is provided). The token is used only for this request. Completed and graded "
        "assignments are excluded."
    ),
)
async def sync_canvas(request: CanvasAssignmentsRequest) -> CanvasSyncResponse | JSONResponse:
    try:
        assignments = await fetch_assignments(
            request.canvas_url,
            request.access_token,
            request.course_ids,
        )
        courses_scanned = len(request.course_ids) if request.course_ids else None
        if courses_scanned is None:
            courses = await fetch_courses(request.canvas_url, request.access_token)
            courses_scanned = len(courses)
    except CanvasError as error:
        logger.info("Canvas sync failed: %s", error.code.value)
        return _canvas_error_response(error)
    except Exception:
        logger.exception("Unexpected error during Canvas sync")
        return JSONResponse(
            status_code=500,
            content={"code": "canvas_error", "message": "An unexpected error occurred."},
        )
    return CanvasSyncResponse(
        assignments=assignments,
        courses_scanned=courses_scanned,
        assignments_found=len(assignments),
    )
