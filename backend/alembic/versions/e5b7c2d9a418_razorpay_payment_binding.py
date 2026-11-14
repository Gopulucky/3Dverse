"""Bind checkout payments to Razorpay orders (replaces the Stripe PaymentIntent binding).

Additive on purpose: the legacy ``orders.stripe_payment_intent_id`` column is left in
place, unused, so any historical Stripe reference survives for audit. It can be
dropped in a later migration once nobody needs it.

Revision ID: e5b7c2d9a418
Revises: d2e8b4c6a913
"""
from alembic import op
import sqlalchemy as sa

revision = "e5b7c2d9a418"
down_revision = "d2e8b4c6a913"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("orders", sa.Column("razorpay_order_id", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("razorpay_payment_id", sa.String(), nullable=True))
    op.add_column("orders", sa.Column("coupon_id", sa.Integer(), nullable=True))
    op.create_unique_constraint("uq_orders_razorpay_order_id", "orders", ["razorpay_order_id"])


def downgrade():
    op.drop_constraint("uq_orders_razorpay_order_id", "orders", type_="unique")
    op.drop_column("orders", "coupon_id")
    op.drop_column("orders", "razorpay_payment_id")
    op.drop_column("orders", "razorpay_order_id")
