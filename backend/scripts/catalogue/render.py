"""Render a mesh to a PNG with a tiny z-buffer rasteriser (numpy + Pillow).

Deterministic and dependency-light: orthographic camera, flat shading, one key
light plus ambient, soft ground shadow, 2x supersampling for clean edges.
"""
import math

import numpy as np
import trimesh
from PIL import Image

SIZE = (1200, 900)
SUPERSAMPLE = 2
PLASTIC = np.array([118, 130, 158], dtype=float)
LIGHT = np.array([-0.45, -0.55, 0.70])      # in view space: x right, y toward viewer's far side, z up
AZIMUTH_DEG, ELEVATION_DEG = -38.0, 27.0


def _view_matrix() -> np.ndarray:
    az, el = math.radians(AZIMUTH_DEG), math.radians(ELEVATION_DEG)
    rz = np.array([[math.cos(az), -math.sin(az), 0], [math.sin(az), math.cos(az), 0], [0, 0, 1]])
    rx = np.array([[1, 0, 0], [0, math.cos(el), -math.sin(el)], [0, math.sin(el), math.cos(el)]])
    return rx @ rz


def _background(width: int, height: int) -> np.ndarray:
    top, bottom = np.array([240, 242, 246], float), np.array([220, 225, 233], float)
    t = np.linspace(0, 1, height)[:, None, None]
    return np.broadcast_to(top * (1 - t) + bottom * t, (height, width, 3)).copy()


def render_png(mesh: trimesh.Trimesh, path: str) -> None:
    width, height = SIZE[0] * SUPERSAMPLE, SIZE[1] * SUPERSAMPLE
    view = _view_matrix()
    centred = mesh.vertices - mesh.bounds.mean(axis=0)
    cam = centred @ view.T                       # view space; x right, z up, y = depth (away from viewer)
    scale = 0.74 * min(width, height) / max(np.ptp(cam[:, 0]) * 1.0, np.ptp(cam[:, 2]) * 1.05, 1e-6)
    cx = width / 2 - scale * (cam[:, 0].min() + cam[:, 0].max()) / 2
    cy = height / 2 + scale * (cam[:, 2].min() + cam[:, 2].max()) / 2 - 0.02 * height
    sx = cx + scale * cam[:, 0]
    sy = cy - scale * cam[:, 2]
    depth = cam[:, 1]

    image = _background(width, height)

    # Soft ground shadow under the model's footprint.
    foot_x = cx + scale * (cam[:, 0].min() + cam[:, 0].max()) / 2
    foot_y = cy - scale * cam[:, 2].min() + 0.01 * height
    rx_, ry_ = 0.5 * scale * np.ptp(cam[:, 0]) * 0.95, 0.5 * scale * np.ptp(cam[:, 0]) * 0.16
    yy, xx = np.mgrid[0:height, 0:width]
    falloff = np.clip(1 - (((xx - foot_x) / max(rx_, 1)) ** 2 + ((yy - foot_y) / max(ry_, 1)) ** 2), 0, 1)
    image *= (1 - 0.22 * falloff ** 1.5)[:, :, None]

    normals = mesh.face_normals @ view.T
    light = LIGHT / np.linalg.norm(LIGHT)
    shade = 0.30 + 0.70 * np.clip(normals @ light, 0, 1)
    shade = shade + 0.10 * np.clip(normals[:, 2], 0, 1)        # sky light from above
    colours = np.clip(PLASTIC[None, :] * shade[:, None], 0, 255)

    zbuf = np.full((height, width), np.inf)
    tris = mesh.faces
    for fi in range(len(tris)):
        a, b, c = tris[fi]
        x0, y0, x1, y1, x2, y2 = sx[a], sy[a], sx[b], sy[b], sx[c], sy[c]
        min_x, max_x = int(max(math.floor(min(x0, x1, x2)), 0)), int(min(math.ceil(max(x0, x1, x2)), width - 1))
        min_y, max_y = int(max(math.floor(min(y0, y1, y2)), 0)), int(min(math.ceil(max(y0, y1, y2)), height - 1))
        if min_x > max_x or min_y > max_y:
            continue
        den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(den) < 1e-9:
            continue
        px = np.arange(min_x, max_x + 1)[None, :] + 0.5
        py = np.arange(min_y, max_y + 1)[:, None] + 0.5
        w0 = ((y1 - y2) * (px - x2) + (x2 - x1) * (py - y2)) / den
        w1 = ((y2 - y0) * (px - x2) + (x0 - x2) * (py - y2)) / den
        w2 = 1 - w0 - w1
        inside = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not inside.any():
            continue
        z = w0 * depth[a] + w1 * depth[b] + w2 * depth[c]
        window = zbuf[min_y:max_y + 1, min_x:max_x + 1]
        win_img = image[min_y:max_y + 1, min_x:max_x + 1]
        closer = inside & (z < window)
        window[closer] = z[closer]
        win_img[closer] = colours[fi]

    # Edge-darkening for crisp silhouettes, then downsample.
    out = Image.fromarray(np.clip(image, 0, 255).astype(np.uint8), "RGB").resize(SIZE, Image.LANCZOS)
    out.save(path, format="PNG", optimize=False)
