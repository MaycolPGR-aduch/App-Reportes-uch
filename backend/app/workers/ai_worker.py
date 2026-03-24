from __future__ import annotations

import socket
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy.orm import joinedload

from app.core.config import get_settings
from app.db import base as _models_registry  # noqa: F401
from app.db.session import SessionLocal
from app.models.ai_metric import AIMetric
from app.models.assignment import IncidentAssignment
from app.models.enums import IncidentStatus, JobType, PriorityLevel
from app.models.incident import Incident
from app.models.responsible import Responsible
from app.services.ai import classify_incident
from app.services.jobs import claim_next_job, complete_job, enqueue_job, fail_job

PRIORITY_SLA_HOURS = {
    PriorityLevel.CRITICAL: 2,
    PriorityLevel.HIGH: 6,
    PriorityLevel.MEDIUM: 24,
    PriorityLevel.LOW: 72,
}


def _safe_load_evidence_bytes(
    *,
    storage_root: Path,
    relative_path: str | None,
    max_bytes: int = 4 * 1024 * 1024,
) -> bytes | None:
    if not relative_path:
        return None
    try:
        candidate = (storage_root.parent / relative_path).resolve()
        storage_parent = storage_root.parent.resolve()
        if storage_parent not in candidate.parents and candidate != storage_parent:
            return None
        if not candidate.exists() or not candidate.is_file():
            return None
        file_size = candidate.stat().st_size
        if file_size <= 0 or file_size > max_bytes:
            return None
        return candidate.read_bytes()
    except Exception:
        return None


def _resolve_responsible_for_assignment(
    *,
    db,
    incident: Incident,
    assigned_to_hint: str | None,
) -> Responsible | None:
    category_responsibles = (
        db.query(Responsible)
        .filter(
            Responsible.category == incident.category,
            Responsible.is_active.is_(True),
        )
        .all()
    )
    if not category_responsibles:
        return None

    if assigned_to_hint:
        hint = assigned_to_hint.strip().lower()
        for responsible in category_responsibles:
            if hint in responsible.area_name.lower():
                return responsible

    # Fallback: choose one deterministically.
    sorted_rows = sorted(
        category_responsibles,
        key=lambda row: (row.min_priority.value, row.created_at, row.full_name.lower()),
    )
    return sorted_rows[0]


def _create_or_update_assignment(
    *,
    db,
    incident: Incident,
    responsible: Responsible,
    note: str,
) -> None:
    existing = (
        db.query(IncidentAssignment)
        .filter(
            IncidentAssignment.incident_id == incident.id,
            IncidentAssignment.responsible_id == responsible.id,
        )
        .order_by(IncidentAssignment.created_at.desc())
        .first()
    )
    if existing:
        existing.notes = note[:300]
        return

    due_at = datetime.now(timezone.utc) + timedelta(
        hours=PRIORITY_SLA_HOURS.get(incident.priority, 24)
    )
    assignment = IncidentAssignment(
        incident_id=incident.id,
        responsible_id=responsible.id,
        assigned_at=datetime.now(timezone.utc),
        due_at=due_at,
        notes=note[:300],
    )
    db.add(assignment)


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
            image_bytes = None
            image_mime_type = None
            if incident.evidences:
                first_evidence = incident.evidences[0]
                image_mime_type = first_evidence.mime_type
                image_bytes = _safe_load_evidence_bytes(
                    storage_root=settings.local_storage_path,
                    relative_path=first_evidence.storage_path,
                )

            try:
                result = classify_incident(
                    description=incident.description,
                    user_category=incident.category,
                    evidence_metadata=evidence_metadata,
                    image_bytes=image_bytes,
                    image_mime_type=image_mime_type,
                )
                ai_metric = AIMetric(
                    incident_id=incident.id,
                    model_name=settings.gemini_model,
                    prompt_version=settings.gemini_prompt_version,
                    predicted_category=result.predicted_category,
                    priority_score=result.priority_score,
                    priority_label=result.priority_label,
                    confidence=result.confidence,
                    latency_ms=result.latency_ms,
                    reasoning_summary=result.reasoning_summary,
                    raw_response={
                        **(result.raw_response or {}),
                        "is_appropriate": result.is_appropriate,
                        "is_incident": result.is_incident,
                        "reason": result.reason,
                        "suggested_title": result.suggested_title,
                        "assigned_to": result.assigned_to,
                    },
                )
                db.add(ai_metric)

                # Moderation / false-positive controls extracted from the pilot behavior.
                if not result.is_appropriate:
                    incident.status = IncidentStatus.REJECTED
                elif not result.is_incident and incident.status == IncidentStatus.REPORTED:
                    incident.status = IncidentStatus.IN_REVIEW

                if result.confidence >= 0.750 and result.is_incident:
                    incident.category = result.predicted_category
                if incident.priority != PriorityLevel.CRITICAL and result.is_incident:
                    incident.priority = result.priority_label

                if result.is_appropriate and result.is_incident:
                    responsible = _resolve_responsible_for_assignment(
                        db=db,
                        incident=incident,
                        assigned_to_hint=result.assigned_to,
                    )
                    if responsible:
                        assignment_note = (
                            f"Asignacion sugerida por IA ({settings.gemini_model}). "
                            f"Titulo sugerido: {result.suggested_title or 'N/A'}"
                        )
                        _create_or_update_assignment(
                            db=db,
                            incident=incident,
                            responsible=responsible,
                            note=assignment_note,
                        )

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
