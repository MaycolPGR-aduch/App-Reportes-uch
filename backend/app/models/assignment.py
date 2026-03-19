from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Enum as SAEnum
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import AssignmentStatus

if TYPE_CHECKING:
    from app.models.incident import Incident
    from app.models.responsible import Responsible


class IncidentAssignment(Base, TimestampMixin):
    __tablename__ = "incident_assignments"

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    incident_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False
    )
    responsible_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("responsibles.id", ondelete="RESTRICT"),
        nullable=False,
    )
    status: Mapped[AssignmentStatus] = mapped_column(
        SAEnum(AssignmentStatus, name="assignment_status"),
        default=AssignmentStatus.ASSIGNED,
        nullable=False,
    )
    notes: Mapped[str | None] = mapped_column(String(300))
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    incident: Mapped["Incident"] = relationship(back_populates="assignments")
    responsible: Mapped["Responsible"] = relationship(back_populates="assignments")

