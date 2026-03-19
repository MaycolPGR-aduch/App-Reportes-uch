from __future__ import annotations

import socket
import time
from datetime import datetime, timezone

from sqlalchemy.orm import joinedload

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.ai_metric import AIMetric
from app.models.enums import JobType, PriorityLevel
from app.models.incident import Incident
from app.services.ai import classify_incident
from app.services.jobs import claim_next_job, complete_job, enqueue_job, fail_job


def run_worker() -> None:
    settings = get_settings()
    worker_id = f"ai-worker@{socket.gethostname()}"
    poll = settings.worker_poll_seconds

    while True:
        with SessionLocal() as db:
            job = claim_next_job(db, job_type=JobType.CLASSIFY_INCIDENT, worker_id=worker_id)
            if job is None:
                db.commit()
                time.sleep(poll)
                continue

            incident = (
                db.query(Incident)
                .options(joinedload(Incident.evidences))
                .filter(Incident.id == job.incident_id)
                .first()
            )
            if incident is None:
                fail_job(
                    db,
                    job,
                    error_message="Incident not found for classification",
                    retry_delay_seconds=settings.classification_retry_delay_seconds,
                )
                db.commit()
                continue

            evidence_metadata = incident.evidences[0].metadata_json if incident.evidences else None

            try:
                result = classify_incident(
                    description=incident.description,
                    user_category=incident.category,
                    evidence_metadata=evidence_metadata,
                )
                ai_metric = AIMetric(
                    incident_id=incident.id,
                    model_name=settings.openai_model,
                    prompt_version=settings.openai_prompt_version,
                    predicted_category=result.predicted_category,
                    priority_score=result.priority_score,
                    priority_label=result.priority_label,
                    confidence=result.confidence,
                    latency_ms=result.latency_ms,
                    reasoning_summary=result.reasoning_summary,
                    raw_response=result.raw_response,
                )
                db.add(ai_metric)

                if result.confidence >= 0.750:
                    incident.category = result.predicted_category
                if incident.priority != PriorityLevel.CRITICAL:
                    incident.priority = result.priority_label

                enqueue_job(
                    db,
                    incident_id=incident.id,
                    job_type=JobType.SEND_NOTIFICATION,
                    payload={
                        "source": "ai_classification",
                        "classified_at": datetime.now(timezone.utc).isoformat(),
                    },
                )
                complete_job(db, job)
                db.commit()
            except Exception as exc:
                fail_job(
                    db,
                    job,
                    error_message=str(exc),
                    retry_delay_seconds=settings.classification_retry_delay_seconds,
                )
                db.commit()


if __name__ == "__main__":
    run_worker()

