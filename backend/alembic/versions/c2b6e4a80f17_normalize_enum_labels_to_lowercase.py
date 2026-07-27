"""normalize collaboration enum labels to lowercase

Revision ID: c2b6e4a80f17
Revises: e8a3c71f5d02
Create Date: 2026-07-26 19:35:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c2b6e4a80f17'
down_revision: Union[str, None] = 'e8a3c71f5d02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Databases stamped before f0f443659054 was corrected have uppercase labels on
# these types, which SQLAlchemy cannot read back because the models declare the
# columns with values_callable (enum *values*, not member names). Renaming in
# place repairs those without touching already-correct databases.
LABELS = {
    'paymentstatus': ['PENDING', 'COMPLETED', 'FAILED'],
    'ticketstatus': [
        'PENDING_PAYMENT', 'PAID', 'DESIGN_SUBMITTED', 'SAMPLE_PRINTING',
        'CERTIFIED', 'NEGOTIATING', 'AGREED', 'REJECTED', 'EXPIRED',
    ],
    'agreementstatus': ['PENDING', 'ACTIVE', 'TERMINATED'],
}


def upgrade() -> None:
    # Some databases already received a partial, ad-hoc fix (both the upper and
    # lower label present). Only rename when the uppercase label exists AND the
    # lowercase one doesn't yet -- Postgres has no DROP VALUE, so a stray
    # uppercase label alongside a correct lowercase one is harmless and left in
    # place rather than risking a rename collision.
    for type_name, labels in LABELS.items():
        for label in labels:
            op.execute(f"""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_enum e
                        JOIN pg_type t ON t.oid = e.enumtypid
                        WHERE t.typname = '{type_name}' AND e.enumlabel = '{label}'
                    ) AND NOT EXISTS (
                        SELECT 1 FROM pg_enum e
                        JOIN pg_type t ON t.oid = e.enumtypid
                        WHERE t.typname = '{type_name}' AND e.enumlabel = '{label.lower()}'
                    ) THEN
                        ALTER TYPE {type_name} RENAME VALUE '{label}' TO '{label.lower()}';
                    END IF;
                END $$;
            """)


def downgrade() -> None:
    for type_name, labels in LABELS.items():
        for label in labels:
            op.execute(f"""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_enum e
                        JOIN pg_type t ON t.oid = e.enumtypid
                        WHERE t.typname = '{type_name}' AND e.enumlabel = '{label.lower()}'
                    ) THEN
                        ALTER TYPE {type_name} RENAME VALUE '{label.lower()}' TO '{label}';
                    END IF;
                END $$;
            """)
