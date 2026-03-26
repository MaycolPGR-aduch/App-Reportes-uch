from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_staff
from app.db.session import get_db
from app.models.assignment import IncidentAssignment
from app.models.enums import AssignmentStatus, IncidentStatus
from app.models.incident import Incident
from app.models.location import IncidentLocation
from app.models.responsible import Responsible
from app.models.user import User
from app.schemas.staff import (
    StaffCompleteAssignmentResponse,
    StaffSelfAssignmentItem,
    StaffSelfAssignmentListResponse,
)

router = APIRouter(prefix="/staff", tags=["staff"])


def _get_staff_responsibles(db: Session, current_staff: User) -> list[Responsible]:
    staff_email = current_staff.email.strip().lower()
    return (
        db.query(Responsible)
        .filter(func.lower(Responsible.email) == staff_email)
        .order_by(Responsible.area_name.asc(), Responsible.created_at.asc())
        .all()
    )


@router.get("/my-assignments", response_model=StaffSelfAssignmentListResponse)
def list_my_assignments(
    status_filter: AssignmentStatus | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=300),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
) -> StaffSelfAssignmentListResponse:
    responsibles = _get_staff_responsibles(db, current_staff)
    responsible_ids = [responsible.id for responsible in responsibles]
    if not responsible_ids:
        return StaffSelfAssignmentListResponse(total=0, items=[])

    query = (
        db.query(IncidentAssignment, Incident, IncidentLocation, Responsible)
        .join(Incident, Incident.id == IncidentAssignment.incident_id)
        .join(Responsible, Responsible.id == IncidentAssignment.responsible_id)
        .outerjoin(IncidentLocation, IncidentLocation.incident_id == Incident.id)
        .filter(IncidentAssignment.responsible_id.in_(responsible_ids))
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

    return StaffSelfAssignmentListResponse(
        total=total,
        items=[
            StaffSelfAssignmentItem(
                assignment_id=assignment.id,
                responsible_id=assignment.responsible_id,
                responsible_area_name=responsible.area_name,
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
            for assignment, incident, location, responsible in rows
        ],
    )


@router.post(
    "/assignments/{assignment_id}/complete",
    response_model=StaffCompleteAssignmentResponse,
)
def complete_my_assignment(
    assignment_id: UUID,
    db: Session = Depends(get_db),
    current_staff: User = Depends(get_current_staff),
) -> StaffCompleteAssignmentResponse:
    assignment = (
        db.query(IncidentAssignment)
        .options(
            joinedload(IncidentAssignment.incident),
            joinedload(IncidentAssignment.responsible),
        )
        .filter(IncidentAssignment.id == assignment_id)
        .first()
    )
    if assignment is None:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")
    if assignment.responsible is None:
        raise HTTPException(status_code=400, detail="Asignación inválida sin staff vinculado")

    responsible_email = assignment.responsible.email.strip().lower()
    if responsible_email != current_staff.email.strip().lower():
        raise HTTPException(
            status_code=403,
            detail="No puedes completar una asignación que pertenece a otro staff.",
        )

    incident = assignment.incident
    if incident is None:
        raise HTTPException(status_code=400, detail="Asignación inválida sin incidencia vinculada")

    if assignment.status != AssignmentStatus.COMPLETED:
        assignment.status = AssignmentStatus.COMPLETED
        assignment.completed_at = datetime.now(timezone.utc)
        db.flush()

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

        db.commit()
        db.refresh(assignment)
        db.refresh(incident)
        return StaffCompleteAssignmentResponse(
            assignment_id=assignment.id,
            incident_id=assignment.incident_id,
            assignment_status=assignment.status,
            incident_status=incident.status,
            message="Asignación marcada como completada.",
        )

    return StaffCompleteAssignmentResponse(
        assignment_id=assignment.id,
        incident_id=assignment.incident_id,
        assignment_status=assignment.status,
        incident_status=incident.status,
        message="La asignación ya estaba en estado COMPLETED.",
    )
