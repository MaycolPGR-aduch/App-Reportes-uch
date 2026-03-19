from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import IncidentCategory, IncidentStatus


class ReportCreateResponse(BaseModel):
    incident_id: UUID
    status: IncidentStatus
    created_at: datetime
    ai_status: str


class ReportValidation(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    description: str = Field(min_length=5, max_length=280)
    category: IncidentCategory
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, ge=0, le=5_000)

