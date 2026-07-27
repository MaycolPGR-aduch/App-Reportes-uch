from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.deps import get_optional_user
from app.core.config import get_settings
from app.core.security import hash_opaque_token
from app.models.auth_session import AuthSession
from app.models.enums import UserStatus

from tests.conftest import FakeSession, make_request

COOKIE_NAME = get_settings().session_cookie_name


def _valid_session(user_id) -> AuthSession:
    return AuthSession(
        id=uuid4(),
        user_id=user_id,
        token_hash=hash_opaque_token("raw-token"),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
    )


def test_returns_none_without_cookie() -> None:
    result = get_optional_user(make_request(), FakeSession())

    assert result is None


def test_returns_none_for_stale_cookie() -> None:
    """Regression: an expired or revoked cookie used to raise 401, which blocked
    anonymous reporting from any browser still holding one."""
    request = make_request({COOKIE_NAME: "expired-or-revoked"})

    result = get_optional_user(request, FakeSession(auth_session=None))

    assert result is None


def test_returns_user_for_valid_session(active_user) -> None:
    request = make_request({COOKIE_NAME: "raw-token"})
    db = FakeSession(auth_session=_valid_session(active_user.id), user=active_user)

    assert get_optional_user(request, db) is active_user


def test_rejects_valid_session_pointing_at_banned_user(active_user) -> None:
    """A banned user must not be silently downgraded to anonymous."""
    active_user.status = UserStatus.INACTIVE
    request = make_request({COOKIE_NAME: "raw-token"})
    db = FakeSession(auth_session=_valid_session(active_user.id), user=active_user)

    with pytest.raises(HTTPException) as exc_info:
        get_optional_user(request, db)

    assert exc_info.value.status_code == 401


def test_rejects_session_whose_user_vanished() -> None:
    request = make_request({COOKIE_NAME: "raw-token"})
    db = FakeSession(auth_session=_valid_session(uuid4()), user=None)

    with pytest.raises(HTTPException) as exc_info:
        get_optional_user(request, db)

    assert exc_info.value.status_code == 401
