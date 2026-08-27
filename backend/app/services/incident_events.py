"""Detección de la transición de una incidencia a RESUELTA.

Diez sitios del código asignan `incident.status`, y tres pueden producir
`RESOLVED`: el personal al completar su asignación, el administrador al cerrar
la última, y el administrador al fijar el estado directamente.

Instrumentar esas tres llamadas sería frágil: quien añada una cuarta se
olvidará, y el fallo sería **silencioso** — un reportante que nunca recibe su
aviso y nadie se entera. Por eso la detección se hace con un evento del ORM,
que se dispara venga el cambio de donde venga. Es implícito a propósito: es
exactamente el caso para el que existen los eventos de sesión de SQLAlchemy.
"""

from __future__ import annotations

import logging

from sqlalchemy import event, inspect
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.enums import IncidentStatus, JobType
from app.models.incident import Incident
from app.services.jobs import enqueue_job
from app.services.notifications import KIND_INCIDENCIA_RESUELTA

logger = logging.getLogger("campus.incident_events")


def _acaba_de_resolverse(incidencia: Incident) -> bool:
    """True solo en la transición hacia RESUELTA, no si ya lo estaba."""
    historial = inspect(incidencia).attrs.status.history
    if not historial.has_changes():
        return False
    if incidencia.status != IncidentStatus.RESOLVED:
        return False
    # `deleted` guarda el valor anterior; si ya era RESUELTA no hay transición.
    anterior = historial.deleted[0] if historial.deleted else None
    return anterior != IncidentStatus.RESOLVED


@event.listens_for(Session, "before_flush")
def _encolar_aviso_al_reportante(session: Session, flush_context, instances) -> None:
    settings = get_settings()
    if not settings.reporter_updates_enabled:
        return

    for objeto in session.dirty:
        if not isinstance(objeto, Incident):
            continue
        if not _acaba_de_resolverse(objeto):
            continue
        # Un reporte anónimo no tiene cuenta ni correo: no hay a quién avisar.
        if objeto.reporter_id is None:
            logger.info("aviso_omitido_reporte_anonimo incident_id=%s", objeto.id)
            continue
        if objeto.reporter is None or not objeto.reporter.email:
            continue

        enqueue_job(
            session,
            incident_id=objeto.id,
            job_type=JobType.SEND_NOTIFICATION,
            payload={
                "kind": KIND_INCIDENCIA_RESUELTA,
                "recipient_overrides": [objeto.reporter.email],
            },
        )
        logger.info("aviso_al_reportante_encolado incident_id=%s", objeto.id)


def registrar_escuchas() -> None:
    """Importar este módulo ya registra el evento; existe para hacerlo explícito."""
    return None
