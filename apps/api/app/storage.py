"""Persistence for anonymous StudyFlow sessions (SQLite locally, Postgres in production).

One row per browser session. Only a SHA-256 hash of the session id is stored,
so a database leak cannot be replayed as a cookie. The Canvas token column is
always encrypted (see crypto.py).

The backend is chosen by configuration: DATABASE_URL selects Postgres (pooled
connections via psycopg 3); otherwise a local SQLite file is used. Both share
the same SQL, written in the common subset (ON CONFLICT, TEXT columns), with
"?" placeholders translated for psycopg.
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.settings import get_settings

_pools: dict[str, Any] = {}

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


class _Db:
    """A minimal cursor facade so call sites don't care which database is underneath."""

    def __init__(self, connection: Any, postgres: bool) -> None:
        self._connection = connection
        self._postgres = postgres

    def execute(self, sql: str, params: tuple[Any, ...] = ()) -> Any:
        if self._postgres:
            sql = sql.replace("?", "%s")
        return self._connection.execute(sql, params)


def _postgres_pool(url: str) -> Any:
    pool = _pools.get(url)
    if pool is None:
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool

        pool = ConnectionPool(
            url,
            min_size=1,
            max_size=5,
            kwargs={"row_factory": dict_row},
            open=True,
        )
        with pool.connection() as connection:
            connection.execute(_SCHEMA)
        _pools[url] = pool
    return pool


@contextmanager
def _connect() -> Iterator[_Db]:
    settings = get_settings()
    if settings.database_url:
        with _postgres_pool(settings.database_url).connection() as connection:
            # The pool commits on clean exit and rolls back on error.
            yield _Db(connection, postgres=True)
        return

    path = settings.db_path
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        connection.execute(_SCHEMA)
        yield _Db(connection, postgres=False)
        connection.commit()
    finally:
        connection.close()


def ping() -> None:
    """Raise if the database can't answer a trivial query (used by readiness checks)."""

    with _connect() as db:
        db.execute("SELECT 1").fetchone()


def purge_idle_sessions(max_idle: timedelta) -> int:
    """Delete sessions untouched for longer than `max_idle`; returns how many were removed."""

    cutoff = (datetime.now(timezone.utc) - max_idle).isoformat(timespec="seconds")
    with _connect() as db:
        result = db.execute("DELETE FROM sessions WHERE updated_at < ?", (cutoff,))
        return result.rowcount or 0


def create_session(id_hash: str) -> None:
    now = _now()
    with _connect() as db:
        db.execute(
            "INSERT INTO sessions (id_hash, created_at, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT (id_hash) DO NOTHING",
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
