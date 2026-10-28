"""Cola durable de eliminación de evidencias."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "20261027_02"
down_revision = "20261027_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "evidence_deletion_queue",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("storage_identity", sa.String(80), nullable=False),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("storage_identity", "storage_path", name="uq_evidence_deletion_path"),
    )


def downgrade() -> None:
    raise NotImplementedError("La reversión perdería eliminaciones pendientes")
