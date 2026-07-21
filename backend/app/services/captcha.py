from __future__ import annotations

import httpx
from fastapi import HTTPException, Request, status

from app.core.config import get_settings


def verify_turnstile(token: str | None, request: Request) -> None:
    settings = get_settings()
    if not settings.require_turnstile:
        return
    if not token or not settings.turnstile_secret_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CAPTCHA verification is required")

    try:
        response = httpx.post(
            "https://challenges.cloudflare.com/turnstile/v0/siteverify",
            data={
                "secret": settings.turnstile_secret_key,
                "response": token,
                "remoteip": request.client.host if request.client else "",
            },
            timeout=5.0,
        )
        body = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=503, detail="CAPTCHA service unavailable") from exc
    if not response.is_success or body.get("success") is not True:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CAPTCHA verification failed")
