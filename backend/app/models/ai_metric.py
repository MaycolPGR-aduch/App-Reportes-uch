from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import IncidentCategory, PriorityLevel
from sqlalchemy import Enum as SAEnum

if TYPE_CHECKING:
    from app.models.incident import Incident


class AIMetric(Base, TimestampMixin):
    __tablename__ = "ai_metrics"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    incident_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False
    )
    model_name: Mapped[str] = mapped_column(String(80), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(40), nullable=False)
    predicted_category: Mapped[IncidentCategory] = mapped_column(
        SAEnum(IncidentCategory, name="incident_category"), nullable=False
    )
    priority_score: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    priority_label: Mapped[PriorityLevel] = mapped_column(
        SAEnum(PriorityLevel, name="priority_level"), nullable=False
    )
    confidence: Mapped[Decimal] = mapped_column(Numeric(4, 3), nullable=False)
    latency_ms: Mapped[int] = mapped_column(nullable=False)
    reasoning_summary: Mapped[str] = mapped_column(Text, nullable=False)
    raw_response: Mapped[dict[str, Any] | None] = mapped_column(JSONB)

    incident: Mapped["Incident"] = relationship(back_populates="ai_metrics")

