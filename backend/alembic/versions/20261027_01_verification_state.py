"""Distinguir verificación pendiente de una suspensión administrativa."""
from alembic import op
import sqlalchemy as sa

revision = "20261027_01"
down_revision = "20260922_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Cuentas inactivas anteriores son ambiguas: no reactivarlas automáticamente.
    op.add_column("users", sa.Column("email_verification_pending", sa.Boolean(),
                                     nullable=False, server_default=sa.false()))


def downgrade() -> None:
    raise NotImplementedError("La reversión perdería el estado de verificación")
