from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import UserRole, UserStatus


class RegisterRequest(BaseModel):
    campus_id: str = Field(min_length=3, max_length=64)
    full_name: str = Field(min_length=3, max_length=120)
    email: str = Field(min_length=6, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = UserRole.STUDENT


class PublicRegisterRequest(BaseModel):
    campus_id: str = Field(min_length=3, max_length=64)
    full_name: str = Field(min_length=3, max_length=120)
    email: str = Field(min_length=6, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    campus_id: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)


class SessionResponse(BaseModel):
    message: str = "Authenticated"
    role: UserRole
    campus_id: str
    # El cliente no puede leer la cookie CSRF entre dominios, asi que viaja
    # tambien en el cuerpo para que pueda reenviarla en la cabecera.
    csrf_token: str


class MessageResponse(BaseModel):
    message: str


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=20, max_length=256)


class PasswordResetRequest(BaseModel):
    email: str = Field(min_length=6, max_length=255)


class PasswordResetConfirmRequest(VerifyEmailRequest):
    password: str = Field(min_length=8, max_length=128)


class UserResponse(BaseModel):
    id: UUID
    campus_id: str
    full_name: str
    email: str
    role: UserRole
    status: UserStatus
    # Permite recuperar el testigo tras recargar la pagina, cuando el que
    # guardaba el cliente en memoria se ha perdido.
    csrf_token: str | None = None
