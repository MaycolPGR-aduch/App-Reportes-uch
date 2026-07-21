from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import Session

from app.models.rate_limit import RateLimitBucket


def client_identifier(request: Request, suffix: str = "") -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    client_ip = forwarded or (request.client.host if request.client else "unknown")
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
    bucket = (
        db.query(RateLimitBucket)
        .filter(RateLimitBucket.scope == scope, RateLimitBucket.identifier == identifier)
        .with_for_update()
        .first()
    )
    if bucket is None:
        bucket = RateLimitBucket(
            scope=scope,
            identifier=identifier,
            window_started_at=now,
            hits=1,
        )
        db.add(bucket)
        db.commit()
        return

    if bucket.window_started_at + timedelta(seconds=window_seconds) <= now:
        bucket.window_started_at = now
        bucket.hits = 1
        db.commit()
        return

    if bucket.hits >= limit:
        retry_after = max(1, int((bucket.window_started_at + timedelta(seconds=window_seconds) - now).total_seconds()))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Try again later.",
            headers={"Retry-After": str(retry_after)},
        )
    bucket.hits += 1
    db.commit()
