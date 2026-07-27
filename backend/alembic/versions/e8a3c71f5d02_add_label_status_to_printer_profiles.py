"""add label and status to printer_profiles

Revision ID: e8a3c71f5d02
Revises: d4f8a21b9c33
Create Date: 2026-07-26 19:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e8a3c71f5d02'
down_revision: Union[str, None] = 'd4f8a21b9c33'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # A `printerstatus` type is left behind by the old `printers` table drop in
    # 3bd183c97112, so recreate it rather than assuming it is absent.
    op.execute('DROP TYPE IF EXISTS printerstatus CASCADE')
    op.execute("CREATE TYPE printerstatus AS ENUM ('active', 'maintenance', 'offline')")
    op.add_column('printer_profiles', sa.Column('label', sa.String(), nullable=True))
    op.add_column(
        'printer_profiles',
        sa.Column(
            'status',
            postgresql.ENUM('active', 'maintenance', 'offline', name='printerstatus', create_type=False),
            nullable=False,
            server_default='active',
        ),
    )
    op.alter_column('printer_profiles', 'status', server_default=None)


def downgrade() -> None:
    op.drop_column('printer_profiles', 'status')
    op.drop_column('printer_profiles', 'label')
    op.execute('DROP TYPE IF EXISTS printerstatus CASCADE')
