from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Enum as SAEnum
from sqlalchemy import String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import IncidentCategory, PriorityLevel

if TYPE_CHECKING:
    from app.models.assignment import IncidentAssignment


class Responsible(Base, TimestampMixin):
    __tablename__ = "responsibles"
    __table_args__ = (
        UniqueConstraint("email", "category", name="uq_responsible_email_category"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    area_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[IncidentCategory] = mapped_column(
        SAEnum(IncidentCategory, name="incident_category"), nullable=False
    )
    min_priority: Mapped[PriorityLevel] = mapped_column(
        SAEnum(PriorityLevel, name="priority_level"),
        default=PriorityLevel.MEDIUM,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    assignments: Mapped[list["IncidentAssignment"]] = relationship(
        back_populates="responsible"
    )

