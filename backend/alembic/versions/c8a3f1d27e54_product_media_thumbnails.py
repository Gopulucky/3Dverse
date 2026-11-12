"""Product media: a small thumbnail copy for cards and lists.

Additive only: one nullable column. Existing rows keep NULL and are shown from
the original image until the backfill script (scripts/backfill_thumbnails.py)
is run.

Revision ID: c8a3f1d27e54
Revises: b4d7e2a91c36
"""
from alembic import op
import sqlalchemy as sa

revision = "c8a3f1d27e54"
down_revision = "b4d7e2a91c36"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("product_media", sa.Column("thumb_url", sa.String(), nullable=True))


def downgrade():
    op.drop_column("product_media", "thumb_url")
