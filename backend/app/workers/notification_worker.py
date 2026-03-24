from __future__ import annotations

import socket
import time

from sqlalchemy.orm import joinedload

from app.core.config import get_settings
from app.db import base as _models_registry  # noqa: F401
from app.db.session import SessionLocal
from app.models.enums import JobType
from app.models.incident import Incident
from app.services.jobs import claim_next_job, complete_job, fail_job
from app.services.notifications import (
    register_notification,
    resolve_recipients,
    send_email_notification,
)


def run_worker() -> None:
    settings = get_settings()
    worker_id = f"notification-worker@{socket.gethostname()}"
    poll = settings.worker_poll_seconds

    while True:
        with SessionLocal() as db:
            job = claim_next_job(db, job_type=JobType.SEND_NOTIFICATION, worker_id=worker_id)
            if job is None:
                db.commit()
                time.sleep(poll)
                continue

            incident = (
                db.query(Incident)
                .options(joinedload(Incident.reporter))
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
                continue

            recipients = resolve_recipients(db, incident)
            if not recipients:
                fail_job(
                    db,
                    job,
                    error_message="No recipients resolved for incident",
                    retry_delay_seconds=settings.notification_retry_delay_seconds,
                )
                db.commit()
                continue

            errors = []
            for recipient in recipients:
                send_result = send_email_notification(incident=incident, recipient=recipient)
                register_notification(
                    db=db,
                    incident=incident,
                    recipient=recipient,
                    send_result=send_result,
                )
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


if __name__ == "__main__":
    run_worker()
