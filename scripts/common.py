"""Shared paths and raster helpers for the data build."""
import os

import numpy as np
import shapefile
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "raw")
OUT = os.path.join(ROOT, "public", "data")
MODEL = os.path.join(RAW, "model", "Muller_etal_2019_PlateMotionModel_v2.0_Tectonics_Updated")
ROT_FILE = os.path.join(MODEL, "SimplifiedFiles", "Muller_etal_2019_CombinedRotations.rot")
STATIC_POLYS = os.path.join(MODEL, "StaticGeometries", "StaticPolygons",
                            "Global_EarthByte_GPlates_PresentDay_StaticPlatePolygons_2019_v1")

os.makedirs(OUT, exist_ok=True)


def grid_lonlat(w, h):
    """Pixel-centre lon/lat (degrees) of an equirectangular grid, row 0 = north."""
    lon = -180.0 + (np.arange(w) + 0.5) * 360.0 / w
    lat = 90.0 - (np.arange(h) + 0.5) * 180.0 / h
    return np.meshgrid(lon, lat)


def load_polygons():
    r = shapefile.Reader(STATIC_POLYS)
    polys = []
    for shp, rec in zip(r.shapes(), r.records()):
        parts = list(shp.parts) + [len(shp.points)]
        rings = [np.array(shp.points[parts[i]:parts[i + 1]]) for i in range(len(parts) - 1)]
        polys.append(dict(plate=int(rec["PLATEID1"]), fromage=float(rec["FROMAGE"]),
                          type=rec["TYPE"], name=rec["NAME"], rings=rings))
    return polys


def _unwrap_ring(ring):
    """Make a ring's longitudes continuous (removes ±360 jumps across the dateline)."""
    lon = ring[:, 0].copy()
    d = np.diff(lon)
    jumps = np.concatenate([[0], np.cumsum(np.where(d > 180, -360, np.where(d < -180, 360, 0)))])
    return np.stack([lon + jumps, ring[:, 1]], axis=1)


def rasterize_polygons(polys, w, h, values):
    """Rasterise polygons into an int32 equirectangular grid (0 = empty).

    Later polygons overwrite earlier ones. Rings crossing the dateline are
    unwrapped and drawn three times (shifted by -360/0/+360)."""
    img = Image.new("I", (w, h), 0)
    draw = ImageDraw.Draw(img)
    for poly, val in zip(polys, values):
        fill = int(val)
        for ring in poly["rings"]:
            ring = _unwrap_ring(ring)
            for shift in (-360.0, 0.0, 360.0):
                xs = (ring[:, 0] + shift + 180.0) / 360.0 * w - 0.5
                if xs.max() < -1 or xs.min() > w:
                    continue
                ys = (90.0 - ring[:, 1]) / 180.0 * h - 0.5
                draw.polygon(list(zip(xs.tolist(), ys.tolist())), fill=fill)
    return np.array(img, dtype=np.int32)


def polygon_on_grid(points, w, h, blur_px=0.0):
    """Rasterise one lon/lat polygon to a float mask in [0,1] (optionally blurred)."""
    from scipy.ndimage import gaussian_filter
    img = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(img)
    pts = np.array(points, dtype=float)
    xs = (pts[:, 0] + 180.0) / 360.0 * w - 0.5
    ys = (90.0 - pts[:, 1]) / 180.0 * h - 0.5
    draw.polygon(list(zip(xs.tolist(), ys.tolist())), fill=255)
    m = np.array(img, dtype=np.float32) / 255.0
    if blur_px > 0:
        m = gaussian_filter(m, blur_px, mode=("nearest", "wrap"))
    return m
