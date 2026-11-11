# Starter catalogue — original 3D products

Status: draft for review · 2026-11-11 · Sub-project 2 of 3

## Goal

Give the storefront a believable, honest starting catalogue across the existing categories, based on what the market guides say sells (phone stands, home decor, desk organisers, tabletop gaming, jewellery, cosplay, fidget toys), without fabricating anything: no invented reviews, ratings, sales counts or customers.

## Decisions already made

- ~12 **original** models that I generate parametrically (nobody else's files, no licensing risk), published under a clearly labelled **"3DVerse Originals"** creator account.
- Written to a **local** database first. Production only after you have reviewed the products.
- Demand evidence is directional only: the sources are SEO and vendor guides with no verified sales or India-specific volume data.

## Findings that shape the design

- Product rows need: `Product` (+ `ProductVersion` with the STL, `PrintabilityReport`, `ProductMedia` image). Public pages use a **decimated GLB preview** that `app/services/printability.py::_write_preview` makes and stores via `store_local_file`; the source STL is served only through the entitlement-checked downloads API.
- `seed_demo.py` is the wrong template: it invents reviews, `mock_order_count` and orders. The new tooling reuses none of that.
- This machine has **no boolean engine** (`manifold3d`) and **no Docker**, so a local Postgres is not available here. The default local DB is `pgvector/pgvector:pg15` on `localhost:5433` (`docker-compose.yml`).
- **Physical prints need a fulfiller.** Marking a product `is_mode_3_active` lets customers pay for a printed item, but there is currently no print partner in the database and the partner hub (sub-project 3) is unbuilt. Listing prints with nobody to make them would take money for something we can't deliver.

## Design

Two small tools under `backend/scripts/catalogue/`, so generation (verifiable anywhere) is separate from the database write (needs Postgres).

### 1. Generator — `generate.py`
- Builds each model from code with `trimesh` (+ `shapely` for 2D profiles, `matplotlib.textpath` for text), deterministic with no randomness.
- Needs `manifold3d` for clean boolean unions/cut-outs. It goes in a new `backend/scripts/catalogue/requirements.txt` (tooling only, **not** the app's `requirements.txt`).
- Outputs, per product, under `backend/scripts/catalogue/out/<slug>/`:
  - `<slug>.stl`: the model
  - `<slug>.png`: a lit render of the real mesh (matplotlib, 1200×900) used as the product image
  - an entry in `manifest.json`: title, category, description, tags, INR prices, print settings, dimensions, volume, face count
- **Quality gate** (fails the run, not a warning): mesh is watertight, volume > 0, every extent between 20 and 220 mm, faces < 400 000.

### 2. Importer — `import_catalogue.py`
- Reads `manifest.json` and writes DB rows through the app's own models and `store_local_file`, then makes the preview with the same `_write_preview`.
- Creates the creator **"3DVerse Originals"** with a random, discarded password (not loginable) and a reserved `.invalid` email. Role `creator`, `creator_type` seller.
- Products are `published`, `safety_review_status=approved`, licence "Personal Use", digital download enabled, `mock_order_count=0`, **no reviews, no orders**. A handful are `is_featured` as an editorial choice.
- **Idempotent** by slug-tagged title/tag: re-running updates nothing it already created.
- **Safety:** refuses to run unless `POSTGRES_SERVER` host is `localhost` / `127.0.0.1`, unless `--allow-remote` is passed. `--dry-run` prints what would be written.
- **Physical prints off by default** (digital-only). `--with-print` turns on `is_mode_3_active` with `base_print_price`. Use it only once a print partner exists to fulfil orders.

### Product list (INR; placeholders for you to adjust)
| Category | Product | Digital | Print |
|---|---|---|---|
| Gadgets | Adjustable phone stand | ₹149 | ₹499 |
| Gadgets | Cable clip set (4) | ₹99 | ₹299 |
| Gadgets | Hexagon keyring tag | ₹79 | ₹249 |
| Home Decor | Faceted geometric planter | ₹199 | ₹799 |
| Home Decor | Ribbed table vase | ₹199 | ₹899 |
| Home Decor | Hex-cell desk organiser | ₹249 | ₹999 |
| Tabletop | Dice tower | ₹249 | ₹1 199 |
| Tabletop | Modular dungeon tile set | ₹299 | ₹1 299 |
| Jewelry | Geometric pendant | ₹149 | ₹599 |
| Cosplay | Layered shoulder armour plate | ₹299 | ₹1 499 |
| Miniatures | Chess-style piece set (pawn, rook, bishop) | ₹249 | ₹999 |
| Fidget | Articulated segmented toy (listed under Gadgets) | ₹199 | ₹699 |

Descriptions state only facts the geometry supports: size, suggested material and layer height, whether supports are needed (verified by the overhang check), and what the file contains. They make no claims about sales, ratings or "best seller".

## Non-goals
- No production writes by me. You run the importer on production (after backup) once the products look right.
- No reviews, ratings, orders, fake creators or social proof.
- No change to the app's models, API or frontend.
- Object-storage upgrade: unchanged. On the live service, files written to the container's disk are lost on redeploy until storage is upgraded.

## Verification
- **Unit tests (`pytest`, from `backend/`)**: each generated model passes the quality gate; generation is deterministic (same bytes twice); the manifest matches its schema; importer refuses a non-local host and accepts `--dry-run`; `--with-print` is off by default.
- **Visual:** I view every rendered image and contact sheet before reporting.
- **What I cannot verify here:** the actual database write and the storefront showing the products, because there is no Postgres on this machine. The importer will be reviewed by reading plus a dry run. You run it against your local Postgres (or I verify it if you start one), then we look at the storefront together.

## Decisions I need from you
1. **Print offering.** Recommended: digital-only first, prints enabled after a partner exists. (Alternative: enable prints now and accept that orders have no fulfiller.)
2. **New tooling dependency.** `manifold3d` as a tooling-only requirement. (Alternative: simpler shapes with no cut-outs, which looks plainer.)
3. **Prices** above are placeholders; adjust any you like.
