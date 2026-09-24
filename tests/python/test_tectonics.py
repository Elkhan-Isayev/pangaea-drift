import math

import numpy as np
import pytest

pytest.importorskip("pygplates")
import build_tectonics as bt  # noqa: E402
from rotations import quat_from_pole  # noqa: E402


def test_boundary_record_layout_matches_the_js_parser():
    # src/tectonics.js parseBoundaries reads these byte offsets
    d = bt.BOUNDARY_DTYPE
    assert d.itemsize == 20
    assert {k: d.fields[k][1] for k in ("pos", "vel", "nrm", "rate", "type")} == {
        "pos": 0, "vel": 6, "nrm": 12, "rate": 15, "type": 16}
    assert d.fields["pos"][0].base == np.dtype("<i2") and d.fields["nrm"][0].base == np.dtype("i1")


def test_quat_rotate_matches_single_point_rotation():
    q = quat_from_pole(90.0, 0.0, 90.0)
    v = np.array([[1.0, 0, 0], [0, 0, 1.0]])
    out = bt.quat_rotate(np.tile(q, (2, 1)), v)
    assert np.allclose(out, [[0, 1, 0], [0, 0, 1]], atol=1e-12)


@pytest.fixture(scope="module")
def present_day():
    import os
    import pygplates
    if not os.path.isdir(bt.SIMPLE):
        pytest.skip("raw plate model not downloaded (see README: Rebuilding the data)")
    rot = pygplates.RotationModel(os.path.join(bt.SIMPLE, "Muller_etal_2019_CombinedRotations.rot"))
    topo = pygplates.FeatureCollection(os.path.join(bt.SIMPLE, "Muller_etal_2019_PlateBoundaries_DeformingNetworks.gpmlz"))
    return bt.snapshot_points(topo, rot, 0)


def test_snapshot_points_find_andean_subduction_with_overriding_plate_to_the_east(present_day):
    pos, vel, nrm, rate, typ = present_day
    target = np.array([math.cos(math.radians(-20)) * math.cos(math.radians(-71.5)),
                       math.cos(math.radians(-20)) * math.sin(math.radians(-71.5)), math.sin(math.radians(-20))])
    i = np.argmin(np.where(typ == bt.TYPE_SUBDUCTION, np.linalg.norm(pos - target, axis=1), 9))
    assert typ[i] == bt.TYPE_SUBDUCTION
    east = np.array([-math.sin(math.radians(-71.5)), math.cos(math.radians(-71.5)), 0.0])
    assert np.dot(nrm[i], east) > 0.5          # normal points into South America
    assert 50 < rate[i] < 120                 # Nazca convergence ~8 cm/yr


def test_snapshot_values_are_finite(present_day):
    pos, vel, nrm, rate, typ = present_day
    for a in (pos, vel, nrm, rate):
        assert np.isfinite(a).all()
    assert set(np.unique(typ)) <= {1, 2, 3}
