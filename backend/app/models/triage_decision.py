from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import GovernanceMode, IncidentCategory, PriorityLevel

if TYPE_CHECKING:
    from app.models.incident import Incident
    from app.models.responsible import Responsible
    from app.models.user import User


class TriageDecision(Base, TimestampMixin):
    """Cada vez que una persona confirma o corrige la clasificación.

    Es la medición del estudio. Junto a `reported_category` de la incidencia y
    al `AIMetric` de la propuesta, permite reconstruir las tres versiones de
    cada caso: qué dijo quien reportó, qué propuso la IA y qué decidió quien
    modera.

    En modo `MANUAL` las columnas de IA quedan vacías, y esa ausencia es
    justamente el dato: no hubo propuesta que aceptar ni que corregir.
    """

    __tablename__ = "triage_decisions"
    __table_args__ = (
        Index("ix_triage_decisions_incident_created", "incident_id", "created_at"),
        # El analisis separa por brazo y recorre por fecha.
        Index("ix_triage_decisions_mode_created", "governance_mode", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    incident_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False
    )

    # La cuenta puede eliminarse; la decisión debe sobrevivir, con el nombre ya
    # copiado para que el registro se sostenga por sí solo.
    actor_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    actor_label: Mapped[str] = mapped_column(String(160), nullable=False)

    # Copiado de la incidencia: si algún día se corrigiera allí, esta fila
    # seguiría diciendo bajo qué régimen se tomó esta decisión concreta.
    governance_mode: Mapped[GovernanceMode] = mapped_column(
        SAEnum(GovernanceMode, name="governance_mode"), nullable=False
    )

    # Lo que proponía la IA en el momento de decidir. Vacío en modo manual.
    ai_suggested_category: Mapped[IncidentCategory | None] = mapped_column(
        SAEnum(IncidentCategory, name="incident_category"), nullable=True
    )
    ai_suggested_priority: Mapped[PriorityLevel | None] = mapped_column(
        SAEnum(PriorityLevel, name="priority_level"), nullable=True
    )
    #: Confianza de esa propuesta, para poder cruzar acierto con seguridad.
    ai_confidence: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)

    # Lo que decidió la persona.
    final_category: Mapped[IncidentCategory] = mapped_column(
        SAEnum(IncidentCategory, name="incident_category"), nullable=False
    )
    final_priority: Mapped[PriorityLevel] = mapped_column(
        SAEnum(PriorityLevel, name="priority_level"), nullable=False
    )
    assigned_responsible_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("responsibles.id", ondelete="SET NULL"), nullable=True
    )

    reason: Mapped[str | None] = mapped_column(String(300))

    incident: Mapped["Incident"] = relationship()
    actor: Mapped["User | None"] = relationship()
    assigned_responsible: Mapped["Responsible | None"] = relationship()
