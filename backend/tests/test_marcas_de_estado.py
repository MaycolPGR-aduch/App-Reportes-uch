"""El historial de estados solo debe anotar cambios reales.

Guardar una incidencia sin tocar su estado --corregir la categoria, la
descripcion-- no puede dejar marca, o el tiempo hasta la resolucion saldria
de la ultima edicion en vez de la ultima transicion.
"""

from types import SimpleNamespace

import pytest

import app.services.incident_events as eventos
from app.db import base as _modelos  # noqa: F401
from app.models.enums import IncidentStatus


def _incidencia(estado, *, cambio: bool, anterior=None):
    historial = SimpleNamespace(
        has_changes=lambda: cambio,
        deleted=[anterior] if anterior is not None else [],
    )
    obj = SimpleNamespace(status=estado)
    obj._estado = SimpleNamespace(attrs=SimpleNamespace(status=SimpleNamespace(history=historial)))
    return obj


@pytest.fixture(autouse=True)
def _inspect_falso(monkeypatch):
    monkeypatch.setattr(eventos, "inspect", lambda obj: obj._estado)


def test_un_cambio_real_devuelve_anterior_y_nuevo() -> None:
    inc = _incidencia(IncidentStatus.RESOLVED, cambio=True, anterior=IncidentStatus.IN_PROGRESS)
    assert eventos._cambio_de_estado(inc) == (IncidentStatus.IN_PROGRESS, IncidentStatus.RESOLVED)


def test_guardar_sin_tocar_el_estado_no_deja_marca() -> None:
    inc = _incidencia(IncidentStatus.IN_PROGRESS, cambio=False)
    assert eventos._cambio_de_estado(inc) is None


def test_reasignar_el_mismo_estado_no_deja_marca() -> None:
    """El endpoint de estado acepta fijar el que ya tiene: no es una transicion."""
    inc = _incidencia(IncidentStatus.IN_PROGRESS, cambio=True, anterior=IncidentStatus.IN_PROGRESS)
    assert eventos._cambio_de_estado(inc) is None
