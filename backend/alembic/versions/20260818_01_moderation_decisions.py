"""Audit trail for manual community-visibility moderation."""

from pathlib import Path

from alembic import op

revision = "20260818_01"
down_revision = "20260804_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    sql_path = (
        Path(__file__).resolve().parents[2] / "sql" / "20260818_01_moderation_decisions.sql"
    )
    op.execute(sql_path.read_text(encoding="utf-8"))


def downgrade() -> None:
    raise NotImplementedError("Moderation audit trail is intentionally forward-only")
