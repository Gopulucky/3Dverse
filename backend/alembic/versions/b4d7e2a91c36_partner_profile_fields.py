"""Print partner profile: availability, rates, lead time and build volume.

Additive only: every column is nullable or has a default, so existing partner
rows stay valid and nobody is listed until they switch accepting_work on.

Revision ID: b4d7e2a91c36
Revises: d9f2a7b6c104
"""
from alembic import op
import sqlalchemy as sa

revision = "b4d7e2a91c36"
down_revision = "d9f2a7b6c104"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("print_partners", sa.Column("accepting_work", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("print_partners", sa.Column("bio", sa.String(), nullable=True))
    op.add_column("print_partners", sa.Column("lead_time_days", sa.Integer(), nullable=True))
    op.add_column("print_partners", sa.Column("price_per_gram_inr", sa.Float(), nullable=True))
    op.add_column("print_partners", sa.Column("min_order_inr", sa.Float(), nullable=True))
    op.add_column("print_partners", sa.Column("build_x_mm", sa.Integer(), nullable=True))
    op.add_column("print_partners", sa.Column("build_y_mm", sa.Integer(), nullable=True))
    op.add_column("print_partners", sa.Column("build_z_mm", sa.Integer(), nullable=True))


def downgrade():
    for name in ("build_z_mm", "build_y_mm", "build_x_mm", "min_order_inr", "price_per_gram_inr",
                 "lead_time_days", "bio", "accepting_work"):
        op.drop_column("print_partners", name)
