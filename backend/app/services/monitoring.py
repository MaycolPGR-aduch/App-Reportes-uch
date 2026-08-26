"""Vigilancia periódica: salud del sistema y plazos de atención vencidos.

Existe porque el panel de administración es *pull*: muestra el estado, pero solo
si alguien entra a mirarlo. La clasificación por IA estuvo caída dos semanas sin
que nadie se enterara por exactamente ese motivo.

Las condiciones que evalúa son las mismas que reporta `GET /admin/system-status`.
La definición de «esto va mal» vive aquí y el endpoint la reutiliza, para que no
puedan divergir: un panel que dice OK mientras el vigilante manda alertas sería
peor que no tener ninguno de los dos.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.models.assignment import IncidentAssignment
from app.models.enums import AssignmentStatus, IncidentStatus, JobStatus, JobType
from app.models.incident import Incident
from app.models.job import Job
from app.models.system_alert import SystemAlert
from app.services.jobs import enqueue_job
from app.services.notifications import KIND_PLAZO_VENCIDO, send_system_alert

logger = logging.getLogger("campus.monitoring")

QUOTA_MARKERS = ("429", "quota", "rate limit", "rate_limit", "insufficient", "recharge", "billing")

ALERTA_WORKER_CAIDO = "WORKER_CAIDO"
ALERTA_IA_FALLANDO = "IA_FALLANDO"
ALERTA_CUOTA_AGOTADA = "CUOTA_AGOTADA"


def looks_quota_exhausted(error_text: str | None) -> bool:
    """Los proveedores señalan saldo agotado con más que un HTTP 429.

    TokenRouter responde `403 Your account quota is running low ($0.00)`, así que
    buscar solo el código 429 dejaba invisible una cuenta a cero.
    """
    if not error_text:
        return False
    lowered = error_text.lower()
    return any(marker in lowered for marker in QUOTA_MARKERS)


@dataclass(frozen=True)
class Condicion:
    """Una condición evaluada, con lo necesario para redactar el aviso."""

    kind: str
    activa: bool
    titulo: str
    detalle: str
    consecuencia: str


def evaluar_condiciones(db: Session, *, ahora: datetime | None = None) -> list[Condicion]:
    """Evalúa el estado del sistema y devuelve una condición por tipo de alerta."""
    ahora = ahora or datetime.now(timezone.utc)
    ventana_24h = ahora - timedelta(hours=24)
    condiciones: list[Condicion] = []

    # --- Procesos de servicio rezagados -----------------------------------
    rezagados: list[str] = []
    for job_type, nombre in (
        (JobType.CLASSIFY_INCIDENT, "ai_worker"),
        (JobType.SEND_NOTIFICATION, "notification_worker"),
    ):
        pendientes = (
            db.query(func.count(Job.id))
            .filter(Job.type == job_type, Job.status == JobStatus.PENDING)
            .scalar()
            or 0
        )
        if pendientes == 0:
            continue
        # Hay trabajo esperando; si nadie lo tocó en un buen rato, el proceso
        # no está consumiendo la cola.
        ultimo = db.query(func.max(Job.updated_at)).filter(Job.type == job_type).scalar()
        if ultimo is None or ultimo < ahora - timedelta(minutes=15):
            rezagados.append(nombre)

    condiciones.append(
        Condicion(
            kind=ALERTA_WORKER_CAIDO,
            activa=bool(rezagados),
            titulo="Un proceso de servicio dejó de consumir su cola",
            detalle=(
                f"Sin actividad reciente en: {', '.join(rezagados)}."
                if rezagados
                else "Todos los procesos consumen su cola con normalidad."
            ),
            consecuencia=(
                "Las incidencias se registran, pero no se clasifican ni se envían "
                "los avisos correspondientes hasta que el proceso vuelva."
            ),
        )
    )

    # --- Clasificación por IA agotando reintentos --------------------------
    fallidos = (
        db.query(Job)
        .filter(
            Job.type == JobType.CLASSIFY_INCIDENT,
            Job.status == JobStatus.FAILED,
            Job.updated_at >= ventana_24h,
        )
        .order_by(Job.updated_at.desc())
        .all()
    )
    ultimo_error = fallidos[0].last_error if fallidos else None

    condiciones.append(
        Condicion(
            kind=ALERTA_IA_FALLANDO,
            activa=bool(fallidos),
            titulo="La clasificación automática no está funcionando",
            detalle=(
                f"{len(fallidos)} incidencia(s) agotaron sus reintentos en 24 h. "
                f"Último error: {(ultimo_error or '')[:300]}"
                if fallidos
                else "La clasificación automática opera con normalidad."
            ),
            consecuencia=(
                "Esas incidencias quedan en revisión manual y ocultas de la vista "
                "comunitaria. Nada se publicará solo hasta que el proveedor responda."
            ),
        )
    )

    condiciones.append(
        Condicion(
            kind=ALERTA_CUOTA_AGOTADA,
            activa=looks_quota_exhausted(ultimo_error),
            titulo="El proveedor de IA reporta cuota agotada",
            detalle=f"Respuesta del proveedor: {(ultimo_error or '')[:300]}",
            consecuencia=(
                "Ningún modelo responderá hasta recargar la cuenta o cambiar de "
                "proveedor. No se resuelve reiniciando el sistema."
            ),
        )
    )

    return condiciones


def revisar_salud(db: Session, *, ahora: datetime | None = None) -> int:
    """Envía los avisos que correspondan y cierra los que ya se resolvieron.

    Devuelve cuántos correos se enviaron. Una condición que persiste no vuelve a
    avisar hasta pasada la ventana de silencio: repetir el mismo mensaje cada
    revisión convierte la alerta en ruido que nadie lee.
    """
    settings = get_settings()
    destinatario = settings.default_alert_email
    if not destinatario:
        logger.warning("monitoring_sin_destinatario: DEFAULT_ALERT_EMAIL no configurado")
        return 0

    ahora = ahora or datetime.now(timezone.utc)
    silencio = timedelta(hours=settings.alert_silence_hours)
    enviados = 0

    for condicion in evaluar_condiciones(db, ahora=ahora):
        abierta = (
            db.query(SystemAlert)
            .filter(SystemAlert.kind == condicion.kind, SystemAlert.resolved_at.is_(None))
            .order_by(SystemAlert.created_at.desc())
            .first()
        )

        if condicion.activa:
            if abierta is None:
                alerta = SystemAlert(kind=condicion.kind, detail=condicion.detalle)
                db.add(alerta)
                db.flush()
            elif abierta.sent_at is not None and abierta.sent_at > ahora - silencio:
                continue  # ya avisamos hace poco
            else:
                alerta = abierta
                alerta.detail = condicion.detalle

            resultado = send_system_alert(
                recipient=destinatario,
                kind=condicion.kind,
                titulo=condicion.titulo,
                detalle=condicion.detalle,
                consecuencia=condicion.consecuencia,
            )
            alerta.sent_at = ahora
            db.commit()
            enviados += 1
            logger.info("alerta_enviada kind=%s ok=%s", condicion.kind, resultado.status)

        elif abierta is not None:
            # La condición desapareció: cerrar y avisar de la recuperación.
            abierta.resolved_at = ahora
            send_system_alert(
                recipient=destinatario,
                kind=condicion.kind,
                titulo=condicion.titulo,
                detalle=condicion.detalle,
                consecuencia="",
                recuperado=True,
            )
            db.commit()
            enviados += 1
            logger.info("alerta_resuelta kind=%s", condicion.kind)

    return enviados


def asignaciones_vencidas(db: Session, *, ahora: datetime | None = None) -> list[IncidentAssignment]:
    """Asignaciones cuyo plazo pasó y siguen sin atenderse."""
    ahora = ahora or datetime.now(timezone.utc)
    return (
        db.query(IncidentAssignment)
        .options(
            joinedload(IncidentAssignment.incident).joinedload(Incident.location),
            joinedload(IncidentAssignment.responsible),
        )
        .join(Incident, Incident.id == IncidentAssignment.incident_id)
        .filter(
            IncidentAssignment.due_at.isnot(None),
            IncidentAssignment.due_at < ahora,
            IncidentAssignment.completed_at.is_(None),
            IncidentAssignment.status != AssignmentStatus.COMPLETED,
            # Una incidencia ya cerrada o rechazada no tiene plazo que vigilar.
            Incident.status.notin_([IncidentStatus.RESOLVED, IncidentStatus.REJECTED]),
        )
        .all()
    )


def revisar_plazos(db: Session, *, ahora: datetime | None = None) -> int:
    """Encola un aviso por cada asignación vencida que no se haya avisado ya.

    No modifica la incidencia: ni prioridad, ni estado, ni responsable. Un plazo
    vencido puede tener causa justificada, y alterar el dato automáticamente
    obligaría a alguien a deshacerlo.
    """
    ahora = ahora or datetime.now(timezone.utc)
    encolados = 0

    for asignacion in asignaciones_vencidas(db, ahora=ahora):
        incidencia = asignacion.incident
        responsable = asignacion.responsible
        if incidencia is None or responsable is None:
            continue

        # Un aviso por asignación: si el retraso se prolonga no se insiste.
        #
        # La comprobación va sobre el trabajo encolado, no sobre la notificación:
        # esta última solo existe una vez que el worker lo procesa, y entre
        # encolar y procesar caben varias revisiones. Mirar solo Notification
        # reencolaba el mismo aviso en cada vuelta.
        ya_encolado = (
            db.query(Job.id)
            .filter(
                Job.type == JobType.SEND_NOTIFICATION,
                Job.payload["kind"].astext == KIND_PLAZO_VENCIDO,
                Job.payload["assignment_id"].astext == str(asignacion.id),
            )
            .first()
        )
        if ya_encolado is not None:
            continue

        destinatarios = [responsable.email]
        alerta = get_settings().default_alert_email
        if alerta and alerta.lower() not in {d.lower() for d in destinatarios}:
            destinatarios.append(alerta)

        enqueue_job(
            db,
            incident_id=incidencia.id,
            job_type=JobType.SEND_NOTIFICATION,
            payload={
                "kind": KIND_PLAZO_VENCIDO,
                "assignment_id": str(asignacion.id),
                "responsible_name": responsable.full_name,
                "due_at": asignacion.due_at.isoformat(),
                "recipient_overrides": destinatarios,
            },
        )
        encolados += 1

    if encolados:
        db.commit()
        logger.info("plazos_vencidos_encolados=%s", encolados)
    return encolados
