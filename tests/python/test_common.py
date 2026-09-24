import numpy as np

from common import _unwrap_ring, grid_lonlat, polygon_on_grid, rasterize_polygons


def test_grid_is_pixel_centred_and_north_up():
    lon, lat = grid_lonlat(4, 2)
    assert np.allclose(lon[0], [-135, -45, 45, 135])
    assert np.allclose(lat[:, 0], [45, -45])


def test_unwrap_removes_dateline_jumps():
    ring = np.array([[170.0, 0], [-170.0, 0], [-170.0, 10], [170.0, 10]])
    out = _unwrap_ring(ring)
    assert np.all(np.abs(np.diff(out[:, 0])) < 180)
    assert np.allclose(out[:, 1], ring[:, 1])


def square(lon0, lon1, lat0, lat1):
    return np.array([[lon0, lat0], [lon1, lat0], [lon1, lat1], [lon0, lat1], [lon0, lat0]])


def test_rasterize_fills_polygons_with_their_values():
    polys = [{"rings": [square(-90, 0, -45, 45)]}, {"rings": [square(0, 90, -45, 45)]}]
    grid = rasterize_polygons(polys, 36, 18, [1, 2])
    lon, lat = grid_lonlat(36, 18)
    assert (grid[(lon > -80) & (lon < -10) & (np.abs(lat) < 40)] == 1).all()
    assert (grid[(lon > 10) & (lon < 80) & (np.abs(lat) < 40)] == 2).all()
    assert (grid[np.abs(lat) > 50] == 0).all()


def test_rasterize_handles_polygons_across_the_dateline():
    polys = [{"rings": [square(160, -160, -10, 10)]}]  # 40 deg wide, crossing 180
    grid = rasterize_polygons(polys, 72, 36, [7])
    lon, lat = grid_lonlat(72, 36)
    inside = (np.abs(lat) < 8) & ((lon > 162) | (lon < -162))
    assert (grid[inside] == 7).all()
    assert (grid[(np.abs(lat) < 8) & (np.abs(lon) < 150)] == 0).all()


def test_polygon_on_grid_is_a_soft_mask():
    m = polygon_on_grid(square(-20, 20, -20, 20), 72, 36, blur_px=1.5)
    assert m.max() <= 1.0 and m.min() >= 0.0
    lon, lat = grid_lonlat(72, 36)
    assert m[(np.abs(lon) < 10) & (np.abs(lat) < 10)].min() > 0.9
    edge = m[(np.abs(lon - 20) < 3) & (np.abs(lat) < 10)]
    assert ((edge > 0.05) & (edge < 0.95)).any()
