"""Make AI results provider-neutral and one successful result per incident."""

from pathlib import Path

from alembic import op

revision = "20260804_01"
down_revision = "20260730_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    sql_path = Path(__file__).resolve().parents[2] / "sql" / "20260804_01_ai_router.sql"
    op.execute(sql_path.read_text(encoding="utf-8"))


def downgrade() -> None:
    raise NotImplementedError("AI router migration is intentionally forward-only")
