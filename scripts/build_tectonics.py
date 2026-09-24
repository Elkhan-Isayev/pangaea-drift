"""
Plate-boundary driven tectonics from the resolved topologies of Müller et al. (2019).

Needs pygplates (Python <= 3.13):
    python3.13 -m venv .venv-gplates && .venv-gplates/bin/pip install pygplates numpy scipy pillow
    .venv-gplates/bin/python scripts/build_tectonics.py

Outputs (public/data/):
  boundaries.bin   plate-boundary points for every 1 Myr snapshot 0..250 Ma (see BOUNDARY_DTYPE)
  boundaries.json  per-snapshot offsets/counts into boundaries.bin
  networks.bin     Uint8 [N_SLICES][NH][NW][2] in palaeo-coordinates (every NET_STEP Myr):
                     R = inside a deforming network (stretched / shortened continental crust)
                     G = 0.5 + shortening (> 0.5) or extension (< 0.5)
  orogeny.bin      Uint8 [T_SLICES][OH][OW][2] on the present-day grid:
                     R = fraction of today's mountain relief present at that time
                     G = extra relief (m / 20) of ranges that have since eroded away

Orogeny model: every continental grid cell is reconstructed to its palaeo-position;
convergent (subduction / collision) boundary points push up an "activity" field on
the overriding side (arc + back-arc plateau) and, weaker, on the subducting side.
Relief responds to activity with erosional decay (time constant TAU):
    H(t - 1) = H(t) * exp(-1 / TAU) + A(t)
so mountains rise while plates converge and wear down when convergence stops.
"""
import json
import math
import os
import time

import numpy as np
import pygplates
from PIL import Image
from scipy.spatial import cKDTree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "data")
SIMPLE = os.path.join(ROOT, "raw", "model", "Muller_etal_2019_PlateMotionModel_v2.0_Tectonics_Updated", "SimplifiedFiles")

R_EARTH = 6371.0
T_MAX = 250
SPACING_DEG = 1.0            # boundary sampling
OW, OH = 512, 256            # orogeny grid
SLICE_STEP = 10              # Myr between stored orogeny slices
TAU = 45.0                   # erosional decay time (Myr)
K_HEIGHT = 1.25              # metres of relief per (mm/yr * Myr) of activity
ALONG_SIGMA = 110.0          # km, along-strike smoothing of boundary samples
# Crustal shortening inside deforming networks (Tibet, Andes, Alps, ...): thickening of a
# ~35 km crust, of which ~1/6 shows as surface uplift (Airy isostasy) -> metres per unit strain.
STRAIN_UPLIFT = 8000.0

NW, NH = 360, 180            # deforming-network grid (palaeo-coordinates)
NET_STEP = 4                 # Myr between network slices

TYPE_SUBDUCTION, TYPE_RIDGE, TYPE_OTHER = 1, 2, 3

BOUNDARY_DTYPE = np.dtype([
    ("pos", "<i2", 3),       # unit position * 32767
    ("vel", "<i2", 3),       # boundary velocity, rad/Myr * 1e5 (xyz tangent vector)
    ("nrm", "i1", 3),        # unit normal * 127: towards the overriding plate (subduction) / left side
    ("rate", "u1"),          # convergence (subduction) or spreading (ridge) rate, mm/yr, clamped 0..255
    ("type", "u1"),
    ("pad", "u1", 3),
])


def log(msg, t0=[time.time()]):
    print(f"[{time.time() - t0[0]:6.1f}s] {msg}", flush=True)


def vec(v):
    return np.array([v.get_x(), v.get_y(), v.get_z()]) if v is not None else np.zeros(3)


def boundary_type(feature):
    ft = feature.get_feature_type()
    if ft == pygplates.FeatureType.gpml_subduction_zone:
        return TYPE_SUBDUCTION
    if ft == pygplates.FeatureType.gpml_mid_ocean_ridge:
        return TYPE_RIDGE
    return TYPE_OTHER


def snapshot_points(topologies, rotations, t, snap=None):
    snap = snap or pygplates.TopologicalSnapshot(topologies, rotations, float(t))
    stats = snap.calculate_plate_boundary_statistics(math.radians(SPACING_DEG))
    n = len(stats)
    pos = np.zeros((n, 3))
    vel = np.zeros((n, 3))
    nrm = np.zeros((n, 3))
    rate = np.zeros(n)
    typ = np.zeros(n, np.uint8)
    for i, s in enumerate(stats):
        f = s.boundary_feature
        k = boundary_type(f)
        pos[i] = s.boundary_point.to_xyz()
        vel[i] = vec(s.boundary_velocity) / R_EARTH  # km/Myr -> rad/Myr
        normal = vec(s.boundary_normal)
        normal /= max(np.linalg.norm(normal), 1e-9)
        if k == TYPE_SUBDUCTION:
            # the normal points to the left; polarity says on which side the overriding plate is
            if f.get_enumeration(pygplates.PropertyName.gpml_subduction_polarity, "Unknown") == "Right":
                normal = -normal
            rate[i] = max(s.convergence_velocity_signed_magnitude, 0.0)
        elif k == TYPE_RIDGE:
            rate[i] = max(-s.convergence_velocity_signed_magnitude, 0.0)
        nrm[i] = normal
        typ[i] = k
    # undefined velocities (plate missing on one side) -> no motion / no rate
    return pos, np.nan_to_num(vel), np.nan_to_num(nrm), np.nan_to_num(rate), typ


def quat_rotate(q, v):
    w, x, y, z = q[..., 0:1], q[..., 1:2], q[..., 2:3], q[..., 3:4]
    u = np.concatenate([x, y, z], -1)
    t = 2.0 * np.cross(u, v)
    return v + w * t + np.cross(u, t)


def main():
    meta = json.load(open(os.path.join(OUT, "meta.json")))
    rotations = pygplates.RotationModel(os.path.join(SIMPLE, "Muller_etal_2019_CombinedRotations.rot"))
    topologies = pygplates.FeatureCollection(os.path.join(SIMPLE, "Muller_etal_2019_PlateBoundaries_DeformingNetworks.gpmlz"))
    quats = np.fromfile(os.path.join(OUT, "rotations.bin"), np.float32).reshape(meta["times"], meta["plates"], 4)

    # ---- orogeny grid: continental cells of the present-day globe
    Image.MAX_IMAGE_PIXELS = None
    pid = np.array(Image.open(os.path.join(OUT, "plateid.png")))
    crust = np.array(Image.open(os.path.join(OUT, "crust.png")))
    lon = -180.0 + (np.arange(OW) + 0.5) * 360.0 / OW
    lat = 90.0 - (np.arange(OH) + 0.5) * 180.0 / OH
    LON, LAT = np.meshgrid(lon, lat)
    rr = ((90.0 - LAT) / 180.0 * pid.shape[0]).astype(int).clip(0, pid.shape[0] - 1)
    cc = ((LON + 180.0) / 360.0 * pid.shape[1]).astype(int).clip(0, pid.shape[1] - 1)
    plate_col = pid[rr, cc, 0].astype(int) + 256 * pid[rr, cc, 1].astype(int)
    rr2 = ((90.0 - LAT) / 180.0 * crust.shape[0]).astype(int).clip(0, crust.shape[0] - 1)
    cc2 = ((LON + 180.0) / 360.0 * crust.shape[1]).astype(int).clip(0, crust.shape[1] - 1)
    continental = crust[rr2, cc2, 1] > 127
    cells = np.flatnonzero(continental.ravel())
    la, lo = np.radians(LAT.ravel()[cells]), np.radians(LON.ravel()[cells])
    xyz0 = np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)
    ccol = plate_col.ravel()[cells]
    log(f"orogeny grid {OW}x{OH}: {len(cells)} continental cells")

    n_slices = T_MAX // SLICE_STEP + 1
    H = np.zeros(len(cells))
    H_slices = np.zeros((n_slices, len(cells)))
    decay = math.exp(-1.0 / TAU)
    along_norm = math.sqrt(math.pi) * ALONG_SIGMA / (SPACING_DEG * math.pi / 180 * R_EARTH)

    nlon = -180.0 + (np.arange(NW) + 0.5) * 360.0 / NW
    nlat = 90.0 - (np.arange(NH) + 0.5) * 180.0 / NH
    NLON, NLAT = np.meshgrid(nlon, nlat)
    net_pts = [pygplates.PointOnSphere(float(a), float(b)) for a, b in zip(NLAT.ravel(), NLON.ravel())]
    net = np.zeros((T_MAX // NET_STEP + 1, NH * NW, 2), np.float32)

    records, index = [], []
    offset = 0
    for t in range(T_MAX, -1, -1):
        snap = pygplates.TopologicalSnapshot(topologies, rotations, float(t))
        pos, vel, nrm, rate, typ = snapshot_points(topologies, rotations, t, snap)

        # -- boundary export
        rec = np.zeros(len(pos), BOUNDARY_DTYPE)
        rec["pos"] = np.round(pos * 32767).astype(np.int16)
        rec["vel"] = np.clip(np.round(vel * 1e5), -32767, 32767).astype(np.int16)
        rec["nrm"] = np.round(nrm * 127).astype(np.int8)
        rec["rate"] = np.clip(np.round(rate), 0, 255).astype(np.uint8)
        rec["type"] = typ
        records.append(rec)
        index.append([offset, len(rec)])
        offset += len(rec)

        # -- deforming networks: where rigid plates leave gaps of stretched / shortened crust
        if t % NET_STEP == 0:
            locs = snap.get_point_locations(net_pts)
            inside = np.array([l.located_in_resolved_network() is not None for l in locs])
            srn = snap.get_point_strain_rates(net_pts)
            d = np.array([r.get_dilatation_rate() if r is not None else 0.0 for r in srn]) * 3.15576e13
            net[t // NET_STEP, :, 0] = inside
            net[t // NET_STEP, :, 1] = np.where(inside, 0.5 + 0.5 * np.clip(-d / 0.02, -1, 1), 0.5)

        # -- orogenic activity on the continental cells
        sub = typ == TYPE_SUBDUCTION
        q = quats[min(int(round(t / meta["tStep"])), meta["times"] - 1)][ccol]
        cpos = quat_rotate(q, xyz0)
        # crustal shortening inside deforming networks (dilatation rate < 0), per Myr
        sr = snap.get_point_strain_rates([pygplates.PointOnSphere(*p, normalise=True) for p in cpos])
        dil = np.array([r.get_dilatation_rate() if r is not None else 0.0 for r in sr]) * 3.15576e13
        A = np.clip(-dil, 0.0, 0.035) * STRAIN_UPLIFT / K_HEIGHT   # clamp numerical hot spots
        if sub.any():
            tree_c = cKDTree(cpos)
            tree_b = cKDTree(pos[sub])
            coo = tree_c.sparse_distance_matrix(tree_b, 1400.0 / R_EARTH, output_type="coo_matrix")
            ci, bi = coo.row, coo.col
            d = cpos[ci] - pos[sub][bi]
            n = nrm[sub][bi]
            s = np.einsum("ij,ij->i", d, n) * R_EARTH                       # km towards the overriding plate
            a = np.linalg.norm(d - s[:, None] / R_EARTH * n, axis=1) * R_EARTH  # km along strike
            over = 0.75 * np.exp(-((s - 230.0) / 200.0) ** 2) + 0.35 * np.exp(-((s - 650.0) / 420.0) ** 2)
            under = 0.45 * np.exp(-((s + 60.0) / 110.0) ** 2)
            K = np.where(s > -40.0, over, 0.0) + under
            w = rate[sub][bi] * K * np.exp(-((a / ALONG_SIGMA) ** 2)) / along_norm
            A += np.bincount(ci, weights=w, minlength=len(cells))
        if t == T_MAX:
            H = A * TAU                     # assume long-lived margins were already in steady state
        else:
            H = H * decay + A
        H = np.minimum(H, 9000.0 / K_HEIGHT)
        if t % SLICE_STEP == 0:
            H_slices[t // SLICE_STEP] = H
        if t % 25 == 0:
            log(f"t={t:3d} Ma: {len(pos)} boundary pts ({sub.sum()} subduction), max relief {K_HEIGHT * H.max():.0f} m")

    recs = np.concatenate(records)
    recs.tofile(os.path.join(OUT, "boundaries.bin"))
    json.dump({"step": 1, "tMax": T_MAX, "stride": BOUNDARY_DTYPE.itemsize, "index": index},
              open(os.path.join(OUT, "boundaries.json"), "w"))
    log(f"boundaries.bin: {len(recs)} points, {recs.nbytes / 1e6:.1f} MB")

    # ---- orogeny slices -> fraction of present relief (R) and eroded extra relief (X)
    Hm = K_HEIGHT * H_slices
    for name, (qla, qlo) in {"Andes": (-18, -68), "Tibet": (32, 88), "Himalaya": (28.5, 84), "Alps": (46.5, 10),
                             "Japan": (36, 138), "Rockies": (40, -106), "Sahara": (22, 10)}.items():
        k = np.argmin(np.sum((xyz0 - np.array([math.cos(math.radians(qla)) * math.cos(math.radians(qlo)),
                                                 math.cos(math.radians(qla)) * math.sin(math.radians(qlo)),
                                                 math.sin(math.radians(qla))])) ** 2, axis=1))
        log(f"  {name:9s} relief(t=0,50,100,150,200,250): " + " ".join(f"{Hm[j, k]:6.0f}" for j in (0, 5, 10, 15, 20, 25)))
    H0 = Hm[0]
    frac = np.clip((Hm + 250.0) / (H0 + 250.0), 0.0, 1.0)
    extra = np.clip((Hm - H0) * 0.8, 0.0, 5000.0)
    grid = np.zeros((n_slices, OH * OW, 2), np.float32)
    grid[:, :, 0] = 1.0
    grid[:, cells, 0] = frac
    grid[:, cells, 1] = extra
    grid = grid.reshape(n_slices, OH, OW, 2)
    # soften cell edges a little
    from scipy.ndimage import gaussian_filter
    for k in range(n_slices):
        for ch in range(2):
            grid[k, :, :, ch] = gaussian_filter(grid[k, :, :, ch], 0.8, mode=("nearest", "wrap"))
    out = np.empty(grid.shape, np.uint8)
    out[..., 0] = np.round(np.clip(grid[..., 0], 0, 1) * 255)
    out[..., 1] = np.round(np.clip(grid[..., 1] / 20.0, 0, 255))
    out.tofile(os.path.join(OUT, "orogeny.bin"))
    from scipy.ndimage import gaussian_filter as gf
    netu8 = np.empty(net.shape, np.uint8)
    for k in range(net.shape[0]):
        for ch in range(2):
            netu8[k, :, ch] = np.round(np.clip(gf(net[k, :, ch].reshape(NH, NW), 0.7, mode=("nearest", "wrap")), 0, 1) * 255).ravel()
    netu8.tofile(os.path.join(OUT, "networks.bin"))
    meta["networks"] = {"size": [NW, NH], "slices": int(net.shape[0]), "step": NET_STEP}
    log(f"networks.bin: {netu8.nbytes / 1e6:.1f} MB")
    meta["orogeny"] = {"size": [OW, OH], "slices": n_slices, "step": SLICE_STEP}
    meta["boundaries"] = {"stride": BOUNDARY_DTYPE.itemsize, "count": int(len(recs))}
    json.dump(meta, open(os.path.join(OUT, "meta.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    log(f"orogeny.bin: {out.nbytes / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
