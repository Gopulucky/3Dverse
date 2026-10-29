"""Bind checkout payments, preserve legacy USD prices, and fulfilment evidence.

Revision ID: d9f2a7b6c104
Revises: a9f3c1d5e7b2
"""
from alembic import op
import sqlalchemy as sa

revision = "d9f2a7b6c104"
down_revision = "a9f3c1d5e7b2"
branch_labels = None
depends_on = None


def upgrade():
    for table in ("products", "orders"):
        # Existing numeric prices mean USD. The default changes only AFTER backfill.
        op.add_column(table, sa.Column("currency", sa.String(3), nullable=False, server_default="USD"))
        op.alter_column(table, "currency", server_default="INR")
    op.add_column("users", sa.Column("firebase_uid", sa.String(), nullable=True))
    op.create_index("ix_users_firebase_uid", "users", ["firebase_uid"], unique=True)
    op.add_column("orders", sa.Column("amount_minor", sa.Integer(), nullable=True))
    op.add_column("orders", sa.Column("payment_verified_at", sa.DateTime(), nullable=True))
    op.add_column("orders", sa.Column("checkout_fingerprint", sa.String(64), nullable=True))
    op.add_column("orders", sa.Column("delivered_at", sa.DateTime(), nullable=True))
    op.add_column("orders", sa.Column("shipping_package", sa.JSON(), nullable=True))
    op.create_unique_constraint("uq_orders_stripe_payment_intent", "orders", ["stripe_payment_intent_id"])
    op.add_column("return_requests", sa.Column("gateway_refund_id", sa.String(), nullable=True))
    op.create_unique_constraint("uq_returns_gateway_refund", "return_requests", ["gateway_refund_id"])
    op.create_table("payment_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("orders.id"), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("processed_at", sa.DateTime(), nullable=False))
    op.create_index("ix_payment_events_order_id", "payment_events", ["order_id"])


def downgrade():
    op.drop_table("payment_events")
    op.drop_constraint("uq_returns_gateway_refund", "return_requests", type_="unique")
    op.drop_column("return_requests", "gateway_refund_id")
    op.drop_constraint("uq_orders_stripe_payment_intent", "orders", type_="unique")
    for column in ("shipping_package", "delivered_at", "checkout_fingerprint", "payment_verified_at", "amount_minor"):
        op.drop_column("orders", column)
    op.drop_index("ix_users_firebase_uid", "users")
    op.drop_column("users", "firebase_uid")
    # Do not silently erase currency semantics from repriced or new INR rows.
    for table in ("orders", "products"):
        op.drop_column(table, "currency")
