from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID, uuid4

from sqlalchemy import Boolean, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.incident import Incident
    from app.models.user import User


class ModerationDecision(Base, TimestampMixin):
    """Registro de cada decisión humana sobre la visibilidad comunitaria.

    Un administrador puede publicar una incidencia que la clasificación
    automática rechazó. Sin esta traza, ante una publicación problemática no
    habría forma de distinguir lo que decidió la máquina de lo que decidió una
    persona, ni quién fue.
    """

    __tablename__ = "moderation_decisions"
    __table_args__ = (
        Index("ix_moderation_decisions_incident_created", "incident_id", "created_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    incident_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False
    )
    # La cuenta puede eliminarse; la decisión debe sobrevivir, con el nombre ya
    # copiado en actor_label para que el registro se sostenga por sí solo.
    actor_user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    actor_label: Mapped[str] = mapped_column(String(160), nullable=False)
    published: Mapped[bool] = mapped_column(Boolean, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(300))
    # Qué había dictaminado la IA en el momento de decidir, para que se vea si
    # la persona confirmó o revirtió su veredicto.
    ai_verdict: Mapped[str | None] = mapped_column(String(60))

    incident: Mapped["Incident"] = relationship()
    actor: Mapped["User | None"] = relationship()
