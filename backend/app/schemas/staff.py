from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.enums import AssignmentStatus, IncidentCategory, IncidentStatus, PriorityLevel


class StaffSelfAssignmentItem(BaseModel):
    assignment_id: UUID
    responsible_id: UUID
    responsible_area_name: str
    incident_id: UUID
    incident_category: IncidentCategory
    incident_priority: PriorityLevel
    incident_status: IncidentStatus
    incident_zone_name: str | None
    assignment_status: AssignmentStatus
    incident_description: str
    assigned_at: datetime
    due_at: datetime | None
    completed_at: datetime | None


class StaffSelfAssignmentListResponse(BaseModel):
    total: int
    items: list[StaffSelfAssignmentItem]


class StaffCompleteAssignmentResponse(BaseModel):
    assignment_id: UUID
    incident_id: UUID
    assignment_status: AssignmentStatus
    incident_status: IncidentStatus
    message: str
