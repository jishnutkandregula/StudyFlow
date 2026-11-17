"""Tests for Canvas integration: client validation, models, and route handlers.

All tests use mocked httpx responses; no real Canvas API calls are made.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.canvas_client import _validate_canvas_url, validate_connection
from app.canvas_models import CanvasError, CanvasErrorCode
from app.main import app

# ---------------------------------------------------------------------------
# URL validation
# ---------------------------------------------------------------------------


def test_valid_canvas_url_passes() -> None:
    assert _validate_canvas_url("https://canvas.ucsc.edu") == "https://canvas.ucsc.edu"


def test_trailing_slash_is_stripped() -> None:
    assert _validate_canvas_url("https://canvas.ucsc.edu/") == "https://canvas.ucsc.edu"


def test_http_is_upgraded_to_https() -> None:
    assert _validate_canvas_url("http://canvas.ucsc.edu") == "https://canvas.ucsc.edu"


def test_bare_hostname_gets_https_prepended() -> None:
    assert _validate_canvas_url("canvas.ucsc.edu") == "https://canvas.ucsc.edu"


def test_bare_hostname_with_path_keeps_only_host() -> None:
    assert _validate_canvas_url("  canvas.ucsc.edu/courses/123/ ") == "https://canvas.ucsc.edu"


def test_non_http_scheme_raises() -> None:
    with pytest.raises(CanvasError) as exc_info:
        _validate_canvas_url("ftp://canvas.ucsc.edu")
    assert exc_info.value.code == CanvasErrorCode.INVALID_URL


def test_bare_localhost_still_raises() -> None:
    with pytest.raises(CanvasError) as exc_info:
        _validate_canvas_url("localhost")
    assert exc_info.value.code == CanvasErrorCode.INVALID_URL


def test_bare_private_ip_still_raises() -> None:
    with pytest.raises(CanvasError) as exc_info:
        _validate_canvas_url("10.0.0.5")
    assert exc_info.value.code == CanvasErrorCode.INVALID_URL


def test_localhost_raises() -> None:
    with pytest.raises(CanvasError) as exc_info:
        _validate_canvas_url("https://localhost/canvas")
    assert exc_info.value.code == CanvasErrorCode.INVALID_URL


def test_private_ip_raises() -> None:
    with pytest.raises(CanvasError) as exc_info:
        _validate_canvas_url("https://192.168.1.1/api")
    assert exc_info.value.code == CanvasErrorCode.INVALID_URL


def test_loopback_ip_raises() -> None:
    with pytest.raises(CanvasError) as exc_info:
        _validate_canvas_url("https://127.0.0.1")
    assert exc_info.value.code == CanvasErrorCode.INVALID_URL


def test_public_ip_literal_raises() -> None:
    with pytest.raises(CanvasError) as exc_info:
        _validate_canvas_url("https://8.8.8.8")
    assert exc_info.value.code == CanvasErrorCode.INVALID_URL


def test_hostname_without_dot_raises() -> None:
    with pytest.raises(CanvasError) as exc_info:
        _validate_canvas_url("https://canvaslocal")
    assert exc_info.value.code == CanvasErrorCode.INVALID_URL


# ---------------------------------------------------------------------------
# Connection validation (mocked HTTP)
# ---------------------------------------------------------------------------


def _make_response(status_code: int, body: dict) -> MagicMock:
    response = MagicMock()
    response.status_code = status_code
    response.is_success = 200 <= status_code < 300
    response.json.return_value = body
    return response


@pytest.mark.asyncio
async def test_validate_connection_success() -> None:
    mock_response = _make_response(200, {"name": "Jishnu Kandregula"})
    with patch("app.canvas_client.httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client
        name = await validate_connection("https://canvas.ucsc.edu", "fake-token")
    assert name == "Jishnu Kandregula"


@pytest.mark.asyncio
async def test_validate_connection_unauthorized() -> None:
    mock_response = _make_response(401, {"errors": [{"message": "Invalid access token."}]})
    with patch("app.canvas_client.httpx.AsyncClient") as mock_client_class:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_class.return_value = mock_client
        with pytest.raises(CanvasError) as exc_info:
            await validate_connection("https://canvas.ucsc.edu", "bad-token")
    assert exc_info.value.code == CanvasErrorCode.UNAUTHORIZED


# ---------------------------------------------------------------------------
# API route tests
# ---------------------------------------------------------------------------


def _connect_payload(url: str = "https://canvas.example.edu", token: str = "tok") -> dict:
    return {"canvas_url": url, "access_token": token}


def _connect(client, token: str = "valid-token"):
    from app.canvas_models import CanvasCourse

    with (
        patch("app.canvas_routes.validate_connection", new_callable=AsyncMock) as mock_validate,
        patch("app.canvas_routes.fetch_courses", new_callable=AsyncMock) as mock_courses,
    ):
        mock_validate.return_value = "Test Student"
        mock_courses.return_value = [
            CanvasCourse(id="1", name="CSE 101", course_code="CSE101"),
            CanvasCourse(id="2", name="STAT 131", course_code="STAT131"),
        ]
        return client.post("/api/v1/canvas/connect", json=_connect_payload(token=token))


def test_connect_requires_session_and_header() -> None:
    no_session = TestClient(app, headers={"X-StudyFlow-Request": "1"})
    assert no_session.post("/api/v1/canvas/connect", json=_connect_payload()).status_code == 401

    no_header = TestClient(app)
    no_header.get("/api/v1/workspace")
    assert no_header.post("/api/v1/canvas/connect", json=_connect_payload()).status_code == 403


def test_connect_invalid_url_returns_422(session_client) -> None:
    response = session_client.post(
        "/api/v1/canvas/connect", json=_connect_payload("https://localhost")
    )
    assert response.status_code == 422
    assert response.json()["code"] == CanvasErrorCode.INVALID_URL.value


def test_connect_success_stores_token_encrypted_and_never_returns_it(session_client) -> None:
    from app import storage
    from app.session import COOKIE_NAME

    response = _connect(session_client)
    assert response.status_code == 200
    body = response.json()
    assert body["display_name"] == "Test Student"
    assert body["canvas_url"] == "https://canvas.example.edu"
    assert len(body["courses"]) == 2
    assert "valid-token" not in json.dumps(body)

    record = storage.get_session(
        storage.hash_session_id(session_client.cookies.get(COOKIE_NAME))
    )
    assert record.canvas_connected
    assert "valid-token" not in record.canvas_token_enc  # encrypted at rest

    workspace = session_client.get("/api/v1/workspace").json()
    assert workspace["canvas"]["display_name"] == "Test Student"
    assert "valid-token" not in json.dumps(workspace)


def test_connect_unauthorized_returns_401_and_stores_nothing(session_client) -> None:
    with patch("app.canvas_routes.validate_connection", new_callable=AsyncMock) as mock_validate:
        mock_validate.side_effect = CanvasError(
            code=CanvasErrorCode.UNAUTHORIZED, message="Bad token."
        )
        response = session_client.post("/api/v1/canvas/connect", json=_connect_payload())
    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"
    assert session_client.get("/api/v1/workspace").json()["canvas"] is None


def test_sync_without_connection_returns_409(session_client) -> None:
    response = session_client.post("/api/v1/canvas/sync", json={})
    assert response.status_code == 409
    assert response.json()["code"] == "not_connected"


def test_sync_uses_stored_token_and_records_last_sync(session_client) -> None:
    from app.canvas_models import CanvasAssignment, CanvasCourse

    _connect(session_client, token="stored-token")
    with (
        patch("app.canvas_routes.fetch_assignments", new_callable=AsyncMock) as mock_assignments,
        patch("app.canvas_routes.fetch_courses", new_callable=AsyncMock) as mock_courses,
    ):
        mock_assignments.return_value = [
            CanvasAssignment(
                id="99",
                course_id="1",
                title="Lab 4",
                due_at="2026-11-19T23:59:00Z",
                points_possible=100.0,
            )
        ]
        mock_courses.return_value = [CanvasCourse(id="1", name="CSE 101", course_code="CSE101")]
        response = session_client.post("/api/v1/canvas/sync", json={})
    assert response.status_code == 200
    body = response.json()
    assert body["assignments_found"] == 1
    assert body["assignments"][0]["title"] == "Lab 4"
    assert mock_assignments.call_args.args[1] == "stored-token"
    assert "stored-token" not in json.dumps(body)
    assert session_client.get("/api/v1/workspace").json()["canvas"]["last_synced"]


def test_sync_paginated_response(session_client) -> None:
    """Multiple assignments from multiple courses are all returned."""
    from app.canvas_models import CanvasAssignment

    _connect(session_client)
    with patch("app.canvas_routes.fetch_assignments", new_callable=AsyncMock) as mock_assignments:
        mock_assignments.return_value = [
            CanvasAssignment(id=str(i), course_id="1", title=f"Assignment {i}")
            for i in range(12)
        ]
        response = session_client.post("/api/v1/canvas/sync", json={"course_ids": ["1"]})
    assert response.status_code == 200
    assert response.json()["assignments_found"] == 12
    assert response.json()["courses_scanned"] == 1


def test_revoked_token_clears_connection(session_client) -> None:
    _connect(session_client)
    with patch("app.canvas_routes.fetch_assignments", new_callable=AsyncMock) as mock_assignments:
        mock_assignments.side_effect = CanvasError(
            code=CanvasErrorCode.UNAUTHORIZED, message="Invalid access token."
        )
        response = session_client.post("/api/v1/canvas/sync", json={})
    assert response.status_code == 401
    assert "reconnect" in response.json()["message"]
    assert session_client.get("/api/v1/workspace").json()["canvas"] is None


def test_disconnect_deletes_connection(session_client) -> None:
    _connect(session_client)
    assert session_client.delete("/api/v1/canvas/connection").status_code == 204
    assert session_client.get("/api/v1/workspace").json()["canvas"] is None
    assert session_client.post("/api/v1/canvas/sync", json={}).status_code == 409
