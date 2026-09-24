import math

import numpy as np
import pytest

from rotations import IDENTITY, RotationModel, qmul, quat_from_pole, slerp


def rotate(q, v):
    w, x, y, z = q
    u = np.array([x, y, z])
    t = 2 * np.cross(u, v)
    return v + w * t + np.cross(u, t)


def test_quat_from_pole_zero_angle_is_identity():
    assert np.allclose(quat_from_pole(12.0, 34.0, 0.0), IDENTITY)


def test_quat_from_pole_rotates_about_the_pole():
    q = quat_from_pole(90.0, 0.0, 90.0)  # 90 deg about the north pole
    assert np.allclose(rotate(q, np.array([1.0, 0, 0])), [0, 1, 0], atol=1e-12)
    assert np.allclose(rotate(q, np.array([0, 0, 1.0])), [0, 0, 1], atol=1e-12)


def test_qmul_identity_and_composition_order():
    a = quat_from_pole(90.0, 0.0, 90.0)
    b = quat_from_pole(0.0, 0.0, 90.0)  # about the x axis
    assert np.allclose(qmul(IDENTITY, a), a)
    v = np.array([0.0, 1.0, 0.0])
    # qmul(a, b) applies b first, then a
    assert np.allclose(rotate(qmul(a, b), v), rotate(a, rotate(b, v)))


def test_slerp_endpoints_midpoint_and_short_path():
    a = IDENTITY
    b = quat_from_pole(90.0, 0.0, 60.0)
    assert np.allclose(slerp(a, b, 0.0), a)
    assert np.allclose(slerp(a, b, 1.0), b)
    mid = slerp(a, b, 0.5)
    assert np.isclose(np.linalg.norm(mid), 1.0)
    assert np.allclose(mid, quat_from_pole(90.0, 0.0, 30.0))
    assert np.allclose(slerp(a, -b, 0.5), mid)  # takes the short way round


ROT = """\
! comment line
701  0.0   90.0   0.0    0.0  000 !AFR
701 100.0  90.0   0.0   20.0  000 !AFR
201  0.0   90.0   0.0    0.0  701 !SAM-AFR
201  50.0  90.0   0.0   10.0  701 !SAM-AFR
201  50.0  90.0   0.0   10.0  101 !crossover
201 100.0  90.0   0.0   30.0  101 !SAM-NAM
101  0.0   90.0   0.0    0.0  000 !NAM
101 100.0  90.0   0.0    5.0  000 !NAM
999  0.0   90.0   0.0    0.0  000 !comment plate
"""


@pytest.fixture()
def model(tmp_path):
    p = tmp_path / "test.rot"
    p.write_text(ROT)
    return RotationModel(str(p))


def angle_about_z(q):
    return math.degrees(2 * math.atan2(q[3], q[0]))


def test_interpolates_between_nodes(model):
    assert np.isclose(angle_about_z(model.absolute(701, 50.0)), 10.0)


def test_composes_the_plate_hierarchy(model):
    # before the crossover SAM moves relative to AFR: 5 (SAM-AFR) + 10 (AFR) at 25 Ma
    assert np.isclose(angle_about_z(model.absolute(201, 25.0)), 5.0 + 5.0)
    # after the crossover SAM follows NAM: 20 (SAM-NAM at 75 Ma) + 3.75 (NAM)
    assert np.isclose(angle_about_z(model.absolute(201, 75.0)), 20.0 + 3.75)


def test_present_day_is_identity_and_anchor_is_fixed(model):
    for pid in (701, 201, 101, 0):
        assert np.allclose(model.absolute(pid, 0.0), IDENTITY)


def test_holds_the_last_rotation_beyond_the_model_range(model):
    assert np.allclose(model.absolute(701, 250.0), model.absolute(701, 100.0))


def test_unknown_plates_do_not_move(model):
    assert np.allclose(model.absolute(12345, 80.0), IDENTITY)
    assert 999 not in model.segments
