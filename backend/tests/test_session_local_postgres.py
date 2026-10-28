"""Prueba optativa en PostgreSQL local; toda la escritura se revierte."""

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
from app.models.auth_session import AuthSession
from app.models.enums import UserRole, UserStatus
from app.models.user import User


@pytest.mark.skipif(os.getenv("RUN_LOCAL_PG_SESSION_TEST") != "1", reason="prueba PostgreSQL local optativa")
def test_sesiones_con_postgres_local(monkeypatch):
    if engine.url.host not in {"localhost", "127.0.0.1", "::1"}:
        pytest.fail("La prueba solo admite PostgreSQL local")

    schema = "session_test_" + uuid4().hex
    connection = engine.connect()
    transaction = connection.begin()
    try:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET LOCAL search_path TO "{schema}", public'))
        User.__table__.create(connection)
        AuthSession.__table__.create(connection)

        def get_test_db():
            with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
                yield db

        with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
            db.add_all([
                User(campus_id=code, full_name=code, email=f"{code}@example.edu",
                     password_hash=hash_password("test-password-123"), role=role,
                     status=UserStatus.ACTIVE)
                for code, role in [("admin_test", UserRole.ADMIN), ("student_test", UserRole.STUDENT)]
            ])
            db.commit()

        # La cuota tiene su propia tabla; aquí se prueba exclusivamente la sesión.
        monkeypatch.setattr(auth, "enforce_rate_limit", lambda *args, **kwargs: None)
        app.dependency_overrides[get_db] = get_test_db
        client = TestClient(app, base_url="https://testserver")
        admin = client.post("/api/v1/auth/login", json={"campus_id": "admin_test", "password": "test-password-123"})
        assert admin.status_code == 200
        old_cookie = client.cookies.get("campus_session")
        assert client.get("/api/v1/auth/profile").json()["role"] == "ADMIN"
        assert client.post("/api/v1/auth/logout").status_code == 403
        assert client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": admin.json()["csrf_token"]}).status_code == 200
        assert client.get("/api/v1/auth/me").status_code == 401
        student = client.post("/api/v1/auth/login", json={"campus_id": "student_test", "password": "test-password-123"})
        assert student.status_code == 200
        assert client.get("/api/v1/auth/profile").json()["role"] == "STUDENT"
        stale = TestClient(app, base_url="https://testserver")
        stale.cookies.set("campus_session", old_cookie)
        assert stale.get("/api/v1/auth/me").status_code == 401

        # Un intento fallido conserva la sesión; un cambio exitoso revoca la anterior.
        assert client.post("/api/v1/auth/login", json={"campus_id": "admin_test", "password": "incorrecta"}).status_code == 401
        assert client.get("/api/v1/auth/me").json()["role"] == "STUDENT"
        student_cookie = client.cookies.get("campus_session")
        switched = client.post("/api/v1/auth/login", json={"campus_id": "admin_test", "password": "test-password-123"})
        assert switched.status_code == 200
        assert client.get("/api/v1/auth/me").json()["role"] == "ADMIN"
        stale_student = TestClient(app, base_url="https://testserver")
        stale_student.cookies.set("campus_session", student_cookie)
        assert stale_student.get("/api/v1/auth/me").status_code == 401
    finally:
        app.dependency_overrides.pop(get_db, None)
        transaction.rollback()
        connection.close()
