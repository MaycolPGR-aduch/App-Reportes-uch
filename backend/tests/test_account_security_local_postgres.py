"""Verificación de cuenta y sesiones en un esquema PostgreSQL reversible."""
import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.v1 import auth
from app.core.security import hash_password
from app.db.session import engine, get_db
from app.main import app
from app.models.account_token import AccountToken
from app.models.auth_session import AuthSession
from app.models.enums import UserRole, UserStatus
from app.models.user import User
from app.services.accounts import issue_account_token


@pytest.mark.skipif(os.getenv("RUN_LOCAL_PG_HARDENING_TEST") != "1", reason="prueba PostgreSQL local optativa")
def test_verificacion_suspension_y_recuperacion(monkeypatch):
    if engine.url.host not in {"localhost", "127.0.0.1", "::1"}:
        pytest.fail("La prueba solo admite PostgreSQL local")
    schema = "account_test_" + uuid4().hex
    connection = engine.connect()
    transaction = connection.begin()
    try:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET LOCAL search_path TO "{schema}", public'))
        for model in (User, AuthSession, AccountToken):
            model.__table__.create(connection, checkfirst=False)

        def get_test_db():
            with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
                yield db

        with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
            active = User(campus_id="active", full_name="Active", email="active@example.edu",
                          password_hash=hash_password("password123"), role=UserRole.STUDENT,
                          status=UserStatus.ACTIVE, email_verification_pending=False)
            suspended = User(campus_id="suspended", full_name="Suspended", email="suspended@example.edu",
                             password_hash=hash_password("password123"), role=UserRole.STUDENT,
                             status=UserStatus.INACTIVE, email_verification_pending=False)
            pending = User(campus_id="pending", full_name="Pending", email="pending@example.edu",
                           password_hash=hash_password("password123"), role=UserRole.STUDENT,
                           status=UserStatus.INACTIVE, email_verification_pending=True)
            db.add_all([active, suspended, pending])
            db.flush()
            active_reset = issue_account_token(db, user=active, purpose="RESET_PASSWORD")
            suspended_reset = issue_account_token(db, user=suspended, purpose="RESET_PASSWORD")
            suspended_verify = issue_account_token(db, user=suspended, purpose="VERIFY_EMAIL")
            pending_verify = issue_account_token(db, user=pending, purpose="VERIFY_EMAIL")
            db.commit()

        app.dependency_overrides[get_db] = get_test_db
        monkeypatch.setattr(auth, "enforce_rate_limit", lambda *args, **kwargs: None)
        client = TestClient(app, base_url="https://testserver")
        login = client.post("/api/v1/auth/login", json={"campus_id": "active", "password": "password123"})
        assert login.status_code == 200
        # Usar un cliente sin cookie evita añadir CSRF al flujo de recuperación pública.
        public = TestClient(app, base_url="https://testserver")
        assert public.post("/api/v1/auth/password-reset/confirm", json={"token": suspended_reset, "password": "newpass123"}).status_code == 400
        assert public.post("/api/v1/auth/verify-email", json={"token": suspended_verify}).status_code == 400
        assert public.post("/api/v1/auth/verify-email", json={"token": pending_verify}).status_code == 200
        assert public.post("/api/v1/auth/verify-email", json={"token": pending_verify}).status_code == 400
        assert public.post("/api/v1/auth/password-reset/confirm", json={"token": active_reset, "password": "newpass123"}).status_code == 200
        assert client.get("/api/v1/auth/me").status_code == 401
    finally:
        app.dependency_overrides.pop(get_db, None)
        transaction.rollback()
        connection.close()
