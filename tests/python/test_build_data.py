import numpy as np

from build_data import bm_water, push_pull_fill, resample_nodes


def test_push_pull_keeps_known_pixels_and_fills_holes_smoothly():
    rng = np.random.default_rng(0)
    img = np.zeros((64, 128, 3), np.float32)
    img[:, :64] = [200, 100, 50]
    img[:, 64:] = [20, 150, 20]
    w = np.ones((64, 128), np.float32)
    w[20:44, 40:90] = 0  # hole spanning both colours
    img[w == 0] = rng.uniform(0, 255, ((w == 0).sum(), 3))  # garbage under the hole
    out = push_pull_fill(img, w)
    assert np.allclose(out[w == 1], img[w == 1], atol=1e-3)
    hole = out[20:44, 40:90]
    assert hole.min() >= 19 and hole.max() <= 201  # stays within the surrounding colours
    assert np.abs(np.diff(hole, axis=1)).max() < 40  # smooth transition, no hard seams


def test_bm_water_classifies_blue_marble_colours():
    px = np.array([[[2, 5, 20], [10, 60, 110], [34, 42, 16], [215, 180, 130], [243, 243, 243], [5, 6, 8]]], np.uint8)
    assert bm_water(px).tolist() == [[True, True, False, False, False, True]]


def test_resample_nodes_flips_south_up_grids_to_north_up():
    ny, nx = 181, 361  # node-registered, row 0 = south pole
    lat = np.linspace(-90, 90, ny)[:, None] * np.ones((1, nx))
    out = resample_nodes(lat, 36, 18, sigma=0.0)
    assert out.shape == (18, 36)
    assert np.allclose(out[:, 0], 90 - (np.arange(18) + 0.5) * 10, atol=1e-3)
