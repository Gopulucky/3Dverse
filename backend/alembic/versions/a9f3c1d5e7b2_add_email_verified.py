"""add users.email_verified

Revision ID: a9f3c1d5e7b2
Revises: a4c9e2f7b813
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a9f3c1d5e7b2"
down_revision: Union[str, None] = "a4c9e2f7b813"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Defensive: skip if the column was already added out-of-band.
    bind = op.get_bind()
    cols = [c["name"] for c in sa.inspect(bind).get_columns("users")]
    if "email_verified" not in cols:
        op.add_column(
            "users",
            sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        )


def downgrade() -> None:
    op.drop_column("users", "email_verified")
