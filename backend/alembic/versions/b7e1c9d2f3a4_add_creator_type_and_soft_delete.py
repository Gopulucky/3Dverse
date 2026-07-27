"""add creator_type and deleted_at to users

Revision ID: b7e1c9d2f3a4
Revises: ace656c3636d
Create Date: 2026-07-25

Adds the account-level creator path (studio / seller / designer), chosen once
on entering the Creator Studio and immutable afterwards, plus a soft-delete
timestamp used by self-service account deletion.
"""
from alembic import op
import sqlalchemy as sa


revision = "b7e1c9d2f3a4"
down_revision = "ace656c3636d"
branch_labels = None
depends_on = None


creator_type_enum = sa.Enum("studio", "seller", "designer", name="creatortype")


def upgrade() -> None:
    # An orphaned `creatortype` enum (SELF_FULFILLING / DESIGNER_ONLY) survives
    # from the dropped `creators.creator_type` column. Drop it first — creating
    # with checkfirst=True would silently bind the new column to those stale
    # labels and every insert of 'studio'/'seller'/'designer' would fail.
    op.execute("DROP TYPE IF EXISTS creatortype")
    creator_type_enum.create(op.get_bind(), checkfirst=False)
    op.add_column("users", sa.Column("creator_type", creator_type_enum, nullable=True))
    op.add_column("users", sa.Column("deleted_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "deleted_at")
    op.drop_column("users", "creator_type")
    creator_type_enum.drop(op.get_bind(), checkfirst=True)
