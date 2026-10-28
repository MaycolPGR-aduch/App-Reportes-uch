from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.v1 import auth
from app.models.enums import UserStatus


class DB:
    def commit(self):
        pass


def test_suspended_account_cannot_be_reactivated_by_verify(monkeypatch):
    user = SimpleNamespace(status=UserStatus.INACTIVE, email_verification_pending=False)
    monkeypatch.setattr(auth, "consume_account_token", lambda *args, **kwargs: user)
    with pytest.raises(HTTPException) as exc:
        auth.verify_email(SimpleNamespace(token="test"), DB())
    assert exc.value.status_code == 400 and user.status == UserStatus.INACTIVE


def test_suspended_account_cannot_reset_password(monkeypatch):
    user = SimpleNamespace(status=UserStatus.INACTIVE, password_hash="old")
    monkeypatch.setattr(auth, "consume_account_token", lambda *args, **kwargs: user)
    with pytest.raises(HTTPException) as exc:
        auth.confirm_password_reset(SimpleNamespace(token="test", password="new"), DB())
    assert exc.value.status_code == 400 and user.password_hash == "old"


def test_reset_revokes_all_sessions(monkeypatch):
    user = SimpleNamespace(id=uuid4(), status=UserStatus.ACTIVE, password_hash="old")
    revoked = []
    monkeypatch.setattr(auth, "consume_account_token", lambda *args, **kwargs: user)
    monkeypatch.setattr(auth, "hash_password", lambda value: "new-hash")
    monkeypatch.setattr(auth, "_revocar_otras_sesiones", lambda db, **kwargs: revoked.append(kwargs))
    auth.confirm_password_reset(SimpleNamespace(token="test", password="new"), DB())
    assert user.password_hash == "new-hash"
    assert revoked == [{"user_id": user.id, "conservar": None}]
