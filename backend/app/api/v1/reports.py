from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import and_, func
from sqlalchemy.orm import Session, joinedload, selectinload

from app.api.deps import get_current_admin, get_current_user, get_optional_user
from app.core.config import get_settings
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
from app.models.assignment import IncidentAssignment
from app.models.incident import Incident
from app.models.location import IncidentLocation
from app.models.user import User
from app.schemas.incident import (
    AIMetricOut,
    AssignmentOut,
    EvidenceOut,
    IncidentDetail,
    IncidentListItem,
    IncidentListResponse,
    LocationOut,
    NotificationOut,
)
from app.schemas.report import ReportCreateResponse, ReportValidation
from app.schemas.report import ReportImageAnalysisResponse
from app.services.ai import classify_incident
from app.services.jobs import enqueue_job
from app.services.location_resolver import resolve_campus_zone
from app.services.sanitizer import sanitize_description, sanitize_title
from app.services.captcha import verify_turnstile
from app.services.images import InvalidImageError, normalize_image
from app.services.rate_limit import client_identifier, enforce_rate_limit
from app.services.storage import LocalStorageProvider

router = APIRouter(tags=["reports"])

def _build_incident_detail(incident: Incident, *, include_sensitive: bool) -> IncidentDetail:
    location = (
        LocationOut(
            latitude=incident.location.latitude,
            longitude=incident.location.longitude,
            accuracy_m=incident.location.accuracy_m,
            reference=incident.location.reference,
            resolved_zone_id=incident.location.resolved_zone_id,
            resolved_zone_name=incident.location.resolved_zone_name,
            location_status=incident.location.location_status,
            location_confidence=incident.location.location_confidence,
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
            raw_response=m.raw_response if include_sensitive else None,
            created_at=m.created_at,
        )
        for m in sorted(incident.ai_metrics, key=lambda x: x.created_at, reverse=True)
    ]
    assignments = [
        AssignmentOut(
            id=a.id,
            responsible_id=a.responsible_id,
            responsible_name=a.responsible.full_name,
            responsible_area=a.responsible.area_name,
            responsible_email=a.responsible.email,
            responsible_phone=a.responsible.phone_number,
            status=a.status,
            notes=a.notes,
            assigned_at=a.assigned_at,
            due_at=a.due_at,
            completed_at=a.completed_at,
            created_at=a.created_at,
        )
        for a in sorted(incident.assignments, key=lambda x: x.created_at, reverse=True)
        if a.responsible is not None
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
        reporter_campus_id=incident.reporter.campus_id if include_sensitive and incident.reporter else "Protegido",
        reporter_name=incident.reporter.full_name if include_sensitive and incident.reporter else "Reporte protegido",
        location=location,
        evidences=evidences,
        ai_metrics=ai_metrics if include_sensitive else [],
        assignments=assignments,
        notifications=notifications if include_sensitive else [],
    )


@router.post("/reports", response_model=ReportCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    description: Annotated[str, Form(...)],
    category: Annotated[IncidentCategory, Form(...)],
    latitude: Annotated[float, Form(...)],
    longitude: Annotated[float, Form(...)],
    photo: UploadFile = File(...),
    title: Annotated[str | None, Form()] = None,
    accuracy_m: Annotated[float | None, Form()] = None,
    location_reference: Annotated[str | None, Form()] = None,
    trace_id: str | None = Header(default=None, alias="X-Trace-Id"),
    turnstile_token: str | None = Header(default=None, alias="X-Turnstile-Token"),
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> ReportCreateResponse:
    settings = get_settings()

    if current_user is None:
        enforce_rate_limit(
            db,
            scope="public_report",
            identifier=client_identifier(request),
            limit=settings.rate_limit_public_report,
            window_seconds=3600,
        )
        verify_turnstile(turnstile_token, request)

    sanitized_title = sanitize_title(title or "")
    sanitized_description = sanitize_description(description)
    if sanitized_title:
        sanitized_description = f"{sanitized_title}. {sanitized_description}"[:280]

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

    file_bytes = await photo.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Photo file is empty")

    max_size_bytes = settings.max_image_size_mb * 1024 * 1024
    if len(file_bytes) > max_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Photo exceeds {settings.max_image_size_mb}MB limit",
        )

    try:
        normalized_bytes, normalized_mime = normalize_image(
            file_bytes,
            declared_mime=photo.content_type,
            max_pixels=settings.max_image_pixels,
        )
    except InvalidImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    storage = LocalStorageProvider(settings.local_storage_path)
    stored = None
    try:
        stored = storage.save_incident_image(
            content=normalized_bytes,
            mime_type=normalized_mime,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    incident = Incident(
        reporter_id=current_user.id if current_user else None,
        description=sanitized_description,
        category=category,
        status=IncidentStatus.REPORTED,
        priority=PriorityLevel.MEDIUM,
        trace_id=(trace_id or "")[:64] or None,
        created_by=current_user.campus_id if current_user else "anonymous",
    )
    db.add(incident)
    db.flush()

    location = IncidentLocation(
        incident_id=incident.id,
        latitude=latitude,
        longitude=longitude,
        accuracy_m=accuracy_m,
        reference=(location_reference or "").strip()[:255] or None,
        location_status="UNKNOWN",
    )

    resolved_location = resolve_campus_zone(
        db,
        latitude=latitude,
        longitude=longitude,
        accuracy_m=accuracy_m,
    )
    location.resolved_zone_id = resolved_location.zone_id
    location.resolved_zone_name = resolved_location.zone_name
    location.location_status = resolved_location.location_status
    location.location_confidence = resolved_location.location_confidence

    evidence = IncidentEvidence(
        incident_id=incident.id,
        storage_path=stored.relative_path,
        mime_type=stored.mime_type,
        file_size_bytes=stored.size_bytes,
        sha256_hash=stored.sha256_hash,
        metadata_json={
            "original_filename": photo.filename,
            "saved_path": stored.absolute_path,
            "reported_title": sanitized_title or None,
        },
    )
    db.add_all([location, evidence])

    enqueue_job(
        db,
        incident_id=incident.id,
        job_type=JobType.CLASSIFY_INCIDENT,
        payload={"source": "report_created"},
    )

    try:
        db.commit()
    except Exception:
        db.rollback()
        if stored:
            storage.delete(stored.relative_path)
        raise
    db.refresh(incident)
    return ReportCreateResponse(
        incident_id=incident.id,
        status=incident.status,
        created_at=incident.created_at,
        ai_status="PENDING",
    )


@router.post(
    "/reports/analyze-image",
    response_model=ReportImageAnalysisResponse,
    status_code=status.HTTP_200_OK,
)
async def analyze_report_image(
    photo: UploadFile = File(...),
    description: Annotated[str | None, Form()] = None,
    category: Annotated[IncidentCategory, Form()] = IncidentCategory.INFRASTRUCTURE,
    request: Request = None,
    turnstile_token: str | None = Header(default=None, alias="X-Turnstile-Token"),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
) -> ReportImageAnalysisResponse:
    settings = get_settings()
    if current_user is None:
        enforce_rate_limit(
            db,
            scope="image_analysis",
            identifier=client_identifier(request),
            limit=settings.rate_limit_image_analysis,
            window_seconds=3600,
        )
        verify_turnstile(turnstile_token, request)

    file_bytes = await photo.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Photo file is empty")

    max_size_bytes = settings.max_image_size_mb * 1024 * 1024
    if len(file_bytes) > max_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"Photo exceeds {settings.max_image_size_mb}MB limit",
        )

    try:
        file_bytes, normalized_mime = normalize_image(
            file_bytes,
            declared_mime=photo.content_type,
            max_pixels=settings.max_image_pixels,
        )
    except InvalidImageError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    text = sanitize_description(description or "")
    result = classify_incident(
        description=text or "Sin descripcion",
        user_category=category,
        evidence_metadata={
            "precheck_mode": True,
            "file_name": photo.filename,
        },
        image_bytes=file_bytes,
        image_mime_type=normalized_mime,
    )

    source = "heuristic"
    if result.raw_response and isinstance(result.raw_response.get("source"), str):
        source = str(result.raw_response["source"])

    return ReportImageAnalysisResponse(
        is_appropriate=result.is_appropriate,
        is_incident=result.is_incident,
        reason=result.reason,
        suggested_title=result.suggested_title,
        predicted_category=result.predicted_category,
        priority_label=result.priority_label,
        priority_score=result.priority_score,
        confidence=result.confidence,
        assigned_to=result.assigned_to,
        source=source,
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
    _: User = Depends(get_current_admin),
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

    base_query = db.query(Incident).outerjoin(User, Incident.reporter_id == User.id)
    if filters:
        base_query = base_query.filter(and_(*filters))

    total = base_query.with_entities(func.count(Incident.id)).scalar() or 0
    incidents = (
        base_query.options(joinedload(Incident.reporter))
        .options(joinedload(Incident.location))
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
            reporter_campus_id=inc.reporter.campus_id if inc.reporter else "ANONYMOUS",
            location_zone_name=inc.location.resolved_zone_name if inc.location else None,
            location_status=inc.location.location_status if inc.location else None,
        )
        for inc in incidents
    ]
    return IncidentListResponse(total=total, items=items)


@router.get("/incidents/mine", response_model=IncidentListResponse)
def list_my_incidents(
    limit: int = 20,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IncidentListResponse:
    if current_user.role != UserRole.STUDENT:
        raise HTTPException(status_code=403, detail="Student role required")
    safe_limit = min(max(limit, 1), 100)
    query = db.query(Incident).filter(Incident.reporter_id == current_user.id)
    total = query.with_entities(func.count(Incident.id)).scalar() or 0
    incidents = query.options(selectinload(Incident.location)).order_by(Incident.created_at.desc()).offset(max(offset, 0)).limit(safe_limit).all()
    return IncidentListResponse(
        total=total,
        items=[
            IncidentListItem(
                id=inc.id, category=inc.category, status=inc.status, priority=inc.priority,
                description=inc.description, created_at=inc.created_at,
                reporter_campus_id=current_user.campus_id,
                location_zone_name=inc.location.resolved_zone_name if inc.location else None,
                location_status=inc.location.location_status if inc.location else None,
            ) for inc in incidents
        ],
    )


def _can_access_incident(db: Session, incident: Incident, user: User) -> bool:
    if user.role == UserRole.ADMIN:
        return True
    if user.role == UserRole.STUDENT:
        return incident.reporter_id == user.id
    if user.role == UserRole.STAFF:
        return (
            db.query(IncidentAssignment.id)
            .join(IncidentAssignment.responsible)
            .filter(IncidentAssignment.incident_id == incident.id, IncidentAssignment.responsible.has(user_id=user.id))
            .first()
            is not None
        )
    return False


@router.get("/incidents/{incident_id}", response_model=IncidentDetail)
def get_incident_detail(
    incident_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> IncidentDetail:
    incident = (
        db.query(Incident)
        .options(
            joinedload(Incident.reporter),
            selectinload(Incident.location),
            selectinload(Incident.evidences),
            selectinload(Incident.ai_metrics),
            selectinload(Incident.assignments).joinedload(IncidentAssignment.responsible),
            selectinload(Incident.notifications),
        )
        .filter(Incident.id == incident_id)
        .first()
    )
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    if not _can_access_incident(db, incident, current_user):
        raise HTTPException(status_code=404, detail="Incident not found")
    return _build_incident_detail(incident, include_sensitive=current_user.role == UserRole.ADMIN)


@router.get("/incidents/{incident_id}/evidences/{evidence_id}")
def get_incident_evidence_file(
    incident_id: UUID,
    evidence_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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

    incident = db.get(Incident, incident_id)
    if incident is None or not _can_access_incident(db, incident, current_user):
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
