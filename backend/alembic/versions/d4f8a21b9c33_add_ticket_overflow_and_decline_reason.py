"""add overflow_reason and decline_reason to collaboration tickets

Revision ID: d4f8a21b9c33
Revises: b7e1c9d2f3a4
Create Date: 2026-07-26 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd4f8a21b9c33'
down_revision: Union[str, None] = 'b7e1c9d2f3a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Lowercase labels: the model declares this column with values_callable, so
    # SQLAlchemy reads/writes enum *values*, not member names.
    op.execute('DROP TYPE IF EXISTS overflowreason CASCADE')
    op.execute("CREATE TYPE overflowreason AS ENUM ('shipping_difficulty', 'overflow_capacity')")
    op.add_column(
        'collaboration_tickets',
        sa.Column(
            'overflow_reason',
            postgresql.ENUM('shipping_difficulty', 'overflow_capacity', name='overflowreason', create_type=False),
            nullable=True,
        ),
    )
    op.add_column('collaboration_tickets', sa.Column('decline_reason', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('collaboration_tickets', 'decline_reason')
    op.drop_column('collaboration_tickets', 'overflow_reason')
    op.execute('DROP TYPE IF EXISTS overflowreason CASCADE')
