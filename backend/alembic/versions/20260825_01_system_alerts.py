"""Deduplication store for automatic system health alerts."""

from pathlib import Path

from alembic import op

revision = "20260825_01"
down_revision = "20260818_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    sql_path = Path(__file__).resolve().parents[2] / "sql" / "20260825_01_system_alerts.sql"
    op.execute(sql_path.read_text(encoding="utf-8"))


def downgrade() -> None:
    raise NotImplementedError("System alert store is intentionally forward-only")
