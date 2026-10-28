from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.v1 import auth
from app.db.session import get_db
from app.main import app
from app.models.auth_session import AuthSession
from app.models.enums import UserRole, UserStatus
from app.models.user import User


def test_cambio_de_administrador_a_estudiante_y_revocacion(monkeypatch):
    users = [User(id=uuid4(), campus_id=code, full_name=code, email=f"{code}@example.edu",
                  password_hash="hash", role=role, status=UserStatus.ACTIVE)
             for code, role in [("admin", UserRole.ADMIN), ("student", UserRole.STUDENT)]]
    sessions = []

    class Query:
        def __init__(self, model):
            self.model = model
            self.conditions = []

        def filter(self, *conditions):
            self.conditions.extend(conditions)
            return self

        def first(self):
            values = {getattr(getattr(c, "left", None), "key", ""): getattr(getattr(c, "right", None), "value", None)
                      for c in self.conditions}
            if self.model is User:
                return next((u for u in users if u.campus_id == values.get("campus_id")), None)
            return next((s for s in sessions if s.token_hash == values.get("token_hash")
                         and s.revoked_at is None and s.expires_at > datetime.now(timezone.utc)), None)

    class DB:
        def query(self, model):
            return Query(model)

        def add(self, instance):
            if isinstance(instance, AuthSession):
                sessions.append(instance)

        def commit(self):
            pass

        def get(self, model, identifier):
            return next((u for u in users if u.id == identifier), None)

    monkeypatch.setattr(auth, "enforce_rate_limit", lambda *args, **kwargs: None)
    monkeypatch.setattr(auth, "verify_password", lambda *args: True)
    monkeypatch.setattr(auth, "password_needs_rehash", lambda *args: False)
    app.dependency_overrides[get_db] = lambda: DB()
    try:
        client = TestClient(app, base_url="https://testserver")
        first = client.post("/api/v1/auth/login", json={"campus_id": "admin", "password": "password123"})
        assert first.status_code == 200 and first.json()["role"] == "ADMIN"
        old_cookie = client.cookies.get("campus_session")
        assert client.get("/api/v1/auth/me").json()["role"] == "ADMIN"
        assert client.post("/api/v1/auth/logout").status_code == 403
        assert client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": first.json()["csrf_token"]}).status_code == 200
        assert client.get("/api/v1/auth/me").status_code == 401
        second = client.post("/api/v1/auth/login", json={"campus_id": "student", "password": "password123"})
        assert second.status_code == 200 and client.get("/api/v1/auth/me").json()["role"] == "STUDENT"
        stale = TestClient(app, base_url="https://testserver")
        stale.cookies.set("campus_session", old_cookie)
        assert stale.get("/api/v1/auth/me").status_code == 401

        direct = TestClient(app, base_url="https://testserver")
        assert direct.post("/api/v1/auth/login", json={"campus_id": "admin", "password": "password123"}).status_code == 200
        replaced_cookie = direct.cookies.get("campus_session")
        assert direct.post("/api/v1/auth/login", json={"campus_id": "student", "password": "password123"}).status_code == 200
        assert direct.get("/api/v1/auth/me").json()["role"] == "STUDENT"
        replaced = TestClient(app, base_url="https://testserver")
        replaced.cookies.set("campus_session", replaced_cookie)
        assert replaced.get("/api/v1/auth/me").status_code == 401
    finally:
        app.dependency_overrides.pop(get_db, None)
