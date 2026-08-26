from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models.enums import IncidentStatus
from app.models.incident import Incident
from app.services.storage import get_storage_provider


def purge_expired_incidents(db: Session) -> int:
    """Delete terminal incidents and private evidence after the retention window."""
    settings = get_settings()
    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.retention_days)
    incidents = (
        db.query(Incident)
        .options(selectinload(Incident.evidences))
        .filter(
            Incident.status.in_([IncidentStatus.RESOLVED, IncidentStatus.REJECTED]),
            Incident.updated_at < cutoff,
        )
        .all()
    )
    storage = get_storage_provider()
    for incident in incidents:
        for evidence in incident.evidences:
            storage.delete(evidence.storage_path)
        db.delete(incident)
    db.commit()
    return len(incidents)


def backup_evidences() -> int:
    """Upload the Render Disk tree to S3-compatible storage when configured."""
    settings = get_settings()
    if not settings.backup_s3_bucket:
        return 0
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
