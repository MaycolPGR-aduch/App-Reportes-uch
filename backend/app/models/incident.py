from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import IncidentCategory, IncidentStatus, PriorityLevel

if TYPE_CHECKING:
    from app.models.ai_metric import AIMetric
    from app.models.assignment import IncidentAssignment
    from app.models.evidence import IncidentEvidence
    from app.models.job import Job
    from app.models.location import IncidentLocation
    from app.models.notification import Notification
    from app.models.user import User


class Incident(Base, TimestampMixin):
    __tablename__ = "incidents"
    __table_args__ = (
        Index(
            "ix_incidents_created_status_category_priority",
            "created_at",
            "status",
            "category",
            "priority",
        ),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    reporter_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[IncidentCategory] = mapped_column(
        SAEnum(IncidentCategory, name="incident_category"), nullable=False
    )
    status: Mapped[IncidentStatus] = mapped_column(
        SAEnum(IncidentStatus, name="incident_status"),
        default=IncidentStatus.REPORTED,
        nullable=False,
    )
    priority: Mapped[PriorityLevel] = mapped_column(
        SAEnum(PriorityLevel, name="priority_level"),
        default=PriorityLevel.MEDIUM,
        nullable=False,
    )
    trace_id: Mapped[str | None] = mapped_column(String(64), index=True)
    created_by: Mapped[str] = mapped_column(String(64), nullable=False)

    reporter: Mapped["User"] = relationship(back_populates="incidents")
    location: Mapped["IncidentLocation"] = relationship(
        back_populates="incident", uselist=False, cascade="all, delete-orphan"
    )
    evidences: Mapped[list["IncidentEvidence"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )
    assignments: Mapped[list["IncidentAssignment"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )
    ai_metrics: Mapped[list["AIMetric"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )
    jobs: Mapped[list["Job"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )

