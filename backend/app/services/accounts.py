from __future__ import annotations

from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import generate_opaque_token, hash_opaque_token
from app.models.account_token import AccountToken
from app.models.user import User


def issue_account_token(db: Session, *, user: User, purpose: str, ttl_hours: int = 24) -> str:
    db.query(AccountToken).filter(
        AccountToken.user_id == user.id,
        AccountToken.purpose == purpose,
        AccountToken.used_at.is_(None),
    ).update({AccountToken.used_at: datetime.now(timezone.utc)})
    raw_token = generate_opaque_token()
    db.add(AccountToken(
        user_id=user.id,
        purpose=purpose,
        token_hash=hash_opaque_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=ttl_hours),
    ))
    return raw_token


def consume_account_token(db: Session, *, raw_token: str, purpose: str) -> User:
    token = db.query(AccountToken).filter(
        AccountToken.token_hash == hash_opaque_token(raw_token),
        AccountToken.purpose == purpose,
        AccountToken.used_at.is_(None),
        AccountToken.expires_at > datetime.now(timezone.utc),
    ).first()
    if token is None:
        raise HTTPException(status_code=400, detail="Invalid or expired account token")
    token.used_at = datetime.now(timezone.utc)
    user = db.get(User, token.user_id)
    if user is None:
        raise HTTPException(status_code=400, detail="Account no longer exists")
    return user


def email_delivery_configured() -> bool:
    """Si hay proveedor de correo, sin levantar nada.

    `send_account_link` corta con 503 cuando falta, que es lo correcto para una
    operación cuyo único cometido es enviar. Pero el registro y la recuperación
    tienen algo que decir aunque el correo no salga, y necesitan preguntarlo
    antes de intentarlo.
    """
    settings = get_settings()
    return bool(settings.brevo_api_key and settings.brevo_from_email)


def send_account_link(*, recipient: str, purpose: str, raw_token: str) -> None:
    settings = get_settings()
    if not email_delivery_configured():
        raise HTTPException(status_code=503, detail="Email delivery is not configured")
    path = "verify-email" if purpose == "VERIFY_EMAIL" else "reset-password"
    url = f"{settings.frontend_base_url.rstrip('/')}/{path}?token={quote(raw_token)}"
    subject = "Verifica tu cuenta institucional" if purpose == "VERIFY_EMAIL" else "Restablece tu contraseña"
    response = httpx.post(
        "https://api.brevo.com/v3/smtp/email",
        headers={"api-key": settings.brevo_api_key, "Content-Type": "application/json"},
        json={
            "sender": {"email": settings.brevo_from_email, "name": settings.brevo_from_name},
            "to": [{"email": recipient}],
            "subject": subject,
            "htmlContent": f"<p>{subject}:</p><p><a href='{url}'>Continuar</a></p><p>El enlace vence en 24 horas.</p>",
        },
        timeout=10.0,
    )
    if not response.is_success:
        raise HTTPException(status_code=503, detail="Unable to send account email")
