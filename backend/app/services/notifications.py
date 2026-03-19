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


def resolve_recipients(db: Session, incident: Incident) -> list[str]:
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
    return sorted(set(recipients))


def _compose_html(incident: Incident) -> str:
    settings = get_settings()
    detail_url = f"{settings.dashboard_base_url}/{incident.id}"
    return (
        "<h2>Nueva incidencia en campus</h2>"
        f"<p><strong>ID:</strong> {incident.id}</p>"
        f"<p><strong>Categoria:</strong> {incident.category.value}</p>"
        f"<p><strong>Prioridad:</strong> {incident.priority.value}</p>"
        f"<p><strong>Estado:</strong> {incident.status.value}</p>"
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
    if not settings.sendgrid_api_key or not settings.sendgrid_from_email:
        return EmailSendResult(
            status=NotificationStatus.FAILED,
            provider_message_id=None,
            error_message="SENDGRID_API_KEY or SENDGRID_FROM_EMAIL not configured",
        )

    payload = {
        "personalizations": [{"to": [{"email": recipient}]}],
        "from": {"email": settings.sendgrid_from_email},
        "subject": f"[{incident.priority.value}] Incidencia {incident.category.value} - {incident.id}",
        "content": [{"type": "text/html", "value": _compose_html(incident)}],
    }
    headers = {
        "Authorization": f"Bearer {settings.sendgrid_api_key}",
        "Content-Type": "application/json",
    }
    try:
        response = httpx.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers=headers,
            json=payload,
            timeout=10.0,
        )
        if 200 <= response.status_code < 300:
            message_id = response.headers.get("X-Message-Id")
            return EmailSendResult(
                status=NotificationStatus.SENT,
                provider_message_id=message_id,
                error_message=None,
            )
        return EmailSendResult(
            status=NotificationStatus.FAILED,
            provider_message_id=None,
            error_message=f"SendGrid error {response.status_code}: {response.text[:250]}",
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

