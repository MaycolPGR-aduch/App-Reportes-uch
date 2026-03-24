from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import JobStatus, JobType, UserRole, UserStatus


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


class AdminUpdateUserRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=3, max_length=120)
    email: str | None = Field(default=None, min_length=6, max_length=255)
    role: UserRole | None = None
    status: UserStatus | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
