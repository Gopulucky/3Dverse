# Starter Catalogue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate ~12 original, printable 3D models with rendered images and import them as honest, digital-only marketplace products into a local database.

**Architecture:** A generator (`generate.py`) builds meshes with `trimesh`, gates their quality, renders PNGs and writes a `manifest.json`. A separate importer (`import_catalogue.py`) turns the manifest into rows through the app's own models and storage helpers, then calls the real `analyze_version` to produce the printability report and the public preview. Pure functions are unit-tested without a database.

**Tech Stack:** Python 3.13, `trimesh` 4.12, `numpy`, `shapely`, `matplotlib`, `manifold3d` (tooling-only), `Pillow`, SQLAlchemy models in `backend/app/models`, `pytest` (from `backend/`).

**Spec:** `docs/superpowers/specs/2026-11-11-starter-catalogue-design.md`

## Global Constraints

- Everything lives under `backend/scripts/catalogue/` (package, with `__init__.py`) plus tests in `backend/tests/test_catalogue_*.py`. **No change** to `backend/app/`, `backend/requirements.txt`, the frontend, or alembic.
- Tooling dependencies go only in `backend/scripts/catalogue/requirements.txt`: `manifold3d`, `matplotlib`, `shapely`. Tests that need `manifold3d` use `pytest.importorskip("manifold3d")`.
- **No invented social proof:** no reviews, ratings, orders, `mock_order_count` (must be 0), "best seller", "top rated", "popular" in any copy.
- Prices in INR (`currency="INR"`). Print prices are stored only with `--with-print`; default is **digital only** (`is_mode_3_active=False`, `base_print_price=0.0`).
- Importer refuses any `POSTGRES_SERVER` host other than exactly `localhost` or `127.0.0.1` unless `--allow-remote` is passed. `--dry-run` writes nothing and opens no DB session.
- Models: units are mm, Z up, every extent within 20–220 mm, watertight, volume > 0, < 400 000 faces. Generation is deterministic (no randomness, same bytes on every run).
- Prices (INR, digital / print; placeholders the user may adjust): adjustable-phone-stand 149 / 499 · cable-clip-set 99 / 299 · hexagon-keyring-tag 79 / 249 · faceted-geometric-planter 199 / 799 · ribbed-table-vase 199 / 899 · hex-cell-desk-organiser 249 / 999 · dice-tower 249 / 1199 · modular-dungeon-tile-set 299 / 1299 · geometric-pendant 149 / 599 · layered-shoulder-armour-plate 299 / 1499 · chess-style-piece-set 249 / 999 · articulated-segmented-toy 199 / 699.
- Never run the importer against a database without the user's explicit instruction. This plan only dry-runs it.
- Do not touch the unrelated working-tree changes (`docs/brand/*`, `frontend/AGENTS.md`, `.hallmark/*`, `sample_images/`).

## Review Focus

1. **Lookalike database hosts** (`localhost.evil.com`, `127.0.0.1.nip.io`, `db.x.supabase.co:5432`, `[::1]:5433`, empty string): the guard must refuse all except `localhost` / `127.0.0.1` (any port). Test: Task 5 `test_guard_table`.
2. **Description says "no supports" but the mesh needs them** (or the reverse). The supports text must come from the measured overhang ratio. Test: Task 1 `test_supports_label_matches_overhang` and Task 2-4 per-model check.
3. **Re-running the importer** must not duplicate products, and a later `--with-print` run must switch print on for existing originals without creating copies. Test: Task 5 `test_idempotent_and_with_print_updates`.
4. **Same STL bytes twice** (determinism). Test: Task 2-4 `test_deterministic`.
5. **Unsafe filenames/slugs** (spaces, non-ASCII, path separators in a title). Slugs are `[a-z0-9-]+` only. Test: Task 2 `test_slugs_are_safe`.

---

### Task 1: Shapes toolkit and quality gate

**Files:** Create `backend/scripts/catalogue/__init__.py`, `backend/scripts/catalogue/shapes.py`, `backend/scripts/catalogue/quality.py`, `backend/scripts/catalogue/requirements.txt`; Test `backend/tests/test_catalogue_quality.py`.

**Interfaces:**
- Produces in `quality.py`:
  - `@dataclass(frozen=True) class MeshReport: watertight: bool; volume_mm3: float; extents_mm: tuple[float, float, float]; faces: int; overhang_ratio: float; supports: str  # "none" | "recommended"`
  - `measure(mesh: trimesh.Trimesh) -> MeshReport` (overhang_ratio = share of faces with normal z < -0.707, same threshold as `app/services/printability.py`; `supports = "recommended"` when ratio > 0.25 else `"none"`)
  - `problems(report: MeshReport) -> list[str]` (empty list means pass; messages for: not watertight, volume <= 0, any extent < 20 or > 220 mm, faces >= 400000)
- Produces in `shapes.py` (pure helpers, return `trimesh.Trimesh`): `lathe(profile_xz: list[tuple[float,float]], sections: int) -> Trimesh` (revolve a closed profile), `prism(polygon_xy: list[tuple[float,float]], height: float) -> Trimesh` (extrude), `union(*meshes) -> Trimesh` and `difference(a, b) -> Trimesh` (both via `trimesh.boolean` with the `manifold` engine), `grounded(mesh) -> Trimesh` (translate so min Z = 0 and centred in X/Y).

- [ ] **Step 1: Failing tests** in `test_catalogue_quality.py` (top of file: `pytest.importorskip("manifold3d")`):
  - `test_measure_box`: a 40×40×40 box → watertight, volume ≈ 64 000, `supports == "none"`.
  - `test_problems_flags_each_rule`: an open mesh (box with one face removed) → "not watertight" in problems; a 5 mm cube → an extent message; a 300 mm cube → an extent message.
  - `test_supports_label_matches_overhang`: an upside-down cone (apex down, 60 mm) → `supports == "recommended"`; the same cone apex up → `"none"`.
  - `test_grounded`: result has `bounds[0][2] == 0` and X/Y centred on 0.
  - `test_union_difference_watertight`: box minus a cylinder is watertight with smaller volume than the box; union of two overlapping boxes is watertight with volume < sum.
- [ ] **Step 2:** `cd backend && python -m pytest tests/test_catalogue_quality.py -q -p no:cacheprovider` → FAIL (modules missing). (First `pip install -r scripts/catalogue/requirements.txt`; the user approved `manifold3d`.)
- [ ] **Step 3:** Implement `quality.py` and `shapes.py` to the signatures above. `lathe` uses `trimesh.creation.revolve`.
- [ ] **Step 4:** Run the test file → PASS.

### Task 2: Gadgets and fidget (4 models, all category "Gadgets") + registry

**Files:** Create `backend/scripts/catalogue/models.py`; Test `backend/tests/test_catalogue_models.py` (shared by Tasks 2-4).

**Interfaces:**
- Produces in `models.py`:
  - `@dataclass(frozen=True) class ProductSpec: slug: str; title: str; category: str; description: str; tags: tuple[str, ...]; price_inr: float; print_price_inr: float; featured: bool; build: Callable[[], trimesh.Trimesh]`
  - `SPECS: list[ProductSpec]` (appended to by Tasks 2-4, in this order)
  - `CATEGORIES = {"Gadgets", "Home Decor", "Tabletop", "Jewelry", "Cosplay", "Miniatures"}`
- Every `build()` returns a grounded, watertight mesh and uses no randomness.

Designs (the implementer chooses the exact geometry; targets below are binding):
| slug | title | size (mm) | features |
|---|---|---|---|
| `adjustable-phone-stand` | Adjustable phone stand | ≈ 100×90×100 | angled back rest with a front lip, cable slot, flat base; prints without supports |
| `cable-clip-set` | Cable clip set (4) | one plate ≈ 80×30×12 holding 4 separate clips | C-shaped clips for 6 mm cable |
| `hexagon-keyring-tag` | Hexagon keyring tag | ≈ 40×35×4 | hexagon with a 4 mm key-ring hole; raised "3D" mark may be omitted |
| `articulated-segmented-toy` | Articulated segmented toy | ≈ 150×30×20 | 8+ interlocking printable-in-place segments, no overlapping bodies |

Copy rules (all models): description 2-3 sentences, states size, suggested material/layer height and the measured supports label, never uses the banned words from Global Constraints.

- [ ] **Step 1: Failing tests** in `test_catalogue_models.py` (parametrised over `SPECS`, so they extend as later tasks add models):
  - `test_models_pass_quality_gate`: `problems(measure(spec.build())) == []`.
  - `test_deterministic`: two builds export identical STL bytes.
  - `test_slugs_are_safe`: every slug matches `^[a-z0-9]+(-[a-z0-9]+)*$` and is unique; titles unique.
  - `test_copy_and_prices`: category ∈ `CATEGORIES`; `price_inr > 0`; `print_price_inr > price_inr`; description has no banned word (case-insensitive: "best seller", "bestseller", "top rated", "popular", "bestselling", "reviews"); description mentions the measured supports label ("no supports" when `none`, "supports recommended" when `recommended`).
  - `test_phone_stand_prints_without_supports`: `measure(...).supports == "none"` for `adjustable-phone-stand`.
- [ ] **Step 2:** Run → FAIL (no specs).
- [ ] **Step 3:** Add the four specs to `models.py`. Descriptions are built with a small helper `describe(spec_text, report)` that appends the measured size and supports sentence, so the claim cannot drift from the mesh.
- [ ] **Step 4:** Run → PASS. Export each model to the scratchpad and look at one quick render in the next task's step before committing to proportions.

### Task 3: Home decor and jewelry (4 models)

**Files:** Modify `backend/scripts/catalogue/models.py`.

Designs (binding targets):
| slug | title | category | size (mm) | features |
|---|---|---|---|---|
| `faceted-geometric-planter` | Faceted geometric planter | Home Decor | ≈ 110×110×120 | 8-facet low-poly pot, 3 mm walls, drainage hole, hollow (uses `difference`) |
| `ribbed-table-vase` | Ribbed table vase | Home Decor | ≈ 90×90×180 | lathe profile with vertical ribs, closed bottom, 2.4 mm wall |
| `hex-cell-desk-organiser` | Hex-cell desk organiser | Home Decor | ≈ 130×120×100 | 7 hexagonal cells of different depth in one body |
| `geometric-pendant` | Geometric pendant | Jewelry | ≈ 35×35×4 plus bail | faceted diamond outline with a 3 mm bail hole |

- [ ] **Step 1:** The shared tests already run over `SPECS`; confirm they fail (new slugs absent from expectations) by adding to `test_catalogue_models.py`: `test_expected_slugs_present` asserting the 8 slugs of Tasks 2-3 are in `SPECS` → FAIL.
- [ ] **Step 2:** Implement the four specs; planter and vase must report `supports == "none"` (state this via the measured label; if the geometry measures otherwise, fix the geometry, not the text).
- [ ] **Step 3:** Run `pytest tests/test_catalogue_models.py -q -p no:cacheprovider` → PASS.

### Task 4: Tabletop, cosplay, miniatures (4 models)

**Files:** Modify `backend/scripts/catalogue/models.py`.

Designs (binding targets):
| slug | title | category | size (mm) | features | featured |
|---|---|---|---|---|---|
| `dice-tower` | Dice tower | Tabletop | ≈ 80×80×160 | square tower, 2 internal baffles, front tray, open top | yes |
| `modular-dungeon-tile-set` | Modular dungeon tile set | Tabletop | 4 tiles each 50×50×8 | 1-inch grid feel, edge clips that fit neighbouring tiles | no |
| `layered-shoulder-armour-plate` | Layered shoulder armour plate | Cosplay | ≈ 180×120×60 | 3 overlapping curved plates fused into one shell, strap slots | no |
| `chess-style-piece-set` | Chess-style piece set | Miniatures | 3 pieces each ≈ 30×30×60 | pawn, rook, bishop from lathe profiles | no |

`featured=True` for exactly four specs across the catalogue: `adjustable-phone-stand`, `faceted-geometric-planter`, `dice-tower`, `chess-style-piece-set`.

- [ ] **Step 1:** Add `test_expected_slugs_present` coverage for all 12 slugs and `test_exactly_four_featured` (the four named above) → FAIL.
- [ ] **Step 2:** Implement the four specs. Any model measuring `supports == "recommended"` says so in its copy (automatic via `describe`).
- [ ] **Step 3:** Full catalogue tests → PASS (12 models × gate/deterministic/copy).

### Task 5: Render, manifest and generator CLI

**Files:** Create `backend/scripts/catalogue/render.py`, `backend/scripts/catalogue/generate.py`; Test `backend/tests/test_catalogue_generate.py`.

**Interfaces:**
- Consumes: `SPECS`, `ProductSpec`, `measure`, `problems`.
- Produces:
  - `render.render_png(mesh: Trimesh, path: str) -> None` — 1200×900 PNG, light neutral background, a lit isometric view of the real mesh (matplotlib `Poly3DCollection` with face-normal shading), fixed camera so output is deterministic.
  - `generate.build_all(out_dir: str, specs=SPECS) -> dict` — writes `<out>/<slug>/<slug>.stl`, `<slug>.png`, and returns/writes `<out>/manifest.json` as `{"version": 1, "creator": {"name": "3DVerse Originals"}, "products": [ {slug, title, category, description, tags, price_inr, print_price_inr, featured, stl, png, dimensions_mm: {x,y,z}, volume_mm3, faces, supports} ]}`.
  - `generate.main(argv=None) -> int` — `python -m scripts.catalogue.generate --out <dir>`; exit code 1 if any model fails the gate.

- [ ] **Step 1: Failing tests:**
  - `test_render_png_size_and_not_blank`: render a box → image size is (1200, 900); the image has more than 20 distinct colours.
  - `test_build_all_writes_everything`: with a 2-spec list into `tmp_path`: both STL and PNG exist, manifest lists 2 products with every key above, paths relative to the out dir.
  - `test_manifest_values_match_meshes`: manifest `volume_mm3` and `dimensions_mm` equal a fresh `measure()` within 0.01.
  - `test_build_all_fails_on_bad_model`: a spec whose build returns an open mesh → `main` returns 1 and writes no manifest.
  - `test_build_is_deterministic`: two runs give identical STL and manifest bytes.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `render.py` and `generate.py`.
- [ ] **Step 4:** Tests PASS. Then run the real generator: `python -m scripts.catalogue.generate --out scripts/catalogue/out`. Build a contact sheet PNG of all 12 renders into the scratchpad and **look at every image**; fix any model that looks broken, upside-down or unrecognisable. Add `backend/scripts/catalogue/out/` to `.gitignore` if not already ignored.

### Task 6: Importer

**Files:** Create `backend/scripts/catalogue/import_catalogue.py`; Test `backend/tests/test_catalogue_import.py`.

**Interfaces:**
- Consumes: manifest format from Task 5; app models `User`, `UserRole`, `CreatorType`, `Product`, `ProductStatus`, `SafetyReviewStatus`, `ProductVersion`, `ProductMedia`; `app.core.storage.store_local_file(source_path, subfolder, extension) -> str`; `app.services.printability.analyze_version(version_id)`; `app.core.security.get_password_hash`.
- Produces:
  - `ORIGINALS_EMAIL = "originals@3dverse.invalid"`
  - `assert_local_target(server: str, allow_remote: bool = False) -> None` — `server` is `host[:port]`; raises `SystemExit` with a clear message unless host is exactly `localhost` or `127.0.0.1` (IPv6 and lookalikes refused) or `allow_remote`.
  - `product_fields(entry: dict, creator_id: int, with_print: bool, now: datetime) -> dict` — kwargs for `Product(...)`: status published, `is_published=True`, `published_at=now`, `license_type="Personal Use"`, `currency="INR"`, `price=entry["price_inr"]`, `is_mode_2_active=True`, `digital_download_enabled=True`, `is_mode_3_active=with_print`, `base_print_price=entry["print_price_inr"] if with_print else 0.0`, `is_featured=entry["featured"]`, `mock_order_count=0`, `safety_review_status=approved`, `safety_reviewed_at=now`, `safety_review_note="Original 3DVerse design."`, `technology_required=PrinterTechnology.FDM`, `material_required="PLA"`, `available_materials=["PLA","PETG"]`, `print_settings={"layer_height":"0.2mm","infill":"15%","supports": entry["supports"]}`, tags from the entry.
  - `run(manifest_dir: str, session, *, with_print: bool, dry_run: bool, now=None) -> list[str]` — returns human-readable actions ("created X", "enabled print on X", "skipped X (exists)"). Per product: find the creator (create `ORIGINALS_EMAIL` user once: role creator, `creator_type=seller`, `onboarding_completed=True`, `email_verified=True`, `full_name`/`company_name` "3DVerse Originals", password `get_password_hash(secrets.token_urlsafe(32))` discarded); skip if a product with the same title and creator exists, except that with `with_print=True` an existing one is switched to `is_mode_3_active=True` and its `base_print_price` set; otherwise create `Product`, copy STL via `store_local_file(..., "models", "stl")` into a `ProductVersion` (`version_number=1`, `is_latest=True`, `file_size` from disk), PNG via `store_local_file(..., "images", "png")` into a primary `ProductMedia`, commit, then call `analyze_version(version.id)`. With `dry_run=True`: no session calls, no files copied, returns the would-be actions.
  - `main(argv=None) -> int` — flags `--manifest-dir`, `--with-print`, `--dry-run`, `--allow-remote`; calls `assert_local_target(settings.POSTGRES_SERVER, ...)` before opening any session.

- [ ] **Step 1: Failing tests** (fake in-memory session object recording `add/commit/query` calls; no database):
  - `test_guard_table`: parametrised accept = `localhost`, `localhost:5433`, `127.0.0.1:5432`; refuse = `localhost.evil.com`, `127.0.0.1.nip.io`, `db.abc.supabase.co:5432`, `[::1]:5433`, `""`, `0.0.0.0:5433`; `allow_remote=True` accepts `db.abc.supabase.co:5432`.
  - `test_product_fields_digital_only_default`: with `with_print=False` → `is_mode_3_active is False`, `base_print_price == 0.0`, `mock_order_count == 0`, `is_mode_2_active is True`.
  - `test_product_fields_with_print`: `with_print=True` → `is_mode_3_active is True`, `base_print_price` equals the entry's print price.
  - `test_dry_run_touches_nothing`: `run(..., dry_run=True, session=None)` returns one action per manifest product and raises nothing (session is `None`).
  - `test_idempotent_and_with_print_updates`: with a fake session that remembers created products, a second `run` returns only "skipped … (exists)"; a third run with `with_print=True` returns "enabled print on …" for each and creates no new products.
  - `test_main_refuses_remote_before_any_session`: monkeypatch `settings.POSTGRES_SERVER` to a remote host; `main([...])` exits non-zero and a `SessionLocal` sentinel is never called.
  - `test_no_social_proof_fields`: nothing in `run` constructs a `Review` or `Order` (assert the fake session never receives objects of those types).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `import_catalogue.py`. `run` takes the session as a parameter so tests can fake it; `main` is the only place that builds a real `SessionLocal`.
- [ ] **Step 4:** Tests PASS. Then `python -m scripts.catalogue.import_catalogue --manifest-dir scripts/catalogue/out --dry-run` → prints 12 "would create" lines and exits 0 **without a database** (confirm: no connection attempt; if the `app` import needs the DB at import time, make the import lazy inside `main`/`run`).
- [ ] **Step 5:** Run the full backend suite `cd backend && python -m pytest -q -p no:cacheprovider` → report counts; any failure unrelated to this work is named in the report.

### Task 7: Docs, final check, review

**Files:** Create `backend/scripts/catalogue/README.md`.

- [ ] **Step 1:** README: what it is, `pip install -r scripts/catalogue/requirements.txt`; generate (`python -m scripts.catalogue.generate --out scripts/catalogue/out`); preview import (`--dry-run`); import to a local Postgres (`docker compose up -d db`, `alembic upgrade head`, then the importer); `--with-print` only once a print partner exists; the production warning (back up first; files on ephemeral disk until object storage is configured; importer refuses remote hosts without `--allow-remote`); how to remove the originals (delete products by creator `originals@3dverse.invalid`).
- [ ] **Step 2:** `git diff --stat` shows changes only under `backend/scripts/catalogue/`, `backend/tests/test_catalogue_*.py` and `.gitignore`; `git diff --stat -- backend/app frontend backend/requirements.txt` is empty.
- [ ] **Step 3:** Request one fresh whole-change review (superpowers:requesting-code-review), apply Critical/Important fixes with failing tests first, report rulings, deferred minors, and the limits (database write not exercised; no storefront check; prices are placeholders).
