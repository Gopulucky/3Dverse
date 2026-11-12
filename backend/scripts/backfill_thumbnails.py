"""Create thumbnails for product images that were uploaded before thumbnails existed.

    python -m scripts.backfill_thumbnails                         # count only, changes nothing
    python -m scripts.backfill_thumbnails --apply                 # local database
    python -m scripts.backfill_thumbnails --allow-remote --apply  # the real database

Safe by design:
  * counts only unless --apply is given;
  * refuses any database host other than localhost / 127.0.0.1 unless --allow-remote
    (back up the database first and make sure the thumb_url migration has been applied);
  * adds a new small file and sets thumb_url; the original image is never changed;
  * re-running is safe: images that already have a thumbnail are skipped.
"""
import argparse
import importlib
import logging
import pkgutil
import sys

LOCAL_HOSTS = {"localhost", "127.0.0.1"}


def assert_local_target(server: str, allow_remote: bool = False) -> None:
    if allow_remote:
        return
    host = (server or "").strip()
    if ":" in host:
        host = host.rsplit(":", 1)[0]
    if host not in LOCAL_HOSTS:
        raise SystemExit(
            f"Refusing to use database host {server!r}: only localhost or 127.0.0.1 is allowed. "
            "Pass --allow-remote only for a database you have backed up and mean to change."
        )


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="write thumbnails (default: only count)")
    parser.add_argument("--allow-remote", action="store_true", help="allow a database that is not on this machine")
    parser.add_argument("--limit", type=int, default=None, help="process at most this many images")
    args = parser.parse_args(argv)

    from app.core.config import settings
    assert_local_target(settings.POSTGRES_SERVER, args.allow_remote)

    import app.models
    for module in pkgutil.iter_modules(app.models.__path__):
        importlib.import_module(f"app.models.{module.name}")
    from app.core.database import SessionLocal
    from app.services.media_thumbnails import backfill_thumbnails

    logging.basicConfig(level=logging.INFO)
    db = SessionLocal()
    try:
        report = backfill_thumbnails(db, apply=args.apply, limit=args.limit)
    finally:
        db.close()
    if args.apply:
        print(f"{report.candidates} image(s) without a thumbnail; created: {report.created}; failed: {report.failed}")
    else:
        print(f"{report.candidates} image(s) without a thumbnail. Nothing was changed; re-run with --apply to create them.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
