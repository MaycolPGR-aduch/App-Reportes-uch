from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from backend/.env when present.
load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_env: str
    app_debug: bool
    database_url: str
    auto_create_schema: bool
    jwt_secret: str
    jwt_exp_minutes: int
    session_cookie_name: str
    csrf_cookie_name: str
    cookie_secure: bool
    cookie_samesite: str
    allowed_email_domains: list[str]
    trusted_hosts: list[str]
    turnstile_secret_key: str | None
    require_turnstile: bool
    rate_limit_login: int
    rate_limit_public_report: int
    max_image_pixels: int
    job_lease_seconds: int
    retention_days: int
    backup_s3_bucket: str | None
    backup_s3_prefix: str
    storage_backend: str
    s3_bucket: str | None
    s3_prefix: str
    s3_endpoint_url: str | None
    s3_access_key_id: str | None
    s3_secret_access_key: str | None
    s3_region: str
    cors_origins: list[str]
    local_storage_path: Path
    max_image_size_mb: int
    ai_tokenrouter_api_key: str | None
    ai_tokenrouter_base_url: str
    ai_image_primary_model: str | None
    ai_image_fallback_models: list[str]
    ai_prompt_version: str
    ai_request_timeout_seconds: float
    ai_max_output_tokens: int
    auto_assign_enabled: bool
    ai_moderation_enabled: bool
    alerts_enabled: bool
    alert_silence_hours: int
    monitor_interval_minutes: int
    reporter_updates_enabled: bool
    brevo_api_key: str | None
    brevo_from_email: str | None
    brevo_from_name: str
    default_alert_email: str | None
    dashboard_base_url: str
    frontend_base_url: str
    worker_poll_seconds: float
    classification_retry_delay_seconds: int
    notification_retry_delay_seconds: int


def _as_bool(raw: str | None, default: bool = False) -> bool:
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}


def _as_list(raw: str | None) -> list[str]:
    if not raw:
        return []
    return [item.strip() for item in raw.split(",") if item.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    local_storage_path = Path(
        os.getenv("LOCAL_STORAGE_PATH", "./data/evidences")
    ).resolve()

    cors_origins = _as_list(os.getenv("CORS_ORIGINS"))
    if not cors_origins:
        cors_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

    app_env = os.getenv("APP_ENV", "development")
    jwt_secret = os.getenv("JWT_SECRET")
    if app_env.lower() == "production" and (
        not jwt_secret or jwt_secret == "change-this-secret-in-production"
    ):
        raise RuntimeError("JWT_SECRET must be configured in production")
    if app_env.lower() == "production" and (not cors_origins or "*" in cors_origins):
        raise RuntimeError("CORS_ORIGINS must contain explicit origins in production")

    return Settings(
        app_name=os.getenv("APP_NAME", "Campus Incidents API"),
        app_env=app_env,
        app_debug=_as_bool(os.getenv("APP_DEBUG"), default=False),
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg2://postgres:postgres@localhost:5432/campus_incidents",
        ),
        auto_create_schema=_as_bool(os.getenv("AUTO_CREATE_SCHEMA"), default=False),
        jwt_secret=jwt_secret or "development-only-secret-change-me",
        jwt_exp_minutes=int(os.getenv("JWT_EXP_MINUTES", "480")),
        session_cookie_name=os.getenv("SESSION_COOKIE_NAME", "campus_session"),
        csrf_cookie_name=os.getenv("CSRF_COOKIE_NAME", "campus_csrf"),
        cookie_secure=_as_bool(os.getenv("COOKIE_SECURE"), default=app_env.lower() == "production"),
        cookie_samesite=os.getenv("COOKIE_SAMESITE", "lax").strip().lower(),
        allowed_email_domains=[domain.lower() for domain in _as_list(os.getenv("ALLOWED_EMAIL_DOMAINS"))],
        trusted_hosts=_as_list(os.getenv("TRUSTED_HOSTS")),
        turnstile_secret_key=os.getenv("TURNSTILE_SECRET_KEY"),
        require_turnstile=_as_bool(os.getenv("REQUIRE_TURNSTILE"), default=app_env.lower() == "production"),
        rate_limit_login=int(os.getenv("RATE_LIMIT_LOGIN", "5")),
        rate_limit_public_report=int(os.getenv("RATE_LIMIT_PUBLIC_REPORT", "3")),
        max_image_pixels=int(os.getenv("MAX_IMAGE_PIXELS", "25000000")),
        job_lease_seconds=int(os.getenv("JOB_LEASE_SECONDS", "300")),
        retention_days=int(os.getenv("RETENTION_DAYS", "180")),
        backup_s3_bucket=os.getenv("BACKUP_S3_BUCKET"),
        backup_s3_prefix=os.getenv("BACKUP_S3_PREFIX", "campus-evidences"),
        storage_backend=os.getenv("STORAGE_BACKEND", "local").strip().lower(),
        s3_bucket=os.getenv("S3_BUCKET"),
        s3_prefix=os.getenv("S3_PREFIX", "evidences"),
        s3_endpoint_url=os.getenv("S3_ENDPOINT_URL"),
        s3_access_key_id=os.getenv("S3_ACCESS_KEY_ID"),
        s3_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY"),
        # R2 exige la region literal "auto"; AWS espera la suya (us-east-1...).
        s3_region=os.getenv("S3_REGION", "auto"),
        cors_origins=cors_origins,
        local_storage_path=local_storage_path,
        max_image_size_mb=int(os.getenv("MAX_IMAGE_SIZE_MB", "10")),
        ai_tokenrouter_api_key=os.getenv("AI_TOKENROUTER_API_KEY"),
        ai_tokenrouter_base_url=os.getenv(
            "AI_TOKENROUTER_BASE_URL", "https://api.tokenrouter.com/v1"
        ).rstrip("/"),
        ai_image_primary_model=os.getenv("AI_IMAGE_PRIMARY_MODEL") or None,
        ai_image_fallback_models=_as_list(os.getenv("AI_IMAGE_FALLBACK_MODELS")),
        ai_prompt_version=os.getenv("AI_PROMPT_VERSION", "incident-classification-v2"),
        ai_request_timeout_seconds=float(os.getenv("AI_REQUEST_TIMEOUT_SECONDS", "30")),
        ai_max_output_tokens=int(os.getenv("AI_MAX_OUTPUT_TOKENS", "700")),
        auto_assign_enabled=_as_bool(os.getenv("AUTO_ASSIGN_ENABLED"), default=False),
        ai_moderation_enabled=_as_bool(os.getenv("AI_MODERATION_ENABLED"), default=True),
        alerts_enabled=_as_bool(os.getenv("ALERTS_ENABLED"), default=True),
        alert_silence_hours=int(os.getenv("ALERT_SILENCE_HOURS", "6")),
        monitor_interval_minutes=int(os.getenv("MONITOR_INTERVAL_MINUTES", "15")),
        reporter_updates_enabled=_as_bool(os.getenv("REPORTER_UPDATES_ENABLED"), default=True),
        brevo_api_key=os.getenv("BREVO_API_KEY"),
        brevo_from_email=os.getenv("BREVO_FROM_EMAIL"),
        brevo_from_name=os.getenv("BREVO_FROM_NAME", "Campus Alertas"),
        default_alert_email=os.getenv("DEFAULT_ALERT_EMAIL"),
        dashboard_base_url=os.getenv(
            "DASHBOARD_BASE_URL", "http://localhost:3000/dashboard"
        ),
        frontend_base_url=os.getenv("FRONTEND_BASE_URL", "http://localhost:3000"),
        worker_poll_seconds=float(os.getenv("WORKER_POLL_SECONDS", "2.0")),
        classification_retry_delay_seconds=int(
            os.getenv("CLASSIFICATION_RETRY_DELAY_SECONDS", "120")
        ),
        notification_retry_delay_seconds=int(
            os.getenv("NOTIFICATION_RETRY_DELAY_SECONDS", "60")
        ),
    )
