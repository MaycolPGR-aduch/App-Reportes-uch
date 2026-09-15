"""Vista de gobernanza de una incidencia: lo que un administrador necesita
para triar y moderar.

Vivia dentro del endpoint de la cola de moderacion, y por eso solo podia
verse desde alli. Pero la cola filtra por consentimiento de publicacion, asi
que las incidencias que no consentian quedaban sin forma de confirmar su
categoria y prioridad: el triaje --la medicion central del estudio-- solo
ocurria en una fraccion de los reportes.

Al extraerlo, el detalle de cualquier incidencia puede llevar la misma
informacion, y triar y moderar dejan de depender el uno del otro.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.ai_metric import AIMetric
from app.models.incident import Incident
from app.models.moderation_decision import ModerationDecision
from app.models.triage_decision import TriageDecision


@dataclass(frozen=True)
class Veredicto:
    """Lo que la IA opino sobre publicabilidad, si llego a opinar."""

    evaluada: bool
    apropiada: bool | None
    es_incidencia: bool | None
    motivo: str | None


@dataclass(frozen=True)
class VistaGobernanza:
    metric: AIMetric | None
    decision: ModerationDecision | None
    triaje: TriageDecision | None
    veredicto: Veredicto
    moderation_state: str


def ultima_metrica(db: Session, incident_id: UUID) -> AIMetric | None:
    return (
        db.query(AIMetric)
        .filter(AIMetric.incident_id == incident_id)
        .order_by(AIMetric.created_at.desc())
        .first()
    )


def ultima_decision(db: Session, incident_id: UUID) -> ModerationDecision | None:
    return (
        db.query(ModerationDecision)
        .filter(ModerationDecision.incident_id == incident_id)
        .order_by(ModerationDecision.created_at.desc())
        .first()
    )


def ultimo_triaje(db: Session, incident_id: UUID) -> TriageDecision | None:
    return (
        db.query(TriageDecision)
        .filter(TriageDecision.incident_id == incident_id)
        .order_by(TriageDecision.created_at.desc())
        .first()
    )


def veredicto_de(metric: AIMetric | None) -> Veredicto:
    if metric is None:
        return Veredicto(False, None, None, None)
    raw = metric.raw_response or {}
    apropiada = raw.get("is_appropriate")
    es_incidencia = raw.get("is_incident")
    motivo = raw.get("reason") or None
    return Veredicto(
        evaluada=True,
        apropiada=bool(apropiada) if apropiada is not None else None,
        es_incidencia=bool(es_incidencia) if es_incidencia is not None else None,
        motivo=str(motivo)[:300] if motivo else None,
    )


def estado_de_moderacion(
    *,
    incident: Incident,
    veredicto: Veredicto,
    decision: ModerationDecision | None,
) -> str:
    if decision is not None:
        # Compara contra la visibilidad real: si algo la cambio sin dejar
        # decision, la etiqueta no debe quedarse anclada al historico y decir
        # "publicada" sobre una incidencia que esta oculta.
        if decision.published == incident.is_community_visible:
            return "PUBLICADA_MANUAL" if decision.published else "OCULTA_MANUAL"
        return "PUBLICADA_IA" if incident.is_community_visible else "PENDIENTE_IA"
    if not veredicto.evaluada:
        return "PENDIENTE_IA"
    if incident.is_community_visible:
        return "PUBLICADA_IA"
    if veredicto.apropiada is False or veredicto.es_incidencia is False:
        return "RECHAZADA_IA"
    return "PENDIENTE_IA"


def vista_de_gobernanza(db: Session, incident: Incident) -> VistaGobernanza:
    """Reune en una consulta lo que triaje y moderacion necesitan saber."""
    metric = ultima_metrica(db, incident.id)
    decision = ultima_decision(db, incident.id)
    triaje = ultimo_triaje(db, incident.id)
    veredicto = veredicto_de(metric)
    return VistaGobernanza(
        metric=metric,
        decision=decision,
        triaje=triaje,
        veredicto=veredicto,
        moderation_state=estado_de_moderacion(
            incident=incident, veredicto=veredicto, decision=decision
        ),
    )
