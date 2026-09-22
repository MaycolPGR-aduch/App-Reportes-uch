from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import IncidentStatus

if TYPE_CHECKING:
    from app.models.incident import Incident


class IncidentStatusEvent(Base):
    """Cada cambio de estado de una incidencia, con su momento.

    `incidents.status` guarda solo el estado actual y `updated_at` se pisa con
    cualquier edición, así que no había forma de saber cuándo se resolvió una
    incidencia: bastaba corregir su categoría una semana después para perder
    esa fecha. Sin ella, el tiempo hasta la resolución --una de las medidas del
    estudio-- no se podía calcular.

    Solo se añaden filas; nunca se modifican ni se borran salvo junto con la
    incidencia. No lleva `updated_at` a propósito: un evento no se edita.
    """

    __tablename__ = "incident_status_events"
    __table_args__ = (
        Index("ix_incident_status_events_incident_at", "incident_id", "at"),
        Index("ix_incident_status_events_status_at", "status", "at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    incident_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False
    )
    #: Estado del que se venía. NULL en el primero, el del alta.
    previous_status: Mapped[IncidentStatus | None] = mapped_column(
        SAEnum(IncidentStatus, name="incident_status"), nullable=True
    )
    status: Mapped[IncidentStatus] = mapped_column(
        SAEnum(IncidentStatus, name="incident_status"), nullable=False
    )
    at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    incident: Mapped["Incident"] = relationship(back_populates="status_events")
