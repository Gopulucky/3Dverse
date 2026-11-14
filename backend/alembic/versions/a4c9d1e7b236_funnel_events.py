"""Anonymous funnel events (visits, product views, checkout, paid).

Additive only: one new table.

Revision ID: a4c9d1e7b236
Revises: e5b7c2d9a418
"""
from alembic import op
import sqlalchemy as sa

revision = "a4c9d1e7b236"
down_revision = "e5b7c2d9a418"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "funnel_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("anon_id", sa.String(64), nullable=False),
        sa.Column("event", sa.String(32), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("source", sa.String(64), nullable=True),
        sa.Column("medium", sa.String(64), nullable=True),
        sa.Column("campaign", sa.String(64), nullable=True),
        sa.Column("path", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    for column in ("id", "anon_id", "event", "product_id", "order_id", "created_at"):
        op.create_index(f"ix_funnel_events_{column}", "funnel_events", [column])


def downgrade():
    op.drop_table("funnel_events")
