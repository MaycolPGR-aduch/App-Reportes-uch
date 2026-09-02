"""Hasta ahora la clasificacion de la IA era inapelable.

`incident.category` y `incident.priority` solo cambiaban porque el worker las
reescribiera: no habia ningun endpoint que permitiera a una persona corregirlas.
El «el administrador acepta o corrige cada propuesta» del modo asistido no
estaba a medias, no existia.

Estas pruebas fijan que la decision se aplique y --sobre todo-- que quede
registrada, porque es la medicion del estudio.
"""

from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

import app.api.v1.admin as admin
from app.db import base as _modelos  # noqa: F401
from app.models.enums import (
    GovernanceMode,
    IncidentCategory,
    PriorityLevel,
)


class _Consulta:
    def __init__(self, resultado) -> None:
        self._resultado = resultado

    def filter(self, *_a, **_k):
        return self

    def order_by(self, *_a, **_k):
        return self

    def first(self):
        return self._resultado


class _Sesion:
    """Devuelve una cosa distinta segun el modelo consultado."""

    def __init__(self, incidencia=None, metrica=None, asignacion=None) -> None:
        self.incidencia = incidencia
        self.por_modelo = {"AIMetric": metrica, "IncidentAssignment": asignacion}
        self.agregados: list = []
        self.commits = 0

    def get(self, _modelo, _pk):
        return self.incidencia

    def query(self, modelo):
        return _Consulta(self.por_modelo.get(getattr(modelo, "__name__", ""), None))

    def add(self, obj):
        self.agregados.append(obj)

    def commit(self):
        self.commits += 1

    def refresh(self, _obj):
        pass


def _incidencia(modo=GovernanceMode.AI_ASSISTED):
    return SimpleNamespace(
        id=uuid4(),
        category=IncidentCategory.INFRASTRUCTURE,
        priority=PriorityLevel.MEDIUM,
        governance_mode=modo,
    )


def _metrica(categoria=IncidentCategory.SECURITY, prioridad=PriorityLevel.HIGH):
    return SimpleNamespace(
        predicted_category=categoria,
        priority_label=prioridad,
        confidence=Decimal("0.910"),
    )


def _admin():
    return SimpleNamespace(id=uuid4(), full_name="Admin Campus", campus_id="uadmin01")


def _peticion(categoria, prioridad, motivo=None):
    return SimpleNamespace(category=categoria, priority=prioridad, reason=motivo)


def _triar(db, categoria, prioridad, motivo=None):
    return admin.triage_incident(
        db.incidencia.id, _peticion(categoria, prioridad, motivo), db, _admin()
    )


# ------------------------------------------------------ aplica la decision

def test_la_correccion_se_aplica_a_la_incidencia() -> None:
    db = _Sesion(_incidencia(), _metrica())

    _triar(db, IncidentCategory.CLEANING, PriorityLevel.LOW)

    assert db.incidencia.category is IncidentCategory.CLEANING
    assert db.incidencia.priority is PriorityLevel.LOW


def test_una_incidencia_inexistente_da_404() -> None:
    db = _Sesion(None)
    db.incidencia = SimpleNamespace(id=uuid4())
    db.get = lambda *_: None

    with pytest.raises(HTTPException) as excinfo:
        _triar(db, IncidentCategory.CLEANING, PriorityLevel.LOW)

    assert excinfo.value.status_code == 404


# -------------------------------------------------------- deja constancia

def test_la_decision_queda_registrada_con_las_dos_versiones() -> None:
    """Sin las dos --lo que propuso la IA y lo que decidio la persona-- no hay
    forma de medir cuantas veces se la corrige."""
    db = _Sesion(_incidencia(), _metrica(IncidentCategory.SECURITY, PriorityLevel.HIGH))

    _triar(db, IncidentCategory.CLEANING, PriorityLevel.LOW, "La foto es de basura")

    assert len(db.agregados) == 1
    d = db.agregados[0]
    assert d.ai_suggested_category is IncidentCategory.SECURITY
    assert d.ai_suggested_priority is PriorityLevel.HIGH
    assert d.final_category is IncidentCategory.CLEANING
    assert d.final_priority is PriorityLevel.LOW
    assert d.reason == "La foto es de basura"


def test_se_copia_quien_decidio_en_vez_de_referenciarlo() -> None:
    """La cuenta puede borrarse; los datos del estudio no pueden quedarse sin
    saber quien tomo la decision."""
    db = _Sesion(_incidencia(), _metrica())

    _triar(db, IncidentCategory.CLEANING, PriorityLevel.LOW)

    assert "Admin Campus" in db.agregados[0].actor_label
    assert "uadmin01" in db.agregados[0].actor_label


def test_se_copia_el_modo_de_la_incidencia() -> None:
    db = _Sesion(_incidencia(GovernanceMode.MANUAL), None)

    _triar(db, IncidentCategory.CLEANING, PriorityLevel.LOW)

    assert db.agregados[0].governance_mode is GovernanceMode.MANUAL


def test_aplicar_y_registrar_ocurren_en_la_misma_transaccion() -> None:
    """Una decision aplicada sin registrar dejaria los datos del estudio
    mintiendo sobre lo que ocurrio."""
    db = _Sesion(_incidencia(), _metrica())

    _triar(db, IncidentCategory.CLEANING, PriorityLevel.LOW)

    assert db.commits == 1, "un solo commit para el cambio y su registro"


# ---------------------------------------------------- coincide o corrige

def test_detecta_que_se_confirmo_la_propuesta() -> None:
    db = _Sesion(_incidencia(), _metrica(IncidentCategory.SECURITY, PriorityLevel.HIGH))

    r = _triar(db, IncidentCategory.SECURITY, PriorityLevel.HIGH)

    assert r.agreed_with_ai is True


def test_detecta_que_se_corrigio_la_propuesta() -> None:
    db = _Sesion(_incidencia(), _metrica(IncidentCategory.SECURITY, PriorityLevel.HIGH))

    r = _triar(db, IncidentCategory.SECURITY, PriorityLevel.LOW)  # cambia la prioridad

    assert r.agreed_with_ai is False


def test_en_modo_manual_no_hay_con_que_comparar() -> None:
    """`None` y no `False`: en manual no hubo propuesta, que es distinto de
    haberla habido y haberla corregido. Mezclar ambos falsearia las medias."""
    db = _Sesion(_incidencia(GovernanceMode.MANUAL), None)

    r = _triar(db, IncidentCategory.CLEANING, PriorityLevel.LOW)

    assert r.agreed_with_ai is None
    assert db.agregados[0].ai_suggested_category is None
    assert db.agregados[0].ai_suggested_priority is None
    assert db.agregados[0].ai_confidence is None
