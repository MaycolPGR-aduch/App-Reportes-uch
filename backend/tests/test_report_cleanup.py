import asyncio
from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

import pytest
from starlette.datastructures import Headers, UploadFile

from app.db import base as _models  # noqa: F401
from app.api.v1 import reports
from app.models.enums import GovernanceMode, IncidentCategory


def test_error_after_evidence_save_rolls_back_and_deletes(monkeypatch):
    removed = []
    class DB:
        incident = None
        rolled_back = False
        def add(self, value): self.incident = value
        def flush(self): self.incident.id = uuid4()
        def add_all(self, values): pass
        def rollback(self): self.rolled_back = True
    class Storage:
        def save_incident_image(self, **kwargs):
            return SimpleNamespace(relative_path="evidences/test.jpg", absolute_path="test", mime_type="image/jpeg", size_bytes=4, sha256_hash="a" * 64)
        def delete(self, path): removed.append(path)

    settings = SimpleNamespace(max_image_size_mb=10, max_image_pixels=25000000,
                               governance_mode="AI_ASSISTED", shadow_classification=True)
    monkeypatch.setattr(reports, "get_settings", lambda: settings)
    monkeypatch.setattr(reports, "get_storage_provider", lambda: Storage())
    monkeypatch.setattr(reports, "normalize_image", lambda *args, **kwargs: (b"test", "image/jpeg"))
    monkeypatch.setattr(reports, "resolve_campus_zone", lambda *args, **kwargs: SimpleNamespace(zone_id=None, zone_name=None, location_status="UNKNOWN", location_confidence=None))
    monkeypatch.setattr(reports, "resolver_modo", lambda *args: GovernanceMode.AI_ASSISTED)
    monkeypatch.setattr(reports, "se_clasifica", lambda *args, **kwargs: True)
    def fail_enqueue(*args, **kwargs): raise RuntimeError("simulated database error")
    monkeypatch.setattr(reports, "enqueue_job", fail_enqueue)
    db = DB()
    photo = UploadFile(file=BytesIO(b"test"), filename="test.jpg", headers=Headers({"content-type": "image/jpeg"}))
    with pytest.raises(RuntimeError):
        asyncio.run(reports.create_report(description="Reporte válido", category=IncidentCategory.SECURITY,
            latitude=-12, longitude=-77, photo=photo, title=None, accuracy_m=None, location_reference=None,
            community_consent=False, trace_id=None, turnstile_token=None, request=None, db=db,
            current_user=SimpleNamespace(id=uuid4(), campus_id="test")))
    assert db.rolled_back and removed == ["evidences/test.jpg"]
