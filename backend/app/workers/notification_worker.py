from __future__ import annotations

import logging
import socket
import time
from datetime import datetime, timezone

from sqlalchemy.orm import Session, joinedload

from app.core.config import get_settings
from app.db import base as _models_registry  # noqa: F401
from app.db.session import SessionLocal
from app.models.enums import JobType, NotificationChannel, NotificationStatus
from app.models.incident import Incident
from app.models.job import Job
from app.models.notification import Notification
from app.services.jobs import claim_next_job, complete_job, fail_job, recover_expired_leases
from app.services.notifications import (
    KIND_INCIDENCIA_RESUELTA,
    KIND_PLAZO_VENCIDO,
    resolve_recipients,
    send_email_notification,
    send_overdue_notification,
    send_resolved_notification,
)

logger = logging.getLogger("campus.workers.notification")



def _despachar(job: Job, *, incident: Incident, recipient: str):
    """Elige el mensaje según el tipo declarado en el trabajo.

    Sin `kind` se asume el aviso de incidencia nueva, que es el comportamiento
    que tenían los trabajos encolados antes de existir los demás tipos.
    """
    payload = job.payload if isinstance(job.payload, dict) else {}
    kind = payload.get("kind")

    if kind == KIND_INCIDENCIA_RESUELTA:
        return send_resolved_notification(incident=incident, recipient=recipient)

    if kind == KIND_PLAZO_VENCIDO:
        return send_overdue_notification(
            incident=incident,
            recipient=recipient,
            responsible_name=str(payload.get("responsible_name") or "Sin responsable"),
            due_at=datetime.fromisoformat(payload["due_at"]),
        )

    return send_email_notification(incident=incident, recipient=recipient)


def _process_job(db: Session, job: Job) -> None:
    """Run one claimed job to completion.

    Raises on unexpected failures so the caller can mark the job as failed
    without losing the worker process.
    """
    settings = get_settings()

    incident = (
        db.query(Incident)
        .options(joinedload(Incident.reporter), joinedload(Incident.location))
        .filter(Incident.id == job.incident_id)
        .first()
    )
    if incident is None:
        fail_job(
            db,
            job,
            error_message="Incident not found for notification",
            retry_delay_seconds=settings.notification_retry_delay_seconds,
        )
        db.commit()
        return

    recipient_overrides = None
    if isinstance(job.payload, dict):
        raw_overrides = job.payload.get("recipient_overrides")
        if isinstance(raw_overrides, list):
            recipient_overrides = [
                str(item)
                for item in raw_overrides
                if isinstance(item, str) and item.strip()
            ]

    recipients = resolve_recipients(
        db,
        incident,
        recipient_overrides=recipient_overrides,
    )
    if not recipients:
        fail_job(
            db,
            job,
            error_message="No recipients resolved for incident",
            retry_delay_seconds=settings.notification_retry_delay_seconds,
        )
        db.commit()
        return

    errors = []
    for recipient in recipients:
        kind = (job.payload or {}).get("kind", "NUEVA_INCIDENCIA") if isinstance(job.payload, dict) else "NUEVA_INCIDENCIA"
        event_key = f"{kind}:job:{job.id}:recipient:{recipient.lower()}"
        notification = db.query(Notification).filter(Notification.event_key == event_key).first()
        if notification and notification.status == NotificationStatus.SENT:
            continue
        if notification and notification.status == NotificationStatus.SENDING:
            # A process may have died after handing the message to Brevo. Do
            # not risk a duplicate; surface it through the failed job queue.
            errors.append(f"Delivery status uncertain for {recipient}")
            continue
        if notification is None:
            notification = Notification(
                incident_id=incident.id,
                channel=NotificationChannel.EMAIL,
                recipient=recipient,
                event_key=event_key,
                subject=f"[{incident.priority.value}] Incidencia {incident.category.value}",
                payload={"incident_id": str(incident.id), "recipient": recipient},
                status=NotificationStatus.SENDING,
            )
            db.add(notification)
        else:
            notification.status = NotificationStatus.SENDING
            notification.error_message = None
        db.commit()
        send_result = _despachar(job, incident=incident, recipient=recipient)
        notification.status = send_result.status
        notification.provider_message_id = send_result.provider_message_id
        notification.error_message = send_result.error_message
        if send_result.status == NotificationStatus.SENT:
            notification.sent_at = datetime.now(timezone.utc)
        db.commit()
        if send_result.error_message:
            errors.append(send_result.error_message)

    if errors:
        fail_job(
            db,
            job,
            error_message="; ".join(errors)[:500],
            retry_delay_seconds=settings.notification_retry_delay_seconds,
        )
    else:
        complete_job(db, job)
    db.commit()


def run_worker() -> None:
    settings = get_settings()
    worker_id = f"notification-worker@{socket.gethostname()}"
    poll = settings.worker_poll_seconds

    while True:
        # Render starts the workers with `&` from the service start command, so a
        # dead worker is silent: only the admin system panel would show it STALE.
        # Keep the loop alive across any unexpected failure.
        try:
            with SessionLocal() as db:
                recover_expired_leases(db, lease_seconds=settings.job_lease_seconds)
                job = claim_next_job(db, job_type=JobType.SEND_NOTIFICATION, worker_id=worker_id)
                if job is None:
                    db.commit()
                    time.sleep(poll)
                    continue
                # Do not keep the claim transaction open during an email provider call.
                db.commit()

                job_id = job.id
                try:
                    _process_job(db, job)
                except Exception as exc:
                    logger.exception("notification_job_failed job_id=%s", job_id)
                    # The attempt counter was already committed when the job was
                    # claimed, so retry accounting survives this rollback.
                    db.rollback()
                    failed_job = db.get(Job, job_id)
                    if failed_job is not None:
                        fail_job(
                            db,
                            failed_job,
                            error_message=f"Unhandled worker error: {exc}",
                            retry_delay_seconds=settings.notification_retry_delay_seconds,
                        )
                        db.commit()
        except Exception:
            logger.exception("notification_worker_iteration_failed")
            time.sleep(poll)


if __name__ == "__main__":
    run_worker()
