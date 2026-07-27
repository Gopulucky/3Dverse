"""add design safety review fields to products

Revision ID: f6c2a90e3d41
Revises: b3e15f27ac90
Create Date: 2026-07-26 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'f6c2a90e3d41'
down_revision: Union[str, None] = 'b3e15f27ac90'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('DROP TYPE IF EXISTS safetyreviewstatus CASCADE')
    op.execute("CREATE TYPE safetyreviewstatus AS ENUM ('pending', 'approved', 'rejected')")
    op.add_column(
        'products',
        sa.Column(
            'safety_review_status',
            postgresql.ENUM('pending', 'approved', 'rejected', name='safetyreviewstatus', create_type=False),
            nullable=False,
            server_default='pending',
        ),
    )
    op.add_column('products', sa.Column('safety_review_note', sa.String(), nullable=True))
    op.add_column('products', sa.Column('safety_reviewed_at', sa.DateTime(), nullable=True))
    op.alter_column('products', 'safety_review_status', server_default=None)


def downgrade() -> None:
    op.drop_column('products', 'safety_reviewed_at')
    op.drop_column('products', 'safety_review_note')
    op.drop_column('products', 'safety_review_status')
    op.execute('DROP TYPE IF EXISTS safetyreviewstatus CASCADE')
