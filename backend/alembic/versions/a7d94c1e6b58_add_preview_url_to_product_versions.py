"""add preview_url to product_versions

Revision ID: a7d94c1e6b58
Revises: c2b6e4a80f17
Create Date: 2026-07-26 20:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7d94c1e6b58'
down_revision: Union[str, None] = 'c2b6e4a80f17'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('product_versions', sa.Column('preview_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('product_versions', 'preview_url')
