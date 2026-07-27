"""add customer-to-creator custom design commissions

Revision ID: e2f6b184ca70
Revises: d1a95b6c2e08
Create Date: 2026-07-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'e2f6b184ca70'
down_revision: Union[str, None] = 'd1a95b6c2e08'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


COMMISSION_STATUS = (
    'pending_payment', 'submitted', 'accepted', 'quoted', 'negotiating',
    'agreed', 'delivered', 'completed', 'declined', 'cancelled',
)
COMMISSION_INTENT = ('file_only', 'print_too')

# Already created by the collaboration migrations and reused here, so these
# must not be re-created or dropped.
payment_status = postgresql.ENUM(
    'pending', 'completed', 'failed', name='paymentstatus', create_type=False
)
agreement_status = postgresql.ENUM(
    'pending', 'active', 'terminated', name='agreementstatus', create_type=False
)


def upgrade() -> None:
    # Lowercase labels: the models declare these columns with values_callable, so
    # SQLAlchemy reads/writes enum *values*, not member names.
    op.execute('DROP TYPE IF EXISTS commissionstatus CASCADE')
    op.execute(
        "CREATE TYPE commissionstatus AS ENUM (%s)"
        % ', '.join(f"'{v}'" for v in COMMISSION_STATUS)
    )
    op.execute('DROP TYPE IF EXISTS commissionintent CASCADE')
    op.execute(
        "CREATE TYPE commissionintent AS ENUM (%s)"
        % ', '.join(f"'{v}'" for v in COMMISSION_INTENT)
    )

    commission_status = postgresql.ENUM(
        *COMMISSION_STATUS, name='commissionstatus', create_type=False
    )
    commission_intent = postgresql.ENUM(
        *COMMISSION_INTENT, name='commissionintent', create_type=False
    )

    op.create_table(
        'custom_design_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('creator_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('brief', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('reference_image_url', sa.String(), nullable=True),
        sa.Column('target_budget', sa.Float(), nullable=True),
        sa.Column('desired_material', sa.String(), nullable=True),
        sa.Column('desired_color', sa.String(), nullable=True),
        sa.Column('dimensions_note', sa.String(), nullable=True),
        sa.Column('intent', commission_intent, nullable=False, server_default='file_only'),
        sa.Column('brief_fee', sa.Float(), nullable=False, server_default='25.0'),
        sa.Column('payment_status', payment_status, nullable=False, server_default='pending'),
        sa.Column('design_fee_status', payment_status, nullable=False, server_default='pending'),
        sa.Column('workflow_status', commission_status, nullable=False, server_default='pending_payment'),
        sa.Column('decline_reason', sa.String(), nullable=True),
        sa.Column('final_design_url', sa.String(), nullable=True),
        sa.Column('final_design_name', sa.String(), nullable=True),
        sa.Column('final_design_size', sa.Integer(), nullable=True),
        sa.Column('delivered_at', sa.DateTime(), nullable=True),
        sa.Column('revisions_used', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('revision_note', sa.String(), nullable=True),
        sa.Column('print_order_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['customer_id'], ['users.id']),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id']),
        sa.ForeignKeyConstraint(['print_order_id'], ['orders.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_custom_design_requests_id'), 'custom_design_requests', ['id'])

    op.create_table(
        'custom_design_proposals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_id', sa.Integer(), nullable=False),
        sa.Column('design_fee', sa.Float(), nullable=False),
        sa.Column('revisions_included', sa.Integer(), nullable=False, server_default='2'),
        sa.Column('delivery_days', sa.Integer(), nullable=False),
        sa.Column('print_unit_price', sa.Float(), nullable=True),
        sa.Column('concept_image', sa.String(), nullable=True),
        sa.Column('scope_notes', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['request_id'], ['custom_design_requests.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('request_id'),
    )
    op.create_index(op.f('ix_custom_design_proposals_id'), 'custom_design_proposals', ['id'])

    op.create_table(
        'custom_design_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_id', sa.Integer(), nullable=False),
        sa.Column('sender_id', sa.Integer(), nullable=False),
        sa.Column('content', sa.String(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['request_id'], ['custom_design_requests.id']),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_custom_design_messages_id'), 'custom_design_messages', ['id'])

    op.create_table(
        'custom_design_agreements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('request_id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('creator_id', sa.Integer(), nullable=False),
        sa.Column('final_price', sa.Float(), nullable=False),
        sa.Column('delivery_days', sa.Integer(), nullable=True),
        sa.Column('status', agreement_status, nullable=False, server_default='pending'),
        sa.Column('customer_confirmed', sa.Boolean(), server_default=sa.false(), nullable=True),
        sa.Column('creator_confirmed', sa.Boolean(), server_default=sa.false(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['request_id'], ['custom_design_requests.id']),
        sa.ForeignKeyConstraint(['customer_id'], ['users.id']),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('request_id'),
    )
    op.create_index(op.f('ix_custom_design_agreements_id'), 'custom_design_agreements', ['id'])


def downgrade() -> None:
    op.drop_table('custom_design_agreements')
    op.drop_table('custom_design_messages')
    op.drop_table('custom_design_proposals')
    op.drop_table('custom_design_requests')
    op.execute('DROP TYPE IF EXISTS commissionintent CASCADE')
    op.execute('DROP TYPE IF EXISTS commissionstatus CASCADE')
