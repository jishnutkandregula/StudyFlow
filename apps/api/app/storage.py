"""SQLite persistence for anonymous StudyFlow sessions.

One row per browser session. Only a SHA-256 hash of the session id is stored,
so a database leak cannot be replayed as a cookie. The Canvas token column is
always encrypted (see crypto.py). SQLite keeps local development dependency-free;
the narrow interface below is what a Postgres implementation would replace.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from app.settings import get_settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    id_hash TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    workspace_json TEXT,
    canvas_url TEXT,
    canvas_display_name TEXT,
    canvas_token_enc TEXT,
    canvas_connected_at TEXT,
    canvas_last_synced TEXT
)
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def hash_session_id(session_id: str) -> str:
    return hashlib.sha256(session_id.encode()).hexdigest()


@dataclass
class SessionRecord:
    id_hash: str
    updated_at: str
    workspace: Optional[dict[str, Any]]  # noqa: UP045 -- Python 3.9 runtime
    canvas_url: Optional[str]  # noqa: UP045
    canvas_display_name: Optional[str]  # noqa: UP045
    canvas_token_enc: Optional[str]  # noqa: UP045
    canvas_connected_at: Optional[str]  # noqa: UP045
    canvas_last_synced: Optional[str]  # noqa: UP045

    @property
    def canvas_connected(self) -> bool:
        return bool(self.canvas_token_enc and self.canvas_url)


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    path = get_settings().db_path
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute(_SCHEMA)
        yield connection
        connection.commit()
    finally:
        connection.close()


def create_session(id_hash: str) -> None:
    now = _now()
    with _connect() as db:
        db.execute(
            "INSERT OR IGNORE INTO sessions (id_hash, created_at, updated_at) VALUES (?, ?, ?)",
            (id_hash, now, now),
        )


def get_session(id_hash: str) -> Optional[SessionRecord]:  # noqa: UP045
    with _connect() as db:
        row = db.execute("SELECT * FROM sessions WHERE id_hash = ?", (id_hash,)).fetchone()
    if row is None:
        return None
    return SessionRecord(
        id_hash=row["id_hash"],
        updated_at=row["updated_at"],
        workspace=json.loads(row["workspace_json"]) if row["workspace_json"] else None,
        canvas_url=row["canvas_url"],
        canvas_display_name=row["canvas_display_name"],
        canvas_token_enc=row["canvas_token_enc"],
        canvas_connected_at=row["canvas_connected_at"],
        canvas_last_synced=row["canvas_last_synced"],
    )


def save_workspace(id_hash: str, workspace: dict[str, Any]) -> str:
    now = _now()
    with _connect() as db:
        db.execute(
            "UPDATE sessions SET workspace_json = ?, updated_at = ? WHERE id_hash = ?",
            (json.dumps(workspace, separators=(",", ":")), now, id_hash),
        )
    return now


def save_canvas_connection(
    id_hash: str, canvas_url: str, display_name: str, token_enc: str
) -> str:
    now = _now()
    with _connect() as db:
        db.execute(
            """UPDATE sessions SET canvas_url = ?, canvas_display_name = ?, canvas_token_enc = ?,
               canvas_connected_at = ?, updated_at = ? WHERE id_hash = ?""",
            (canvas_url, display_name, token_enc, now, now, id_hash),
        )
    return now


def mark_canvas_synced(id_hash: str) -> str:
    now = _now()
    with _connect() as db:
        db.execute(
            "UPDATE sessions SET canvas_last_synced = ?, updated_at = ? WHERE id_hash = ?",
            (now, now, id_hash),
        )
    return now


def clear_canvas_connection(id_hash: str) -> None:
    with _connect() as db:
        db.execute(
            """UPDATE sessions SET canvas_url = NULL, canvas_display_name = NULL,
               canvas_token_enc = NULL, canvas_connected_at = NULL, canvas_last_synced = NULL,
               updated_at = ? WHERE id_hash = ?""",
            (_now(), id_hash),
        )


def delete_session(id_hash: str) -> None:
    with _connect() as db:
        db.execute("DELETE FROM sessions WHERE id_hash = ?", (id_hash,))
