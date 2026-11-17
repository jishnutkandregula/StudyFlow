from fastapi.testclient import TestClient

from app.main import app
from app.session import COOKIE_NAME


def _workspace(**extra: object) -> dict:
    return {
        "tasks": [
            {
                "id": "canvas-1",
                "title": "Lab 5",
                "course": "CSE 101",
                "due_date": "2026-11-18",
                "due_time": "23:59:00",
                "estimated_minutes": 90,
                "source": "canvas",
                "points": 50,
            }
        ],
        "preferences": {"sleep_start": "23:00:00"},
        "busy_time": [
            {"date": "2026-11-17", "start_time": "10:00:00", "end_time": "11:00:00",
             "label": "Therapy appointment"}
        ],
        **extra,
    }


def test_first_load_starts_a_session_with_secure_cookie_flags() -> None:
    client = TestClient(app)
    response = client.get("/api/v1/workspace")
    assert response.status_code == 200
    assert response.json() == {"workspace": None, "canvas": None, "saved_at": None}
    cookie = response.headers["set-cookie"]
    assert COOKIE_NAME in cookie and "HttpOnly" in cookie and "SameSite=lax" in cookie


def test_workspace_round_trips_and_strips_calendar_titles(session_client) -> None:
    saved = session_client.put("/api/v1/workspace", json=_workspace())
    assert saved.status_code == 200 and saved.json()["saved_at"]

    loaded = session_client.get("/api/v1/workspace").json()
    assert loaded["workspace"]["tasks"][0]["title"] == "Lab 5"
    assert loaded["workspace"]["busy_time"][0]["label"] == "Calendar event"
    assert "Therapy" not in str(loaded)


def test_sessions_are_isolated(session_client) -> None:
    session_client.put("/api/v1/workspace", json=_workspace())
    other = TestClient(app)
    assert other.get("/api/v1/workspace").json()["workspace"] is None


def test_save_requires_header_and_rejects_invalid_data(session_client) -> None:
    no_header = TestClient(app, cookies={COOKIE_NAME: session_client.cookies.get(COOKIE_NAME)})
    assert no_header.put("/api/v1/workspace", json=_workspace()).status_code == 403

    bad = _workspace()
    bad["tasks"][0]["estimated_minutes"] = -5
    assert session_client.put("/api/v1/workspace", json=bad).status_code == 422


def test_delete_removes_everything_and_clears_cookie(session_client) -> None:
    session_client.put("/api/v1/workspace", json=_workspace())
    response = session_client.delete("/api/v1/workspace")
    assert response.status_code == 204
    assert COOKIE_NAME in response.headers.get("set-cookie", "")
    # The old session is gone: a fresh load starts empty.
    fresh = TestClient(app)
    assert fresh.get("/api/v1/workspace").json()["workspace"] is None
