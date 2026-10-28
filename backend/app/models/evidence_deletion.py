from uuid import UUID, uuid4

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class EvidenceDeletion(Base, TimestampMixin):
    """Borrados pendientes, confirmados por separado del borrado de la incidencia."""
    __tablename__ = "evidence_deletion_queue"
    __table_args__ = (UniqueConstraint("storage_identity", "storage_path", name="uq_evidence_deletion_path"),)

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    storage_identity: Mapped[str] = mapped_column(String(80), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
