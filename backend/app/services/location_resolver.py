from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.campus_zone import CampusZone

MATCHED_STATUS = "MATCHED"
OUTSIDE_STATUS = "OUTSIDE"
UNKNOWN_STATUS = "UNKNOWN"


@dataclass(frozen=True)
class ResolvedCampusLocation:
    zone_id: UUID | None
    zone_name: str | None
    location_status: str
    location_confidence: float | None


def _to_point(raw_point: Any) -> tuple[float, float]:
    if not isinstance(raw_point, list) or len(raw_point) < 2:
        raise ValueError("Invalid coordinate pair")
    x_raw, y_raw = raw_point[0], raw_point[1]
    if not isinstance(x_raw, (int, float)) or not isinstance(y_raw, (int, float)):
        raise ValueError("Coordinate values must be numeric")
    return float(x_raw), float(y_raw)


def _normalize_ring(raw_ring: Any) -> list[tuple[float, float]]:
    if not isinstance(raw_ring, list) or len(raw_ring) < 4:
        raise ValueError("Polygon ring must contain at least 4 points")

    points = [_to_point(item) for item in raw_ring]
    if points[0] != points[-1]:
        points.append(points[0])
    if len(points) < 4:
        raise ValueError("Polygon ring is too short")
    return points


def _extract_polygons(polygon_geojson: Any) -> list[list[list[tuple[float, float]]]]:
    if not isinstance(polygon_geojson, dict):
        raise ValueError("Polygon geojson must be an object")

    geo_type = polygon_geojson.get("type")
    coordinates = polygon_geojson.get("coordinates")

    if geo_type == "Polygon":
        if not isinstance(coordinates, list) or not coordinates:
            raise ValueError("Polygon coordinates are required")
        return [[_normalize_ring(ring) for ring in coordinates]]

    if geo_type == "MultiPolygon":
        if not isinstance(coordinates, list) or not coordinates:
            raise ValueError("MultiPolygon coordinates are required")
        polygons: list[list[list[tuple[float, float]]]] = []
        for polygon in coordinates:
            if not isinstance(polygon, list) or not polygon:
                raise ValueError("Each MultiPolygon entry must contain rings")
            polygons.append([_normalize_ring(ring) for ring in polygon])
        return polygons

    raise ValueError("Polygon geojson type must be Polygon or MultiPolygon")


def validate_polygon_geojson(polygon_geojson: dict[str, Any]) -> None:
    _extract_polygons(polygon_geojson)


def _point_on_segment(
    point: tuple[float, float],
    segment_start: tuple[float, float],
    segment_end: tuple[float, float],
) -> bool:
    px, py = point
    ax, ay = segment_start
    bx, by = segment_end
    epsilon = 1e-12

    cross = (py - ay) * (bx - ax) - (px - ax) * (by - ay)
    if abs(cross) > epsilon:
        return False

    dot = (px - ax) * (px - bx) + (py - ay) * (py - by)
    return dot <= epsilon


def _point_in_ring(point: tuple[float, float], ring: list[tuple[float, float]]) -> bool:
    inside = False
    for index in range(len(ring) - 1):
        start = ring[index]
        end = ring[index + 1]

        if _point_on_segment(point, start, end):
            return True

        x1, y1 = start
        x2, y2 = end
        px, py = point

        intersects = (y1 > py) != (y2 > py)
        if not intersects:
            continue
        projected_x = ((x2 - x1) * (py - y1) / (y2 - y1)) + x1
        if projected_x >= px:
            inside = not inside
    return inside


def _point_in_polygon(point: tuple[float, float], rings: list[list[tuple[float, float]]]) -> bool:
    if not rings:
        return False
    if not _point_in_ring(point, rings[0]):
        return False
    for hole in rings[1:]:
        if _point_in_ring(point, hole):
            return False
    return True


def _ring_area(ring: list[tuple[float, float]]) -> float:
    area = 0.0
    for index in range(len(ring) - 1):
        x1, y1 = ring[index]
        x2, y2 = ring[index + 1]
        area += (x1 * y2) - (x2 * y1)
    return abs(area) / 2.0


def _polygon_area(rings: list[list[tuple[float, float]]]) -> float:
    if not rings:
        return 0.0
    outer = _ring_area(rings[0])
    holes = sum(_ring_area(hole) for hole in rings[1:])
    return max(outer - holes, 0.0)


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _match_confidence(accuracy_m: float | None, overlaps: int) -> float:
    if accuracy_m is None:
        base = 0.85
    elif accuracy_m <= 10:
        base = 0.98
    elif accuracy_m <= 25:
        base = 0.94
    elif accuracy_m <= 50:
        base = 0.88
    elif accuracy_m <= 100:
        base = 0.8
    else:
        base = 0.7

    if overlaps > 1:
        base -= 0.08
    return round(_clamp(base, 0.0, 1.0), 3)


def _outside_confidence(accuracy_m: float | None) -> float:
    if accuracy_m is None:
        return 0.6
    if accuracy_m <= 15:
        return 0.92
    if accuracy_m <= 30:
        return 0.86
    if accuracy_m <= 80:
        return 0.76
    return 0.65


def resolve_campus_zone(
    db: Session,
    *,
    latitude: float,
    longitude: float,
    accuracy_m: float | None,
) -> ResolvedCampusLocation:
    zones = (
        db.query(CampusZone)
        .filter(CampusZone.is_active.is_(True))
        .order_by(CampusZone.priority.desc(), CampusZone.created_at.asc())
        .all()
    )
    if not zones:
        return ResolvedCampusLocation(
            zone_id=None,
            zone_name=None,
            location_status=UNKNOWN_STATUS,
            location_confidence=None,
        )

    point = (longitude, latitude)
    matches: list[tuple[CampusZone, float]] = []
    valid_zone_count = 0

    for zone in zones:
        try:
            polygons = _extract_polygons(zone.polygon_geojson)
        except ValueError:
            continue

        valid_zone_count += 1
        matched_area: float | None = None
        for polygon in polygons:
            if _point_in_polygon(point, polygon):
                current_area = _polygon_area(polygon)
                if matched_area is None or current_area < matched_area:
                    matched_area = current_area

        if matched_area is not None:
            matches.append((zone, matched_area))

    if matches:
        # Priority first (higher wins), area second (smaller wins), creation third.
        matches.sort(key=lambda item: (-item[0].priority, item[1], item[0].created_at))
        winner = matches[0][0]
        return ResolvedCampusLocation(
            zone_id=winner.id,
            zone_name=winner.name,
            location_status=MATCHED_STATUS,
            location_confidence=_match_confidence(accuracy_m, len(matches)),
        )

    if valid_zone_count == 0:
        return ResolvedCampusLocation(
            zone_id=None,
            zone_name=None,
            location_status=UNKNOWN_STATUS,
            location_confidence=None,
        )

    return ResolvedCampusLocation(
        zone_id=None,
        zone_name=None,
        location_status=OUTSIDE_STATUS,
        location_confidence=_outside_confidence(accuracy_m),
    )

