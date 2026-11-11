"""Small, deterministic mesh-building helpers (millimetres, Z up)."""
import numpy as np
import trimesh
from shapely.geometry import Polygon

ENGINE = "manifold"


def lathe(profile_xz, sections: int = 48) -> trimesh.Trimesh:
    """Revolve a closed (radius, z) profile around the Z axis."""
    mesh = trimesh.creation.revolve(np.asarray(profile_xz, dtype=float), sections=sections)
    mesh.fix_normals()
    return mesh


def prism(polygon_xy, height: float) -> trimesh.Trimesh:
    """Extrude a polygon (list of (x, y)) from z=0 to z=height."""
    return trimesh.creation.extrude_polygon(Polygon(polygon_xy), height)


def union(*meshes) -> trimesh.Trimesh:
    return trimesh.boolean.union(list(meshes), engine=ENGINE)


def difference(a: trimesh.Trimesh, *others) -> trimesh.Trimesh:
    return trimesh.boolean.difference([a, *others], engine=ENGINE)


def grounded(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Copy centred on X/Y with its lowest point on z=0."""
    out = mesh.copy()
    lo, hi = out.bounds
    out.apply_translation([-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]])
    return out


def _geom(shape) -> Polygon:
    return shape if hasattr(shape, "exterior") else Polygon(shape)


def _oriented(mesh: trimesh.Trimesh, order) -> trimesh.Trimesh:
    """Reorder axes; an odd permutation mirrors the mesh, so restore the winding."""
    out = trimesh.Trimesh(vertices=mesh.vertices[:, order], faces=mesh.faces, process=True)
    if out.volume < 0:
        out.invert()
    return out


def extrude_xz(shape, depth: float) -> trimesh.Trimesh:
    """Profile drawn in (x, z); extruded along Y, centred on Y."""
    mesh = trimesh.creation.extrude_polygon(_geom(shape), depth)   # (u, v, w)
    out = _oriented(mesh, [0, 2, 1])                                # X=u, Y=w, Z=v
    out.apply_translation([0, -depth / 2, 0])
    return out


def extrude_yz(shape, width: float) -> trimesh.Trimesh:
    """Profile drawn in (y, z); extruded along X, centred on X."""
    mesh = trimesh.creation.extrude_polygon(_geom(shape), width)   # (u, v, w)
    out = _oriented(mesh, [2, 0, 1])                                # X=w, Y=u, Z=v
    out.apply_translation([-width / 2, 0, 0])
    return out
