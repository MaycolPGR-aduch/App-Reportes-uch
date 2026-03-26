from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

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
    settings = get_settings()
    detail_url = f"{settings.dashboard_base_url}/{incident.id}"
    location_html = "<p><strong>Ubicacion:</strong> Sin coordenadas</p>"
    if incident.location:
        zone_name = incident.location.resolved_zone_name or "Zona no definida"
        location_html = (
            f"<p><strong>Zona detectada:</strong> {zone_name}</p>"
            f"<p><strong>Estado ubicacion:</strong> {incident.location.location_status}</p>"
            "<p><strong>GPS:</strong> "
            f"{incident.location.latitude:.6f}, {incident.location.longitude:.6f}"
            "</p>"
        )

    return (
        "<h2>Nueva incidencia en campus</h2>"
        f"<p><strong>ID:</strong> {incident.id}</p>"
        f"<p><strong>Categoria:</strong> {incident.category.value}</p>"
        f"<p><strong>Prioridad:</strong> {incident.priority.value}</p>"
        f"<p><strong>Estado:</strong> {incident.status.value}</p>"
        f"{location_html}"
        f"<p><strong>Descripcion:</strong> {incident.description}</p>"
        f"<p><strong>Reportante:</strong> {incident.reporter.campus_id}</p>"
        f"<p><a href='{detail_url}'>Abrir en dashboard</a></p>"
    )


def send_email_notification(
    *,
    incident: Incident,
    recipient: str,
) -> EmailSendResult:
    settings = get_settings()
    if not settings.brevo_api_key or not settings.brevo_from_email:
        return EmailSendResult(
            status=NotificationStatus.FAILED,
            provider_message_id=None,
            error_message="BREVO_API_KEY or BREVO_FROM_EMAIL not configured",
        )

    payload = {
        "sender": {"email": settings.brevo_from_email, "name": settings.brevo_from_name},
        "to": [{"email": recipient}],
        "subject": f"[{incident.priority.value}] Incidencia {incident.category.value} - {incident.id}",
        "htmlContent": _compose_html(incident),
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


def register_notification(
    *,
    db: Session,
    incident: Incident,
    recipient: str,
    send_result: EmailSendResult,
) -> Notification:
    notification = Notification(
        incident_id=incident.id,
        channel=NotificationChannel.EMAIL,
        recipient=recipient,
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
