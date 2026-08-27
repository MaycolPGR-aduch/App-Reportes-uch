from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from html import escape

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.enums import (
    NotificationChannel,
    NotificationStatus,
    PriorityLevel,
)
from app.models.incident import Incident
from app.models.notification import Notification
from app.models.responsible import Responsible

PRIORITY_RANK = {
    PriorityLevel.LOW: 1,
    PriorityLevel.MEDIUM: 2,
    PriorityLevel.HIGH: 3,
    PriorityLevel.CRITICAL: 4,
}


@dataclass
class EmailSendResult:
    status: NotificationStatus
    provider_message_id: str | None
    error_message: str | None


def _normalize_recipients(raw_recipients: list[str]) -> list[str]:
    normalized: list[str] = []
    for raw in raw_recipients:
        email = raw.strip().lower()
        if email:
            normalized.append(email)
    return sorted(set(normalized))


def resolve_recipients(
    db: Session,
    incident: Incident,
    *,
    recipient_overrides: list[str] | None = None,
) -> list[str]:
    if recipient_overrides:
        return _normalize_recipients(recipient_overrides)

    rows = (
        db.query(Responsible)
        .filter(
            Responsible.category == incident.category,
            Responsible.is_active.is_(True),
        )
        .all()
    )

    recipients = []
    incident_rank = PRIORITY_RANK[incident.priority]
    for row in rows:
        if incident_rank >= PRIORITY_RANK[row.min_priority]:
            recipients.append(row.email)

    settings = get_settings()
    if not recipients and settings.default_alert_email:
        recipients.append(settings.default_alert_email)
    return _normalize_recipients(recipients)


def _compose_html(incident: Incident) -> str:
    # sanitize_description only strips control characters, so reporter-supplied
    # text still carries markup. Escaping belongs here, at the presentation edge.
    settings = get_settings()
    detail_url = escape(f"{settings.dashboard_base_url}/{incident.id}", quote=True)
    location_html = "<p><strong>Ubicacion:</strong> Sin coordenadas</p>"
    if incident.location:
        zone_name = escape(incident.location.resolved_zone_name or "Zona no definida")
        location_html = (
            f"<p><strong>Zona detectada:</strong> {zone_name}</p>"
            f"<p><strong>Estado ubicacion:</strong> {escape(incident.location.location_status)}</p>"
            "<p><strong>GPS:</strong> "
            f"{incident.location.latitude:.6f}, {incident.location.longitude:.6f}"
            "</p>"
        )

    # Anonymous reports carry no reporter row; mirror the label used by the
    # protected incident serializer instead of dereferencing a null relation.
    reporter_label = escape(
        incident.reporter.campus_id if incident.reporter else "Anonimo"
    )

    return (
        "<h2>Nueva incidencia en campus</h2>"
        f"<p><strong>ID:</strong> {escape(str(incident.id))}</p>"
        f"<p><strong>Categoria:</strong> {escape(incident.category.value)}</p>"
        f"<p><strong>Prioridad:</strong> {escape(incident.priority.value)}</p>"
        f"<p><strong>Estado:</strong> {escape(incident.status.value)}</p>"
        f"{location_html}"
        f"<p><strong>Descripcion:</strong> {escape(incident.description)}</p>"
        f"<p><strong>Reportante:</strong> {reporter_label}</p>"
        f"<p><a href='{detail_url}'>Abrir en dashboard</a></p>"
    )


def _send_via_brevo(*, recipient: str, subject: str, html: str) -> EmailSendResult:
    """Envío en bruto. Cada tipo de aviso compone su asunto y cuerpo y delega aquí."""
    settings = get_settings()
    if not settings.brevo_api_key or not settings.brevo_from_email:
        return EmailSendResult(
            status=NotificationStatus.FAILED,
            provider_message_id=None,
            error_message="BREVO_API_KEY or BREVO_FROM_EMAIL not configured",
        )
    if not settings.alerts_enabled:
        # Interruptor general: la evaluación sigue corriendo y el panel sigue
        # reportando, pero no se gasta cuota del proveedor en desarrollo.
        return EmailSendResult(
            status=NotificationStatus.FAILED,
            provider_message_id=None,
            error_message="ALERTS_ENABLED=false: envío suprimido",
        )

    payload = {
        "sender": {"email": settings.brevo_from_email, "name": settings.brevo_from_name},
        "to": [{"email": recipient}],
        "subject": subject,
        "htmlContent": html,
    }
    headers = {
        "api-key": settings.brevo_api_key,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    try:
        response = httpx.post(
            "https://api.brevo.com/v3/smtp/email",
            headers=headers,
            json=payload,
            timeout=10.0,
        )
        if response.status_code in {200, 201, 202}:
            message_id = None
            try:
                body = response.json()
                if isinstance(body, dict) and isinstance(body.get("messageId"), str):
                    message_id = body["messageId"]
            except Exception:
                message_id = None
            return EmailSendResult(
                status=NotificationStatus.SENT,
                provider_message_id=message_id,
                error_message=None,
            )
        return EmailSendResult(
            status=NotificationStatus.FAILED,
            provider_message_id=None,
            error_message=f"Brevo error {response.status_code}: {response.text[:250]}",
        )
    except Exception as exc:
        return EmailSendResult(
            status=NotificationStatus.FAILED,
            provider_message_id=None,
            error_message=str(exc)[:250],
        )


def send_email_notification(*, incident: Incident, recipient: str) -> EmailSendResult:
    """Aviso al personal de que hay una incidencia nueva que atender."""
    return _send_via_brevo(
        recipient=recipient,
        subject=f"[{incident.priority.value}] Incidencia {incident.category.value} - {incident.id}",
        html=_compose_html(incident),
    )


# --------------------------------------------------------- Tipos de aviso
# El tipo viaja en jobs.payload["kind"], que ya es JSONB y ya lo lee el worker.

KIND_NUEVA_INCIDENCIA = "NUEVA_INCIDENCIA"
KIND_INCIDENCIA_RESUELTA = "INCIDENCIA_RESUELTA"
KIND_PLAZO_VENCIDO = "PLAZO_VENCIDO"


def send_resolved_notification(*, incident: Incident, recipient: str) -> EmailSendResult:
    """Aviso a quien reportó de que su incidencia quedó resuelta.

    Deliberadamente escueto: sin datos del personal, sin traza de clasificación
    y sin enlace al panel, porque quien lo recibe no tiene acceso a él.
    """
    zona = escape(
        (incident.location.resolved_zone_name if incident.location else None)
        or "el campus"
    )
    html = (
        "<h2>Tu reporte fue atendido</h2>"
        "<p>La incidencia que reportaste fue marcada como resuelta.</p>"
        f"<p><strong>Lo que reportaste:</strong> {escape(incident.description)}</p>"
        f"<p><strong>Dónde:</strong> {zona}</p>"
        f"<p><strong>Categoría:</strong> {escape(incident.category.value)}</p>"
        "<p>Gracias por avisar: los reportes de la comunidad son lo que permite "
        "detectar y corregir estos problemas.</p>"
    )
    return _send_via_brevo(
        recipient=recipient,
        subject="Tu reporte en el campus fue atendido",
        html=html,
    )


def send_overdue_notification(
    *,
    incident: Incident,
    recipient: str,
    responsible_name: str,
    due_at: datetime,
) -> EmailSendResult:
    """Aviso de que una asignación pasó su plazo de atención.

    No altera la incidencia: solo informa. Se envía una vez por asignación.
    """
    settings = get_settings()
    detail_url = escape(f"{settings.dashboard_base_url}/{incident.id}", quote=True)
    zona = escape(
        (incident.location.resolved_zone_name if incident.location else None)
        or "Zona no definida"
    )
    html = (
        "<h2>Asignación con plazo vencido</h2>"
        f"<p><strong>Responsable:</strong> {escape(responsible_name)}</p>"
        f"<p><strong>Vencía:</strong> {escape(due_at.strftime('%d/%m/%Y %H:%M'))}</p>"
        f"<p><strong>Prioridad:</strong> {escape(incident.priority.value)}</p>"
        f"<p><strong>Zona:</strong> {zona}</p>"
        f"<p><strong>Incidencia:</strong> {escape(incident.description)}</p>"
        "<p>La incidencia no fue modificada: sigue con su prioridad y estado "
        "actuales. Este aviso se envía una sola vez.</p>"
        f"<p><a href='{detail_url}'>Abrir en dashboard</a></p>"
    )
    return _send_via_brevo(
        recipient=recipient,
        subject=f"[Plazo vencido] Incidencia {incident.category.value} - {incident.id}",
        html=html,
    )


def send_system_alert(
    *,
    recipient: str,
    kind: str,
    titulo: str,
    detalle: str,
    consecuencia: str,
    recuperado: bool = False,
) -> EmailSendResult:
    """Aviso sobre la salud del sistema, o su recuperación.

    Nombrar la consecuencia práctica es lo que distingue una alerta útil de un
    volcado de estado: quien la lee necesita saber qué deja de funcionar.
    """
    if recuperado:
        html = (
            f"<h2>Resuelto: {escape(titulo)}</h2>"
            f"<p>{escape(detalle)}</p>"
            "<p>El sistema volvió a operar con normalidad. No hace falta ninguna acción.</p>"
        )
        asunto = f"[Resuelto] {titulo}"
    else:
        html = (
            f"<h2>{escape(titulo)}</h2>"
            f"<p>{escape(detalle)}</p>"
            f"<p><strong>Qué implica:</strong> {escape(consecuencia)}</p>"
            "<p>Revisa la pestaña Sistema del panel de administración para el "
            "detalle completo.</p>"
        )
        asunto = f"[Campus Alertas] {titulo}"

    return _send_via_brevo(recipient=recipient, subject=asunto, html=html)


def register_notification(
    *,
    db: Session,
    incident: Incident,
    recipient: str,
    send_result: EmailSendResult,
    event_key: str | None = None,
) -> Notification:
    notification = Notification(
        incident_id=incident.id,
        channel=NotificationChannel.EMAIL,
        recipient=recipient,
        event_key=event_key,
        subject=f"[{incident.priority.value}] Incidencia {incident.category.value}",
        payload={"incident_id": str(incident.id), "recipient": recipient},
        provider_message_id=send_result.provider_message_id,
        status=send_result.status,
        sent_at=datetime.now(timezone.utc)
        if send_result.status == NotificationStatus.SENT
        else None,
        error_message=send_result.error_message,
    )
    db.add(notification)
    return notification
