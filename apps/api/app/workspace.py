"""Saved workspace: the student's coursework, preferences, and current plan.

The workspace is validated on the way in so stored data has a known shape and
bounded size. Calendar event titles are stripped before saving: StudyFlow only
needs *when* someone is busy, not *what* the event is.
"""

from __future__ import annotations

import json
from datetime import date
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app import crypto, storage
from app.planner import BusyTimeBlock, LockedSession
from app.ratelimit import client_ip, limiter, rate_limit
from app.session import COOKIE_NAME, clear_cookie, get_or_create_session, require_session

MAX_WORKSPACE_BYTES = 512 * 1024


class WorkspaceTask(BaseModel):
    id: str = Field(max_length=200)
    title: str = Field(min_length=1, max_length=160)
    course: str = Field(min_length=1, max_length=80)
    due_date: date
    due_time: Optional[str] = Field(default=None, max_length=8)  # noqa: UP045
    estimated_minutes: int = Field(gt=0, le=10_080)
    priority: int = Field(default=3, ge=1, le=5)
    course_weight: float = Field(default=10, gt=0, le=100)
    source: Literal["manual", "canvas", "sample"] = "manual"
    points: Optional[float] = None  # noqa: UP045
    url: Optional[str] = Field(default=None, max_length=1000)  # noqa: UP045


class CompletedTask(BaseModel):
    id: str = Field(max_length=200)
    title: str = Field(max_length=160)
    course: str = Field(max_length=80)


class CalendarMeta(BaseModel):
    busy_events: int = Field(ge=0)
    calendars_scanned: int = Field(ge=0)
    last_synced: str = Field(max_length=40)


class Workspace(BaseModel):
    version: Literal[1] = 1
    tasks: list[WorkspaceTask] = Field(default_factory=list, max_length=500)
    completed: list[CompletedTask] = Field(default_factory=list, max_length=500)
    availability: list[dict[str, Any]] = Field(default_factory=list, max_length=7)
    preferences: dict[str, str] = Field(default_factory=dict)
    protected_blocks: list[dict[str, Any]] = Field(default_factory=list, max_length=50)
    busy_time: list[BusyTimeBlock] = Field(default_factory=list, max_length=2000)
    locked_sessions: list[LockedSession] = Field(default_factory=list, max_length=200)
    blocked_dates: list[date] = Field(default_factory=list, max_length=60)
    calendar: Optional[CalendarMeta] = None  # noqa: UP045
    # The last generated plan, kept so a reload shows the same plan instead of a new one.
    plan: Optional[dict[str, Any]] = None  # noqa: UP045
    plan_key: str = Field(default="", max_length=200_000)


class CanvasStatus(BaseModel):
    canvas_url: str
    display_name: str
    method: Literal["token", "feed"] = "token"
    connected_at: Optional[str] = None  # noqa: UP045
    last_synced: Optional[str] = None  # noqa: UP045


class WorkspaceResponse(BaseModel):
    workspace: Optional[Workspace] = None  # noqa: UP045
    canvas: Optional[CanvasStatus] = None  # noqa: UP045
    saved_at: Optional[str] = None  # noqa: UP045


class SaveResponse(BaseModel):
    saved_at: str


def canvas_status(record: storage.SessionRecord) -> Optional[CanvasStatus]:  # noqa: UP045
    if not record.canvas_connected:
        return None
    try:
        feed = crypto.decrypt(record.canvas_token_enc or "").startswith("feed:")
    except crypto.CredentialError:
        feed = False
    return CanvasStatus(
        canvas_url=record.canvas_url or "",
        display_name=record.canvas_display_name or "",
        method="feed" if feed else "token",
        connected_at=record.canvas_connected_at,
        last_synced=record.canvas_last_synced,
    )


router = APIRouter(prefix="/api/v1/workspace", tags=["workspace"])


@router.get(
    "", response_model=WorkspaceResponse, summary="Load (or start) this browser's workspace"
)
def load_workspace(request: Request, response: Response) -> WorkspaceResponse:
    if not request.cookies.get(COOKIE_NAME):
        # Cap brand-new sessions per IP so the database can't be flooded with empty rows.
        retry_after = limiter.check(f"new-session:{client_ip(request)}", 60, 3600)
        if retry_after is not None:
            raise HTTPException(
                status_code=429,
                detail="Too many new sessions from this network. Try again later.",
                headers={"Retry-After": str(max(1, round(retry_after)))},
            )
    record = get_or_create_session(request, response)
    workspace = Workspace.model_validate(record.workspace) if record.workspace else None
    return WorkspaceResponse(
        workspace=workspace,
        canvas=canvas_status(record),
        saved_at=record.updated_at if record.workspace else None,
    )


@router.put("", response_model=SaveResponse, summary="Save the workspace")
def save_workspace(
    workspace: Workspace,
    record: storage.SessionRecord = Depends(require_session),
    _: None = Depends(rate_limit("workspace-save", limit=120, window_seconds=60)),
) -> SaveResponse:
    for block in workspace.busy_time:
        block.label = "Calendar event"
    payload = workspace.model_dump(mode="json")
    if len(json.dumps(payload)) > MAX_WORKSPACE_BYTES:
        raise HTTPException(status_code=413, detail="Workspace is too large to save.")
    return SaveResponse(saved_at=storage.save_workspace(record.id_hash, payload))


@router.delete("", status_code=204, summary="Delete everything StudyFlow stores for this browser")
def delete_workspace(
    response: Response, record: storage.SessionRecord = Depends(require_session)
) -> Response:
    storage.delete_session(record.id_hash)
    clear_cookie(response)
    response.status_code = 204
    return response
