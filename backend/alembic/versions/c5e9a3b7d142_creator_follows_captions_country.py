"""Creator following, image captions and the shopper's country.

Additive only: one new table and two nullable columns.

Revision ID: c5e9a3b7d142
Revises: b7d2e4f1a905
"""
from alembic import op
import sqlalchemy as sa

revision = "c5e9a3b7d142"
down_revision = "b7d2e4f1a905"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "creator_follows",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("follower_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("creator_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("follower_id", "creator_id", name="uq_creator_follow"),
    )
    op.create_index("ix_creator_follows_id", "creator_follows", ["id"])
    op.create_index("ix_creator_follows_follower_id", "creator_follows", ["follower_id"])
    op.create_index("ix_creator_follows_creator_id", "creator_follows", ["creator_id"])
    op.add_column("product_media", sa.Column("caption", sa.String(200), nullable=True))
    op.add_column("users", sa.Column("country", sa.String(2), nullable=True))


def downgrade():
    op.drop_column("users", "country")
    op.drop_column("product_media", "caption")
    op.drop_table("creator_follows")
