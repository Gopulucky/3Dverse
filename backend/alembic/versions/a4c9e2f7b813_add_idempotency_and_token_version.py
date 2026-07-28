"""add order idempotency key and user token version

Revision ID: a4c9e2f7b813
Revises: e2f6b184ca70
Create Date: 2026-07-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4c9e2f7b813'
down_revision: Union[str, None] = 'e2f6b184ca70'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('orders', sa.Column('idempotency_key', sa.String(), nullable=True))
    op.create_unique_constraint('uq_orders_customer_idempotency_key', 'orders', ['customer_id', 'idempotency_key'])

    op.add_column('users', sa.Column('token_version', sa.Integer(), nullable=False, server_default='0'))

    # Drop pre-existing duplicates before adding the constraint below, keeping
    # the most recent review per (user, product) pair.
    op.execute(
        """
        DELETE FROM reviews r
        USING reviews r2
        WHERE r.user_id = r2.user_id
          AND r.product_id = r2.product_id
          AND r.id < r2.id
        """
    )
    op.create_unique_constraint('uq_reviews_user_product', 'reviews', ['user_id', 'product_id'])


def downgrade() -> None:
    op.drop_constraint('uq_reviews_user_product', 'reviews', type_='unique')

    op.drop_column('users', 'token_version')

    op.drop_constraint('uq_orders_customer_idempotency_key', 'orders', type_='unique')
    op.drop_column('orders', 'idempotency_key')
