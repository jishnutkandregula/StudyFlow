"""Anonymous browser sessions carried in an httpOnly cookie.

- GET /api/v1/workspace is the only route that creates a session.
- Every other session route requires an existing session, and every state-changing
  request must send the `X-StudyFlow-Request: 1` header. Browsers can't add custom
  headers to cross-site requests without a CORS preflight, which our CORS policy
  refuses for unknown origins, so this blocks cross-site request forgery.
"""

from __future__ import annotations

import secrets

from fastapi import HTTPException, Request, Response

from app import storage
from app.settings import get_settings

COOKIE_NAME = "sf_session"
CSRF_HEADER = "X-StudyFlow-Request"
_MAX_AGE = 60 * 60 * 24 * 180  # 180 days


def _set_cookie(response: Response, session_id: str) -> None:
    response.set_cookie(
        COOKIE_NAME,
        session_id,
        max_age=_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=get_settings().cookie_secure,
        path="/",
    )


def clear_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def get_or_create_session(request: Request, response: Response) -> storage.SessionRecord:
    """Resolve the caller's session, starting a new one if needed."""

    session_id = request.cookies.get(COOKIE_NAME)
    if session_id:
        record = storage.get_session(storage.hash_session_id(session_id))
        if record is not None:
            return record
    session_id = secrets.token_urlsafe(32)
    id_hash = storage.hash_session_id(session_id)
    storage.create_session(id_hash)
    _set_cookie(response, session_id)
    record = storage.get_session(id_hash)
    assert record is not None
    return record


def require_session(request: Request) -> storage.SessionRecord:
    """Resolve an existing session for a state-changing request, or reject it."""

    if request.method not in {"GET", "HEAD", "OPTIONS"} and request.headers.get(CSRF_HEADER) != "1":
        raise HTTPException(status_code=403, detail="Missing request header.")
    session_id = request.cookies.get(COOKIE_NAME)
    record = storage.get_session(storage.hash_session_id(session_id)) if session_id else None
    if record is None:
        raise HTTPException(
            status_code=401, detail="Your StudyFlow session expired. Reload the page."
        )
    return record
