"""Import the generated starter catalogue into a LOCAL database.

    python -m scripts.catalogue.import_catalogue --manifest-dir scripts/catalogue/out --dry-run
    python -m scripts.catalogue.import_catalogue --manifest-dir scripts/catalogue/out
    python -m scripts.catalogue.import_catalogue --manifest-dir scripts/catalogue/out --with-print

Safe by design:
  * refuses any database host other than localhost / 127.0.0.1 unless --allow-remote;
  * --dry-run opens no database connection and copies no files;
  * products are digital-only unless --with-print (physical prints need a fulfiller);
  * creates no reviews, ratings, orders or sales counts.

Re-running is idempotent: existing originals are skipped, except that --with-print
switches printing on for the ones that already exist.
"""
import argparse
import importlib
import json
import os
import pkgutil
import secrets
import sys
from datetime import datetime

ORIGINALS_EMAIL = "originals@3dverse.invalid"      # reserved TLD: can never receive mail or log in
ORIGINALS_NAME = "3DVerse Originals"
LOCAL_HOSTS = {"localhost", "127.0.0.1"}


class AnalysisFailed(Exception):
    """The app's analyzer swallows its own errors, so the importer checks its result."""


def assert_local_target(server: str, allow_remote: bool = False) -> None:
    """`server` is `host[:port]`. Only exactly localhost / 127.0.0.1 count as local."""
    if allow_remote:
        return
    host = (server or "").strip()
    if ":" in host:
        host = host.rsplit(":", 1)[0]
    if host not in LOCAL_HOSTS:
        raise SystemExit(
            f"Refusing to import into database host {server!r}: only localhost or 127.0.0.1 is allowed. "
            "Pass --allow-remote only for a database you have backed up and mean to change."
        )


def register_models() -> None:
    """Import every app model so SQLAlchemy can resolve all relationships."""
    package = importlib.import_module("app.models")
    for module in pkgutil.iter_modules(package.__path__):
        importlib.import_module(f"app.models.{module.name}")


def product_fields(entry: dict, creator_id: int, with_print: bool, now: datetime) -> dict:
    from app.models.printer import PrinterTechnology
    from app.models.product import ProductStatus, SafetyReviewStatus

    return {
        "title": entry["title"], "description": entry["description"], "category": entry["category"],
        "tags": list(entry["tags"]), "price": entry["price_inr"], "currency": "INR",
        "license_type": "Personal Use", "status": ProductStatus.published, "is_published": True,
        "published_at": now, "creator_id": creator_id,
        "safety_review_status": SafetyReviewStatus.approved, "safety_reviewed_at": now,
        "safety_review_note": "Original 3DVerse design.",
        "is_featured": bool(entry["featured"]), "mock_order_count": 0,
        "is_mode_2_active": True, "digital_download_enabled": True,
        "is_mode_3_active": with_print,
        "base_print_price": entry["print_price_inr"] if with_print else 0.0,
        "technology_required": PrinterTechnology.FDM, "material_required": "PLA",
        "available_materials": ["PLA", "PETG"],
        "print_settings": {"layer_height": "0.2mm", "infill": "15%", "supports": entry["supports"]},
    }


class SqlRepo:
    """The only place that talks to the database."""

    def __init__(self, session):
        from app.models.product import Product, ProductMedia, ProductVersion
        from app.models.user import User
        self.s, self.User, self.Product, self.Version, self.Media = session, User, Product, ProductVersion, ProductMedia

    def find_creator(self):
        return self.s.query(self.User).filter(self.User.email == ORIGINALS_EMAIL).first()

    def create_creator(self, **fields):
        creator = self.User(**fields)
        self.s.add(creator)
        self.s.flush()
        return creator

    def find_product(self, creator_id, title):
        return self.s.query(self.Product).filter(self.Product.creator_id == creator_id, self.Product.title == title).first()

    def create_product(self, fields):
        product = self.Product(**fields)
        self.s.add(product)
        self.s.flush()
        return product

    def add_version(self, product_id, **fields):
        version = self.Version(product_id=product_id, **fields)
        self.s.add(version)
        self.s.flush()
        return version

    def add_media(self, product_id, url):
        self.s.add(self.Media(product_id=product_id, media_url=url, media_type="image", is_primary=True))

    def enable_print(self, product, price):
        product.is_mode_3_active, product.base_print_price = True, price

    def commit(self):
        self.s.commit()

    def latest_version(self, product_id):
        return (self.s.query(self.Version).filter(self.Version.product_id == product_id)
                .order_by(self.Version.version_number.desc()).first())

    def version_health(self, version_id):
        """(preview_url, report_status) as left by the analyzer, which uses its own session."""
        from app.models.product import PrintabilityReport
        self.s.expire_all()
        version = self.s.query(self.Version).filter(self.Version.id == version_id).first()
        report = self.s.query(PrintabilityReport).filter(PrintabilityReport.version_id == version_id).first()
        return (version.preview_url if version else None), (report.status if report else None)


def _creator_fields() -> dict:
    from app.core.security import get_password_hash
    from app.models.user import CreatorType, UserRole

    return {
        "email": ORIGINALS_EMAIL, "full_name": ORIGINALS_NAME, "company_name": ORIGINALS_NAME,
        "bio": "Original designs made by the 3DVerse team.",
        # Random and discarded: nobody can sign in as this account.
        "hashed_password": get_password_hash(secrets.token_urlsafe(32)),
        "role": UserRole.creator, "creator_type": CreatorType.seller,
        "onboarding_completed": True, "email_verified": True,
    }


def _default_store(path, subfolder, extension):
    from app.core.storage import store_local_file
    return store_local_file(path, subfolder, extension)


def _default_analyze(version_id):
    from app.services.printability import analyze_version
    analyze_version(version_id)


def run(manifest_dir, repo, *, with_print=False, dry_run=False, now=None, store_file=None, analyze=None) -> list:
    with open(os.path.join(manifest_dir, "manifest.json"), encoding="utf-8") as handle:
        manifest = json.load(handle)
    if manifest.get("version") != 1:
        raise SystemExit(f"Unsupported manifest version: {manifest.get('version')!r}")
    entries = manifest["products"]

    if dry_run:
        return [f"would create {entry['title']}" for entry in entries]

    now = now or datetime.utcnow()
    store_file = store_file or _default_store
    analyze = analyze or _default_analyze
    actions = []

    creator = repo.find_creator()
    if creator is None:
        creator = repo.create_creator(**_creator_fields())
        repo.commit()
        actions.append(f"created creator {ORIGINALS_NAME}")

    failures = []

    def analysed_ok(version_id, title):
        preview, status = repo.version_health(version_id)
        if not preview or status in (None, "fail"):
            failures.append(f"{title}: no public preview or the printability report failed "
                            f"(preview={preview!r}, report={status!r}); check storage settings")
            return False
        return True

    for entry in entries:
        existing = repo.find_product(creator.id, entry["title"])
        if existing is not None:
            repaired = False
            version = repo.latest_version(existing.id)
            if version is not None and not all(repo.version_health(version.id)[:1]):
                analyze(version.id)                      # preview missing: try again rather than skip
                repaired = analysed_ok(version.id, entry["title"])
                if repaired:
                    actions.append(f"repaired {entry['title']}")
            if with_print and not existing.is_mode_3_active:
                repo.enable_print(existing, entry["print_price_inr"])
                repo.commit()
                actions.append(f"enabled print on {entry['title']}")
            elif not repaired:
                actions.append(f"skipped {entry['title']} (exists)")
            continue

        product = repo.create_product(product_fields(entry, creator.id, with_print, now))
        stl_path = os.path.join(manifest_dir, entry["stl"])
        version = repo.add_version(
            product.id, file_url=store_file(stl_path, "models", "stl"), file_name=f"{entry['slug']}.stl",
            file_size=os.path.getsize(stl_path), version_number=1, is_latest=True, created_at=now,
        )
        repo.add_media(product.id, store_file(os.path.join(manifest_dir, entry["png"]), "images", "png"))
        repo.commit()
        analyze(version.id)        # the app's own analyzer: printability report + public preview
        if analysed_ok(version.id, entry["title"]):
            actions.append(f"created {entry['title']}")
    if failures:
        raise AnalysisFailed("analysis incomplete (no preview or failed report):" + chr(10) + chr(10).join(failures))
    return actions


def _open_session():
    from app.core.database import SessionLocal
    return SessionLocal()


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--manifest-dir", required=True)
    parser.add_argument("--with-print", action="store_true", help="also offer printed versions (needs a fulfiller)")
    parser.add_argument("--dry-run", action="store_true", help="show what would happen; touch nothing")
    parser.add_argument("--allow-remote", action="store_true", help="allow a non-local database (back it up first)")
    args = parser.parse_args(argv)

    if args.dry_run:
        actions = run(args.manifest_dir, None, with_print=args.with_print, dry_run=True)
    else:
        from app.core.config import settings
        assert_local_target(settings.POSTGRES_SERVER, args.allow_remote)
        register_models()
        session = _open_session()
        try:
            actions = run(args.manifest_dir, SqlRepo(session), with_print=args.with_print, dry_run=False)
        finally:
            session.close()
    print("\n".join(actions))
    return 0


if __name__ == "__main__":
    sys.exit(main())
