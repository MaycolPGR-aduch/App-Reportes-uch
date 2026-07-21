"""Production hardening schema.

Revision ID: 20260721_01
Revises: 20260318_01
"""

from alembic import op

revision = "20260721_01"
down_revision = "20260318_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Kept in one audited SQL source so existing installations can also apply it
    # manually before `alembic stamp 20260721_01`.
    from pathlib import Path

    sql_path = Path(__file__).resolve().parents[2] / "sql" / "20260721_production_hardening.sql"
    sql = sql_path.read_text(encoding="utf-8")
    with op.get_context().autocommit_block():
        op.execute(sql)


def downgrade() -> None:
    raise NotImplementedError("Production hardening is intentionally forward-only")
