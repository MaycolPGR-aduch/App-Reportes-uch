from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api.v1.reports import _require_student, _safe_feed_limit_offset
from app.models.enums import IncidentCategory, IncidentStatus, UserRole
from app.schemas.incident import CommunityFeedItem


def test_visitante_puede_listar_y_no_puede_reaccionar(monkeypatch) -> None:
    from app.api.v1 import reports
    from app.db.session import get_db
    from app.main import app

    class EmptyQuery:
        def filter(self, *args): return self
        def with_entities(self, *args): return self
        def scalar(self): return 0
        def options(self, *args): return self
        def order_by(self, *args): return self
        def offset(self, *args): return self
        def limit(self, *args): return self
        def all(self): return []

    class EmptyDB:
        def query(self, *args): return EmptyQuery()

    app.dependency_overrides[get_db] = lambda: EmptyDB()
    monkeypatch.setattr(reports, "enforce_rate_limit", lambda *args, **kwargs: None)
    try:
        client = TestClient(app)
        response = client.get("/api/v1/incidents/community")
        assert response.status_code == 200 and response.json() == {"total": 0, "items": []}
        reaction = client.post(f"/api/v1/incidents/community/{uuid4()}/reaction")
        assert reaction.status_code == 401
    finally:
        app.dependency_overrides.pop(get_db, None)


def test_community_card_schema_never_contains_sensitive_reporter_fields() -> None:
    card = CommunityFeedItem(
        id=uuid4(),
        category=IncidentCategory.SECURITY,
        status=IncidentStatus.IN_PROGRESS,
        description="Luminaria sin protección en un pasillo",
        created_at=datetime.now(timezone.utc),
        location_zone_name="Pabellón B",
        has_image=True,
        reaction_count=2,
        reacted_by_me=False,
        is_own_report=False,
    )

    assert set(card.model_dump()) == {
        "id",
        "category",
        "status",
        "description",
        "created_at",
        "location_zone_name",
        "has_image",
        "reaction_count",
        "reacted_by_me",
        "is_own_report",
    }


def test_reaction_helpers_remain_student_only(active_user) -> None:
    assert _require_student(active_user) is active_user
    active_user.role = UserRole.STAFF

    with pytest.raises(HTTPException) as exc_info:
        _require_student(active_user)

    assert exc_info.value.status_code == 403


def test_feed_pagination_is_bounded() -> None:
    assert _safe_feed_limit_offset(limit=0, offset=-5) == (1, 0)
    assert _safe_feed_limit_offset(limit=999, offset=7) == (30, 7)
