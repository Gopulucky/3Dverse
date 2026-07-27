"""point defect_reports.print_partner_id at users instead of print_partners

Revision ID: d1a95b6c2e08
Revises: c8b41e0d7f92
Create Date: 2026-07-26 21:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1a95b6c2e08'
down_revision: Union[str, None] = 'c8b41e0d7f92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # DefectReport.print_partner_id is meant to identify the User who actually
    # fulfilled the order (Order.print_partner_id), not a row in the separate
    # print_partners collaboration-matching table -- every write path already
    # populates it from Order.print_partner_id, so the constraint was wrong.
    op.drop_constraint('defect_reports_print_partner_id_fkey', 'defect_reports', type_='foreignkey')
    op.alter_column('defect_reports', 'print_partner_id', nullable=True)
    op.create_foreign_key(
        'defect_reports_print_partner_id_fkey', 'defect_reports', 'users',
        ['print_partner_id'], ['id'],
    )


def downgrade() -> None:
    op.drop_constraint('defect_reports_print_partner_id_fkey', 'defect_reports', type_='foreignkey')
    op.alter_column('defect_reports', 'print_partner_id', nullable=False)
    op.create_foreign_key(
        'defect_reports_print_partner_id_fkey', 'defect_reports', 'print_partners',
        ['print_partner_id'], ['id'],
    )
