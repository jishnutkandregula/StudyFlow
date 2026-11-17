"""Encryption at rest for third-party credentials (currently the Canvas token).

Production must supply STUDYFLOW_SECRET_KEY (a Fernet key). In development a
key is generated once and kept beside the database with owner-only permissions,
so tokens survive API reloads; that convenience is refused in production.
"""

from __future__ import annotations

import logging
import os

from cryptography.fernet import Fernet, InvalidToken

from app.settings import Settings, get_settings

logger = logging.getLogger(__name__)


class CredentialError(Exception):
    """Stored credentials could not be decrypted (e.g. the key changed)."""


def _load_key(settings: Settings) -> bytes:
    if settings.secret_key:
        return settings.secret_key.encode()
    if settings.is_production:
        raise RuntimeError("STUDYFLOW_SECRET_KEY must be set in production.")
    path = settings.dev_key_path
    if path.exists():
        return path.read_bytes().strip()
    path.parent.mkdir(parents=True, exist_ok=True)
    key = Fernet.generate_key()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as handle:
        handle.write(key)
    logger.warning(
        "Generated a development encryption key; set STUDYFLOW_SECRET_KEY for production."
    )
    return key


def _fernet() -> Fernet:
    return Fernet(_load_key(get_settings()))


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except InvalidToken as error:
        raise CredentialError("Stored credential could not be decrypted.") from error
