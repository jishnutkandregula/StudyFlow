import os

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(autouse=True)
def isolated_storage(tmp_path, monkeypatch):
    """Every test gets a clean database and its own encryption key.

    Set STUDYFLOW_TEST_DATABASE_URL to run the whole suite against Postgres (CI does);
    otherwise each test uses a fresh SQLite file.
    """
    monkeypatch.setenv("STUDYFLOW_SECRET_KEY", Fernet.generate_key().decode())
    postgres_url = os.environ.get("STUDYFLOW_TEST_DATABASE_URL")
    if postgres_url:
        monkeypatch.setenv("DATABASE_URL", postgres_url)
        from app import storage

        with storage._connect() as db:
            db.execute("DELETE FROM sessions")
    else:
        monkeypatch.delenv("DATABASE_URL", raising=False)
        monkeypatch.setenv("STUDYFLOW_DB_PATH", str(tmp_path / "test.db"))
    yield


@pytest.fixture
def session_client() -> TestClient:
    """A client that has started a session and sends the CSRF header."""
    client = TestClient(app, headers={"X-StudyFlow-Request": "1"})
    assert client.get("/api/v1/workspace").status_code == 200
    return client


@pytest.fixture(autouse=True)
def reset_rate_limits():
    from app.ratelimit import limiter

    limiter.reset()
    yield
