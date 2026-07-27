"""link print_partners to a user account

Revision ID: c8b41e0d7f92
Revises: f6c2a90e3d41
Create Date: 2026-07-26 21:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8b41e0d7f92'
down_revision: Union[str, None] = 'f6c2a90e3d41'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('print_partners', sa.Column('user_id', sa.Integer(), nullable=True))
    op.create_unique_constraint('uq_print_partners_user_id', 'print_partners', ['user_id'])
    op.create_foreign_key(None, 'print_partners', 'users', ['user_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('uq_print_partners_user_id', 'print_partners', type_='unique')
    op.drop_column('print_partners', 'user_id')
