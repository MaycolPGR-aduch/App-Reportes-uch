from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Any
from uuid import UUID

from app.core.config import get_settings


def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _base64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(message: bytes, secret: str) -> str:
    digest = hmac.new(secret.encode("utf-8"), message, hashlib.sha256).digest()
    return _base64url_encode(digest)


def hash_password(password: str) -> str:
    if not password or len(password) < 8:
        raise ValueError("Password must be at least 8 characters long")

    iterations = 100_000
    salt = os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations,
    ).hex()
    return f"pbkdf2_sha256${iterations}${salt}${digest}"


def verify_password(password: str, stored_hash: str) -> bool:
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


def create_access_token(*, user_id: UUID, campus_id: str, role: str) -> str:
    settings = get_settings()
    now = int(time.time())
    payload = {
        "sub": str(user_id),
        "campus_id": campus_id,
        "role": role,
        "iat": now,
        "exp": now + settings.jwt_exp_minutes * 60,
    }

    header = {"alg": "HS256", "typ": "JWT"}
    header_segment = _base64url_encode(
        json.dumps(header, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    payload_segment = _base64url_encode(
        json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signature = _sign(
        f"{header_segment}.{payload_segment}".encode("utf-8"), settings.jwt_secret
    )
    return f"{header_segment}.{payload_segment}.{signature}"


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()

    try:
        header_segment, payload_segment, signature_segment = token.split(".")
    except ValueError as exc:
        raise ValueError("Malformed token") from exc

    expected_signature = _sign(
        f"{header_segment}.{payload_segment}".encode("utf-8"), settings.jwt_secret
    )
    if not hmac.compare_digest(signature_segment, expected_signature):
        raise ValueError("Invalid token signature")

    try:
        header = json.loads(_base64url_decode(header_segment))
        payload = json.loads(_base64url_decode(payload_segment))
    except (json.JSONDecodeError, ValueError) as exc:
        raise ValueError("Invalid token encoding") from exc

    if header.get("alg") != "HS256":
        raise ValueError("Unsupported JWT algorithm")

    if int(payload.get("exp", 0)) <= int(time.time()):
        raise ValueError("Token expired")

    return payload

