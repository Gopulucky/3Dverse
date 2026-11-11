"""Measure a generated mesh and decide whether it is fit to list.

The supports label is computed from the mesh, so product copy cannot claim
"no supports" for a model that needs them. It deliberately differs from the
app's own check in `app/services/printability.py` (face count, bed faces
included): a flat bottom is not an overhang. The app's rule is mirrored in
`app_flags_overhang` so a listing cannot end up with a spurious "printability
warning" badge after the importer runs the real analyzer.
"""
from dataclasses import dataclass

import numpy as np
import trimesh

OVERHANG_NORMAL_Z = -0.707        # same 45 degree threshold the app uses
APP_OVERHANG_FACE_SHARE = 0.25    # app: more than 25% of faces
SUPPORT_AREA_SHARE = 0.05         # real overhang area worth supporting
BED_TOLERANCE_MM = 0.05
MIN_LARGEST_MM = 20.0     # something you can hold
MIN_THIN_MM = 1.2         # thinnest dimension still printable
MAX_EXTENT_MM = 220.0     # fits common bed sizes
MAX_FACES = 400_000


@dataclass(frozen=True)
class MeshReport:
    watertight: bool
    volume_mm3: float
    extents_mm: tuple
    faces: int
    overhang_ratio: float          # share of surface area that overhangs, bed contact excluded
    supports: str                  # "none" | "recommended"
    app_flags_overhang: bool       # would app/services/printability.py warn?


def measure(mesh: trimesh.Trimesh) -> MeshReport:
    normals = mesh.face_normals
    steep = normals[:, 2] < OVERHANG_NORMAL_Z
    app_flags = bool(steep.sum() > len(normals) * APP_OVERHANG_FACE_SHARE)

    bed_z = float(mesh.bounds[0][2])
    centroid_z = mesh.triangles_center[:, 2]
    off_bed = centroid_z > bed_z + BED_TOLERANCE_MM
    area = mesh.area_faces
    total = float(area.sum()) or 1.0
    ratio = float(area[steep & off_bed].sum() / total)

    return MeshReport(
        watertight=bool(mesh.is_watertight),
        volume_mm3=abs(float(mesh.volume)),
        extents_mm=tuple(float(x) for x in mesh.extents),
        faces=int(len(mesh.faces)),
        overhang_ratio=ratio,
        supports="recommended" if ratio > SUPPORT_AREA_SHARE else "none",
        app_flags_overhang=app_flags,
    )


def problems(report: MeshReport) -> list:
    found = []
    if not report.watertight:
        found.append("mesh is not watertight")
    if report.volume_mm3 <= 0:
        found.append("volume is not positive")
    largest, thinnest = max(report.extents_mm), min(report.extents_mm)
    if largest < MIN_LARGEST_MM:
        found.append(f"largest extent {largest:.1f} mm is below {MIN_LARGEST_MM:.0f} mm")
    if largest > MAX_EXTENT_MM:
        found.append(f"largest extent {largest:.1f} mm exceeds {MAX_EXTENT_MM:.0f} mm")
    if thinnest < MIN_THIN_MM:
        found.append(f"thinnest extent {thinnest:.2f} mm is too thin (minimum {MIN_THIN_MM} mm)")
    if report.faces >= MAX_FACES:
        found.append(f"{report.faces} faces is too many (limit {MAX_FACES})")
    if report.app_flags_overhang and report.supports == "none":
        found.append("app analyzer would flag overhangs although nothing overhangs; coarsen the flat bottom")
    return found
