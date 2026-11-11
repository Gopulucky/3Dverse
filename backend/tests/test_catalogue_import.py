import inspect
from datetime import datetime
from types import SimpleNamespace

import pytest

pytest.importorskip("manifold3d")

from scripts.catalogue import generate, import_catalogue as imp, models  # noqa: E402

NOW = datetime(2026, 11, 11, 12, 0, 0)
ENTRY = {
    "slug": "angled-phone-stand", "title": "Angled phone stand", "category": "Gadgets",
    "description": "A stand.", "tags": ["phone", "stand"], "price_inr": 149, "print_price_inr": 499,
    "featured": True, "stl": "a/a.stl", "png": "a/a.png",
    "dimensions_mm": {"x": 80, "y": 105, "z": 96}, "volume_mm3": 1000.0, "faces": 70, "supports": "none",
}


class MemoryRepo:
    """In-memory stand-in for SqlRepo: remembers what was created, touches nothing else."""

    def __init__(self):
        self.creators, self.products, self.versions, self.media, self.commits = [], [], [], [], 0
        self._id = 0

    def _next(self):
        self._id += 1
        return self._id

    def find_creator(self):
        return self.creators[0] if self.creators else None

    def create_creator(self, **fields):
        creator = SimpleNamespace(id=self._next(), **fields)
        self.creators.append(creator)
        return creator

    def find_product(self, creator_id, title):
        return next((p for p in self.products if p.creator_id == creator_id and p.title == title), None)

    def create_product(self, fields):
        product = SimpleNamespace(id=self._next(), **fields)
        self.products.append(product)
        return product

    def add_version(self, product_id, **fields):
        version = SimpleNamespace(id=self._next(), product_id=product_id, **fields)
        self.versions.append(version)
        return version

    def add_media(self, product_id, url):
        self.media.append((product_id, url))

    def enable_print(self, product, price):
        product.is_mode_3_active, product.base_print_price = True, price

    def commit(self):
        self.commits += 1

    health = ("/media/previews/p.glb", "pass")      # what the analyzer left behind; tests override it

    def latest_version(self, product_id):
        return next((v for v in reversed(self.versions) if v.product_id == product_id), None)

    def version_health(self, version_id):
        return self.health


@pytest.fixture(scope="module")
def manifest_dir(tmp_path_factory):
    out = tmp_path_factory.mktemp("catalogue")
    by_slug = {s.slug: s for s in models.SPECS}
    generate.build_all(str(out), [by_slug["hexagon-keyring-tag"], by_slug["dice-tower"]])
    return str(out)


def fakes():
    stored, analysed = [], []

    def store(path, subfolder, extension):
        stored.append((subfolder, extension))
        return f"/uploads/{subfolder}/file.{extension}"

    return stored, analysed, store, analysed.append


@pytest.mark.parametrize("server", ["localhost", "localhost:5433", "127.0.0.1:5432"])
def test_guard_accepts_local(server):
    imp.assert_local_target(server)


@pytest.mark.parametrize("server", [
    "localhost.evil.com", "127.0.0.1.nip.io", "db.abc.supabase.co:5432", "[::1]:5433", "", "0.0.0.0:5433",
    "evil.com:5433", "localhost@evil.com",
])
def test_guard_table(server):
    with pytest.raises(SystemExit):
        imp.assert_local_target(server)


def test_guard_allow_remote_is_explicit():
    imp.assert_local_target("db.abc.supabase.co:5432", allow_remote=True)


def test_product_fields_digital_only_default():
    fields = imp.product_fields(ENTRY, creator_id=3, with_print=False, now=NOW)
    assert fields["is_mode_3_active"] is False and fields["base_print_price"] == 0.0
    assert fields["is_mode_2_active"] is True and fields["digital_download_enabled"] is True
    assert fields["mock_order_count"] == 0 and fields["currency"] == "INR" and fields["price"] == 149
    assert fields["status"].value == "published" and fields["safety_review_status"].value == "approved"
    assert fields["creator_id"] == 3 and fields["is_featured"] is True
    assert fields["print_settings"]["supports"] == "none"


def test_product_fields_with_print():
    fields = imp.product_fields(ENTRY, creator_id=3, with_print=True, now=NOW)
    assert fields["is_mode_3_active"] is True and fields["base_print_price"] == 499


def test_dry_run_touches_nothing(manifest_dir):
    actions = imp.run(manifest_dir, None, with_print=False, dry_run=True)
    assert len(actions) == 2 and all(a.startswith("would create") for a in actions)


def test_run_creates_creator_products_files_and_analysis(manifest_dir):
    repo, (stored, analysed, store, analyse) = MemoryRepo(), fakes()
    actions = imp.run(manifest_dir, repo, with_print=False, dry_run=False, now=NOW, store_file=store, analyze=analyse)
    assert len(repo.creators) == 1 and repo.creators[0].email == imp.ORIGINALS_EMAIL
    assert repo.creators[0].role.value == "creator" and repo.creators[0].creator_type.value == "seller"
    assert len(repo.products) == 2 and len(repo.versions) == 2 and len(repo.media) == 2
    assert analysed == [v.id for v in repo.versions]          # the real analyzer runs once per version
    assert sorted(stored) == [("images", "png")] * 2 + [("models", "stl")] * 2
    assert sum(a.startswith("created") for a in actions) >= 2
    assert all(v.version_number == 1 and v.is_latest for v in repo.versions)


def test_idempotent_and_with_print_updates(manifest_dir):
    repo, (stored, analysed, store, analyse) = MemoryRepo(), fakes()
    imp.run(manifest_dir, repo, with_print=False, dry_run=False, now=NOW, store_file=store, analyze=analyse)
    stored.clear(), analysed.clear()
    again = imp.run(manifest_dir, repo, with_print=False, dry_run=False, now=NOW, store_file=store, analyze=analyse)
    assert len(repo.products) == 2 and len(repo.creators) == 1
    assert all("skipped" in a and "exists" in a for a in again) and not stored and not analysed
    enabled = imp.run(manifest_dir, repo, with_print=True, dry_run=False, now=NOW, store_file=store, analyze=analyse)
    assert len(repo.products) == 2 and sum("enabled print" in a for a in enabled) == 2
    assert all(p.is_mode_3_active and p.base_print_price > 0 for p in repo.products)


def test_main_refuses_remote_before_any_session(monkeypatch, manifest_dir):
    from app.core.config import settings
    monkeypatch.setattr(settings, "POSTGRES_SERVER", "db.abc.supabase.co:5432")
    monkeypatch.setattr(imp, "_open_session", lambda: pytest.fail("a database session was opened"))
    with pytest.raises(SystemExit):
        imp.main(["--manifest-dir", manifest_dir])


def test_main_dry_run_needs_no_database(monkeypatch, manifest_dir, capsys):
    monkeypatch.setattr(imp, "_open_session", lambda: pytest.fail("a database session was opened"))
    assert imp.main(["--manifest-dir", manifest_dir, "--dry-run"]) == 0
    assert "would create" in capsys.readouterr().out


def test_no_social_proof_is_ever_created():
    import ast

    tree = ast.parse(inspect.getsource(imp))
    called = {n.func.id for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Name)}
    called |= {n.func.attr for n in ast.walk(tree) if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute)}
    assert not called & {"Review", "Order", "OrderItem", "randint", "choice", "sample", "uniform"}, called
    keywords = {k.arg for n in ast.walk(tree) if isinstance(n, ast.Call) for k in n.keywords}
    assert not keywords & {"rating", "review_count", "avg_rating"}, keywords
    assert imp.product_fields(ENTRY, 1, False, NOW)["mock_order_count"] == 0


def test_field_names_are_real_model_columns():
    # SqlRepo is the one part with no database here. Building the real ORM objects in
    # memory still catches any misspelt or unknown column name (SQLAlchemy rejects them).
    from app.models.product import Product, ProductMedia, ProductVersion
    from app.models.user import User

    imp.register_models()
    for with_print in (False, True):
        product = Product(**imp.product_fields(ENTRY, creator_id=1, with_print=with_print, now=NOW))
        assert product.title == ENTRY["title"] and product.is_mode_3_active is with_print
    creator = User(**imp._creator_fields())
    assert creator.email == imp.ORIGINALS_EMAIL and creator.hashed_password
    ProductVersion(product_id=1, file_url="/x.stl", file_name="x.stl", file_size=1, version_number=1, is_latest=True, created_at=NOW)
    ProductMedia(product_id=1, media_url="/x.png", media_type="image", is_primary=True)
    assert {"find_creator", "create_creator", "find_product", "create_product", "add_version", "add_media",
            "enable_print", "commit"} <= set(dir(imp.SqlRepo))


def test_failed_analysis_is_reported_loudly(manifest_dir):
    repo, (stored, analysed, store, analyse) = MemoryRepo(), fakes()
    repo.health = (None, "fail")                      # analyzer swallowed an error: no preview, failed report
    with pytest.raises(imp.AnalysisFailed) as info:
        imp.run(manifest_dir, repo, with_print=False, dry_run=False, now=NOW, store_file=store, analyze=analyse)
    assert "preview" in str(info.value).lower()


def test_existing_product_without_preview_is_repaired(manifest_dir):
    repo, (stored, analysed, store, analyse) = MemoryRepo(), fakes()
    imp.run(manifest_dir, repo, with_print=False, dry_run=False, now=NOW, store_file=store, analyze=analyse)
    analysed.clear()
    repo.health = (None, "pass")                      # preview went missing (e.g. storage was down)

    def analyse_and_fix(version_id):                   # the real analyzer writes the preview this time
        analysed.append(version_id)
        repo.health = ("/media/previews/p.glb", "pass")

    actions = imp.run(manifest_dir, repo, with_print=False, dry_run=False, now=NOW, store_file=store, analyze=analyse_and_fix)
    assert len(repo.products) == 2 and len(analysed) == 1      # fixed once; the second product is healthy again
    assert sum("repaired" in a for a in actions) == 1

    repo.health = (None, "pass")                      # and if analysis still cannot produce a preview, say so
    with pytest.raises(imp.AnalysisFailed):
        imp.run(manifest_dir, repo, with_print=False, dry_run=False, now=NOW, store_file=store, analyze=analyse)
