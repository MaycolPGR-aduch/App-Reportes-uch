from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.enums import JobStatus, JobType
from app.models.job import Job


def enqueue_job(
    db: Session,
    *,
    incident_id: UUID,
    job_type: JobType,
    payload: dict[str, Any] | None = None,
    run_after: datetime | None = None,
    max_attempts: int = 5,
) -> Job:
    job = Job(
        incident_id=incident_id,
        type=job_type,
        status=JobStatus.PENDING,
        payload=payload or {},
        run_after=run_after or datetime.now(timezone.utc),
        max_attempts=max_attempts,
    )
    db.add(job)
    return job


def claim_next_job(db: Session, *, job_type: JobType, worker_id: str) -> Job | None:
    stmt = text(
        """
        WITH candidate AS (
            SELECT id
            FROM jobs
            WHERE type = :job_type
              AND status = 'PENDING'
              AND run_after <= now()
              AND attempts < max_attempts
            ORDER BY created_at
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        UPDATE jobs j
        SET
            status = 'PROCESSING',
            attempts = attempts + 1,
            locked_at = now(),
            locked_by = :worker_id,
            updated_at = now()
        FROM candidate
        WHERE j.id = candidate.id
        RETURNING j.id
        """
    )
    result = db.execute(stmt, {"job_type": job_type.value, "worker_id": worker_id})
    row = result.mappings().first()
    if row is None:
        return None
    return db.get(Job, row["id"])


def complete_job(db: Session, job: Job) -> None:
    job.status = JobStatus.COMPLETED
    job.locked_at = None
    job.locked_by = None
    job.last_error = None


def fail_job(
    db: Session,
    job: Job,
    *,
    error_message: str,
    retry_delay_seconds: int,
) -> None:
    has_retries_left = job.attempts < job.max_attempts
    job.last_error = error_message[:500]
    job.locked_at = None
    job.locked_by = None
    if has_retries_left:
        job.status = JobStatus.PENDING
        job.run_after = datetime.now(timezone.utc) + timedelta(
            seconds=retry_delay_seconds
        )
    else:
        job.status = JobStatus.FAILED

