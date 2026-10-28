"""Comprobaciones optativas en transacción reversible de PostgreSQL local."""
import importlib.util
import os
from pathlib import Path
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import base as _models  # noqa: F401
from app.db.session import engine
from app.models.rate_limit import RateLimitBucket
from app.services.jobs import recover_expired_leases
from app.services.rate_limit import enforce_rate_limit


@pytest.mark.skipif(os.getenv("RUN_LOCAL_PG_HARDENING_TEST") != "1", reason="prueba PostgreSQL local optativa")
def test_migracion_limites_y_lease():
    if engine.url.host not in {"localhost", "127.0.0.1", "::1"}:
        pytest.fail("La prueba solo admite PostgreSQL local")
    schema = "hardening_test_" + uuid4().hex
    connection = engine.connect()
    transaction = connection.begin()
    try:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET LOCAL search_path TO "{schema}", public'))
        connection.execute(text("CREATE TABLE users (id uuid PRIMARY KEY)"))
        connection.execute(text("INSERT INTO users (id) VALUES (:id)"), {"id": uuid4()})
        path = Path(__file__).resolve().parents[1] / "alembic" / "versions" / "20261027_01_verification_state.py"
        spec = importlib.util.spec_from_file_location("verification_migration", path)
        assert spec and spec.loader
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
        assert connection.execute(text("SELECT email_verification_pending FROM users")).scalar() is False
        path = path.with_name("20261027_02_evidence_deletions.py")
        spec = importlib.util.spec_from_file_location("evidence_deletions_migration", path)
        assert spec and spec.loader
        migration = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration)
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
        assert connection.execute(text("SELECT count(*) FROM evidence_deletion_queue")).scalar() == 0

        RateLimitBucket.__table__.create(connection, checkfirst=False)
        with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
            enforce_rate_limit(db, scope="test", identifier="ip", limit=2)
            enforce_rate_limit(db, scope="test", identifier="ip", limit=2)
            with pytest.raises(HTTPException) as exc:
                enforce_rate_limit(db, scope="test", identifier="ip", limit=2)
            assert exc.value.status_code == 429

        connection.execute(text("CREATE TYPE job_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')"))
        connection.execute(text("CREATE TABLE jobs (status job_status, attempts integer, max_attempts integer, "
                                "locked_at timestamptz, locked_by text, run_after timestamptz, updated_at timestamptz, last_error text)"))
        connection.execute(text("INSERT INTO jobs (status, attempts, max_attempts, locked_at) VALUES "
                                "('PROCESSING', 5, 5, now() - interval '1 hour'), "
                                "('PROCESSING', 1, 5, now() - interval '1 hour')"))
        with Session(bind=connection, join_transaction_mode="create_savepoint") as db:
            assert recover_expired_leases(db, lease_seconds=300) == 2
            db.commit()
        statuses = connection.execute(text("SELECT status::text FROM jobs ORDER BY attempts DESC")).scalars().all()
        assert statuses == ["FAILED", "PENDING"]
    finally:
        transaction.rollback()
        connection.close()
