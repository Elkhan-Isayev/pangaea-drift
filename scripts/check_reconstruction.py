"""Sanity check: forward-reconstruct the present-day land mask to a few ages and
save quick-look paleo maps (scratch output, not used by the app)."""
import sys

import netCDF4
import numpy as np
from PIL import Image

from common import RAW, ROT_FILE, grid_lonlat, load_polygons, rasterize_polygons
from rotations import RotationModel

out_dir = sys.argv[1] if len(sys.argv) > 1 else "."
W, H = 1440, 720
polys = load_polygons()
pid = rasterize_polygons(polys, W, H, [i + 1 for i in range(len(polys))])
print("unassigned pixels:", (pid == 0).mean())
plate = np.where(pid > 0, np.array([0] + [p["plate"] for p in polys])[pid], 0)

d = netCDF4.Dataset(f"{RAW}/etopo.nc")
z = d.variables["altitude"][::-1, :][::7, ::7][:H, :W]  # coarse, north-up
land = np.asarray(z) > -200

lon, lat = grid_lonlat(W, H)
la, lo = np.radians(lat), np.radians(lon)
xyz = np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], -1)
rm = RotationModel(ROT_FILE)


def rot(q, v):
    w, x, y, zq = q
    u = np.array([x, y, zq])
    t = 2 * np.cross(u, v)
    return v + w * t + np.cross(u, t)


for age in (0, 66, 150, 200, 250):
    img = np.zeros((H, W, 3), np.uint8)
    img[:] = (20, 40, 90)
    for p in np.unique(plate):
        m = (plate == p) & land
        if not m.any():
            continue
        v = rot(rm.absolute(int(p), float(age)), xyz[m])
        plat = np.degrees(np.arcsin(np.clip(v[:, 2], -1, 1)))
        plon = np.degrees(np.arctan2(v[:, 1], v[:, 0]))
        r = np.clip(((90 - plat) / 180 * H).astype(int), 0, H - 1)
        c = np.clip(((plon + 180) / 360 * W).astype(int), 0, W - 1)
        img[r, c] = (200, 170, 110)
    Image.fromarray(img).save(f"{out_dir}/paleo_{age:03d}.png")
    print("saved", age)
