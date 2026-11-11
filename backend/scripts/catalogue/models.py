"""The starter catalogue: original parametric models and their listing copy.

Every model is built from code, deterministically, in millimetres with Z up and
its lowest point on the bed. Copy is assembled by `describe`, so the size and
the supports statement come from the mesh and cannot drift from it.
"""
import math
from dataclasses import dataclass
from typing import Callable

import trimesh
from shapely.geometry import LineString, Point, Polygon, box

from . import shapes
from .quality import MeshReport

CATEGORIES = {"Gadgets", "Home Decor", "Tabletop", "Jewelry", "Cosplay", "Miniatures"}


@dataclass(frozen=True)
class ProductSpec:
    slug: str
    title: str
    category: str
    blurb: str
    tags: tuple
    price_inr: float
    print_price_inr: float
    featured: bool
    build: Callable[[], trimesh.Trimesh]


def describe(spec: ProductSpec, report: MeshReport) -> str:
    x, y, z = (round(v) for v in report.extents_mm)
    supports = ("Prints with no supports." if report.supports == "none"
                else "Supports recommended for the overhanging parts.")
    return (f"{spec.blurb} Size {x} x {y} x {z} mm. Suggested material: PLA or PETG at "
            f"0.2 mm layer height. {supports}")


# ---------------------------------------------------------------- Gadgets

def _phone_stand() -> trimesh.Trimesh:
    # Side profile (depth, height); 80 mm wide. The rest leans back about 26 degrees.
    profile = [(0, 0), (105, 0), (105, 6), (55, 6), (99, 96), (90, 96), (46, 6),
               (34, 6), (34, 14), (26, 14), (26, 6), (0, 6)]
    body = shapes.extrude_yz(profile, width=80)
    cable_slot = trimesh.creation.box((14, 40, 14))
    cable_slot.apply_translation([0, 62, 13])
    return shapes.grounded(shapes.difference(body, cable_slot))


def _cable_clips() -> trimesh.Trimesh:
    pad = box(-9, 0, 9, 2.4)
    ring = Point(0, 8.0).buffer(8.0, 24)                    # tangent to the bed: no overhang above the pad
    hole_circle = Point(0, 8.0).buffer(3.4, 24)
    hole = hole_circle.union(Point(0, 13.9).buffer(0.01, 4)).convex_hull   # teardrop: steep pointed top
    slot = box(-2.25, 13.3, 2.25, 17.0)
    section = pad.union(ring).difference(hole.union(slot))
    one = shapes.extrude_xz(section, depth=24)
    clips = []
    for x in (-33, -11, 11, 33):
        clip = one.copy()
        clip.apply_translation([x, 0, 0])
        clips.append(clip)
    return shapes.grounded(trimesh.util.concatenate(clips))


def _hexagon_tag() -> trimesh.Trimesh:
    hexagon = [(20 * math.cos(math.radians(a)), 20 * math.sin(math.radians(a))) for a in range(0, 360, 60)]
    tag = shapes.prism(hexagon, height=4)
    ring_hole = trimesh.creation.cylinder(radius=2.5, height=12, sections=32)
    ring_hole.apply_translation([-12.5, 0, 2])
    pocket_outline = [(4 + 12 * math.cos(math.radians(a)), 12 * math.sin(math.radians(a))) for a in range(0, 360, 60)]
    pocket = shapes.prism(pocket_outline, height=3).apply_translation([0, 0, 3])
    return shapes.grounded(shapes.difference(tag, ring_hole, pocket))


def _chain() -> trimesh.Trimesh:
    def stadium(length, width):
        half = (length - width) / 2
        return LineString([(-half, 0), (half, 0)]).buffer(width / 2, 24)

    ring = stadium(30, 14).difference(stadium(20, 6))
    standing = shapes.extrude_xz(ring, depth=4)               # ring stands on edge, 14 mm tall
    standing.apply_translation([0, 0, 7])
    flat = trimesh.creation.extrude_polygon(ring, 4)           # ring lies flat at mid height
    flat.apply_translation([0, 0, 5])
    pitch = 17
    links = []
    for i in range(6):
        link = (standing if i % 2 == 0 else flat).copy()
        link.apply_translation([i * pitch, 0, 0])
        links.append(link)
    return shapes.grounded(trimesh.util.concatenate(links))


# ------------------------------------------------------------- Home decor

def _planter() -> trimesh.Trimesh:
    # Eight flat facets. Walls flare outward gently, so nothing overhangs.
    profile = [(0, 0), (36, 0), (56, 120), (53, 120), (33.5, 4), (0, 4)]
    pot = shapes.lathe(profile, sections=8)
    drain = trimesh.creation.cylinder(radius=4, height=20, sections=8)
    drain.apply_translation([0, 0, 2])
    return shapes.grounded(shapes.difference(pot, drain))


def _vase() -> trimesh.Trimesh:
    def outer(z):
        belly = 28 + 17 * math.sin(math.pi * min(z, 105) / 105 * 0.5) ** 1.2 - 15 * max(0, (z - 105) / 75) ** 1.3
        return belly + 1.0 * math.sin(2 * math.pi * z / 12)          # gentle horizontal ribs
    zs = [i * 2.0 for i in range(0, 91)]
    outside = [(outer(z), z) for z in zs]
    inside = [(outer(z) - 2.4, z) for z in reversed(zs) if z >= 3]
    return shapes.grounded(shapes.lathe([(0, 0)] + outside + inside + [(0, 3)], sections=64))


def _organiser() -> trimesh.Trimesh:
    radius, wall, spacing = 23.0, 2.8, 23.0 * math.sqrt(3) * 0.985
    centres = [(0.0, 0.0)] + [(spacing * math.cos(math.radians(60 * k)), spacing * math.sin(math.radians(60 * k))) for k in range(6)]
    heights = [100, 70, 85, 55, 90, 65, 75]

    def hexagon(r, cx, cy):
        return [(cx + r * math.cos(math.radians(60 * k + 30)), cy + r * math.sin(math.radians(60 * k + 30))) for k in range(6)]

    bodies = [shapes.prism(hexagon(radius, cx, cy), h) for (cx, cy), h in zip(centres, heights)]
    pockets = []
    for (cx, cy), h in zip(centres, heights):
        pocket = shapes.prism(hexagon(radius - wall, cx, cy), h)
        pocket.apply_translation([0, 0, 3])                        # 3 mm floor
        pockets.append(pocket)
    return shapes.grounded(shapes.difference(shapes.union(*bodies), shapes.union(*pockets)))


# ----------------------------------------------------------------- Jewelry

def _pendant() -> trimesh.Trimesh:
    gem = shapes.lathe([(0, 0), (17.5, 0), (17.5, 3), (11, 9), (0, 9)], sections=8)
    lug = trimesh.creation.box((11, 8, 3))
    lug.apply_translation([20.5, 0, 1.5])
    hole = trimesh.creation.cylinder(radius=1.6, height=12, sections=24)
    hole.apply_translation([21, 0, 1.5])
    return shapes.grounded(shapes.difference(shapes.union(gem, lug), hole))


# ------------------------------------------------------------------ Tabletop

def _dice_tower() -> trimesh.Trimesh:
    def slab(length, width, angle_deg, y, z):
        ramp = trimesh.creation.box((width, length, 3))
        ramp.apply_transform(trimesh.transformations.rotation_matrix(math.radians(angle_deg), [1, 0, 0]))
        ramp.apply_translation([0, y, z])
        return ramp

    outer = trimesh.creation.box((80, 80, 160)).apply_translation([0, 0, 80])
    cavity = trimesh.creation.box((68, 68, 160)).apply_translation([0, 0, 85])        # open top, 5 mm floor
    shell = shapes.difference(outer, cavity)
    # Three baffles lean 46-50 degrees, steep enough to print without supports.
    ramps = [slab(52, 72, 50, 16.3, 115), slab(52, 72, -50, -16.3, 80), slab(95, 72, 46, 0, 41)]
    tower = shapes.union(shell, *ramps)
    window = trimesh.creation.box((40, 8, 32)).apply_translation([0, -37, 21])
    tower = shapes.difference(tower, window)
    tray = trimesh.creation.box((80, 40, 5)).apply_translation([0, -60, 2.5])
    lip = trimesh.creation.box((80, 3, 10)).apply_translation([0, -78.5, 5])
    return shapes.grounded(shapes.union(tower, tray, lip))


def _tile() -> trimesh.Trimesh:
    tile = trimesh.creation.box((50, 50, 8)).apply_translation([0, 0, 4])
    tab_x = shapes.prism([(25, -3), (30, -5), (30, 5), (25, 3)], 8)
    tab_y = shapes.prism([(-3, 25), (-5, 30), (5, 30), (3, 25)], 8)
    slot_x = shapes.prism([(-25.5, -3.3), (-20, -5.3), (-20, 5.3), (-25.5, 3.3)], 8)   # 0.3 mm clearance
    slot_y = shapes.prism([(-3.3, -25.5), (-5.3, -20), (5.3, -20), (3.3, -25.5)], 8)
    grooves = [trimesh.creation.box((50, 0.8, 1.6)).apply_translation([0, 0, 8]),
               trimesh.creation.box((0.8, 50, 1.6)).apply_translation([0, 0, 8])]
    return shapes.difference(shapes.union(tile, tab_x, tab_y), slot_x, slot_y, *grooves)


def _tiles() -> trimesh.Trimesh:
    tiles = []
    for x, y in ((0, 0), (70, 0), (0, 70), (70, 70)):
        tile = _tile().copy()
        tile.apply_translation([x, y, 0])
        tiles.append(tile)
    return shapes.grounded(trimesh.util.concatenate(tiles))


# ------------------------------------------------------------------ Cosplay

def _armour() -> trimesh.Trimesh:
    def arc_band(radius, thickness, half_angle_deg):
        steps = 48
        angles = [math.radians(90 - half_angle_deg + 2 * half_angle_deg * k / steps) for k in range(steps + 1)]
        outer = [(radius * math.cos(a), radius * math.sin(a)) for a in angles]
        inner = [((radius - thickness) * math.cos(a), (radius - thickness) * math.sin(a)) for a in reversed(angles)]
        return Polygon(outer + inner)

    band = arc_band(110, 3.5, 50)
    plates = []
    for k in range(3):
        plate = shapes.extrude_xz(band, depth=50)
        plate.apply_translation([0, (k - 1) * 32, 3 * k])
        plates.append(plate)
    body = shapes.union(*plates)
    slots = []
    for sign in (-1, 1):
        slot = trimesh.creation.box((6, 18, 40))
        slot.apply_translation([sign * 60, 0, 90])
        slots.append(slot)
    return shapes.grounded(shapes.difference(body, *slots))


# --------------------------------------------------------------- Miniatures

def _piece_profile(points, ball=None):
    """Outer profile (radius, z) from the axis up to the top. `ball` = (centre_z, radius, neck_radius)."""
    pts = list(points)
    if ball:
        cz, r, neck = ball
        start = math.degrees(math.asin(neck / r))
        for k in range(17):
            beta = math.radians(start + (180 - start) * k / 16)
            pts.append((r * math.sin(beta), cz - r * math.cos(beta)))
    return pts


def _chess() -> trimesh.Trimesh:
    base = [(0, 0), (14, 0), (14, 4), (12, 6), (8, 9)]
    pawn = shapes.lathe(_piece_profile(base + [(5.5, 26), (9, 28), (9, 30.5), (5, 32), (5, 34)], ball=(41, 8, 5)), sections=48)

    rook_profile = base + [(10, 38), (13, 42), (13, 55), (0, 55)]
    rook = shapes.lathe(rook_profile, sections=48)
    notches = [trimesh.creation.box((34, 8, 12)).apply_translation([0, 0, 55]),
               trimesh.creation.box((8, 34, 12)).apply_translation([0, 0, 55])]
    rook = shapes.difference(rook, *notches)

    bishop_profile = _piece_profile(base + [(5.5, 30), (9, 33), (9, 35.5), (6, 37), (8, 44), (6, 55), (2.5, 60)], ball=None)
    bishop_profile += [(0, 61)]
    bishop = shapes.lathe(bishop_profile, sections=48)
    ball = trimesh.creation.icosphere(subdivisions=2, radius=3.5).apply_translation([0, 0, 63.5])
    slit = trimesh.creation.box((24, 1.6, 9))
    slit.apply_transform(trimesh.transformations.rotation_matrix(math.radians(40), [0, 1, 0]))
    slit.apply_translation([0, 0, 50])
    bishop = shapes.difference(shapes.union(bishop, ball), slit)

    parts = []
    for x, piece in ((-40, pawn), (0, rook), (40, bishop)):
        moved = piece.copy()
        moved.apply_translation([x, 0, 0])
        parts.append(moved)
    return shapes.grounded(trimesh.util.concatenate(parts))


SPECS = [
    ProductSpec("angled-phone-stand", "Angled phone stand", "Gadgets",
                "A desk stand that holds a phone upright at a fixed, comfortable viewing angle, with a front lip and a slot for a charging cable.",
                ("phone", "stand", "desk", "gadget"), 149, 499, True, _phone_stand),
    ProductSpec("cable-clip-set", "Cable clip set (4)", "Gadgets",
                "Four snap-in clips that hold a cable up to about 6 mm thick, with a flat pad for gluing or taping to a desk or wall.",
                ("cable", "organiser", "clips", "gadget"), 99, 299, False, _cable_clips),
    ProductSpec("hexagon-keyring-tag", "Hexagon keyring tag", "Gadgets",
                "A flat hexagon tag with a hole for a key ring and a shallow recess on the face for a label or paint.",
                ("keyring", "tag", "hexagon", "gadget"), 79, 249, False, _hexagon_tag),
    ProductSpec("interlocking-chain-fidget", "Interlocking chain fidget", "Gadgets",
                "A chain of six links printed already joined, to fidget with or hang on a bag. Each link moves freely with about 0.8 mm of clearance between neighbours.",
                ("chain", "fidget", "print-in-place", "toy"), 199, 699, False, _chain),
    ProductSpec("faceted-geometric-planter", "Faceted geometric planter", "Home Decor",
                "A low-poly eight-sided planter with 3 mm walls and a drainage hole in the base, for a small succulent or herb.",
                ("planter", "geometric", "low-poly", "home"), 199, 799, True, _planter),
    ProductSpec("ribbed-table-vase", "Ribbed table vase", "Home Decor",
                "A rounded table vase with fine horizontal ribs and a 2.4 mm wall. Sealed at the base; use it for dried stems or a glass liner.",
                ("vase", "ribbed", "table", "home"), 199, 899, False, _vase),
    ProductSpec("hex-cell-desk-organiser", "Hex-cell desk organiser", "Home Decor",
                "A honeycomb organiser of seven hexagonal cells in different depths for pens, scissors, rulers and small tools.",
                ("organiser", "desk", "hexagon", "home"), 249, 999, False, _organiser),
    ProductSpec("geometric-pendant", "Geometric pendant", "Jewelry",
                "A faceted eight-sided pendant with a flat back and a hole in the side lug for a cord or chain.",
                ("pendant", "geometric", "jewelry", "faceted"), 149, 599, False, _pendant),
    ProductSpec("dice-tower", "Dice tower", "Tabletop",
                "A square dice tower with three internal baffles, an open top and a front exit window onto a tray with a rim.",
                ("dice", "tower", "tabletop", "rpg"), 249, 1199, True, _dice_tower),
    ProductSpec("modular-dungeon-tile-set", "Modular dungeon tile set", "Tabletop",
                "Four 50 mm floor tiles with dovetail edges that lock into one another, for building dungeon rooms of any shape. A fine cross groove marks the centre of each tile.",
                ("tiles", "dungeon", "modular", "tabletop"), 299, 1299, False, _tiles),
    ProductSpec("layered-shoulder-armour-plate", "Layered shoulder armour plate", "Cosplay",
                "A curved shoulder plate built from three overlapping layers, with a strap slot on each side. Print it in sections or in one piece on a large bed.",
                ("armour", "cosplay", "shoulder", "costume"), 299, 1499, False, _armour),
    ProductSpec("chess-style-piece-set", "Chess-style piece set", "Miniatures",
                "Three chess-style pieces on matching round bases: a pawn, a rook with battlements and a bishop with a slit mitre.",
                ("chess", "miniature", "pieces", "tabletop"), 249, 999, True, _chess),
]
