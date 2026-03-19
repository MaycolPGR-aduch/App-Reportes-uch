from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.enums import (
    IncidentCategory,
    IncidentStatus,
    NotificationStatus,
    PriorityLevel,
)


class LocationOut(BaseModel):
    latitude: float
    longitude: float
    accuracy_m: float | None
    reference: str | None
    captured_at: datetime


class EvidenceOut(BaseModel):
    id: UUID
    storage_path: str
    mime_type: str
    file_size_bytes: int
    sha256_hash: str
    metadata_json: dict[str, Any] | None
    created_at: datetime


class AIMetricOut(BaseModel):
    id: UUID
    model_name: str
    prompt_version: str
    predicted_category: IncidentCategory
    priority_score: Decimal
    priority_label: PriorityLevel
    confidence: Decimal
    latency_ms: int
    reasoning_summary: str
    created_at: datetime


class NotificationOut(BaseModel):
    id: UUID
    recipient: str
    status: NotificationStatus
    channel: str
    subject: str
    sent_at: datetime | None
    created_at: datetime


class IncidentListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category: IncidentCategory
    status: IncidentStatus
    priority: PriorityLevel
    description: str
    created_at: datetime
    reporter_campus_id: str


class IncidentDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category: IncidentCategory
    status: IncidentStatus
    priority: PriorityLevel
    description: str
    trace_id: str | None
    created_at: datetime
    updated_at: datetime
    reporter_campus_id: str
    reporter_name: str
    location: LocationOut | None
    evidences: list[EvidenceOut]
    ai_metrics: list[AIMetricOut]
    notifications: list[NotificationOut]


class IncidentListResponse(BaseModel):
    total: int
    items: list[IncidentListItem]

