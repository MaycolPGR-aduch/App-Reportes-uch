from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy import case
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.rate_limit import RateLimitBucket


def client_identifier(request: Request, suffix: str = "") -> str:
    # Uvicorn solo aplica cabeceras de proxy de intermediarios autorizados.
    # Nunca volver a interpretar X-Forwarded-For aportado por el cliente.
    client_ip = request.client.host if request.client else "unknown"
    return f"{client_ip}:{suffix}"[:255]


def enforce_rate_limit(
    db: Session,
    *,
    scope: str,
    identifier: str,
    limit: int,
    window_seconds: int = 900,
) -> None:
    """Database-backed fixed window limiter suitable for multiple Render workers."""
    now = datetime.now(timezone.utc)
    expired = RateLimitBucket.window_started_at <= now - timedelta(seconds=window_seconds)
    statement = insert(RateLimitBucket).values(
        scope=scope, identifier=identifier, window_started_at=now, hits=1,
    ).on_conflict_do_update(
        index_elements=[RateLimitBucket.scope, RateLimitBucket.identifier],
        set_={
            "window_started_at": case((expired, now), else_=RateLimitBucket.window_started_at),
            "hits": case((expired, 1), else_=RateLimitBucket.hits + 1),
        },
    ).returning(RateLimitBucket.hits, RateLimitBucket.window_started_at)
    hits, started_at = db.execute(statement).one()
    db.commit()
    if hits > limit:
        retry_after = max(1, int((started_at + timedelta(seconds=window_seconds) - now).total_seconds()))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )
