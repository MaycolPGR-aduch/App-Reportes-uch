from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, case, func, or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_admin
from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import get_db
from app.models.ai_metric import AIMetric
from app.models.assignment import IncidentAssignment
from app.models.campus_zone import CampusZone
from app.models.enums import (
    AssignmentStatus,
    IncidentCategory,
    IncidentStatus,
    JobStatus,
    JobType,
    PriorityLevel,
    UserRole,
    UserStatus,
)
from app.models.incident import Incident
from app.models.job import Job
from app.models.location import IncidentLocation
from app.models.responsible import Responsible
from app.models.user import User
from app.schemas.admin import (
    AdminCreateUserRequest,
    AdminUpdateUserRequest,
    CampusZoneCreateRequest,
    CampusZoneListResponse,
    CampusZoneOut,
    CampusZoneUpdateRequest,
    IncidentLocationResolveResponse,
    AdminUserListResponse,
    AdminUserOut,
    AssignmentActionResponse,
    GeminiStatusOut,
    IncidentStatusUpdateResponse,
    JobQueueSummaryItem,
    ManualAssignIncidentRequest,
    StaffAssignmentItem,
    StaffAssignmentListResponse,
    StaffCreateRequest,
    StaffListResponse,
    StaffOut,
    StaffUpdateRequest,
    SystemStatusResponse,
    UpdateAssignmentStatusRequest,
    UpdateIncidentStatusRequest,
    WorkerStatusOut,
)
from app.services.jobs import enqueue_job
from app.services.location_resolver import resolve_campus_zone, validate_polygon_geojson

router = APIRouter(prefix="/admin", tags=["admin"])

PRIORITY_SLA_HOURS = {
    PriorityLevel.CRITICAL: 2,
    PriorityLevel.HIGH: 6,
    PriorityLevel.MEDIUM: 24,
    PriorityLevel.LOW: 72,
}


def _user_out(user: User) -> AdminUserOut:
    return AdminUserOut(
        id=user.id,
        campus_id=user.campus_id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        status=user.status,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def _staff_out(staff: Responsible, *, pending: int, completed: int) -> StaffOut:
    return StaffOut(
        id=staff.id,
        full_name=staff.full_name,
        area_name=staff.area_name,
        email=staff.email,
        phone_number=staff.phone_number,
        category=staff.category,
        min_priority=staff.min_priority,
        is_active=staff.is_active,
        pending_assignments=int(pending),
        completed_assignments=int(completed),
        created_at=staff.created_at,
        updated_at=staff.updated_at,
    )


def _zone_out(zone: CampusZone) -> CampusZoneOut:
    return CampusZoneOut(
        id=zone.id,
        name=zone.name,
        code=zone.code,
        priority=zone.priority,
        polygon_geojson=zone.polygon_geojson,
        is_active=zone.is_active,
        created_at=zone.created_at,
        updated_at=zone.updated_at,
    )


def _compute_worker_status(
    *,
    db: Session,
    job_type: JobType,
    name: str,
    now: datetime,
) -> WorkerStatusOut:
    recent_processing_cutoff = now - timedelta(minutes=2)
    recent_activity_cutoff = now - timedelta(minutes=8)

    last_update = db.query(func.max(Job.updated_at)).filter(Job.type == job_type).scalar()
    pending_jobs = (
        db.query(func.count(Job.id))
        .filter(Job.type == job_type, Job.status == JobStatus.PENDING)
        .scalar()
        or 0
    )
    processing_jobs = (
        db.query(func.count(Job.id))
        .filter(Job.type == job_type, Job.status == JobStatus.PROCESSING)
        .scalar()
        or 0
    )
    processing_recent = (
        db.query(func.count(Job.id))
        .filter(
            Job.type == job_type,
            Job.status == JobStatus.PROCESSING,
            Job.locked_at.is_not(None),
            Job.locked_at >= recent_processing_cutoff,
        )
        .scalar()
        or 0
    ) > 0

    state = "STALE"
    if processing_recent:
        state = "ACTIVE"
    elif last_update and last_update >= recent_activity_cutoff:
        state = "IDLE"
    elif pending_jobs == 0 and processing_jobs == 0:
        state = "IDLE"

    return WorkerStatusOut(
        name=name,
        state=state,
        last_job_update_at=last_update,
        pending_jobs=int(pending_jobs),
        processing_jobs=int(processing_jobs),
    )


@router.get("/system-status", response_model=SystemStatusResponse)
def get_system_status(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> SystemStatusResponse:
    now = datetime.now(timezone.utc)
    settings = get_settings()

    grouped_jobs = (
        db.query(Job.type, Job.status, func.count(Job.id))
        .group_by(Job.type, Job.status)
        .order_by(Job.type, Job.status)
        .all()
    )
    queue_summary = [
        JobQueueSummaryItem(job_type=row[0], job_status=row[1], count=int(row[2]))
        for row in grouped_jobs
    ]

    ai_worker = _compute_worker_status(
        db=db,
        job_type=JobType.CLASSIFY_INCIDENT,
        name="ai_worker",
        now=now,
    )
    notification_worker = _compute_worker_status(
        db=db,
        job_type=JobType.SEND_NOTIFICATION,
        name="notification_worker",
        now=now,
    )

    window_24h = now - timedelta(hours=24)
    metrics_24h = (
        db.query(AIMetric)
        .filter(AIMetric.created_at >= window_24h)
        .order_by(AIMetric.created_at.desc())
        .all()
    )
    fallback_count_24h = 0
    quota_exhausted_detected = False
    latest_fallback_reason: str | None = None
    latest_source: str | None = None
    if metrics_24h:
        for metric in metrics_24h:
            raw = metric.raw_response or {}
            source = raw.get("source")
            if latest_source is None and isinstance(source, str):
                latest_source = source
            fallback_reason = raw.get("fallback_reason")
            if isinstance(fallback_reason, str) and fallback_reason.strip():
                fallback_count_24h += 1
                if latest_fallback_reason is None:
                    latest_fallback_reason = fallback_reason[:500]
                if "resource_exhausted" in fallback_reason.lower() or "429" in fallback_reason:
                    quota_exhausted_detected = True

    gemini_state = "OK"
    if not settings.gemini_api_key:
        gemini_state = "MISSING_API_KEY"
    elif fallback_count_24h > 0:
        gemini_state = "FALLBACK_ACTIVE"

    notes: list[str] = []
    if ai_worker.state == "STALE":
        notes.append("AI worker parece inactivo o atrasado.")
    if notification_worker.state == "STALE":
        notes.append("Notification worker parece inactivo o atrasado.")
    if gemini_state == "FALLBACK_ACTIVE":
        notes.append("Gemini está en fallback en al menos una ejecución reciente.")
    if not settings.auto_assign_enabled:
        notes.append("Auto-asignación IA desactivada: asignación manual activa.")

    return SystemStatusResponse(
        api_ok=True,
        server_time=now,
        queue_summary=queue_summary,
        workers=[ai_worker, notification_worker],
        gemini=GeminiStatusOut(
            api_key_configured=bool(settings.gemini_api_key),
            model=settings.gemini_model,
            state=gemini_state,
            fallback_count_24h=fallback_count_24h,
            quota_exhausted_detected=quota_exhausted_detected,
            latest_fallback_reason=latest_fallback_reason,
            latest_source=latest_source,
        ),
        notes=notes,
    )


@router.get("/users", response_model=AdminUserListResponse)
def list_users_admin(
    search: str | None = Query(default=None),
    role: UserRole | None = Query(default=None),
    status_filter: UserStatus | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> AdminUserListResponse:
    query = db.query(User)

    filters = []
    if role:
        filters.append(User.role == role)
    if status_filter:
        filters.append(User.status == status_filter)
    if search:
        like = f"%{search.strip()}%"
        filters.append(
            or_(
                User.campus_id.ilike(like),
                User.full_name.ilike(like),
                User.email.ilike(like),
            )
        )
    if filters:
        query = query.filter(and_(*filters))

    total = query.with_entities(func.count(User.id)).scalar() or 0
    users = query.order_by(User.created_at.desc()).offset(offset).limit(limit).all()
    return AdminUserListResponse(total=total, items=[_user_out(u) for u in users])


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_user_admin(
    payload: AdminCreateUserRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> AdminUserOut:
    campus_id = payload.campus_id.strip()
    email = payload.email.strip().lower()
    exists = db.query(User).filter((User.campus_id == campus_id) | (User.email == email)).first()
    if exists:
        raise HTTPException(status_code=409, detail="Campus ID or email already registered")

    user = User(
        campus_id=campus_id,
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user_admin(
    user_id: UUID,
    payload: AdminUpdateUserRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> AdminUserOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.email is not None:
        email = payload.email.strip().lower()
        exists = db.query(User).filter(User.email == email, User.id != user.id).first()
        if exists:
            raise HTTPException(status_code=409, detail="Email already in use")
        user.email = email
    if payload.full_name is not None:
        user.full_name = payload.full_name.strip()
    if payload.role is not None:
        user.role = payload.role
    if payload.status is not None:
        if user.id == current_admin.id and payload.status != UserStatus.ACTIVE:
            raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta")
        user.status = payload.status
    if payload.password:
        user.password_hash = hash_password(payload.password)

    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.post("/users/{user_id}/ban", response_model=AdminUserOut)
def ban_user_admin(
    user_id: UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
) -> AdminUserOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="No puedes banear tu propia cuenta")
    user.status = UserStatus.INACTIVE
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.post("/users/{user_id}/unban", response_model=AdminUserOut)
def unban_user_admin(
    user_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> AdminUserOut:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = UserStatus.ACTIVE
    db.commit()
    db.refresh(user)
    return _user_out(user)


@router.get("/staff", response_model=StaffListResponse)
def list_staff(
    search: str | None = Query(default=None),
    category: IncidentCategory | None = Query(default=None),
    active: bool | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=300),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> StaffListResponse:
    filters = []
    if search:
        like = f"%{search.strip()}%"
        filters.append(
            or_(
                Responsible.full_name.ilike(like),
                Responsible.area_name.ilike(like),
                Responsible.email.ilike(like),
            )
        )
    if category:
        filters.append(Responsible.category == category)
    if active is not None:
        filters.append(Responsible.is_active.is_(active))

    total_query = db.query(Responsible.id)
    if filters:
        total_query = total_query.filter(and_(*filters))
    total = total_query.with_entities(func.count(Responsible.id)).scalar() or 0

    staff_query = db.query(Responsible)
    if filters:
        staff_query = staff_query.filter(and_(*filters))
    staff_items = (
        staff_query.order_by(Responsible.area_name.asc(), Responsible.full_name.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    if not staff_items:
        return StaffListResponse(total=total, items=[])

    staff_ids = [item.id for item in staff_items]
    counts_rows = (
        db.query(
            IncidentAssignment.responsible_id,
            func.sum(
                case(
                    (IncidentAssignment.status != AssignmentStatus.COMPLETED, 1),
                    else_=0,
                )
            ).label("pending_count"),
            func.sum(
                case(
                    (IncidentAssignment.status == AssignmentStatus.COMPLETED, 1),
                    else_=0,
                )
            ).label("completed_count"),
        )
        .filter(IncidentAssignment.responsible_id.in_(staff_ids))
        .group_by(IncidentAssignment.responsible_id)
        .all()
    )
    by_staff_id = {
        row[0]: {"pending": int(row[1] or 0), "completed": int(row[2] or 0)}
        for row in counts_rows
    }

    return StaffListResponse(
        total=total,
        items=[
            _staff_out(
                staff,
                pending=by_staff_id.get(staff.id, {}).get("pending", 0),
                completed=by_staff_id.get(staff.id, {}).get("completed", 0),
            )
            for staff in staff_items
        ],
    )


@router.post("/staff", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
def create_staff(
    payload: StaffCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> StaffOut:
    email = payload.email.strip().lower()
    exists = (
        db.query(Responsible)
        .filter(
            Responsible.email == email,
            Responsible.category == payload.category,
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="Email ya existe para esa categoria")

    staff = Responsible(
        full_name=payload.full_name.strip(),
        area_name=payload.area_name.strip(),
        email=email,
        phone_number=(payload.phone_number or "").strip() or None,
        category=payload.category,
        min_priority=payload.min_priority,
        is_active=payload.is_active,
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return _staff_out(staff, pending=0, completed=0)


@router.patch("/staff/{staff_id}", response_model=StaffOut)
def update_staff(
    staff_id: UUID,
    payload: StaffUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> StaffOut:
    staff = db.get(Responsible, staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff no encontrado")

    payload_data = payload.model_dump(exclude_unset=True)
    if "full_name" in payload_data and payload.full_name is not None:
        staff.full_name = payload.full_name.strip()
    if "area_name" in payload_data and payload.area_name is not None:
        staff.area_name = payload.area_name.strip()
    if "phone_number" in payload_data:
        staff.phone_number = (payload.phone_number or "").strip() or None
    if "min_priority" in payload_data and payload.min_priority is not None:
        staff.min_priority = payload.min_priority
    if "is_active" in payload_data and payload.is_active is not None:
        staff.is_active = payload.is_active

    next_email = staff.email
    if "email" in payload_data and payload.email is not None:
        next_email = payload.email.strip().lower()
    next_category = staff.category
    if "category" in payload_data and payload.category is not None:
        next_category = payload.category

    collision = (
        db.query(Responsible)
        .filter(
            Responsible.id != staff.id,
            Responsible.email == next_email,
            Responsible.category == next_category,
        )
        .first()
    )
    if collision:
        raise HTTPException(status_code=409, detail="Email ya existe para esa categoria")

    staff.email = next_email
    staff.category = next_category

    db.commit()
    db.refresh(staff)

    counts = (
        db.query(
            func.sum(
                case(
                    (IncidentAssignment.status != AssignmentStatus.COMPLETED, 1),
                    else_=0,
                )
            ),
            func.sum(
                case(
                    (IncidentAssignment.status == AssignmentStatus.COMPLETED, 1),
                    else_=0,
                )
            ),
        )
        .filter(IncidentAssignment.responsible_id == staff.id)
        .first()
    )
    return _staff_out(
        staff,
        pending=int((counts[0] if counts else 0) or 0),
        completed=int((counts[1] if counts else 0) or 0),
    )


@router.get("/staff/{staff_id}/assignments", response_model=StaffAssignmentListResponse)
def list_staff_assignments(
    staff_id: UUID,
    status_filter: AssignmentStatus | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=300),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> StaffAssignmentListResponse:
    staff = db.get(Responsible, staff_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff no encontrado")

    query = (
        db.query(IncidentAssignment, Incident, IncidentLocation)
        .join(Incident, Incident.id == IncidentAssignment.incident_id)
        .outerjoin(IncidentLocation, IncidentLocation.incident_id == Incident.id)
        .filter(IncidentAssignment.responsible_id == staff_id)
    )
    if status_filter:
        query = query.filter(IncidentAssignment.status == status_filter)

    total = query.with_entities(func.count(IncidentAssignment.id)).scalar() or 0
    rows = (
        query.order_by(IncidentAssignment.assigned_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return StaffAssignmentListResponse(
        total=total,
        items=[
            StaffAssignmentItem(
                assignment_id=assignment.id,
                incident_id=incident.id,
                incident_category=incident.category,
                incident_priority=incident.priority,
                incident_status=incident.status,
                incident_zone_name=location.resolved_zone_name if location else None,
                assignment_status=assignment.status,
                incident_description=incident.description,
                assigned_at=assignment.assigned_at,
                due_at=assignment.due_at,
                completed_at=assignment.completed_at,
            )
            for assignment, incident, location in rows
        ],
    )


@router.get("/campus-zones", response_model=CampusZoneListResponse)
def list_campus_zones(
    search: str | None = Query(default=None),
    active: bool | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> CampusZoneListResponse:
    query = db.query(CampusZone)

    filters = []
    if search:
        like = f"%{search.strip()}%"
        filters.append(or_(CampusZone.name.ilike(like), CampusZone.code.ilike(like)))
    if active is not None:
        filters.append(CampusZone.is_active.is_(active))
    if filters:
        query = query.filter(and_(*filters))

    total = query.with_entities(func.count(CampusZone.id)).scalar() or 0
    zones = (
        query.order_by(CampusZone.priority.desc(), CampusZone.name.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return CampusZoneListResponse(total=total, items=[_zone_out(zone) for zone in zones])


@router.post(
    "/campus-zones",
    response_model=CampusZoneOut,
    status_code=status.HTTP_201_CREATED,
)
def create_campus_zone(
    payload: CampusZoneCreateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> CampusZoneOut:
    zone_name = payload.name.strip()
    zone_code = (payload.code or "").strip() or None

    if db.query(CampusZone).filter(CampusZone.name == zone_name).first():
        raise HTTPException(status_code=409, detail="Ya existe una zona con ese nombre")
    if zone_code and db.query(CampusZone).filter(CampusZone.code == zone_code).first():
        raise HTTPException(status_code=409, detail="Ya existe una zona con ese código")

    try:
        validate_polygon_geojson(payload.polygon_geojson)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    zone = CampusZone(
        name=zone_name,
        code=zone_code,
        priority=payload.priority,
        polygon_geojson=payload.polygon_geojson,
        is_active=payload.is_active,
    )
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return _zone_out(zone)


@router.patch("/campus-zones/{zone_id}", response_model=CampusZoneOut)
def update_campus_zone(
    zone_id: UUID,
    payload: CampusZoneUpdateRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> CampusZoneOut:
    zone = db.get(CampusZone, zone_id)
    if zone is None:
        raise HTTPException(status_code=404, detail="Zona no encontrada")

    payload_data = payload.model_dump(exclude_unset=True)
    if "name" in payload_data and payload.name is not None:
        next_name = payload.name.strip()
        existing = (
            db.query(CampusZone)
            .filter(CampusZone.id != zone.id, CampusZone.name == next_name)
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail="Ya existe una zona con ese nombre")
        zone.name = next_name

    if "code" in payload_data:
        next_code = (payload.code or "").strip() or None
        if next_code:
            existing = (
                db.query(CampusZone)
                .filter(CampusZone.id != zone.id, CampusZone.code == next_code)
                .first()
            )
            if existing:
                raise HTTPException(status_code=409, detail="Ya existe una zona con ese código")
        zone.code = next_code

    if "priority" in payload_data and payload.priority is not None:
        zone.priority = payload.priority
    if "is_active" in payload_data and payload.is_active is not None:
        zone.is_active = payload.is_active
    if "polygon_geojson" in payload_data and payload.polygon_geojson is not None:
        try:
            validate_polygon_geojson(payload.polygon_geojson)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        zone.polygon_geojson = payload.polygon_geojson

    db.commit()
    db.refresh(zone)
    return _zone_out(zone)


@router.post(
    "/incidents/{incident_id}/resolve-location",
    response_model=IncidentLocationResolveResponse,
)
def resolve_incident_location_zone(
    incident_id: UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> IncidentLocationResolveResponse:
    location = (
        db.query(IncidentLocation).filter(IncidentLocation.incident_id == incident_id).first()
    )
    if location is None:
        raise HTTPException(status_code=404, detail="No hay ubicación registrada para la incidencia")

    resolved = resolve_campus_zone(
        db,
        latitude=location.latitude,
        longitude=location.longitude,
        accuracy_m=location.accuracy_m,
    )
    location.resolved_zone_id = resolved.zone_id
    location.resolved_zone_name = resolved.zone_name
    location.location_status = resolved.location_status
    location.location_confidence = resolved.location_confidence

    db.commit()
    db.refresh(location)
    return IncidentLocationResolveResponse(
        incident_id=incident_id,
        zone_id=location.resolved_zone_id,
        zone_name=location.resolved_zone_name,
        location_status=location.location_status,
        location_confidence=location.location_confidence,
        message="Ubicación de incidencia recalculada.",
    )


@router.post(
    "/incidents/{incident_id}/assign",
    response_model=AssignmentActionResponse,
    status_code=status.HTTP_201_CREATED,
)
def assign_incident_to_staff(
    incident_id: UUID,
    payload: ManualAssignIncidentRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> AssignmentActionResponse:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")
    if incident.status == IncidentStatus.REJECTED:
        raise HTTPException(status_code=400, detail="No se puede asignar una incidencia rechazada")

    staff = db.get(Responsible, payload.responsible_id)
    if staff is None:
        raise HTTPException(status_code=404, detail="Staff no encontrado")
    if not staff.is_active:
        raise HTTPException(status_code=400, detail="El staff seleccionado está inactivo")

    already_assigned = (
        db.query(IncidentAssignment)
        .filter(
            IncidentAssignment.incident_id == incident.id,
            IncidentAssignment.responsible_id == staff.id,
            IncidentAssignment.status != AssignmentStatus.COMPLETED,
        )
        .first()
    )
    if already_assigned:
        raise HTTPException(
            status_code=409,
            detail="La incidencia ya está asignada a este staff y sigue pendiente",
        )

    now = datetime.now(timezone.utc)
    assignment = IncidentAssignment(
        incident_id=incident.id,
        responsible_id=staff.id,
        status=AssignmentStatus.ASSIGNED,
        notes=(payload.notes or "").strip()[:300] or None,
        assigned_at=now,
        due_at=now + timedelta(hours=PRIORITY_SLA_HOURS.get(incident.priority, 24)),
    )
    db.add(assignment)

    if incident.status in {IncidentStatus.REPORTED, IncidentStatus.IN_REVIEW, IncidentStatus.RESOLVED}:
        incident.status = IncidentStatus.IN_PROGRESS

    db.flush()
    if payload.notify:
        enqueue_job(
            db,
            incident_id=incident.id,
            job_type=JobType.SEND_NOTIFICATION,
            payload={
                "source": "manual_assignment",
                "assignment_id": str(assignment.id),
                "responsible_id": str(staff.id),
                "recipient_overrides": [staff.email],
            },
        )

    db.commit()
    db.refresh(assignment)
    db.refresh(incident)
    return AssignmentActionResponse(
        assignment_id=assignment.id,
        incident_id=incident.id,
        responsible_id=staff.id,
        assignment_status=assignment.status,
        incident_status=incident.status,
        message="Asignación registrada y notificación encolada." if payload.notify else "Asignación registrada.",
    )


@router.patch("/assignments/{assignment_id}", response_model=AssignmentActionResponse)
def update_assignment_status(
    assignment_id: UUID,
    payload: UpdateAssignmentStatusRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> AssignmentActionResponse:
    assignment = (
        db.query(IncidentAssignment)
        .options(joinedload(IncidentAssignment.incident))
        .filter(IncidentAssignment.id == assignment_id)
        .first()
    )
    if assignment is None:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")

    assignment.status = payload.status
    if payload.notes is not None:
        assignment.notes = payload.notes.strip()[:300] or None

    incident = assignment.incident
    if payload.status == AssignmentStatus.COMPLETED:
        assignment.completed_at = datetime.now(timezone.utc)
        remaining_pending = (
            db.query(func.count(IncidentAssignment.id))
            .filter(
                IncidentAssignment.incident_id == assignment.incident_id,
                IncidentAssignment.status != AssignmentStatus.COMPLETED,
            )
            .scalar()
            or 0
        )
        if remaining_pending == 0 and incident.status != IncidentStatus.REJECTED:
            incident.status = IncidentStatus.RESOLVED
        elif incident.status != IncidentStatus.REJECTED:
            incident.status = IncidentStatus.IN_PROGRESS
    else:
        assignment.completed_at = None
        if incident.status in {
            IncidentStatus.REPORTED,
            IncidentStatus.IN_REVIEW,
            IncidentStatus.RESOLVED,
        }:
            incident.status = IncidentStatus.IN_PROGRESS

    db.commit()
    db.refresh(assignment)
    db.refresh(incident)
    return AssignmentActionResponse(
        assignment_id=assignment.id,
        incident_id=assignment.incident_id,
        responsible_id=assignment.responsible_id,
        assignment_status=assignment.status,
        incident_status=incident.status,
        message="Estado de asignación actualizado.",
    )


@router.patch("/incidents/{incident_id}/status", response_model=IncidentStatusUpdateResponse)
def update_incident_status(
    incident_id: UUID,
    payload: UpdateIncidentStatusRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> IncidentStatusUpdateResponse:
    incident = db.get(Incident, incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incidencia no encontrada")

    incident.status = payload.status
    db.commit()
    db.refresh(incident)
    return IncidentStatusUpdateResponse(
        incident_id=incident.id,
        incident_status=incident.status,
        message="Estado de incidencia actualizado.",
    )
