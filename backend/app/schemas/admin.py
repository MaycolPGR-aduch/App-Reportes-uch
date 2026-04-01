from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

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


class WorkerStatusOut(BaseModel):
    name: str
    state: str
    last_job_update_at: datetime | None
    pending_jobs: int
    processing_jobs: int


class JobQueueSummaryItem(BaseModel):
    job_type: JobType
    job_status: JobStatus
    count: int


class GeminiStatusOut(BaseModel):
    api_key_configured: bool
    model: str
    state: str
    fallback_count_24h: int
    quota_exhausted_detected: bool
    latest_fallback_reason: str | None
    latest_source: str | None


class SystemStatusResponse(BaseModel):
    api_ok: bool
    server_time: datetime
    queue_summary: list[JobQueueSummaryItem]
    workers: list[WorkerStatusOut]
    gemini: GeminiStatusOut
    notes: list[str]


class AdminUserOut(BaseModel):
    id: UUID
    campus_id: str
    full_name: str
    email: str
    role: UserRole
    status: UserStatus
    created_at: datetime
    updated_at: datetime


class AdminUserListResponse(BaseModel):
    total: int
    items: list[AdminUserOut]


class AdminCreateUserRequest(BaseModel):
    campus_id: str = Field(min_length=3, max_length=64)
    full_name: str = Field(min_length=3, max_length=120)
    email: str = Field(min_length=6, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.STUDENT
    staff_area_name: str | None = Field(default=None, min_length=3, max_length=120)
    staff_phone_number: str | None = Field(default=None, min_length=7, max_length=32)
    staff_category: IncidentCategory | None = None
    staff_min_priority: PriorityLevel | None = None


class AdminUpdateUserRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=3, max_length=120)
    email: str | None = Field(default=None, min_length=6, max_length=255)
    role: UserRole | None = None
    status: UserStatus | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    staff_area_name: str | None = Field(default=None, min_length=3, max_length=120)
    staff_phone_number: str | None = Field(default=None, min_length=7, max_length=32)
    staff_category: IncidentCategory | None = None
    staff_min_priority: PriorityLevel | None = None


class StaffOut(BaseModel):
    id: UUID
    full_name: str
    area_name: str
    email: str
    phone_number: str | None
    category: IncidentCategory
    min_priority: PriorityLevel
    is_active: bool
    pending_assignments: int
    completed_assignments: int
    created_at: datetime
    updated_at: datetime


class StaffListResponse(BaseModel):
    total: int
    items: list[StaffOut]


class StaffCreateRequest(BaseModel):
    full_name: str = Field(min_length=3, max_length=120)
    area_name: str = Field(min_length=3, max_length=120)
    email: str = Field(min_length=6, max_length=255)
    phone_number: str | None = Field(default=None, min_length=7, max_length=32)
    category: IncidentCategory
    min_priority: PriorityLevel = PriorityLevel.MEDIUM
    is_active: bool = True


class StaffUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=3, max_length=120)
    area_name: str | None = Field(default=None, min_length=3, max_length=120)
    email: str | None = Field(default=None, min_length=6, max_length=255)
    phone_number: str | None = Field(default=None, min_length=7, max_length=32)
    category: IncidentCategory | None = None
    min_priority: PriorityLevel | None = None
    is_active: bool | None = None


class StaffAssignmentItem(BaseModel):
    assignment_id: UUID
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


class StaffAssignmentListResponse(BaseModel):
    total: int
    items: list[StaffAssignmentItem]


class ManualAssignIncidentRequest(BaseModel):
    responsible_id: UUID
    notes: str | None = Field(default=None, max_length=300)
    notify: bool = True


class AssignmentActionResponse(BaseModel):
    assignment_id: UUID
    incident_id: UUID
    responsible_id: UUID
    assignment_status: AssignmentStatus
    incident_status: IncidentStatus
    message: str


class UpdateAssignmentStatusRequest(BaseModel):
    status: AssignmentStatus
    notes: str | None = Field(default=None, max_length=300)


class UpdateIncidentStatusRequest(BaseModel):
    status: IncidentStatus


class IncidentStatusUpdateResponse(BaseModel):
    incident_id: UUID
    incident_status: IncidentStatus
    message: str


class CampusZoneOut(BaseModel):
    id: UUID
    name: str
    code: str | None
    priority: int
    polygon_geojson: dict
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CampusZoneListResponse(BaseModel):
    total: int
    items: list[CampusZoneOut]


class CampusZoneCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    code: str | None = Field(default=None, min_length=2, max_length=40)
    priority: int = Field(default=100, ge=0, le=1000)
    polygon_geojson: dict
    is_active: bool = True


class CampusZoneUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    code: str | None = Field(default=None, min_length=2, max_length=40)
    priority: int | None = Field(default=None, ge=0, le=1000)
    polygon_geojson: dict | None = None
    is_active: bool | None = None


class IncidentLocationResolveResponse(BaseModel):
    incident_id: UUID
    zone_id: UUID | None
    zone_name: str | None
    location_status: str
    location_confidence: float | None
    message: str
