"""
Build every data asset the web app needs (written to public/data/).

  rotations.bin    Float32 [T][P][4]  absolute plate quaternions (w,x,y,z), 0..250 Ma every 0.5 Myr
  cells.bin        Uint32  cell * 512 + plate for every (mesh cell, plate) pair (boundary cells appear once per plate)
  plateid.png      RGB8    plate column index per pixel (R = low byte, G = high byte), exact plate boundaries
  elevation.bin    Float16 [EH][EW]   present-day relief incl. bathymetry (m), ETOPO1
  crust.png        RGB8    R: crust birth age (Ma, 255 = older than the model)
                           G: continental crust flag   B: young-orogen onset age (Ma)
  surface.png      RGB8    R: inland water (lakes)  G: permanent ice  B: old (Pangean) orogen weight
  tect.png         RGB8    R: young-orogen weight   G: young-orogen residual height (m / 25)
  albedo.jpg       RGB     NASA Blue Marble (June 2004), water pixels in-painted with neighbouring land colour
  lights.jpg       L       NASA Black Marble 2016 city lights
  meta.json        dimensions, plate ids, labels

Run:  .venv/bin/python scripts/build_data.py
"""
import json
import os
import time

import netCDF4
import numpy as np
from PIL import Image
from scipy import ndimage

from common import OUT, RAW, ROT_FILE, grid_lonlat, load_polygons, polygon_on_grid, rasterize_polygons
from regions import OLD_OROGENS, YOUNG_OROGENS
from rotations import RotationModel, qmul

Image.MAX_IMAGE_PIXELS = None

T_MAX, T_STEP = 250.0, 0.5
MESH_W, MESH_H = 1024, 512          # plate mesh (cell) resolution; must divide AUX
ELEV_W, ELEV_H = 6144, 3072         # elevation texture
AUX_W, AUX_H = 4096, 2048           # crust / surface textures
PID_W, PID_H = 8192, 4096           # plate-id raster (exact boundaries)
ALB_W, ALB_H = 8192, 4096           # albedo texture

LABELS = [
    # id (translated in src/i18n.js), lat, lon, kind, [min_age, max_age]
    ("na", 45, -100, "continent", [0, 250]),
    ("sa", -12, -58, "continent", [0, 250]),
    ("af", 5, 20, "continent", [0, 250]),
    ("eu", 51, 15, "continent", [0, 250]),
    ("as", 55, 95, "continent", [0, 250]),
    ("in", 21, 78, "continent", [0, 250]),
    ("au", -25, 134, "continent", [0, 250]),
    ("an", -80, 40, "continent", [0, 250]),
    ("gl", 73, -41, "region", [0, 250]),
    ("ar", 23, 45, "region", [0, 250]),
    ("mg", -19.5, 46.6, "region", [0, 250]),
    ("zl", -43, 171, "region", [0, 250]),
]


def log(msg, t0=[time.time()]):
    print(f"[{time.time() - t0[0]:6.1f}s] {msg}", flush=True)


# --------------------------------------------------------------------------- plates
def build_plates():
    polys = load_polygons()
    plate_ids = sorted({p["plate"] for p in polys})
    col = {pid: i for i, pid in enumerate(plate_ids)}
    P = len(plate_ids)
    log(f"{len(polys)} static polygons, {P} plates")

    # High-resolution plate raster: defines the exact plate boundaries (per-fragment test).
    hi_idx = rasterize_polygons(polys, PID_W, PID_H, [i + 1 for i in range(len(polys))])
    if (hi_idx == 0).any():
        _, (ri, ci) = ndimage.distance_transform_edt(hi_idx == 0, return_indices=True)
        hi_idx = hi_idx[ri, ci]
    poly_col = np.array([col[p["plate"]] for p in polys], dtype=np.int32)
    plate_hi = poly_col[hi_idx - 1]
    del hi_idx
    aux_idx = rasterize_polygons(polys, AUX_W, AUX_H, [i + 1 for i in range(len(polys))])
    if (aux_idx == 0).any():
        _, (ri, ci) = ndimage.distance_transform_edt(aux_idx == 0, return_indices=True)
        aux_idx = aux_idx[ri, ci]
    Image.fromarray(np.stack([(plate_hi & 255), (plate_hi >> 8), np.zeros_like(plate_hi)], -1).astype(np.uint8), "RGB") \
        .save(os.path.join(OUT, "plateid.png"), optimize=True)

    # Coarse mesh cells: every plate present in a cell (dilated by one hi-res pixel)
    # gets that cell in its mesh; the fragment shader keeps only its own pixels.
    f = PID_W // MESH_W
    assert f * MESH_W == PID_W and f * MESH_H == PID_H
    rows = np.arange(MESH_H) * f
    cols = np.arange(MESH_W) * f
    cell = (np.arange(MESH_H)[:, None] * MESH_W + np.arange(MESH_W)[None, :]).astype(np.int32)
    pairs = np.zeros(0, np.int32)
    for dy in range(-1, f + 1):
        r = np.clip(rows + dy, 0, PID_H - 1)
        keys = [(cell * 512 + plate_hi[r][:, (cols + dx) % PID_W]).ravel() for dx in range(-1, f + 1)]
        pairs = np.unique(np.concatenate([pairs] + keys))
    pairs = pairs.astype(np.uint32)
    pairs.tofile(os.path.join(OUT, "cells.bin"))
    log(f"mesh cells: {MESH_W}x{MESH_H}, cell/plate pairs: {len(pairs)}")

    # absolute rotations table
    rm = RotationModel(ROT_FILE)
    times = np.arange(0.0, T_MAX + 1e-9, T_STEP)
    table = np.zeros((len(times), P, 4), np.float32)
    for j, pid in enumerate(plate_ids):
        prev = None
        # A few plates carry a small non-zero rotation at 0 Ma in the model; express all motion
        # relative to the present-day position so that the last frame is exactly today's Earth.
        q0 = rm.absolute(pid, 0.0)
        q0_inv = np.array([q0[0], -q0[1], -q0[2], -q0[3]])
        for i, t in enumerate(times):
            q = qmul(rm.absolute(pid, float(t)), q0_inv)
            q = q / np.linalg.norm(q)
            if prev is not None and np.dot(q, prev) < 0:
                q = -q
            table[i, j] = q
            prev = q
    table.tofile(os.path.join(OUT, "rotations.bin"))
    log(f"rotations: {table.shape}")

    # per-pixel polygon birth age on the aux grid
    fromage = np.array([min(p["fromage"], 255.0) if p["fromage"] > 0 else 255.0 for p in polys], np.float32)
    poly_birth = fromage[aux_idx - 1]
    aux_plate = np.array([p["plate"] for p in polys])[aux_idx - 1]
    return plate_ids, col, poly_birth, aux_plate


# --------------------------------------------------------------------------- elevation
def resample_nodes(src, w, h, sigma):
    """Resample a node-registered global grid (south-up, lon -180..180) to pixel centres (north-up)."""
    src = ndimage.gaussian_filter(src.astype(np.float32), sigma, mode=("nearest", "wrap"))
    ny, nx = src.shape
    lon, lat = grid_lonlat(w, h)
    rows = (lat + 90.0) / 180.0 * (ny - 1)
    cols = (lon + 180.0) / 360.0 * (nx - 1)
    return ndimage.map_coordinates(src, [rows, cols], order=1, mode="nearest")


def build_elevation():
    z = netCDF4.Dataset(os.path.join(RAW, "etopo.nc")).variables["altitude"][:]
    z = np.asarray(z, dtype=np.float32)
    ratio = (z.shape[1] - 1) / ELEV_W
    elev = resample_nodes(z, ELEV_W, ELEV_H, sigma=0.45 * ratio)
    log(f"elevation resampled {elev.shape}, range {elev.min():.0f}..{elev.max():.0f}")
    return elev


# --------------------------------------------------------------------------- albedo, masks
def push_pull_fill(img, w):
    """Fill pixels with weight 0 by a smooth multi-resolution (push-pull) interpolation."""
    levels = []
    cur_c, cur_w = img * w[..., None], w
    while min(cur_w.shape) > 4:
        levels.append((cur_c, cur_w))
        h2, w2 = cur_w.shape[0] // 2, cur_w.shape[1] // 2
        cur_c = cur_c[:h2 * 2, :w2 * 2].reshape(h2, 2, w2, 2, 3).sum((1, 3))
        cur_w = cur_w[:h2 * 2, :w2 * 2].reshape(h2, 2, w2, 2).sum((1, 3))
    col = cur_c / np.maximum(cur_w, 1e-6)[..., None]
    for c, wt in reversed(levels):
        up = np.array([ndimage.zoom(col[..., k], (c.shape[0] / col.shape[0], c.shape[1] / col.shape[1]), order=1)
                       for k in range(3)]).transpose(1, 2, 0)
        a = np.clip(wt, 0, 1)[..., None]
        own = c / np.maximum(wt, 1e-6)[..., None]
        col = own * a + up * (1 - a)
    return col


def bm_water(rgb):
    r, g, b = rgb[..., 0].astype(np.int16), rgb[..., 1].astype(np.int16), rgb[..., 2].astype(np.int16)
    deep = (r < 40) & (g < 50) & (b > r + 6) & (b < 110)
    very_dark = (r + g + b) < 45
    shallow = (b > r + 30) & (g > r + 15) & (r < 110)  # turquoise banks (Bahamas, reefs)
    return deep | very_dark | shallow


def build_albedo(elev_full):
    bm = Image.open(os.path.join(RAW, "bm_june_21600.jpg"))
    bm = bm.resize((ALB_W, ALB_H), Image.LANCZOS)
    rgb = np.array(bm)
    water = bm_water(rgb)
    water = ndimage.binary_dilation(water, iterations=2)  # swallow dark coastal fringe
    log(f"albedo: water fraction {water.mean():.3f}")

    # In-paint water with a smooth push-pull fill of the surrounding land colour.
    filled_up = push_pull_fill(rgb.astype(np.float32), (~water).astype(np.float32))
    soft = ndimage.gaussian_filter(water.astype(np.float32), 1.0)[..., None]
    out = rgb * (1 - soft) + filled_up * soft
    Image.fromarray(out.clip(0, 255).astype(np.uint8)).save(os.path.join(OUT, "albedo.jpg"), quality=90, optimize=True)
    log("albedo.jpg written")

    # water/ice masks on the aux grid
    aux_rgb = np.array(Image.fromarray(rgb).resize((AUX_W, AUX_H), Image.BILINEAR)).astype(np.float32)
    aux_water = np.array(Image.fromarray((water * 255).astype(np.uint8)).resize((AUX_W, AUX_H), Image.BILINEAR)) / 255.0
    mx, mn = aux_rgb.max(-1), aux_rgb.min(-1)
    whiteness = np.clip((mn - 150) / 70.0, 0, 1) * np.clip(1 - (mx - mn) / 60.0, 0, 1)
    return aux_water, whiteness


def main():
    plate_ids, col, poly_birth, aux_plate = build_plates()
    lon, lat = grid_lonlat(AUX_W, AUX_H)

    # ---- elevation
    elev = build_elevation()
    elev_aux = np.array(Image.fromarray(elev).resize((AUX_W, AUX_H), Image.BILINEAR))

    # ---- albedo + BM-derived masks
    aux_water, whiteness = build_albedo(elev)

    # ---- inland depressions: below sea level but not connected to the world ocean
    below = elev_aux < 0
    lab, n = ndimage.label(below, structure=np.ones((3, 3)))
    sizes = ndimage.sum(below, lab, index=np.arange(1, n + 1))
    ocean_labels = np.where(sizes > 200_000)[0] + 1
    ocean = np.isin(lab, ocean_labels)
    # wrap-around connectivity across the dateline
    wrap = set(lab[:, 0][ocean[:, 0]]) & set(lab[:, -1][ocean[:, -1]]) if ocean[:, 0].any() else set()
    inland_below = below & ~ocean
    lake = ((aux_water > 0.5) & ((elev_aux >= 0) | inland_below)).astype(np.float32)
    # depressions that are dry land today (Qattara, Afar, Death Valley...) are lifted to +2 m
    dry_depr = inland_below & (aux_water < 0.5)
    log(f"lakes px: {int(lake.sum())}, dry depressions px: {int(dry_depr.sum())}, ocean comps {len(ocean_labels)} {len(wrap)}")
    if dry_depr.any():
        dd = np.array(Image.fromarray(dry_depr.astype(np.uint8) * 255).resize((ELEV_W, ELEV_H), Image.NEAREST)) > 127
        elev[dd] = np.maximum(elev[dd], 2.0)
    elev.astype(np.float16).tofile(os.path.join(OUT, "elevation.bin"))
    log("elevation.bin written")

    # ---- permanent ice: bright white on land, at high latitude or high altitude
    ice = whiteness * (elev_aux > -50) * np.clip(np.maximum((np.abs(lat) - 55) / 8.0, (elev_aux - 3500) / 1000.0), 0, 1)
    ice = ndimage.gaussian_filter(ice, 1.0)

    # ---- crust birth age: ocean age-grid where available, polygon valid-time otherwise
    ag = netCDF4.Dataset(os.path.join(RAW, "agegrid.nc")).variables["z"][:]
    agv = np.ma.filled(ag, np.nan).astype(np.float32)
    valid = np.isfinite(agv)
    _, (ri, ci) = ndimage.distance_transform_edt(~valid, return_indices=True)
    ag_filled = agv[ri, ci]
    ny, nx = agv.shape
    rows = (lat + 90.0) / 180.0 * (ny - 1)
    cols = (lon + 180.0) / 360.0 * (nx - 1)
    age = ndimage.map_coordinates(ag_filled, [rows, cols], order=1, mode="nearest")
    oceanic = ndimage.map_coordinates(valid.astype(np.float32), [rows, cols], order=1, mode="nearest") > 0.5
    birth = np.where(oceanic, np.minimum(age, poly_birth), poly_birth)
    birth = np.clip(birth, 0, 255)
    continental = (~oceanic).astype(np.float32)
    log(f"oceanic fraction {oceanic.mean():.3f}")

    # ---- orogen regions
    onset = np.zeros((AUX_H, AUX_W), np.float32)
    weight = np.zeros_like(onset)
    residual = np.zeros_like(onset)
    for name, on, res, pts in YOUNG_OROGENS:
        m = polygon_on_grid(pts, AUX_W, AUX_H, blur_px=5.0)
        take = m > weight
        onset = np.where(take, on, onset)
        residual = np.where(take, res, residual)
        weight = np.maximum(weight, m)
    old = np.zeros_like(onset)
    for name, w, pts in OLD_OROGENS:
        old = np.maximum(old, w * polygon_on_grid(pts, AUX_W, AUX_H, blur_px=10.0))

    def u8(a):
        return np.clip(np.round(a), 0, 255).astype(np.uint8)

    # RGB only: browsers may premultiply alpha, which would corrupt data channels.
    crust = np.stack([u8(birth), u8(continental * 255), u8(onset)], -1)
    Image.fromarray(crust, "RGB").save(os.path.join(OUT, "crust.png"), optimize=True)
    surface = np.stack([u8(lake * 255), u8(ice * 255), u8(old * 255)], -1)
    Image.fromarray(surface, "RGB").save(os.path.join(OUT, "surface.png"), optimize=True)
    tect = np.stack([u8(weight * 255), u8(residual / 25.0), np.zeros_like(u8(weight))], -1)
    Image.fromarray(tect, "RGB").save(os.path.join(OUT, "tect.png"), optimize=True)
    log("crust.png, surface.png, tect.png written")

    # ---- night lights
    bl = Image.open(os.path.join(RAW, "black_marble.jpg")).convert("L").resize((AUX_W, AUX_H), Image.LANCZOS)
    bl.save(os.path.join(OUT, "lights.jpg"), quality=88)

    # ---- labels: attach each anchor to the plate beneath it
    labels = []
    for lid, la, lo, kind, span in LABELS:
        r = int((90 - la) / 180 * AUX_H)
        c = int((lo + 180) / 360 * AUX_W)
        labels.append(dict(id=lid, lat=la, lon=lo, kind=kind, span=span, plate=int(col[int(aux_plate[r, c])])))

    meta = dict(
        source="Müller et al. (2019) Tectonics plate model v2.0; ETOPO1; NASA Blue/Black Marble; Müller 2019 age grid",
        tMax=T_MAX, tStep=T_STEP, times=int(round(T_MAX / T_STEP)) + 1, plates=len(plate_ids), plateIds=plate_ids,
        mesh=[MESH_W, MESH_H], elevation=[ELEV_W, ELEV_H], aux=[AUX_W, AUX_H], albedo=[ALB_W, ALB_H], labels=labels,
    )
    with open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=1)
    log("done")


if __name__ == "__main__":
    main()
