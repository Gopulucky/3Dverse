import os
import re

from alembic.config import Config
from alembic.script import ScriptDirectory

import app.main  # noqa: F401  (registers every model)
from app.models.print_partner import PrintPartner

NEW_COLUMNS = ["accepting_work", "bio", "lead_time_days", "price_per_gram_inr", "min_order_inr",
               "build_x_mm", "build_y_mm", "build_z_mm"]
BACKEND = os.path.dirname(os.path.dirname(__file__))
PARTNER_REVISION = "b4d7e2a91c36"      # later migrations chain after this one


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


def test_migration_chain_has_one_head_and_includes_the_partner_migration():
    scripts = script_dir()
    assert len(scripts.get_heads()) == 1
    assert scripts.get_revision(PARTNER_REVISION).down_revision == "d9f2a7b6c104"
    assert PARTNER_REVISION in {r.revision for r in scripts.walk_revisions()}, "partner migration is in the head's history"


def test_migration_is_additive_and_reversible():
    scripts = script_dir()
    path = scripts.get_revision(PARTNER_REVISION).path
    source = open(path, encoding="utf8").read()
    upgrade, downgrade = source.split("def downgrade", 1)
    for name in NEW_COLUMNS:
        assert re.search(rf"add_column\([^)]*['\"]{name}['\"]", upgrade, re.S), f"upgrade must add {name}"
        assert f'"{name}"' in downgrade, f"downgrade must drop {name}"
    assert "drop_column" in downgrade
    for forbidden in ("drop_table", "alter_column", "op.execute", "drop_column"):
        assert forbidden not in upgrade, f"upgrade must not use {forbidden}"
    assert "print_partners" in upgrade


def test_thumbnail_migration_is_one_additive_nullable_column():
    scripts = script_dir()
    revision = scripts.get_revision("c8a3f1d27e54")
    assert revision.down_revision == PARTNER_REVISION
    assert scripts.get_heads() == ["c8a3f1d27e54"]
    upgrade, downgrade = open(revision.path, encoding="utf8").read().split("def downgrade", 1)
    assert re.search(r"add_column\(\s*['\"]product_media['\"].*thumb_url.*nullable=True", upgrade, re.S)
    assert "drop_column" in downgrade and "thumb_url" in downgrade
    for forbidden in ("drop_table", "alter_column", "op.execute", "drop_column"):
        assert forbidden not in upgrade, f"upgrade must not use {forbidden}"
