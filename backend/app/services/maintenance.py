from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging
import hashlib

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models.enums import IncidentStatus
from app.models.incident import Incident
from app.models.evidence_deletion import EvidenceDeletion
from app.models.status_event import IncidentStatusEvent
from app.services.storage import get_storage_provider

logger = logging.getLogger("campus.maintenance")


def _storage_identity(settings) -> str:
    location = (f"{settings.s3_endpoint_url or ''}|{settings.s3_bucket or ''}"
                if settings.storage_backend == "s3" else str(settings.local_storage_path.resolve()))
    return f"{settings.storage_backend}:{hashlib.sha256(location.encode()).hexdigest()}"


def purge_expired_incidents(db: Session) -> int:
    """Delete terminal incidents and private evidence after the retention window."""
    settings = get_settings()
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.retention_days)
    closed_at = select(func.max(IncidentStatusEvent.at)).where(
        IncidentStatusEvent.incident_id == Incident.id,
        IncidentStatusEvent.status == Incident.status,
    ).correlate(Incident).scalar_subquery()
    incidents = (
        db.query(Incident)
        .options(selectinload(Incident.evidences))
        .filter(
            Incident.status.in_([IncidentStatus.RESOLVED, IncidentStatus.REJECTED]),
            closed_at < cutoff,
        )
        .all()
    )
    for incident in incidents:
        for evidence in incident.evidences:
            db.add(EvidenceDeletion(storage_identity=_storage_identity(settings), storage_path=evidence.storage_path))
        db.delete(incident)
    db.commit()
    return len(incidents)


def drain_evidence_deletions(db: Session, *, limit: int = 100) -> int:
    """Solo confirma cada borrado tras completarlo; el fallo deja la fila para reintento."""
    settings = get_settings()
    deleted = 0
    pending = db.query(EvidenceDeletion).order_by(EvidenceDeletion.created_at).limit(limit).all()
    for item in pending:
        if item.storage_identity != _storage_identity(settings):
            logger.error("evidence_deletion_backend_mismatch id=%s", item.id)
            continue
        try:
            get_storage_provider().delete(item.storage_path)
            db.delete(item)
            db.commit()
            deleted += 1
        except Exception:
            db.rollback()
            logger.exception("evidence_deletion_failed")
    return deleted


def backup_evidences() -> int:
    """Upload the Render Disk tree to S3-compatible storage when configured."""
    settings = get_settings()
    if not settings.backup_s3_bucket:
        return 0
    if settings.storage_backend == "s3":
        raise RuntimeError("Evidence backup for S3/R2 primary storage is not implemented")
    try:
        import boto3
    except ImportError as exc:  # pragma: no cover
        raise RuntimeError("boto3 is required when BACKUP_S3_BUCKET is configured") from exc
    client = boto3.client("s3")
    uploaded = 0
    for path in settings.local_storage_path.rglob("*"):
        if not path.is_file():
            continue
        key = f"{settings.backup_s3_prefix.rstrip('/')}/{path.relative_to(settings.local_storage_path).as_posix()}"
        client.upload_file(str(path), settings.backup_s3_bucket, key, ExtraArgs={"ServerSideEncryption": "AES256"})
        uploaded += 1
    return uploaded
