"""Baseline MVP schema for Alembic-managed installations.

Revision ID: 20260318_01
"""

from pathlib import Path

from alembic import op

revision = "20260318_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    sql_path = Path(__file__).resolve().parents[2] / "sql" / "schema.sql"
    op.execute(sql_path.read_text(encoding="utf-8"))


def downgrade() -> None:
    raise NotImplementedError("The legacy MVP baseline is forward-only")
