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


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_seconds: int
    role: UserRole
    campus_id: str


class UserResponse(BaseModel):
    id: UUID
    campus_id: str
    full_name: str
    email: str
    role: UserRole
    status: UserStatus
