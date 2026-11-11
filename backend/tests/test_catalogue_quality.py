import pytest
import trimesh

pytest.importorskip("manifold3d")

from scripts.catalogue import quality, shapes  # noqa: E402


def test_measure_box():
    report = quality.measure(trimesh.creation.box((40, 40, 40)))
    assert report.watertight
    assert report.volume_mm3 == pytest.approx(64000, rel=1e-6)
    assert report.extents_mm == pytest.approx((40, 40, 40))
    assert report.supports == "none"
    assert quality.problems(report) == []


def test_problems_flags_each_rule():
    box = trimesh.creation.box((40, 40, 40))
    open_mesh = trimesh.Trimesh(vertices=box.vertices, faces=box.faces[:-1], process=False)
    assert any("watertight" in p for p in quality.problems(quality.measure(open_mesh)))
    assert any("largest" in p for p in quality.problems(quality.measure(trimesh.creation.box((5, 5, 5)))))
    assert any("exceeds" in p for p in quality.problems(quality.measure(trimesh.creation.box((300, 40, 40)))))
    assert any("thin" in p for p in quality.problems(quality.measure(trimesh.creation.box((60, 40, 0.5)))))


def test_thin_flat_items_are_allowed():
    # Keyrings, pendants and tiles are legitimately a few millimetres thick.
    tag = shapes.grounded(shapes.prism([(0, 0), (40, 0), (40, 35), (0, 35)], height=4))
    report = quality.measure(tag)
    assert quality.problems(report) == []


def test_extrude_profile_axes():
    # u -> X, v -> Z, depth -> Y (centred): a 10 x 20 profile, 30 deep.
    mesh = shapes.extrude_xz([(0, 0), (10, 0), (10, 20), (0, 20)], depth=30)
    assert mesh.is_watertight and mesh.volume == pytest.approx(10 * 20 * 30)
    assert mesh.extents == pytest.approx((10, 30, 20))
    side = shapes.extrude_yz([(0, 0), (10, 0), (10, 20), (0, 20)], width=30)
    assert side.is_watertight and side.volume > 0
    assert side.extents == pytest.approx((30, 10, 20))


def test_supports_label_matches_overhang():
    stem = trimesh.creation.box((10, 10, 40))
    slab = trimesh.creation.box((60, 60, 5)).apply_translation([0, 0, 22.5])
    t_shape = shapes.grounded(shapes.union(stem, slab))
    assert quality.measure(t_shape).supports == "recommended"
    assert quality.measure(shapes.grounded(trimesh.creation.box((40, 40, 40)))).supports == "none"
    # A flat bottom resting on the bed is not an overhang, however finely it is tessellated.
    cone_up = shapes.grounded(trimesh.creation.cone(radius=20, height=60, sections=128))
    assert quality.measure(cone_up).supports == "none"


def test_app_analyzer_rule_is_mirrored():
    # The app's own check counts faces, so a fan-tessellated flat bottom trips it
    # even though nothing overhangs. The gate must surface that mismatch.
    cone_up = shapes.grounded(trimesh.creation.cone(radius=20, height=60, sections=128))
    report = quality.measure(cone_up)
    assert report.app_flags_overhang is True
    assert any("analyzer" in p for p in quality.problems(report))
    box = quality.measure(shapes.grounded(trimesh.creation.box((40, 40, 40))))
    assert box.app_flags_overhang is False


def test_grounded():
    moved = trimesh.creation.box((30, 20, 10)).apply_translation([50, -20, 7])
    g = shapes.grounded(moved)
    assert g.bounds[0][2] == pytest.approx(0)
    assert g.bounds.mean(axis=0)[:2] == pytest.approx((0, 0))


def test_union_difference_watertight():
    box = trimesh.creation.box((20, 20, 20))
    hole = trimesh.creation.cylinder(radius=4, height=40)
    cut = shapes.difference(box, hole)
    assert cut.is_watertight and cut.volume < box.volume
    other = trimesh.creation.box((20, 20, 20)).apply_translation([10, 0, 0])
    joined = shapes.union(box, other)
    assert joined.is_watertight and joined.volume < box.volume + other.volume


def test_lathe_and_prism_are_watertight():
    vase = shapes.lathe([(0, 0), (20, 0), (30, 60), (28, 60), (18, 3), (0, 3)], sections=32)
    assert vase.is_watertight and vase.volume > 0
    tile = shapes.prism([(0, 0), (40, 0), (40, 30), (0, 30)], height=8)
    assert tile.is_watertight and tile.volume == pytest.approx(40 * 30 * 8)
