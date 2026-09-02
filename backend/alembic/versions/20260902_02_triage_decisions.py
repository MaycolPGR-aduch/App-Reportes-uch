"""Registro de las decisiones humanas de clasificacion."""

from pathlib import Path

from alembic import op

revision = "20260902_02"
down_revision = "20260902_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    sql_path = Path(__file__).resolve().parents[2] / "sql" / "20260902_02_triage_decisions.sql"
    op.execute(sql_path.read_text(encoding="utf-8"))


def downgrade() -> None:
    raise NotImplementedError("Borrar las decisiones destruiria los datos del estudio")
