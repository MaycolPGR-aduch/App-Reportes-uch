from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class SystemAlert(Base, TimestampMixin):
    """Aviso automático sobre la salud del sistema.

    No cuelga de ninguna incidencia —«el proveedor de IA no responde» no
    pertenece a un reporte concreto— así que no cabe en `notifications`, cuya
    columna `incident_id` es obligatoria.

    Su razón de ser es la deduplicación: sin este registro, una condición que
    persiste generaría un correo en cada revisión y la alerta se convertiría en
    ruido que nadie lee.
    """

    __tablename__ = "system_alerts"
    __table_args__ = (
        Index("ix_system_alerts_kind_resolved", "kind", "resolved_at"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Al cerrarse se envía el aviso de recuperación: enterarse de que algo
    # volvió a la normalidad importa tanto como enterarse del fallo.
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
