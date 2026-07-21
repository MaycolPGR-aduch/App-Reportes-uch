from __future__ import annotations

import hashlib
import hmac
import os
import secrets

from app.core.config import get_settings
from cryptography.exceptions import InvalidKey
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id


def hash_password(password: str) -> str:
    if not password or len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")

    salt = os.urandom(16)
    kdf = Argon2id(
        salt=salt,
        length=32,
        iterations=3,
        lanes=4,
        memory_cost=64 * 1024,
    )
    return kdf.derive_phc_encoded(password.encode("utf-8"))


def verify_password(password: str, stored_hash: str) -> bool:
    if stored_hash.startswith("$argon2id$"):
        try:
            Argon2id.verify_phc_encoded(password.encode("utf-8"), stored_hash)
            return True
        except (InvalidKey, ValueError, TypeError):
            return False
    try:
        algorithm, iter_raw, salt, expected_digest = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(iter_raw),
        ).hex()
        return hmac.compare_digest(digest, expected_digest)
    except (ValueError, TypeError):
        return False


def password_needs_rehash(stored_hash: str) -> bool:
    """PBKDF2 records are transparently upgraded after a successful login."""
    return not stored_hash.startswith("$argon2id$")


def generate_opaque_token() -> str:
    return secrets.token_urlsafe(48)


def hash_opaque_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
