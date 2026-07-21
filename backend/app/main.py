from __future__ import annotations

import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy import text

from app.api.v1.admin import router as admin_router
from app.api.v1.auth import router as auth_router
from app.api.v1.reports import router as reports_router
from app.api.v1.staff import router as staff_router
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    debug=settings.app_debug,
    version="0.1.0",
)

if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token", "X-Turnstile-Token", "X-Trace-Id"],
    )

if settings.trusted_hosts:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)

logger = logging.getLogger("campus.security")


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    trace_id = request.headers.get("X-Trace-Id") or uuid.uuid4().hex
    session_token = request.cookies.get(settings.session_cookie_name)
    exempt_paths = {"/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/bootstrap-admin"}
    if (
        request.method in {"POST", "PUT", "PATCH", "DELETE"}
        and session_token
        and request.url.path not in exempt_paths
        and request.headers.get("X-CSRF-Token") != request.cookies.get(settings.csrf_cookie_name)
    ):
        return JSONResponse(status_code=403, content={"detail": "Invalid CSRF token"})

    response = await call_next(request)
    response.headers["X-Trace-Id"] = trace_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self), camera=(self)"
    return response


@app.on_event("startup")
def startup_event() -> None:
    settings.local_storage_path.mkdir(parents=True, exist_ok=True)
    if settings.auto_create_schema:
        Base.metadata.create_all(bind=engine)


@app.get("/health")
@app.get("/health/live")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/ready")
def readiness() -> dict[str, str]:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as exc:
        logger.warning("readiness_check_failed", exc_info=exc)
        return JSONResponse(status_code=503, content={"status": "unavailable"})
    return {"status": "ready"}


app.include_router(auth_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(staff_router, prefix="/api/v1")
