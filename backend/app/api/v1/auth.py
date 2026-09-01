from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin, get_current_user
from app.core.config import get_settings
from app.core.security import hash_password, password_needs_rehash, verify_password
from app.db.session import get_db
from app.models.enums import UserRole, UserStatus
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    PublicRegisterRequest,
    RegisterRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    SessionResponse,
    UserResponse,
    VerifyEmailRequest,
)
from app.services.accounts import (
    consume_account_token,
    email_delivery_configured,
    issue_account_token,
    send_account_link,
)
from app.services.captcha import verify_turnstile
from app.services.rate_limit import client_identifier, enforce_rate_limit
from app.services.sessions import clear_session_cookies, create_session, set_session_cookies

router = APIRouter(prefix="/auth", tags=["auth"])


def _ensure_unique_user(db: Session, *, campus_id: str, email: str) -> None:
    exists = (
        db.query(User)
        .filter((User.campus_id == campus_id) | (User.email == email))
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="Campus ID or email already registered")


@router.post(
    "/bootstrap-admin",
    response_model=SessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def bootstrap_admin(
    payload: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> SessionResponse:
    admin_exists = db.query(User).filter(User.role == UserRole.ADMIN).first()
    if admin_exists:
        raise HTTPException(
            status_code=409,
            detail="Admin already exists. Use admin endpoint to create users.",
        )

    _ensure_unique_user(
        db,
        campus_id=payload.campus_id.strip(),
        email=payload.email.strip().lower(),
    )

    user = User(
        campus_id=payload.campus_id.strip(),
        full_name=payload.full_name.strip(),
        email=payload.email.strip().lower(),
        password_hash=hash_password(payload.password),
        role=UserRole.ADMIN,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token, _ = create_session(db, user)
    db.commit()
    set_session_cookies(response, token)
    return SessionResponse(
        role=user.role,
        campus_id=user.campus_id,
    )


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: PublicRegisterRequest,
    request: Request,
    turnstile_token: str | None = None,
    db: Session = Depends(get_db),
) -> MessageResponse:
    settings = get_settings()
    enforce_rate_limit(
        db,
        scope="register",
        identifier=client_identifier(request, payload.email.lower()),
        limit=settings.rate_limit_login,
    )
    verify_turnstile(turnstile_token, request)
    campus_id = payload.campus_id.strip()
    email = payload.email.strip().lower()
    if settings.allowed_email_domains and email.rsplit("@", 1)[-1] not in settings.allowed_email_domains:
        raise HTTPException(status_code=403, detail="Use an allowed institutional email address")
    _ensure_unique_user(db, campus_id=campus_id, email=email)

    user = User(
        campus_id=campus_id,
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=UserRole.STUDENT,
        status=UserStatus.INACTIVE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    # El testigo se emite pase lo que pase: si el correo se configura mas tarde,
    # el enlace de verificacion sigue siendo valido durante sus 24 horas.
    raw_token = issue_account_token(db, user=user, purpose="VERIFY_EMAIL")
    db.commit()

    if not email_delivery_configured():
        # La cuenta ya esta guardada. Fallar aqui dejaba la pantalla diciendo
        # error sobre un registro que si ocurrio, y el reintento respondia
        # "ya registrado" contradiciendo al mensaje anterior.
        return MessageResponse(
            message=(
                "Account created. Email verification is unavailable right now, "
                "so an administrator must activate it."
            )
        )

    send_account_link(recipient=user.email, purpose="VERIFY_EMAIL", raw_token=raw_token)
    return MessageResponse(
        message="Account created. Verify your institutional email to activate it."
    )


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> MessageResponse:
    user = consume_account_token(db, raw_token=payload.token, purpose="VERIFY_EMAIL")
    user.status = UserStatus.ACTIVE
    db.commit()
    return MessageResponse(message="Email verified. You can now sign in.")


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(payload: PasswordResetRequest, db: Session = Depends(get_db)) -> MessageResponse:
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if user and user.status == UserStatus.INACTIVE:
        raw_token = issue_account_token(db, user=user, purpose="VERIFY_EMAIL")
        db.commit()
        send_account_link(recipient=user.email, purpose="VERIFY_EMAIL", raw_token=raw_token)
    return MessageResponse(message="If the account requires verification, an email has been sent.")


@router.post("/password-reset", response_model=MessageResponse)
def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)) -> MessageResponse:
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    if user and email_delivery_configured():
        raw_token = issue_account_token(db, user=user, purpose="RESET_PASSWORD")
        db.commit()
        send_account_link(recipient=user.email, purpose="RESET_PASSWORD", raw_token=raw_token)
    # La respuesta es siempre la misma, y por eso `email_delivery_configured()`
    # se consulta antes de enviar en vez de capturar el 503 despues: sin correo,
    # una direccion registrada respondia 503 y una inventada 200, con lo que
    # bastaba comparar para averiguar que correos tienen cuenta.
    return MessageResponse(message="If the email exists, a reset link has been sent.")


@router.post("/password-reset/confirm", response_model=MessageResponse)
def confirm_password_reset(
    payload: PasswordResetConfirmRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    user = consume_account_token(db, raw_token=payload.token, purpose="RESET_PASSWORD")
    user.password_hash = hash_password(payload.password)
    user.status = UserStatus.ACTIVE
    db.commit()
    return MessageResponse(message="Password updated. You can now sign in.")


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> UserResponse:
    campus_id = payload.campus_id.strip()
    email = payload.email.strip().lower()

    _ensure_unique_user(db, campus_id=campus_id, email=email)
    user = User(
        campus_id=campus_id,
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserResponse(
        id=user.id,
        campus_id=user.campus_id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        status=user.status,
    )


@router.get("/users", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> list[UserResponse]:
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        UserResponse(
            id=user.id,
            campus_id=user.campus_id,
            full_name=user.full_name,
            email=user.email,
            role=user.role,
            status=user.status,
        )
        for user in users
    ]


@router.post("/login", response_model=SessionResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> SessionResponse:
    settings = get_settings()
    enforce_rate_limit(
        db,
        scope="login",
        identifier=client_identifier(request, payload.campus_id.lower()),
        limit=settings.rate_limit_login,
    )
    user = db.query(User).filter(User.campus_id == payload.campus_id).first()
    if user is None or user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    if password_needs_rehash(user.password_hash):
        user.password_hash = hash_password(payload.password)
    token, _ = create_session(db, user)
    db.commit()
    set_session_cookies(response, token)
    return SessionResponse(
        role=user.role,
        campus_id=user.campus_id,
    )


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        id=current_user.id,
        campus_id=current_user.campus_id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        status=current_user.status,
    )


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> MessageResponse:
    from app.models.auth_session import AuthSession
    from app.core.security import hash_opaque_token
    from app.core.config import get_settings

    raw_token = request.cookies.get(get_settings().session_cookie_name)
    if raw_token:
        session = db.query(AuthSession).filter(AuthSession.token_hash == hash_opaque_token(raw_token)).first()
        if session and session.revoked_at is None:
            session.revoked_at = datetime.now(timezone.utc)
            db.commit()
    clear_session_cookies(response)
    return MessageResponse(message="Signed out")
