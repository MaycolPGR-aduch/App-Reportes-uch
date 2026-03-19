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
    cors_origins: list[str]
    local_storage_path: Path
    max_image_size_mb: int
    openai_api_key: str | None
    openai_model: str
    openai_prompt_version: str
    sendgrid_api_key: str | None
    sendgrid_from_email: str | None
    default_alert_email: str | None
    dashboard_base_url: str
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

    return Settings(
        app_name=os.getenv("APP_NAME", "Campus Incidents API"),
        app_env=os.getenv("APP_ENV", "development"),
        app_debug=_as_bool(os.getenv("APP_DEBUG"), default=False),
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg2://postgres:postgres@localhost:5432/campus_incidents",
        ),
        auto_create_schema=_as_bool(os.getenv("AUTO_CREATE_SCHEMA"), default=False),
        jwt_secret=os.getenv("JWT_SECRET", "change-this-secret-in-production"),
        jwt_exp_minutes=int(os.getenv("JWT_EXP_MINUTES", "480")),
        cors_origins=cors_origins,
        local_storage_path=local_storage_path,
        max_image_size_mb=int(os.getenv("MAX_IMAGE_SIZE_MB", "10")),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        openai_prompt_version=os.getenv("OPENAI_PROMPT_VERSION", "mvp-v1"),
        sendgrid_api_key=os.getenv("SENDGRID_API_KEY"),
        sendgrid_from_email=os.getenv("SENDGRID_FROM_EMAIL"),
        default_alert_email=os.getenv("DEFAULT_ALERT_EMAIL"),
        dashboard_base_url=os.getenv(
            "DASHBOARD_BASE_URL", "http://localhost:3000/dashboard"
        ),
        worker_poll_seconds=float(os.getenv("WORKER_POLL_SECONDS", "2.0")),
        classification_retry_delay_seconds=int(
            os.getenv("CLASSIFICATION_RETRY_DELAY_SECONDS", "120")
        ),
        notification_retry_delay_seconds=int(
            os.getenv("NOTIFICATION_RETRY_DELAY_SECONDS", "60")
        ),
    )
