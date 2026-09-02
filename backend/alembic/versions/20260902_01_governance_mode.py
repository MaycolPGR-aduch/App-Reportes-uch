"""Modo de gobernanza y categoria original por incidencia."""

from pathlib import Path

from alembic import op

revision = "20260902_01"
down_revision = "20260825_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    sql_path = Path(__file__).resolve().parents[2] / "sql" / "20260902_01_governance_mode.sql"
    op.execute(sql_path.read_text(encoding="utf-8"))


def downgrade() -> None:
    raise NotImplementedError(
        "Revertir borraria la trazabilidad experimental de incidencias ya procesadas"
    )
