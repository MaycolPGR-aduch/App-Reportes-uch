from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import Response
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import generate_opaque_token, hash_opaque_token
from app.models.auth_session import AuthSession
from app.models.user import User


def create_session(db: Session, user: User) -> tuple[str, AuthSession]:
    settings = get_settings()
    token = generate_opaque_token()
    session = AuthSession(
        user_id=user.id,
        token_hash=hash_opaque_token(token),
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_exp_minutes),
    )
    db.add(session)
    return token, session


def set_session_cookies(response: Response, token: str) -> None:
    settings = get_settings()
    max_age = settings.jwt_exp_minutes * 60
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=generate_opaque_token(),
        max_age=max_age,
        httponly=False,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )


def clear_session_cookies(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(settings.session_cookie_name, path="/")
    response.delete_cookie(settings.csrf_cookie_name, path="/")
