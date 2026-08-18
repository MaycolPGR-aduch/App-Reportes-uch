"""Add opt-in community feed visibility and reactions."""

from pathlib import Path

from alembic import op

revision = "20260730_01"
down_revision = "20260721_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    sql_path = Path(__file__).resolve().parents[2] / "sql" / "20260730_01_community_feed.sql"
    op.execute(sql_path.read_text(encoding="utf-8"))


def downgrade() -> None:
    raise NotImplementedError("Community feed migration is intentionally forward-only")
