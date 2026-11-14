"""Pre-launch waitlist for printed products.

Additive only: one new table.

Revision ID: d2e8b4c6a913
Revises: c8a3f1d27e54
"""
from alembic import op
import sqlalchemy as sa

revision = "d2e8b4c6a913"
down_revision = "c8a3f1d27e54"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "waitlist_signups",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("interest", sa.String(32), nullable=False),
        sa.Column("price_choice", sa.String(16), nullable=True),
        sa.Column("city", sa.String(80), nullable=True),
        sa.Column("source", sa.String(32), nullable=False, server_default="home"),
        sa.Column("consented_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_waitlist_signups_id", "waitlist_signups", ["id"])
    op.create_index("ix_waitlist_signups_email", "waitlist_signups", ["email"], unique=True)


def downgrade():
    op.drop_index("ix_waitlist_signups_email", table_name="waitlist_signups")
    op.drop_index("ix_waitlist_signups_id", table_name="waitlist_signups")
    op.drop_table("waitlist_signups")
