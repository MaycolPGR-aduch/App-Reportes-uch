from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.enums import UserRole, UserStatus
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    PublicRegisterRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)

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
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def bootstrap_admin(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
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

    token = create_access_token(
        user_id=user.id, campus_id=user.campus_id, role=user.role.value
    )
    settings = get_settings()
    return TokenResponse(
        access_token=token,
        expires_in_seconds=settings.jwt_exp_minutes * 60,
        role=user.role,
        campus_id=user.campus_id,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: PublicRegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    campus_id = payload.campus_id.strip()
    email = payload.email.strip().lower()
    _ensure_unique_user(db, campus_id=campus_id, email=email)

    user = User(
        campus_id=campus_id,
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=UserRole.STUDENT,
        status=UserStatus.ACTIVE,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(
        user_id=user.id, campus_id=user.campus_id, role=user.role.value
    )
    settings = get_settings()
    return TokenResponse(
        access_token=token,
        expires_in_seconds=settings.jwt_exp_minutes * 60,
        role=user.role,
        campus_id=user.campus_id,
    )


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


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.campus_id == payload.campus_id).first()
    if user is None or user.status != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    token = create_access_token(
        user_id=user.id, campus_id=user.campus_id, role=user.role.value
    )
    settings = get_settings()
    return TokenResponse(
        access_token=token,
        expires_in_seconds=settings.jwt_exp_minutes * 60,
        role=user.role,
        campus_id=user.campus_id,
    )
