from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RateLimitBucket(Base):
    __tablename__ = "rate_limit_buckets"
    __table_args__ = (UniqueConstraint("scope", "identifier", name="uq_rate_limit_scope_identifier"),)

    scope: Mapped[str] = mapped_column(String(80), primary_key=True)
    identifier: Mapped[str] = mapped_column(String(255), primary_key=True)
    window_started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    hits: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
