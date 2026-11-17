from datetime import timedelta

import pytest
from fastapi.testclient import TestClient

from app import storage
from app.main import app
from app.settings import get_settings


def test_readiness_reports_database_health() -> None:
    client = TestClient(app)
    assert client.get("/health/ready").json() == {"status": "ready"}


def test_readiness_returns_503_when_database_fails(monkeypatch) -> None:
    def broken() -> None:
        raise RuntimeError("db down")

    monkeypatch.setattr(storage, "ping", broken)
    response = TestClient(app).get("/health/ready")
    assert response.status_code == 503


def test_production_refuses_unsafe_configuration(monkeypatch) -> None:
    monkeypatch.setenv("STUDYFLOW_ENV", "production")
    monkeypatch.delenv("STUDYFLOW_SECRET_KEY", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("STUDYFLOW_ALLOWED_ORIGINS", raising=False)

    problems = get_settings().production_problems()
    assert any("STUDYFLOW_SECRET_KEY" in p for p in problems)
    assert any("DATABASE_URL" in p for p in problems)
    assert any("STUDYFLOW_ALLOWED_ORIGINS" in p for p in problems)
    with pytest.raises(RuntimeError, match="Unsafe production configuration"):
        with TestClient(app):
            pass


def test_production_configuration_passes_when_complete(monkeypatch) -> None:
    monkeypatch.setenv("STUDYFLOW_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql://example")
    monkeypatch.setenv("STUDYFLOW_ALLOWED_ORIGINS", "https://studyflow.example")
    assert get_settings().production_problems() == []
    assert get_settings().cookie_secure is True


def test_production_rejects_plain_http_origins(monkeypatch) -> None:
    monkeypatch.setenv("STUDYFLOW_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "postgresql://example")
    monkeypatch.setenv("STUDYFLOW_ALLOWED_ORIGINS", "http://studyflow.example")
    assert any("https://" in p for p in get_settings().production_problems())


def test_canvas_connect_is_rate_limited(session_client) -> None:
    payload = {"canvas_url": "https://localhost", "access_token": "x"}
    codes = [
        session_client.post("/api/v1/canvas/connect", json=payload).status_code for _ in range(6)
    ]
    assert codes[:5] == [422] * 5
    assert codes[5] == 429


def test_idle_sessions_are_purged(session_client) -> None:
    assert storage.purge_idle_sessions(timedelta(days=180)) == 0
    assert storage.purge_idle_sessions(timedelta(seconds=-1)) == 1
    assert session_client.put("/api/v1/workspace", json={}).status_code == 401
