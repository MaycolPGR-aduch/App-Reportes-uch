from __future__ import annotations

from uuid import UUID

from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_opaque_token
from app.db.session import get_db
from app.models.enums import UserRole, UserStatus
from app.models.auth_session import AuthSession
from app.models.user import User

def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    settings = get_settings()
    token = request.cookies.get(settings.session_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    session = (
        db.query(AuthSession)
        .filter(
            AuthSession.token_hash == hash_opaque_token(token),
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    user = db.get(User, session.user_id) if session else None
    if user is None or user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive or unknown user",
        )
    return user


def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return current_user


def get_current_staff(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.STAFF:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff role required",
        )
    return current_user


def get_optional_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    session_token = request.cookies.get(get_settings().session_cookie_name)
    if session_token is None:
        return None
    session = (
        db.query(AuthSession)
        .filter(
            AuthSession.token_hash == hash_opaque_token(session_token),
            AuthSession.revoked_at.is_(None),
            AuthSession.expires_at > datetime.now(timezone.utc),
        )
        .first()
    )
    if session is None:
        # A stale cookie (expired or revoked) must not block the anonymous flow.
        # The request continues unauthenticated, so rate limiting and Turnstile
        # still apply to it.
        return None
    user = db.get(User, session.user_id)
    if user is None or user.status != UserStatus.ACTIVE:
        # A valid session pointing at a banned user is a deliberate signal and
        # must not be silently downgraded to anonymous.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive or unknown user",
        )
    return user
