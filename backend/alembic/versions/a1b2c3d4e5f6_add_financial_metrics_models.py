"""add financial metrics models

Revision ID: a1b2c3d4e5f6
Revises: fb3b187ff900
Create Date: 2026-07-22 10:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: str = 'f7b7071e56da'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- New tables ---

    op.create_table(
        'print_partners',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('region', sa.String(), nullable=True),
        sa.Column('total_orders_fulfilled', sa.Integer(), server_default='0'),
        sa.Column('total_defect_reports', sa.Integer(), server_default='0'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_print_partners_id'), 'print_partners', ['id'])

    op.create_table(
        'defect_reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('print_partner_id', sa.Integer(), nullable=False),
        sa.Column('reported_at', sa.DateTime(), nullable=True),
        sa.Column('within_window', sa.Boolean(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('reprint_status', sa.String(), server_default='pending'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id']),
        sa.ForeignKeyConstraint(['print_partner_id'], ['print_partners.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_defect_reports_id'), 'defect_reports', ['id'])

    op.create_table(
        'filament_spools',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('creator_id', sa.Integer(), nullable=False),
        sa.Column('material_type', sa.String(), nullable=False),
        sa.Column('color', sa.String(), nullable=True),
        sa.Column('total_weight_g', sa.Float(), nullable=False),
        sa.Column('cost', sa.Float(), nullable=False),
        sa.Column('purchase_date', sa.DateTime(), nullable=True),
        sa.Column('is_depleted', sa.Boolean(), server_default='false'),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_filament_spools_id'), 'filament_spools', ['id'])

    op.create_table(
        'product_filament_requirements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('material_type', sa.String(), nullable=False),
        sa.Column('grams_per_unit', sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_product_filament_requirements_id'), 'product_filament_requirements', ['id'])

    op.create_table(
        'production_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('spool_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('units_produced', sa.Integer(), nullable=False),
        sa.Column('grams_used', sa.Float(), nullable=False),
        sa.Column('logged_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['spool_id'], ['filament_spools.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_production_logs_id'), 'production_logs', ['id'])

    op.create_table(
        'printer_assumptions',
        sa.Column('creator_id', sa.Integer(), nullable=False),
        sa.Column('printer_cost', sa.Float(), server_default='35000'),
        sa.Column('expected_lifetime_prints', sa.Integer(), server_default='3000'),
        sa.Column('wattage_w', sa.Float(), server_default='250'),
        sa.Column('electricity_rate_per_kwh', sa.Float(), server_default='8'),
        sa.Column('maintenance_per_print', sa.Float(), server_default='5'),
        sa.Column('failed_print_rate', sa.Float(), server_default='0.07'),
        sa.Column('labor_rate_per_hour', sa.Float(), server_default='100'),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id']),
        sa.PrimaryKeyConstraint('creator_id'),
    )

    op.create_table(
        'reward_ledger',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('creator_id', sa.Integer(), nullable=False),
        sa.Column('points_delta', sa.Integer(), nullable=False),
        sa.Column('reason', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_reward_ledger_id'), 'reward_ledger', ['id'])

    op.create_table(
        'ad_campaigns',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sponsor_type', sa.Enum('PLATFORM', 'CREATOR', name='adsponsortype'), nullable=False),
        sa.Column('creator_id', sa.Integer(), nullable=True),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('budget', sa.Float(), nullable=False),
        sa.Column('spend_to_date', sa.Float(), server_default='0'),
        sa.Column('clicks', sa.Integer(), server_default='0'),
        sa.Column('impressions', sa.Integer(), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.ForeignKeyConstraint(['creator_id'], ['users.id']),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_ad_campaigns_id'), 'ad_campaigns', ['id'])

    # --- New columns on existing orders table ---

    # PostgreSQL requires enum types to exist before use in ALTER TABLE
    ordermode_enum = sa.Enum('PHYSICAL', 'DIGITAL', 'PRINT_ON_DEMAND', 'PERSONALIZED', name='ordermode')
    ordermode_enum.create(op.get_bind(), checkfirst=True)

    op.add_column('orders', sa.Column('mode', ordermode_enum, nullable=True))
    op.add_column('orders', sa.Column('cogs', sa.Float(), server_default='0'))
    op.add_column('orders', sa.Column('packaging_cost', sa.Float(), server_default='0'))
    op.add_column('orders', sa.Column('gateway_fee', sa.Float(), server_default='0'))
    op.add_column('orders', sa.Column('marketplace_commission', sa.Float(), server_default='0'))
    op.add_column('orders', sa.Column('ad_spend_attributed', sa.Float(), server_default='0'))
    op.add_column('orders', sa.Column('packaging_insert_url', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('real_print_photo_url', sa.String(), nullable=True))
    op.add_column('orders', sa.Column('defect_reported', sa.Boolean(), server_default='false'))
    op.add_column('orders', sa.Column('reprint_issued', sa.Boolean(), server_default='false'))


def downgrade() -> None:
    # --- Remove columns from orders ---
    op.drop_column('orders', 'reprint_issued')
    op.drop_column('orders', 'defect_reported')
    op.drop_column('orders', 'real_print_photo_url')
    op.drop_column('orders', 'packaging_insert_url')
    op.drop_column('orders', 'ad_spend_attributed')
    op.drop_column('orders', 'marketplace_commission')
    op.drop_column('orders', 'gateway_fee')
    op.drop_column('orders', 'packaging_cost')
    op.drop_column('orders', 'cogs')
    op.drop_column('orders', 'mode')

    # --- Drop new tables ---
    op.drop_index(op.f('ix_ad_campaigns_id'), table_name='ad_campaigns')
    op.drop_table('ad_campaigns')
    op.drop_index(op.f('ix_reward_ledger_id'), table_name='reward_ledger')
    op.drop_table('reward_ledger')
    op.drop_table('printer_assumptions')
    op.drop_index(op.f('ix_production_logs_id'), table_name='production_logs')
    op.drop_table('production_logs')
    op.drop_index(op.f('ix_product_filament_requirements_id'), table_name='product_filament_requirements')
    op.drop_table('product_filament_requirements')
    op.drop_index(op.f('ix_filament_spools_id'), table_name='filament_spools')
    op.drop_table('filament_spools')
    op.drop_index(op.f('ix_defect_reports_id'), table_name='defect_reports')
    op.drop_table('defect_reports')
    op.drop_index(op.f('ix_print_partners_id'), table_name='print_partners')
    op.drop_table('print_partners')

    # Drop enums
    op.execute("DROP TYPE IF EXISTS ordermode")
    op.execute("DROP TYPE IF EXISTS adsponsortype")
