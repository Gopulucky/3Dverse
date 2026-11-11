"""Generate the starter catalogue: STL models, PNG renders and manifest.json.

    python -m scripts.catalogue.generate --out scripts/catalogue/out

Every model must pass the quality gate; nothing is written if any fails.
"""
import argparse
import json
import os
import sys

from . import models, quality, render

CREATOR = {"name": "3DVerse Originals"}


class QualityError(Exception):
    pass


def build_all(out_dir: str, specs=None) -> dict:
    specs = list(models.SPECS if specs is None else specs)
    built, failures = [], []
    for spec in specs:
        mesh = spec.build()
        report = quality.measure(mesh)
        found = quality.problems(report)
        if found:
            failures.append(f"{spec.slug}: " + "; ".join(found))
        built.append((spec, mesh, report))
    if failures:
        raise QualityError("quality gate failed:\n" + "\n".join(failures))

    products = []
    for spec, mesh, report in built:
        folder = os.path.join(out_dir, spec.slug)
        os.makedirs(folder, exist_ok=True)
        stl_rel, png_rel = f"{spec.slug}/{spec.slug}.stl", f"{spec.slug}/{spec.slug}.png"
        mesh.export(os.path.join(out_dir, stl_rel))
        render.render_png(mesh, os.path.join(out_dir, png_rel))
        x, y, z = report.extents_mm
        products.append({
            "slug": spec.slug, "title": spec.title, "category": spec.category,
            "description": models.describe(spec, report), "tags": list(spec.tags),
            "price_inr": spec.price_inr, "print_price_inr": spec.print_price_inr, "featured": spec.featured,
            "stl": stl_rel, "png": png_rel,
            "dimensions_mm": {"x": round(x, 3), "y": round(y, 3), "z": round(z, 3)},
            "volume_mm3": round(report.volume_mm3, 3), "faces": report.faces, "supports": report.supports,
        })
    manifest = {"version": 1, "creator": dict(CREATOR), "products": products}
    with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8", newline="\n") as handle:
        json.dump(manifest, handle, indent=2, sort_keys=True)
        handle.write("\n")
    return manifest


def main(argv=None, specs=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", required=True, help="output directory")
    args = parser.parse_args(argv)
    try:
        manifest = build_all(args.out, specs)
    except QualityError as error:
        print(error, file=sys.stderr)
        return 1
    print(f"Wrote {len(manifest['products'])} products to {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
