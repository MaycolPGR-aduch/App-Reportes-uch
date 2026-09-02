from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Enum as SAEnum
from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import (
    GovernanceMode,
    IncidentCategory,
    IncidentStatus,
    PriorityLevel,
)

if TYPE_CHECKING:
    from app.models.ai_metric import AIMetric
    from app.models.assignment import IncidentAssignment
    from app.models.evidence import IncidentEvidence
    from app.models.job import Job
    from app.models.location import IncidentLocation
    from app.models.notification import Notification
    from app.models.user import User
    from app.models.community_reaction import CommunityReaction


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
        Index("ix_incidents_community_feed", "is_community_visible", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    reporter_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
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
    community_consent: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    is_community_visible: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    #: Regimen bajo el que se proceso. Se estampa al crearla y no se toca:
    #: cambiarlo despues atribuiria la incidencia al brazo equivocado.
    governance_mode: Mapped[GovernanceMode] = mapped_column(
        SAEnum(GovernanceMode, name="governance_mode"),
        nullable=False,
        default=GovernanceMode.AI_ASSISTED,
        server_default="AI_ASSISTED",
    )
    #: La categoria que eligio quien reporta, antes de que nadie la revise.
    #: `category` puede cambiar --por la IA o por el administrador--; esta no.
    #: Es NULL en las incidencias anteriores a esta columna, donde el valor
    #: original ya se habia perdido.
    reported_category: Mapped[IncidentCategory | None] = mapped_column(
        SAEnum(IncidentCategory, name="incident_category"), nullable=True
    )

    reporter: Mapped["User | None"] = relationship(back_populates="incidents")
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
    reactions: Mapped[list["CommunityReaction"]] = relationship(
        back_populates="incident", cascade="all, delete-orphan"
    )
