"""Historial de cambios de estado por incidencia."""

from pathlib import Path

from alembic import op

revision = "20260922_01"
down_revision = "20260902_02"
branch_labels = None
depends_on = None


def upgrade() -> None:
    sql_path = (
        Path(__file__).resolve().parents[2] / "sql" / "20260922_01_incident_status_events.sql"
    )
    op.execute(sql_path.read_text(encoding="utf-8"))


def downgrade() -> None:
    raise NotImplementedError("Revertir borraria el historial de estados ya registrado")
