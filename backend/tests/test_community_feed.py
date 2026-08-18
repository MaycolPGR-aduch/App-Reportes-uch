from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.api.v1.reports import _require_student, _safe_feed_limit_offset
from app.models.enums import IncidentCategory, IncidentStatus, UserRole
from app.schemas.incident import CommunityFeedItem


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


def test_community_feed_is_student_only(active_user) -> None:
    assert _require_student(active_user) is active_user
    active_user.role = UserRole.STAFF

    with pytest.raises(HTTPException) as exc_info:
        _require_student(active_user)

    assert exc_info.value.status_code == 403


def test_feed_pagination_is_bounded() -> None:
    assert _safe_feed_limit_offset(limit=0, offset=-5) == (1, 0)
    assert _safe_feed_limit_offset(limit=999, offset=7) == (30, 7)
