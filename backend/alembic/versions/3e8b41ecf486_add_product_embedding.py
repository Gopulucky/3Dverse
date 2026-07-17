"""add product embedding

Revision ID: 3e8b41ecf486
Revises: 2cdf41ecf375
Create Date: 2026-07-17 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import pgvector.sqlalchemy

# revision identifiers, used by Alembic.
revision: str = '3e8b41ecf486'
down_revision: Union[str, None] = '2cdf41ecf375'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS vector;')
    op.add_column('products', sa.Column('embedding', pgvector.sqlalchemy.Vector(384), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'embedding')
    op.execute('DROP EXTENSION IF EXISTS vector;')
