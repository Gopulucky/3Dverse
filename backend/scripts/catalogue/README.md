# Starter catalogue

Twelve original, parametric 3D models with rendered images, and a guarded importer that
turns them into marketplace products in a **local** database. Nothing here is copied from
anyone else, and the importer creates no reviews, ratings, orders or sales counts.

Run everything from `backend/`.

## 1. Generate

```bash
pip install -r scripts/catalogue/requirements.txt
python -m scripts.catalogue.generate --out scripts/catalogue/out
```

Writes `out/<slug>/<slug>.stl`, `out/<slug>/<slug>.png` and `out/manifest.json`
(git-ignored). Every model must pass the quality gate (watertight, thinnest part at
least 1.2 mm, largest side 20 to 220 mm), or nothing is written. Output is deterministic.
Product copy states each model's size and whether it needs supports, measured from the mesh.

## 2. Preview the import (no database)

```bash
python -m scripts.catalogue.import_catalogue --manifest-dir scripts/catalogue/out --dry-run
```

## 3. Import into a local Postgres

```bash
docker compose up -d db          # pgvector/pgvector:pg15 on localhost:5433
alembic upgrade head
python -m scripts.catalogue.import_catalogue --manifest-dir scripts/catalogue/out
```

- Products belong to the creator `3DVerse Originals` (`originals@3dverse.invalid`, an
  unusable random password, so nobody can sign in as it).
- They are published, **digital download only**, priced in INR. Prices are placeholders:
  edit `price_inr` / `print_price_inr` in `models.py` and regenerate.
- Re-running is safe: existing products are skipped.
- The app's own analyzer then writes each printability report and public preview.

### Printed versions

```bash
python -m scripts.catalogue.import_catalogue --manifest-dir scripts/catalogue/out --with-print
```

Turns on printed orders for the originals (existing ones are updated, none duplicated).
Do this only once a print partner exists to make and ship them. Otherwise customers can
pay for something nobody will print.

## Production

The importer refuses any database host other than `localhost` or `127.0.0.1`. For a real
deployment: back up the database first, make sure object storage is configured (files on
a container's disk are lost on redeploy), and only then pass `--allow-remote`.

## Remove the originals

Delete the products whose creator is `originals@3dverse.invalid`, then that user.
