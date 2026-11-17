"""Runtime configuration, read from environment variables at call time.

Reading lazily (instead of at import) lets tests point the app at a temporary
database without import-order tricks.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

_API_ROOT = Path(__file__).resolve().parent.parent


@dataclass(frozen=True)
class Settings:
    environment: str
    db_path: Path
    secret_key: str | None
    dev_key_path: Path
    cookie_secure: bool
    allowed_origins: list[str]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


def get_settings() -> Settings:
    db_path = Path(os.environ.get("STUDYFLOW_DB_PATH", _API_ROOT / "studyflow.db"))
    origins = os.environ.get("STUDYFLOW_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    environment = os.environ.get("STUDYFLOW_ENV", "development")
    return Settings(
        environment=environment,
        db_path=db_path,
        secret_key=os.environ.get("STUDYFLOW_SECRET_KEY") or None,
        dev_key_path=db_path.with_name(".studyflow-dev-key"),
        cookie_secure=os.environ.get(
            "STUDYFLOW_COOKIE_SECURE", "true" if environment == "production" else "false"
        ).lower()
        == "true",
        allowed_origins=[origin.strip() for origin in origins.split(",") if origin.strip()],
    )
