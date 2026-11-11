import os
import re

from alembic.config import Config
from alembic.script import ScriptDirectory

import app.main  # noqa: F401  (registers every model)
from app.models.print_partner import PrintPartner

NEW_COLUMNS = ["accepting_work", "bio", "lead_time_days", "price_per_gram_inr", "min_order_inr",
               "build_x_mm", "build_y_mm", "build_z_mm"]
BACKEND = os.path.dirname(os.path.dirname(__file__))


def script_dir():
    cfg = Config(os.path.join(BACKEND, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(BACKEND, "alembic"))
    return ScriptDirectory.from_config(cfg)


def test_model_has_profile_columns():
    columns = PrintPartner.__table__.columns
    for name in NEW_COLUMNS:
        assert name in columns, name
    assert columns["accepting_work"].nullable is False
    assert columns["accepting_work"].default.arg is False


def test_migration_chain_has_one_head_after_d9f2a7b6c104():
    scripts = script_dir()
    heads = scripts.get_heads()
    assert len(heads) == 1 and heads[0] != "d9f2a7b6c104"
    assert scripts.get_revision(heads[0]).down_revision == "d9f2a7b6c104"


def test_migration_is_additive_and_reversible():
    scripts = script_dir()
    path = scripts.get_revision(scripts.get_heads()[0]).path
    source = open(path, encoding="utf8").read()
    upgrade, downgrade = source.split("def downgrade", 1)
    for name in NEW_COLUMNS:
        assert re.search(rf"add_column\([^)]*['\"]{name}['\"]", upgrade, re.S), f"upgrade must add {name}"
        assert f'"{name}"' in downgrade, f"downgrade must drop {name}"
    assert "drop_column" in downgrade
    for forbidden in ("drop_table", "alter_column", "op.execute", "drop_column"):
        assert forbidden not in upgrade, f"upgrade must not use {forbidden}"
    assert "print_partners" in upgrade
