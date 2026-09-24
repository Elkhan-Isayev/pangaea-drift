"""
Hand-authored tectonic regions in present-day lon/lat (degrees).

YOUNG_OROGENS: regions lowered before the given onset age (flattened to `residual`
metres, rising progressively afterwards). Mountain building itself now comes from the
plate-boundary model in build_tectonics.py; only the Western Interior (dynamic
topography) remains here, so the Cretaceous highstand floods the Western Interior Seaway.

OLD_OROGENS: Late-Palaeozoic belts that formed the Central Pangean Mountains
(Appalachians, Mauritanides, Variscides, Urals ...).  They were Himalaya-scale at
the start of the simulation and erode away through the Mesozoic.
"""

YOUNG_OROGENS = [
    # name, onset (Ma), residual height (m), polygon
    # Mountain belts are now driven by the plate-boundary model (scripts/build_tectonics.py).
    # Only dynamic topography that the plate model does not describe stays hand-authored:
    ("Western Interior", 70, 30, [(-121, 68), (-104, 69), (-100, 62), (-96, 55), (-94.5, 47), (-95, 38), (-94, 30.5), (-97.5, 26.5),
                                  (-100.5, 28.5), (-104, 33.5), (-104.6, 40), (-106, 45), (-113.5, 51.5), (-117.5, 57.5),
                                  (-122.5, 62.5)]),
]

OLD_OROGENS = [
    # name, weight, polygon — Central Pangean Mountains and other Variscan-age belts
    ("Appalachians", 1.0, [(-88, 33), (-85, 36), (-80.5, 39), (-76.5, 41.2), (-73.5, 43.5), (-70.5, 45.3), (-66, 47.2), (-60, 48.6),
                           (-56, 49.8), (-52.8, 47.5), (-58, 46.3), (-64, 44.8), (-69, 43), (-73.2, 40.8), (-77.5, 38.2), (-80.3, 35.5),
                           (-83.5, 33.3), (-86.5, 32.3)]),
    ("Ouachita", 0.8, [(-97.5, 33.7), (-94.5, 35.3), (-91.7, 34.9), (-92.5, 34), (-96, 33.3)]),
    ("Mauritanides", 0.8, [(-17, 11.5), (-12, 11.5), (-10.5, 18), (-12.5, 23.5), (-15.5, 23.5), (-16.5, 18)]),
    ("Anti-Atlas-Meseta", 0.6, [(-10.5, 28.8), (-7, 33.8), (-2.5, 34.2), (-4, 31), (-6.5, 28.8)]),
    ("Variscides", 0.85, [(-9.3, 37.2), (-8.8, 43.3), (-4.7, 48.6), (-1, 48.8), (2.5, 50.8), (7, 51.2), (12, 51.7), (16.5, 51),
                          (18, 49.7), (14, 48.3), (9.5, 48), (5, 45.5), (3.5, 44), (0.5, 43.5), (-3, 40), (-5.5, 37)]),
    ("Urals", 0.9, [(56, 50), (57.5, 57), (58.5, 63), (61.5, 68.3), (66.5, 68.6), (64, 63), (61.5, 57), (60.5, 50.5)]),
    ("Cape Fold Belt", 0.7, [(18, -31.8), (18.6, -34.3), (25.5, -34.3), (27.5, -33), (23, -32.6)]),
    ("Ventania", 0.6, [(-63.5, -38.2), (-61.3, -37.4), (-60.8, -38.4), (-62.8, -38.9)]),
    ("Tien Shan-Central Asian (Variscan)", 0.5, [(58, 42), (63, 45), (72, 45.5), (80, 43.5), (74, 40.5), (64, 40)]),
    ("Transantarctic-Gondwanide", 0.6, [(-60, -73), (-60, -77.5), (-45, -81), (-40, -84), (-30, -80), (-40, -76)]),
]
