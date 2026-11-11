import re

import pytest

pytest.importorskip("manifold3d")

from scripts.catalogue import models, quality  # noqa: E402

SPECS = models.SPECS
BANNED = ("best seller", "bestseller", "bestselling", "top rated", "top-rated", "popular", "reviews")
HOME_AND_JEWELRY = {"faceted-geometric-planter", "ribbed-table-vase", "hex-cell-desk-organiser", "geometric-pendant"}
TABLETOP_ETC = {"dice-tower", "modular-dungeon-tile-set", "layered-shoulder-armour-plate", "chess-style-piece-set"}
GADGETS = {"angled-phone-stand", "cable-clip-set", "hexagon-keyring-tag", "interlocking-chain-fidget"}


def ids():
    return [s.slug for s in SPECS]


def test_expected_slugs_present():
    assert GADGETS | HOME_AND_JEWELRY | TABLETOP_ETC <= set(ids())
    assert len(ids()) == 12


@pytest.mark.parametrize("spec", SPECS, ids=ids())
def test_models_pass_quality_gate(spec):
    assert quality.problems(quality.measure(spec.build())) == []


@pytest.mark.parametrize("spec", SPECS, ids=ids())
def test_deterministic(spec):
    assert spec.build().export(file_type="stl") == spec.build().export(file_type="stl")


def test_slugs_are_safe_and_unique():
    slugs = ids()
    assert len(slugs) == len(set(slugs))
    assert len({s.title for s in SPECS}) == len(SPECS)
    for slug in slugs:
        assert re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", slug), slug


@pytest.mark.parametrize("spec", SPECS, ids=ids())
def test_copy_and_prices(spec):
    report = quality.measure(spec.build())
    text = models.describe(spec, report)
    assert spec.category in models.CATEGORIES
    assert spec.price_inr > 0 and spec.print_price_inr > spec.price_inr
    lowered = text.lower()
    assert not any(word in lowered for word in BANNED), text
    assert ("no supports" in lowered) == (report.supports == "none")
    assert ("supports recommended" in lowered) == (report.supports == "recommended")
    x, y, z = (round(v) for v in report.extents_mm)
    assert f"{x} x {y} x {z} mm" in text


def test_phone_stand_prints_without_supports():
    spec = next(s for s in SPECS if s.slug == "angled-phone-stand")
    assert quality.measure(spec.build()).supports == "none"


def test_phone_stand_slot_fits_a_phone_in_a_case():
    # Rays along +y at z=10, off the cable slot: lip front, lip back, then the rest.
    mesh = next(s for s in SPECS if s.slug == "angled-phone-stand").build()
    z = mesh.bounds[0][2] + 10
    hits, _, _ = mesh.ray.intersects_location([[25, mesh.bounds[0][1] - 5, z]], [[0, 1, 0]])
    ys = sorted(float(h[1]) for h in hits)
    gap = ys[2] - ys[1]                                   # lip back face -> rest front face
    assert 8 <= gap <= 16, f"seat gap is {gap:.1f} mm"


def test_chain_links_interlock_without_touching():
    import numpy as np
    import trimesh

    mesh = next(s for s in SPECS if s.slug == "interlocking-chain-fidget").build()
    links = mesh.split(only_watertight=True)
    assert len(links) >= 5
    links = sorted(links, key=lambda m: m.bounds[0][0])
    rng = np.random.default_rng(0)  # fixed seed: sampling only, not geometry
    for i, a in enumerate(links):
        for j in range(i + 1, len(links)):
            b = links[j]
            pts, _ = trimesh.sample.sample_surface(a, 1500, seed=0)
            gap = -trimesh.proximity.signed_distance(b, pts)  # >0 outside b
            gap = float(np.min(np.abs(gap)))
            assert gap >= 0.35, f"links {i} and {j} are only {gap:.2f} mm apart"
            if j == i + 1:
                overlap = (np.minimum(a.bounds[1], b.bounds[1]) - np.maximum(a.bounds[0], b.bounds[0]))
                assert (overlap > 0).all(), f"adjacent links {i},{j} do not interlock"


def test_planter_has_a_drainage_hole_and_hollow_body():
    mesh = next(s for s in SPECS if s.slug == "faceted-geometric-planter").build()
    solid_volume = mesh.convex_hull.volume
    assert mesh.volume < 0.35 * solid_volume          # hollow, not a solid block
    # a ray straight down the centre axis must escape through the bottom hole
    hits, _, _ = mesh.ray.intersects_location([[0, 0, mesh.bounds[1][2] + 5]], [[0, 0, -1]])
    assert len(hits) == 0


def test_vase_is_hollow_and_ribbed():
    mesh = next(s for s in SPECS if s.slug == "ribbed-table-vase").build()
    assert mesh.volume < 0.5 * mesh.convex_hull.volume
    assert mesh.extents[2] >= 150


def test_organiser_has_seven_cells_of_different_depth():
    mesh = next(s for s in SPECS if s.slug == "hex-cell-desk-organiser").build()
    flat_up = (mesh.face_normals[:, 2] > 0.99) & (mesh.triangles_center[:, 2] > 20)
    rim_heights = {round(float(z), 0) for z in mesh.triangles_center[flat_up][:, 2]}
    assert len(rim_heights) >= 5, rim_heights          # seven cells, at least five distinct rim heights
    assert len(mesh.split(only_watertight=False)) == 1  # one fused body, not loose cells


def test_pendant_has_a_bail_hole():
    mesh = next(s for s in SPECS if s.slug == "geometric-pendant").build()
    hits, _, _ = mesh.ray.intersects_location([[mesh.bounds[1][0] - 4.5, 0, mesh.bounds[1][2] + 5]], [[0, 0, -1]])
    assert len(hits) == 0, "the bail hole must go all the way through"


def test_exactly_four_featured():
    assert {s.slug for s in SPECS if s.featured} == {
        "angled-phone-stand", "faceted-geometric-planter", "dice-tower", "chess-style-piece-set"}


def test_categories_cover_the_catalogue():
    assert {s.category for s in SPECS} == models.CATEGORIES


def test_dice_tower_exit_window_is_open():
    mesh = next(s for s in SPECS if s.slug == "dice-tower").build()
    hits, _, _ = mesh.ray.intersects_location([[0, mesh.bounds[0][1] - 10, 20]], [[0, 1, 0]])
    first_y = min(h[1] for h in hits)
    front_wall_y = mesh.bounds[0][1] + 40          # the tray sticks out 40 mm in front of the tower
    assert first_y > front_wall_y + 5, "ray hit the front wall: the exit window is closed"


@pytest.mark.filterwarnings("ignore:invalid value encountered:RuntimeWarning")  # flat contact face has zero volume
def test_tiles_are_four_separate_pieces_that_interlock():
    import trimesh
    mesh = next(s for s in SPECS if s.slug == "modular-dungeon-tile-set").build()
    tiles = mesh.split(only_watertight=True)
    assert len(tiles) == 4
    tile = sorted(tiles, key=lambda t: (round(t.bounds[0][1]), round(t.bounds[0][0])))[0]
    for shift in ([50, 0, 0], [0, 50, 0]):
        neighbour = tile.copy()
        neighbour.apply_translation(shift)
        overlap = trimesh.boolean.intersection([tile, neighbour], engine="manifold")
        assert (len(overlap.faces) == 0) or overlap.volume < 1.0, f"tiles collide when joined along {shift}"
        # the tab must actually reach into the neighbour's slot, not just sit beside it
        np = __import__("numpy")
        assert (np.minimum(tile.bounds[1], neighbour.bounds[1]) - np.maximum(tile.bounds[0], neighbour.bounds[0])).min() > 0


def test_armour_is_one_fused_shell_with_strap_slots():
    mesh = next(s for s in SPECS if s.slug == "layered-shoulder-armour-plate").build()
    assert len(mesh.split(only_watertight=False)) == 1
    assert mesh.extents[0] >= 120 and mesh.extents[1] >= 90


def test_chess_set_has_three_distinct_pieces():
    mesh = next(s for s in SPECS if s.slug == "chess-style-piece-set").build()
    pieces = mesh.split(only_watertight=True)
    assert len(pieces) == 3
    assert len({round(p.extents[2]) for p in pieces}) == 3     # three different heights
