"""Audience popup answers (who visitors are and what they want).

Additive only: one new table.

Revision ID: b7d2e4f1a905
Revises: a4c9d1e7b236
"""
from alembic import op
import sqlalchemy as sa

revision = "b7d2e4f1a905"
down_revision = "a4c9d1e7b236"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "audience_responses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("response_id", sa.String(64), nullable=False),
        sa.Column("anon_id", sa.String(64), nullable=True),
        sa.Column("step_reached", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("role", sa.String(24), nullable=True),
        sa.Column("city", sa.String(80), nullable=True),
        sa.Column("uses", sa.JSON(), nullable=True),
        sa.Column("occasions", sa.JSON(), nullable=True),
        sa.Column("owns_printer", sa.String(16), nullable=True),
        sa.Column("personalise", sa.String(16), nullable=True),
        sa.Column("bought_where", sa.String(24), nullable=True),
        sa.Column("spend_band", sa.String(16), nullable=True),
        sa.Column("missing", sa.String(280), nullable=True),
        sa.Column("email", sa.String(254), nullable=True),
        sa.Column("whatsapp", sa.String(10), nullable=True),
        sa.Column("chat_ok", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("consented_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_audience_responses_id", "audience_responses", ["id"])
    op.create_index("ix_audience_responses_response_id", "audience_responses", ["response_id"], unique=True)
    op.create_index("ix_audience_responses_anon_id", "audience_responses", ["anon_id"])
    op.create_index("ix_audience_responses_email", "audience_responses", ["email"])
    op.create_index("ix_audience_responses_created_at", "audience_responses", ["created_at"])


def downgrade():
    op.drop_table("audience_responses")
