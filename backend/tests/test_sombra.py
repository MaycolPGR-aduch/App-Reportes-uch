"""La clasificacion en sombra solo vale si quien decide nunca la ve.

En el brazo manual la IA tambien clasifica, para poder estimar como lo habria
hecho sola. Pero toda vista, registro o decision debe pedir la propuesta a
traves de `metrica_visible`; si algun camino leyera la metrica directamente,
el brazo manual dejaria de serlo sin que nada lo advirtiera.
"""

from types import SimpleNamespace

import app.services.governance_view as vista
from app.db import base as _modelos  # noqa: F401
from app.models.enums import GovernanceMode


class _Consulta:
    def __init__(self, fila):
        self.fila = fila

    def filter(self, *a, **k):
        return self

    def order_by(self, *a, **k):
        return self

    def first(self):
        return self.fila


class _Sesion:
    """Siempre hay una metrica guardada: la de sombra existe de verdad."""

    def __init__(self, metrica):
        self.metrica = metrica

    def query(self, _modelo):
        return _Consulta(self.metrica)


METRICA = SimpleNamespace(raw_response={"is_appropriate": True, "is_incident": True})


def _incidencia(modo):
    return SimpleNamespace(id="i-1", governance_mode=modo, is_community_visible=False)


def test_en_modo_manual_la_metrica_existe_pero_no_se_ve() -> None:
    db = _Sesion(METRICA)
    assert vista.ultima_metrica(db, "i-1") is METRICA, "la prediccion de sombra debe existir"
    assert vista.metrica_visible(db, _incidencia(GovernanceMode.MANUAL)) is None


def test_en_modo_asistido_la_metrica_se_ve() -> None:
    db = _Sesion(METRICA)
    assert vista.metrica_visible(db, _incidencia(GovernanceMode.AI_ASSISTED)) is METRICA


def test_la_vista_de_gobernanza_no_filtra_la_sombra(monkeypatch) -> None:
    """La vista que alimenta triaje y moderacion: en manual, ni propuesta ni
    veredicto, aunque la metrica este guardada."""
    monkeypatch.setattr(vista, "ultima_decision", lambda db, i: None)
    monkeypatch.setattr(vista, "ultimo_triaje", lambda db, i: None)

    v = vista.vista_de_gobernanza(_Sesion(METRICA), _incidencia(GovernanceMode.MANUAL))

    assert v.metric is None
    assert v.veredicto.evaluada is False
