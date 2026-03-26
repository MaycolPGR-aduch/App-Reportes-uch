from __future__ import annotations

from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.location import IncidentLocation


class CampusZone(Base, TimestampMixin):
    __tablename__ = "campus_zones"
    __table_args__ = (
        Index("ix_campus_zones_active_priority", "is_active", "priority"),
    )

    id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, default=uuid4
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    code: Mapped[str | None] = mapped_column(String(40), unique=True)
    priority: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    polygon_geojson: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    incident_locations: Mapped[list["IncidentLocation"]] = relationship(
        back_populates="resolved_zone"
    )

