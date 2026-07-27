"""add stock items, stock movements and return requests

Revision ID: b3e15f27ac90
Revises: a7d94c1e6b58
Create Date: 2026-07-26 20:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b3e15f27ac90'
down_revision: Union[str, None] = 'a7d94c1e6b58'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('DROP TYPE IF EXISTS stockmovementreason CASCADE')
    op.execute(
        "CREATE TYPE stockmovementreason AS ENUM ('restock', 'reserved', 'released', "
        "'shipped', 'damaged', 'returned', 'adjustment')"
    )
    op.execute('DROP TYPE IF EXISTS returnstatus CASCADE')
    op.execute(
        "CREATE TYPE returnstatus AS ENUM ('requested', 'approved', 'rejected', "
        "'received', 'refunded')"
    )
    op.execute('DROP TYPE IF EXISTS returnreason CASCADE')
    op.execute(
        "CREATE TYPE returnreason AS ENUM ('not_as_described', 'arrived_damaged', "
        "'wrong_item', 'no_longer_needed', 'other')"
    )

    op.create_table(
        'stock_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('seller_id', sa.Integer(), nullable=False),
        sa.Column('on_hand', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('reserved', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('damaged', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('safety_stock', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('reorder_point', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
        sa.ForeignKeyConstraint(['seller_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('product_id'),
    )
    op.create_index(op.f('ix_stock_items_id'), 'stock_items', ['id'], unique=False)

    op.create_table(
        'stock_movements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('stock_item_id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=True),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column(
            'reason',
            postgresql.ENUM(
                'restock', 'reserved', 'released', 'shipped', 'damaged', 'returned', 'adjustment',
                name='stockmovementreason', create_type=False,
            ),
            nullable=False,
        ),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['stock_item_id'], ['stock_items.id'], ),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_stock_movements_id'), 'stock_movements', ['id'], unique=False)

    op.create_table(
        'return_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('order_item_id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'),
        sa.Column(
            'reason',
            postgresql.ENUM(
                'not_as_described', 'arrived_damaged', 'wrong_item', 'no_longer_needed', 'other',
                name='returnreason', create_type=False,
            ),
            nullable=False,
        ),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column(
            'status',
            postgresql.ENUM(
                'requested', 'approved', 'rejected', 'received', 'refunded',
                name='returnstatus', create_type=False,
            ),
            nullable=False,
        ),
        sa.Column('within_window', sa.String(), nullable=True),
        sa.Column('refund_amount', sa.Float(), nullable=True),
        sa.Column('resolution_note', sa.Text(), nullable=True),
        sa.Column('requested_at', sa.DateTime(), server_default=sa.text('now()'), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ),
        sa.ForeignKeyConstraint(['order_item_id'], ['order_items.id'], ),
        sa.ForeignKeyConstraint(['customer_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_return_requests_id'), 'return_requests', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_return_requests_id'), table_name='return_requests')
    op.drop_table('return_requests')
    op.drop_index(op.f('ix_stock_movements_id'), table_name='stock_movements')
    op.drop_table('stock_movements')
    op.drop_index(op.f('ix_stock_items_id'), table_name='stock_items')
    op.drop_table('stock_items')
    op.execute('DROP TYPE IF EXISTS returnreason CASCADE')
    op.execute('DROP TYPE IF EXISTS returnstatus CASCADE')
    op.execute('DROP TYPE IF EXISTS stockmovementreason CASCADE')
