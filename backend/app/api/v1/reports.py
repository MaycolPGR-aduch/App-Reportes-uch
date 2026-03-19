from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_optional_user
from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import get_db
from app.models.enums import (
    IncidentCategory,
    IncidentStatus,
    JobType,
    PriorityLevel,
    UserRole,
    UserStatus,
)
from app.models.evidence import IncidentEvidence
from app.models.incident import Incident
from app.models.location import IncidentLocation
from app.models.user import User
from app.schemas.incident import (
    AIMetricOut,
    EvidenceOut,
    IncidentDetail,
    IncidentListItem,
    IncidentListResponse,
    LocationOut,
    NotificationOut,
)
from app.schemas.report import ReportCreateResponse, ReportValidation
from app.services.jobs import enqueue_job
from app.services.sanitizer import sanitize_description
from app.services.storage import LocalStorageProvider

router = APIRouter(tags=["reports"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}

ANONYMOUS_CAMPUS_ID = "__anonymous__"
ANONYMOUS_EMAIL = "anonymous@campus.local"
ANONYMOUS_NAME = "Reporte Anonimo"


def _get_or_create_anonymous_user(db: Session) -> User:
    anonymous = db.query(User).filter(User.campus_id == ANONYMOUS_CAMPUS_ID).first()
    if anonymous:
        return anonymous

    anonymous = User(
        campus_id=ANONYMOUS_CAMPUS_ID,
        full_name=ANONYMOUS_NAME,
        email=ANONYMOUS_EMAIL,
        password_hash=hash_password("AnonymousReporter#2026"),
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )
    db.add(anonymous)
    db.flush()
    return anonymous


def _build_incident_detail(incident: Incident) -> IncidentDetail:
    location = (
        LocationOut(
            latitude=incident.location.latitude,
            longitude=incident.location.longitude,
            accuracy_m=incident.location.accuracy_m,
            reference=incident.location.reference,
            captured_at=incident.location.captured_at,
        )
        if incident.location
        else None
    )

    evidences = [
        EvidenceOut(
            id=e.id,
            storage_path=e.storage_path,
            mime_type=e.mime_type,
            file_size_bytes=e.file_size_bytes,
            sha256_hash=e.sha256_hash,
            metadata_json=e.metadata_json,
            created_at=e.created_at,
        )
        for e in incident.evidences
    ]
    ai_metrics = [
        AIMetricOut(
            id=m.id,
            model_name=m.model_name,
            prompt_version=m.prompt_version,
            predicted_category=m.predicted_category,
            priority_score=m.priority_score,
            priority_label=m.priority_label,
            confidence=m.confidence,
            latency_ms=m.latency_ms,
            reasoning_summary=m.reasoning_summary,
            created_at=m.created_at,
        )
        for m in incident.ai_metrics
    ]
    notifications = [
        NotificationOut(
            id=n.id,
            recipient=n.recipient,
            status=n.status,
            channel=n.channel.value,
            subject=n.subject,
            sent_at=n.sent_at,
            created_at=n.created_at,
        )
        for n in incident.notifications
    ]
    return IncidentDetail(
        id=incident.id,
        category=incident.category,
        status=incident.status,
        priority=incident.priority,
        description=incident.description,
        trace_id=incident.trace_id,
        created_at=incident.created_at,
        updated_at=incident.updated_at,
        reporter_campus_id=incident.reporter.campus_id,
        reporter_name=incident.reporter.full_name,
        location=location,
        evidences=evidences,
        ai_metrics=ai_metrics,
        notifications=notifications,
    )


@router.post("/reports", response_model=ReportCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    description: Annotated[str, Form(...)],
    category: Annotated[IncidentCategory, Form(...)],
    latitude: Annotated[float, Form(...)],
    longitude: Annotated[float, Form(...)],
    accuracy_m: Annotated[float | None, Form()] = None,
    location_reference: Annotated[str | None, Form()] = None,
    photo: UploadFile = File(...),
    trace_id: str | None = Header(default=None, alias="X-Trace-Id"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> ReportCreateResponse:
    settings = get_settings()

    sanitized_description = sanitize_description(description)
    try:
        _ = ReportValidation(
            description=sanitized_description,
            category=category,
            latitude=latitude,
            longitude=longitude,
            accuracy_m=accuracy_m,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if photo.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported image type. Allowed: {sorted(ALLOWED_IMAGE_TYPES)}",
        )

    file_bytes = await photo.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Photo file is empty")

    max_size_bytes = settings.max_image_size_mb * 1024 * 1024
    if len(file_bytes) > max_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Photo exceeds {settings.max_image_size_mb}MB limit",
        )

    storage = LocalStorageProvider(settings.local_storage_path)
    try:
        stored = storage.save_incident_image(
            content=file_bytes,
            mime_type=photo.content_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    reporter = current_user or _get_or_create_anonymous_user(db)

    incident = Incident(
        reporter_id=reporter.id,
        description=sanitized_description,
        category=category,
        status=IncidentStatus.REPORTED,
        priority=PriorityLevel.MEDIUM,
        trace_id=(trace_id or "")[:64] or None,
        created_by=reporter.campus_id,
    )
    db.add(incident)
    db.flush()

    location = IncidentLocation(
        incident_id=incident.id,
        latitude=latitude,
        longitude=longitude,
        accuracy_m=accuracy_m,
        reference=(location_reference or "").strip()[:255] or None,
    )
    evidence = IncidentEvidence(
        incident_id=incident.id,
        storage_path=stored.relative_path,
        mime_type=stored.mime_type,
        file_size_bytes=stored.size_bytes,
        sha256_hash=stored.sha256_hash,
        metadata_json={
            "original_filename": photo.filename,
            "saved_path": stored.absolute_path,
        },
    )
    db.add_all([location, evidence])

    enqueue_job(
        db,
        incident_id=incident.id,
        job_type=JobType.CLASSIFY_INCIDENT,
        payload={"source": "report_created"},
    )
    enqueue_job(
        db,
        incident_id=incident.id,
        job_type=JobType.SEND_NOTIFICATION,
        payload={"source": "report_created"},
    )

    db.commit()
    db.refresh(incident)
    return ReportCreateResponse(
        incident_id=incident.id,
        status=incident.status,
        created_at=incident.created_at,
        ai_status="PENDING",
    )


@router.get("/incidents", response_model=IncidentListResponse)
def list_incidents(
    status_filter: IncidentStatus | None = None,
    category: IncidentCategory | None = None,
    priority: PriorityLevel | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> IncidentListResponse:
    safe_limit = min(max(limit, 1), 100)
    safe_offset = max(offset, 0)

    filters = []
    if status_filter:
        filters.append(Incident.status == status_filter)
    if category:
        filters.append(Incident.category == category)
    if priority:
        filters.append(Incident.priority == priority)
    if date_from:
        filters.append(Incident.created_at >= date_from)
    if date_to:
        filters.append(Incident.created_at <= date_to)

    base_query = db.query(Incident).join(User, Incident.reporter_id == User.id)
    if filters:
        base_query = base_query.filter(and_(*filters))

    total = base_query.with_entities(func.count(Incident.id)).scalar() or 0
    incidents = (
        base_query.options(joinedload(Incident.reporter))
        .order_by(Incident.created_at.desc())
        .offset(safe_offset)
        .limit(safe_limit)
        .all()
    )

    items = [
        IncidentListItem(
            id=inc.id,
            category=inc.category,
            status=inc.status,
            priority=inc.priority,
            description=inc.description,
            created_at=inc.created_at,
            reporter_campus_id=inc.reporter.campus_id,
        )
        for inc in incidents
    ]
    return IncidentListResponse(total=total, items=items)


@router.get("/incidents/{incident_id}", response_model=IncidentDetail)
def get_incident_detail(
    incident_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> IncidentDetail:
    incident = (
        db.query(Incident)
        .options(
            joinedload(Incident.reporter),
            joinedload(Incident.location),
            joinedload(Incident.evidences),
            joinedload(Incident.ai_metrics),
            joinedload(Incident.notifications),
        )
        .filter(Incident.id == incident_id)
        .first()
    )
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return _build_incident_detail(incident)


@router.get("/incidents/{incident_id}/evidences/{evidence_id}")
def get_incident_evidence_file(
    incident_id: UUID,
    evidence_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> FileResponse:
    evidence = (
        db.query(IncidentEvidence)
        .filter(
            IncidentEvidence.id == evidence_id,
            IncidentEvidence.incident_id == incident_id,
        )
        .first()
    )
    if evidence is None:
        raise HTTPException(status_code=404, detail="Evidence not found")

    settings = get_settings()
    evidence_path = (settings.local_storage_path.parent / evidence.storage_path).resolve()
    base_data_path = settings.local_storage_path.parent.resolve()
    if base_data_path not in evidence_path.parents and evidence_path != base_data_path:
        raise HTTPException(status_code=400, detail="Invalid evidence path")
    if not evidence_path.exists():
        raise HTTPException(status_code=404, detail="Evidence file missing on disk")

    extension = Path(evidence.storage_path).suffix
    filename = f"incident-{incident_id}-evidence-{evidence_id}{extension}"
    return FileResponse(
        path=evidence_path,
        media_type=evidence.mime_type,
        filename=filename,
    )
