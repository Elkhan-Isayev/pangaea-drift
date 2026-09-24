"""Consistency checks for the committed assets in public/data."""
import json
import os

import numpy as np
import pytest
from PIL import Image

from conftest import DATA

Image.MAX_IMAGE_PIXELS = None


@pytest.fixture(scope="module")
def meta():
    with open(os.path.join(DATA, "meta.json"), encoding="utf-8") as fh:
        return json.load(fh)


def size(name):
    return os.path.getsize(os.path.join(DATA, name))


def load(name, dtype):
    return np.fromfile(os.path.join(DATA, name), dtype)


def test_binary_sizes_match_meta(meta):
    assert size("rotations.bin") == meta["times"] * meta["plates"] * 4 * 4
    ew, eh = meta["elevation"]
    assert size("elevation.bin") == ew * eh * 2
    ow, oh = meta["orogeny"]["size"]
    assert size("orogeny.bin") == meta["orogeny"]["slices"] * ow * oh * 2
    nw, nh = meta["networks"]["size"]
    assert size("networks.bin") == meta["networks"]["slices"] * nw * nh * 2
    assert size("cells.bin") % 4 == 0
    assert meta["times"] == round(meta["tMax"] / meta["tStep"]) + 1


def test_rotations_are_unit_and_identity_today(meta):
    q = load("rotations.bin", np.float32).reshape(meta["times"], meta["plates"], 4)
    assert np.allclose(np.linalg.norm(q, axis=-1), 1.0, atol=1e-5)
    assert np.allclose(np.abs(q[0, :, 0]), 1.0, atol=1e-7), "last frame must be exactly today's Earth"
    # consecutive samples keep the same hemisphere (no sign flips -> no interpolation glitches)
    assert (np.sum(q[1:] * q[:-1], axis=-1) > 0).all()
    assert np.degrees(2 * np.arccos(np.clip(np.abs(q[-1, :, 0]), 0, 1))).max() > 30  # plates did move


def test_elevation_is_realistic(meta):
    ew, eh = meta["elevation"]
    e = load("elevation.bin", np.float16).astype(np.float32).reshape(eh, ew)
    assert np.isfinite(e).all()
    assert 6000 < e.max() < 9000 and -11500 < e.min() < -9000
    assert 0.6 < (e < 0).mean() < 0.75  # about 70 % ocean by pixel count


def test_textures_have_the_declared_sizes(meta):
    aw, ah = meta["aux"]
    for name in ("crust.png", "surface.png", "tect.png"):
        im = Image.open(os.path.join(DATA, name))
        assert im.size == (aw, ah) and im.mode == "RGB", name  # RGB: no premultiplied alpha
    assert Image.open(os.path.join(DATA, "albedo.jpg")).size == tuple(meta["albedo"])
    pid = np.array(Image.open(os.path.join(DATA, "plateid.png")))
    assert (pid[..., 0].astype(int) + 256 * pid[..., 1].astype(int)).max() < meta["plates"]


def test_mesh_cells_reference_valid_cells_and_plates(meta):
    pairs = load("cells.bin", np.uint32)
    mw, mh = meta["mesh"]
    assert (pairs & 511).max() < meta["plates"]
    cells = pairs >> 9
    assert cells.max() < mw * mh
    assert len(np.unique(cells)) == mw * mh  # every cell belongs to at least one plate


def test_labels_sit_on_existing_plates(meta):
    ids = {l["id"] for l in meta["labels"]}
    assert {"na", "sa", "af", "eu", "as", "in", "au", "an", "ar"} <= ids
    assert all(0 <= l["plate"] < meta["plates"] for l in meta["labels"])


def test_orogeny_today_is_the_present_relief(meta):
    ow, oh = meta["orogeny"]["size"]
    o = load("orogeny.bin", np.uint8).reshape(meta["orogeny"]["slices"], oh, ow, 2)
    assert (o[0, ..., 0] == 255).all() and (o[0, ..., 1] == 0).all()
    assert (o[..., 0] < 128).any()  # some ranges were flatter in the past


def test_boundary_index_is_contiguous(meta):
    with open(os.path.join(DATA, "boundaries.json")) as fh:
        idx = json.load(fh)
    offsets = np.array(idx["index"])
    assert len(offsets) == idx["tMax"] // idx["step"] + 1
    assert (offsets[1:, 0] == offsets[:-1].sum(axis=1)).all()
    assert offsets[-1].sum() * idx["stride"] == size("boundaries.bin")
