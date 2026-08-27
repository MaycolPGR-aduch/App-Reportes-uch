"""Una zona guardada a kilómetros del campus casi siempre es la plantilla de
ejemplo enviada sin editar. Así fue como «Salida Principal» acabó a 10,6 km de
los otros seis polígonos, sin que nada lo advirtiera."""

import pytest

from app.services.location_resolver import distance_meters, polygon_centroid

# Polígonos reales tomados de la base de desarrollo.
PABELLON_C = {
    "type": "Polygon",
    "coordinates": [[
        [-77.065900, -11.961700],
        [-77.065450, -11.961700],
        [-77.065450, -11.961200],
        [-77.065900, -11.961200],
        [-77.065900, -11.961700],
    ]],
}

# El ejemplo de sql/seed_campus_zones_template.sql, que el formulario de
# administración además precarga como valor por defecto.
PLANTILLA_DE_EJEMPLO = {
    "type": "Polygon",
    "coordinates": [[
        [-77.084900, -12.056000],
        [-77.084500, -12.056000],
        [-77.084500, -12.055700],
        [-77.084900, -12.055700],
        [-77.084900, -12.056000],
    ]],
}


def test_centroid_lands_inside_its_own_polygon() -> None:
    lat, lng = polygon_centroid(PABELLON_C)

    assert -11.9617 <= lat <= -11.9612
    assert -77.0659 <= lng <= -77.06545


def test_centroid_ignores_the_repeated_closing_vertex() -> None:
    """El anillo repite el primer punto al final; contarlo dos veces desplazaría
    el centroide hacia esa esquina."""
    lat, lng = polygon_centroid(PABELLON_C)

    assert lat == pytest.approx(-11.96145, abs=1e-5)
    assert lng == pytest.approx(-77.065675, abs=1e-5)


def test_template_polygon_is_far_from_the_real_campus() -> None:
    """Regresión del caso real: la plantilla queda a ~10,6 km del campus."""
    distance = distance_meters(
        polygon_centroid(PLANTILLA_DE_EJEMPLO), polygon_centroid(PABELLON_C)
    )

    assert distance > 10_000


def test_adjacent_campus_zones_stay_within_the_limit() -> None:
    """Dos zonas contiguas del campus real no deben disparar la advertencia."""
    patio = {
        "type": "Polygon",
        "coordinates": [[
            [-77.065500, -11.961500],
            [-77.065100, -11.961500],
            [-77.065100, -11.961200],
            [-77.065500, -11.961200],
            [-77.065500, -11.961500],
        ]],
    }
    distance = distance_meters(polygon_centroid(patio), polygon_centroid(PABELLON_C))

    assert distance < 2_000


def test_distance_is_symmetric_and_zero_for_the_same_point() -> None:
    a, b = (-11.9614, -77.0656), (-12.0554, -77.0850)

    assert distance_meters(a, a) == pytest.approx(0, abs=1e-6)
    assert distance_meters(a, b) == pytest.approx(distance_meters(b, a), rel=1e-9)


def test_multipolygon_centroid_uses_outer_rings() -> None:
    multi = {"type": "MultiPolygon", "coordinates": [PABELLON_C["coordinates"]]}

    assert polygon_centroid(multi) == pytest.approx(polygon_centroid(PABELLON_C))


def test_rejects_geometry_without_vertices() -> None:
    with pytest.raises(ValueError):
        polygon_centroid({"type": "Polygon", "coordinates": []})
