from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest

from app.services.location_resolver import (
    MATCHED_STATUS,
    OUTSIDE_STATUS,
    UNKNOWN_STATUS,
    resolve_campus_zone,
    validate_polygon_geojson,
)


@dataclass
class _ZoneStub:
    id: UUID
    name: str
    priority: int
    polygon_geojson: dict
    created_at: datetime


class _FakeQuery:
    def __init__(self, rows: list[_ZoneStub]) -> None:
        self._rows = rows

    def filter(self, *_args, **_kwargs) -> _FakeQuery:
        return self

    def order_by(self, *_args, **_kwargs) -> _FakeQuery:
        return self

    def all(self) -> list[_ZoneStub]:
        return self._rows


class _FakeSession:
    def __init__(self, zones: list[_ZoneStub]) -> None:
        self._zones = zones

    def query(self, _model) -> _FakeQuery:
        return _FakeQuery(self._zones)


def _polygon(min_lng: float, min_lat: float, max_lng: float, max_lat: float) -> dict:
    return {
        "type": "Polygon",
        "coordinates": [[
            [min_lng, min_lat],
            [max_lng, min_lat],
            [max_lng, max_lat],
            [min_lng, max_lat],
            [min_lng, min_lat],
        ]],
    }


def test_validate_polygon_geojson_rejects_invalid_shape() -> None:
    with pytest.raises(ValueError):
        validate_polygon_geojson({"type": "Polygon", "coordinates": []})


def test_resolve_campus_zone_returns_matched_zone() -> None:
    zone = _ZoneStub(
        id=uuid4(),
        name="Pabellon A",
        priority=100,
        polygon_geojson=_polygon(-77.01, -12.06, -77.0, -12.05),
        created_at=datetime.now(timezone.utc),
    )
    db = _FakeSession([zone])
    resolved = resolve_campus_zone(
        db,
        latitude=-12.055,
        longitude=-77.005,
        accuracy_m=8.0,
    )
    assert resolved.location_status == MATCHED_STATUS
    assert resolved.zone_id == zone.id
    assert resolved.zone_name == "Pabellon A"
    assert resolved.location_confidence is not None
    assert resolved.location_confidence > 0.9


def test_resolve_campus_zone_returns_outside_when_not_in_polygon() -> None:
    zone = _ZoneStub(
        id=uuid4(),
        name="Patio",
        priority=100,
        polygon_geojson=_polygon(-77.01, -12.06, -77.0, -12.05),
        created_at=datetime.now(timezone.utc),
    )
    db = _FakeSession([zone])
    resolved = resolve_campus_zone(
        db,
        latitude=-12.08,
        longitude=-77.02,
        accuracy_m=15.0,
    )
    assert resolved.location_status == OUTSIDE_STATUS
    assert resolved.zone_id is None
    assert resolved.zone_name is None


def test_resolve_campus_zone_prefers_higher_priority_when_overlapping() -> None:
    lower_priority = _ZoneStub(
        id=uuid4(),
        name="Zona general",
        priority=100,
        polygon_geojson=_polygon(-77.02, -12.07, -76.99, -12.04),
        created_at=datetime.now(timezone.utc),
    )
    higher_priority = _ZoneStub(
        id=uuid4(),
        name="Laboratorio",
        priority=300,
        polygon_geojson=_polygon(-77.01, -12.06, -77.0, -12.05),
        created_at=datetime.now(timezone.utc),
    )
    db = _FakeSession([lower_priority, higher_priority])
    resolved = resolve_campus_zone(
        db,
        latitude=-12.055,
        longitude=-77.005,
        accuracy_m=12.0,
    )
    assert resolved.location_status == MATCHED_STATUS
    assert resolved.zone_id == higher_priority.id


def test_resolve_campus_zone_returns_unknown_without_zones() -> None:
    db = _FakeSession([])
    resolved = resolve_campus_zone(
        db,
        latitude=-12.055,
        longitude=-77.005,
        accuracy_m=10.0,
    )
    assert resolved.location_status == UNKNOWN_STATUS
    assert resolved.zone_id is None

