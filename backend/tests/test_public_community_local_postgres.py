"""Prueba optativa de privacidad comunitaria en un esquema local reversible."""
import os
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.v1 import auth, reports
from app.core.security import hash_password
from app.db.session import engine, get_db
from app.main import app
from app.models.auth_session import AuthSession
from app.models.campus_zone import CampusZone
from app.models.community_reaction import CommunityReaction
from app.models.enums import IncidentCategory, IncidentStatus, PriorityLevel, UserRole, UserStatus
from app.models.evidence import IncidentEvidence
from app.models.incident import Incident
from app.models.location import IncidentLocation
from app.models.user import User


@pytest.mark.skipif(os.getenv("RUN_LOCAL_PG_COMMUNITY_TEST") != "1", reason="prueba PostgreSQL local optativa")
def test_mural_publico_y_privacidad(monkeypatch):
    if engine.url.host not in {"localhost", "127.0.0.1", "::1"}:
        pytest.fail("La prueba solo admite PostgreSQL local")
    schema = "community_test_" + uuid4().hex
    connection = engine.connect()
    transaction = connection.begin()
    try:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET LOCAL search_path TO "{schema}", public'))
        for model in (User, AuthSession, CampusZone, Incident, IncidentLocation, IncidentEvidence, CommunityReaction):
            # No usar checkfirst: detectaría también tablas existentes en public.
            model.__table__.create(connection, checkfirst=False)
        author, reader, visible, hidden, no_consent, rejected = [uuid4() for _ in range(6)]
        for user_id, code in [(author, "author"), (reader, "reader")]:
            connection.execute(User.__table__.insert().values(id=user_id, campus_id=code, full_name=code,
                email=f"{code}@example.edu", password_hash=hash_password("test-password-123"),
                role=UserRole.STUDENT, status=UserStatus.ACTIVE))
        for incident_id, consent, published, incident_status in [
            (visible, True, True, IncidentStatus.REPORTED),
            (hidden, True, False, IncidentStatus.REPORTED),
            (no_consent, False, True, IncidentStatus.REPORTED),
            (rejected, True, True, IncidentStatus.REJECTED),
        ]:
            connection.execute(Incident.__table__.insert().values(id=incident_id, reporter_id=author,
                description="Incidencia de prueba", created_by="author", category=IncidentCategory.SECURITY,
                status=incident_status, priority=PriorityLevel.MEDIUM, community_consent=consent,
                is_community_visible=published))
            connection.execute(IncidentEvidence.__table__.insert().values(id=uuid4(), incident_id=incident_id,
                storage_path="test-image", mime_type="image/png", file_size_bytes=4, sha256_hash="a" * 64))
        connection.execute(IncidentLocation.__table__.insert().values(id=uuid4(), incident_id=visible,
            latitude=-12.0, longitude=-77.0, reference="privada", resolved_zone_name="Zona A"))

        def get_test_db():
            with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
                yield db

        app.dependency_overrides[get_db] = get_test_db
        monkeypatch.setattr(reports, "get_storage_provider", lambda: SimpleNamespace(read=lambda path: b"test"))
        monkeypatch.setattr(reports, "enforce_rate_limit", lambda *args, **kwargs: None)
        monkeypatch.setattr(auth, "enforce_rate_limit", lambda *args, **kwargs: None)
        client = TestClient(app, base_url="https://testserver")
        prefix = "/api/v1/incidents/community"
        response = client.get(prefix)
        assert response.status_code == 200
        assert response.json()["total"] == 1
        item = response.json()["items"][0]
        assert item["id"] == str(visible) and item["location_zone_name"] == "Zona A"
        assert not {"reporter_id", "created_by", "latitude", "longitude", "reference", "storage_path"} & item.keys()
        assert item["reacted_by_me"] is False and item["is_own_report"] is False
        assert client.get(f"{prefix}/{visible}/image").status_code == 200
        for incident_id in (hidden, no_consent, rejected):
            assert client.get(f"{prefix}/{incident_id}/image").status_code == 404
        assert client.post(f"{prefix}/{visible}/reaction").status_code == 401
        assert client.get(prefix, params={"category": "CLEANING"}).json()["total"] == 0
        assert client.get(prefix, params={"offset": 1}).json()["items"] == []

        login = client.post("/api/v1/auth/login", json={"campus_id": "reader", "password": "test-password-123"})
        assert login.status_code == 200
        reaction = client.post(f"{prefix}/{visible}/reaction", headers={"X-CSRF-Token": login.json()["csrf_token"]})
        assert reaction.status_code == 200 and reaction.json()["reaction_count"] == 1
        assert client.get(prefix).json()["items"][0]["reacted_by_me"] is True

        owner = client.post("/api/v1/auth/login", json={"campus_id": "author", "password": "test-password-123"})
        owner_headers = {"X-CSRF-Token": owner.json()["csrf_token"]}
        assert client.post(f"{prefix}/{visible}/reaction", headers=owner_headers).status_code == 403
        assert client.patch(f"/api/v1/incidents/{visible}/community-consent", headers=owner_headers).status_code == 200
        visitor = TestClient(app, base_url="https://testserver")
        assert visitor.get(prefix).json()["items"] == []
        assert visitor.get(f"{prefix}/{visible}/image").status_code == 404
    finally:
        app.dependency_overrides.pop(get_db, None)
        transaction.rollback()
        connection.close()
