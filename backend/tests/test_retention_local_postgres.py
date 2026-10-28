"""Prueba de retención y reintento con cambios revertidos en PostgreSQL local."""
import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.session import engine
from app.models.enums import IncidentCategory, IncidentStatus, PriorityLevel
from app.models.evidence import IncidentEvidence
from app.models.evidence_deletion import EvidenceDeletion
from app.models.incident import Incident
from app.models.status_event import IncidentStatusEvent
from app.services import maintenance


@pytest.mark.skipif(os.getenv("RUN_LOCAL_PG_HARDENING_TEST") != "1", reason="prueba PostgreSQL local optativa")
def test_retencion_y_borrado_durable(monkeypatch):
    if engine.url.host not in {"localhost", "127.0.0.1", "::1"}:
        pytest.fail("La prueba solo admite PostgreSQL local")
    schema = "retention_test_" + uuid4().hex
    connection = engine.connect()
    transaction = connection.begin()
    try:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET LOCAL search_path TO "{schema}", public'))
        Base.metadata.create_all(connection, checkfirst=False)
        now = datetime.now(timezone.utc)
        old_id, recent_id = uuid4(), uuid4()
        for incident_id, closed_at in [(old_id, now - timedelta(days=200)), (recent_id, now - timedelta(days=1))]:
            connection.execute(Incident.__table__.insert().values(
                id=incident_id, description="prueba", category=IncidentCategory.SECURITY,
                status=IncidentStatus.RESOLVED, priority=PriorityLevel.MEDIUM, created_by="test",
            ))
            connection.execute(IncidentStatusEvent.__table__.insert().values(
                id=uuid4(), incident_id=incident_id, status=IncidentStatus.RESOLVED, at=closed_at,
            ))
            connection.execute(IncidentEvidence.__table__.insert().values(
                id=uuid4(), incident_id=incident_id, storage_path=f"evidences/{incident_id}.jpg",
                mime_type="image/jpeg", file_size_bytes=3, sha256_hash="a" * 64,
            ))

        class Storage:
            failed = True
            def delete(self, path):
                if self.failed:
                    raise OSError("storage unavailable")
        storage = Storage()
        monkeypatch.setattr(maintenance, "get_storage_provider", lambda: storage)
        with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
            assert maintenance.purge_expired_incidents(db) == 1
            assert db.get(Incident, old_id) is None
            assert db.get(Incident, recent_id) is not None
            assert db.query(EvidenceDeletion).count() == 1
            assert maintenance.drain_evidence_deletions(db) == 0
            assert db.query(EvidenceDeletion).count() == 1
            storage.failed = False
            assert maintenance.drain_evidence_deletions(db) == 1
            assert db.query(EvidenceDeletion).count() == 0
    finally:
        transaction.rollback()
        connection.close()
