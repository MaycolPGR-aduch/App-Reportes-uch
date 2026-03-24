from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import get_db
from app.models.ai_metric import AIMetric
from app.models.enums import JobStatus, JobType, UserRole, UserStatus
from app.models.job import Job
from app.models.user import User
from app.schemas.admin import (
    AdminCreateUserRequest,
    AdminUpdateUserRequest,
    AdminUserListResponse,
    AdminUserOut,
    GeminiStatusOut,
    JobQueueSummaryItem,
    SystemStatusResponse,
    WorkerStatusOut,
)

router = APIRouter(prefix="/admin", tags=["admin"])


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


def _compute_worker_status(
    *,
    db: Session,
    job_type: JobType,
    name: str,
    now: datetime,
) -> WorkerStatusOut:
    recent_processing_cutoff = now - timedelta(minutes=2)
    recent_activity_cutoff = now - timedelta(minutes=8)

    last_update = (
        db.query(func.max(Job.updated_at))
        .filter(Job.type == job_type)
        .scalar()
    )
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
    users = (
        query.order_by(User.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return AdminUserListResponse(total=total, items=[_user_out(u) for u in users])


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
def create_user_admin(
    payload: AdminCreateUserRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> AdminUserOut:
    campus_id = payload.campus_id.strip()
    email = payload.email.strip().lower()
    exists = (
        db.query(User)
        .filter((User.campus_id == campus_id) | (User.email == email))
        .first()
    )
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
