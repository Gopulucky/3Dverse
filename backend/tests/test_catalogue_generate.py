import json

import pytest
import trimesh
from PIL import Image

pytest.importorskip("manifold3d")

from scripts.catalogue import generate, models, render  # noqa: E402

KEYS = {"slug", "title", "category", "description", "tags", "price_inr", "print_price_inr", "featured",
        "stl", "png", "dimensions_mm", "volume_mm3", "faces", "supports"}


def two_specs():
    by_slug = {s.slug: s for s in models.SPECS}
    return [by_slug["hexagon-keyring-tag"], by_slug["angled-phone-stand"]]


def test_render_png_size_and_not_blank(tmp_path):
    out = tmp_path / "box.png"
    render.render_png(trimesh.creation.box((40, 30, 20)), str(out))
    image = Image.open(out)
    assert image.size == (1200, 900)
    assert len(image.convert("RGB").getcolors(maxcolors=1_000_000)) > 20


def test_render_shows_the_model_not_just_background(tmp_path):
    out = tmp_path / "box.png"
    render.render_png(trimesh.creation.box((40, 30, 20)), str(out))
    image = Image.open(out).convert("RGB")
    corner, centre = image.getpixel((5, 5)), image.getpixel((600, 450))
    assert corner != centre


def test_build_all_writes_everything(tmp_path):
    manifest = generate.build_all(str(tmp_path), two_specs())
    assert len(manifest["products"]) == 2
    on_disk = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert on_disk == manifest and manifest["version"] == 1
    for entry in manifest["products"]:
        assert set(entry) == KEYS
        assert (tmp_path / entry["stl"]).is_file() and (tmp_path / entry["png"]).is_file()
        assert not entry["stl"].startswith(("/", "\\")) and ".." not in entry["stl"]
    assert manifest["creator"] == {"name": "3DVerse Originals"}


def test_manifest_values_match_meshes(tmp_path):
    from scripts.catalogue import quality
    manifest = generate.build_all(str(tmp_path), two_specs())
    for spec, entry in zip(two_specs(), manifest["products"]):
        report = quality.measure(spec.build())
        assert entry["volume_mm3"] == pytest.approx(report.volume_mm3, abs=0.01)
        assert entry["dimensions_mm"] == pytest.approx(dict(zip("xyz", report.extents_mm)), abs=0.01)
        assert entry["supports"] == report.supports
        assert entry["description"] == models.describe(spec, report)


def test_build_all_fails_on_bad_model(tmp_path):
    box = trimesh.creation.box((40, 40, 40))

    def open_mesh():
        return trimesh.Trimesh(vertices=box.vertices, faces=box.faces[:-1], process=False)

    bad = models.ProductSpec("bad-model", "Bad model", "Gadgets", "Broken.", ("x",), 10, 20, False, open_mesh)
    with pytest.raises(generate.QualityError) as info:
        generate.build_all(str(tmp_path), [bad])
    assert "bad-model" in str(info.value)
    assert not (tmp_path / "manifest.json").exists()
    assert generate.main(["--out", str(tmp_path / "cli")], specs=[bad]) == 1
    assert not (tmp_path / "cli" / "manifest.json").exists()


def test_build_is_deterministic(tmp_path):
    first = tmp_path / "a"
    second = tmp_path / "b"
    generate.build_all(str(first), two_specs())
    generate.build_all(str(second), two_specs())
    for name in ("manifest.json", "hexagon-keyring-tag/hexagon-keyring-tag.stl", "hexagon-keyring-tag/hexagon-keyring-tag.png"):
        assert (first / name).read_bytes() == (second / name).read_bytes(), name
