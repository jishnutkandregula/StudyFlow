import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(autouse=True)
def isolated_storage(tmp_path, monkeypatch):
    """Every test gets its own database and encryption key."""
    monkeypatch.setenv("STUDYFLOW_DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("STUDYFLOW_SECRET_KEY", Fernet.generate_key().decode())
    yield


@pytest.fixture
def session_client() -> TestClient:
    """A client that has started a session and sends the CSRF header."""
    client = TestClient(app, headers={"X-StudyFlow-Request": "1"})
    assert client.get("/api/v1/workspace").status_code == 200
    return client
