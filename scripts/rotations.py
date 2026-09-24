"""
GPlates rotation-file (.rot) parser and finite-rotation evaluator.

A .rot line reads:  moving_plate  time  pole_lat  pole_lon  angle  fixed_plate  !comment
Each line is a finite rotation of `moving_plate` relative to `fixed_plate`
that takes the plate from its present-day position to its position at `time` (Ma).
Between two consecutive lines with the same (moving, fixed) pair the rotation is
interpolated with quaternion slerp, exactly as GPlates does. Absolute rotations are
obtained by walking the plate hierarchy up to the anchor plate 0:

    R_abs(p, t) = R_abs(fixed, t) * R_rel(p -> fixed, t)
"""
import math
from collections import defaultdict

import numpy as np


def quat_from_pole(lat, lon, angle):
    """Unit quaternion (w, x, y, z) for a rotation of `angle` deg about the pole (lat, lon)."""
    la, lo, a = math.radians(lat), math.radians(lon), math.radians(angle)
    ax = (math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la))
    s = math.sin(a / 2)
    return np.array([math.cos(a / 2), ax[0] * s, ax[1] * s, ax[2] * s])


def qmul(a, b):
    w1, x1, y1, z1 = a
    w2, x2, y2, z2 = b
    return np.array([
        w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
        w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
        w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
        w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2,
    ])


def slerp(q0, q1, f):
    d = float(np.dot(q0, q1))
    if d < 0:
        q1, d = -q1, -d
    if d > 0.9995:
        q = q0 + f * (q1 - q0)
        return q / np.linalg.norm(q)
    th = math.acos(d)
    s = math.sin(th)
    return (math.sin((1 - f) * th) * q0 + math.sin(f * th) * q1) / s


IDENTITY = np.array([1.0, 0.0, 0.0, 0.0])


class RotationModel:
    def __init__(self, path):
        rows = defaultdict(list)  # moving -> list of (time, quat, fixed)
        with open(path, encoding="latin-1") as fh:
            for line in fh:
                body = line.split("!")[0].split()
                if len(body) < 6:
                    continue
                try:
                    mov, t, lat, lon, ang, fix = int(body[0]), float(body[1]), float(body[2]), float(body[3]), float(body[4]), int(body[5])
                except ValueError:
                    continue
                if mov == 999 or mov == fix:
                    continue
                rows[mov].append((t, quat_from_pole(lat, lon, ang), fix))
        # Build interpolation segments: consecutive rows sharing the same fixed plate.
        self.segments = {}
        for mov, lst in rows.items():
            segs = []
            for a, b in zip(lst, lst[1:]):
                if a[2] == b[2] and b[0] > a[0]:
                    segs.append((a[0], b[0], a[1], b[1], a[2]))
            # single-node sequences (rare): treat as constant
            if not segs and lst:
                t, q, f = lst[0]
                segs.append((t, t, q, q, f))
            self.segments[mov] = segs
        self._cache = {}

    def relative(self, plate, t):
        segs = self.segments.get(plate)
        if not segs:
            return None, None
        for t0, t1, q0, q1, fix in segs:
            if t0 <= t <= t1:
                f = 0.0 if t1 == t0 else (t - t0) / (t1 - t0)
                return slerp(q0, q1, f), fix
        # Outside the modelled range: hold the nearest end (keeps blocks attached
        # instead of snapping back to their present-day position).
        first, last = segs[0], segs[-1]
        if t < first[0]:
            return first[2], first[4]
        return last[3], last[4]

    def absolute(self, plate, t, depth=0):
        if plate == 0 or depth > 60:
            return IDENTITY
        key = (plate, t)
        if key in self._cache:
            return self._cache[key]
        q, fix = self.relative(plate, t)
        if q is None:
            res = IDENTITY
        else:
            res = qmul(self.absolute(fix, t, depth + 1), q)
            res = res / np.linalg.norm(res)
        self._cache[key] = res
        return res
