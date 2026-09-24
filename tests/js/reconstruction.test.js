import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PlateRotations, buildPlateGeometry, geoFromLatLon, geoToWorld, worldToGeo } from '../../src/reconstruction.js';
import { readBuffer, readJson } from './helpers.js';

const close = (a, b, eps = 1e-6) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], -Math.log10(eps)));
const len = (v) => Math.hypot(...v);

describe('coordinates', () => {
  it('geoFromLatLon follows the x = 0°N 0°E, y = 0°N 90°E, z = north convention', () => {
    close(geoFromLatLon(0, 0), [1, 0, 0]);
    close(geoFromLatLon(0, 90), [0, 1, 0]);
    close(geoFromLatLon(90, 0), [0, 0, 1]);
    close(geoFromLatLon(-90, 123), [0, 0, -1]);
    expect(len(geoFromLatLon(37.2, -121.9))).toBeCloseTo(1, 12);
  });

  it('geo <-> world is a rotation with the north pole on the world y axis', () => {
    const north = geoToWorld([0, 0, 1]);
    expect(north.toArray()).toEqual([0, 1, 0]);
    const g = geoFromLatLon(-33.9, 18.4);
    const back = worldToGeo(geoToWorld(g));
    close(back.toArray(), g);
    // handedness preserved: x × y = z in both frames
    const x = geoToWorld([1, 0, 0]), y = geoToWorld([0, 1, 0]), z = geoToWorld([0, 0, 1]);
    close(new THREE.Vector3().crossVectors(x, y).toArray(), z.toArray());
  });
});

describe('PlateRotations', () => {
  const meta = { plates: 2, times: 3, tStep: 10 };
  const s = Math.SQRT1_2;
  // plate 0: identity everywhere; plate 1: 0°, 90°, 180° about the north pole at 0, 10, 20 Ma
  const q = new Float32Array([
    1, 0, 0, 0, 1, 0, 0, 0,
    1, 0, 0, 0, s, 0, 0, s,
    1, 0, 0, 0, 0, 0, 0, 1,
  ]);
  const rot = new PlateRotations({ meta, rotations: q.buffer });

  it('returns unit quaternions interpolated between time samples', () => {
    const mid = rot.quat(1, 5);
    expect(Math.hypot(...mid)).toBeCloseTo(1, 6);
    expect(mid[3]).toBeGreaterThan(0);
    expect(mid[3]).toBeLessThan(s);
  });

  it('rotates points like the vertex shader', () => {
    close(rot.rotate(0, 20, [1, 0, 0]), [1, 0, 0]);
    close(rot.rotate(1, 10, [1, 0, 0]), [0, 1, 0], 1e-6);
    close(rot.rotate(1, 20, [1, 0, 0]), [-1, 0, 0], 1e-6);
    close(rot.rotate(1, 20, [0, 0, 1]), [0, 0, 1], 1e-6);
  });

  it('clamps times outside the table', () => {
    close(rot.quat(1, 999), rot.quat(1, 20));
    close(rot.quat(1, -5), rot.quat(1, 0));
  });
});

describe('buildPlateGeometry', () => {
  it('builds one quad per (cell, plate) pair and duplicates shared vertices per plate', () => {
    // 2 x 1 grid: cell 0 -> plate 3, cell 1 -> plate 7, and cell 1 also touched by plate 3
    const pairs = new Uint32Array([0 * 512 + 3, 1 * 512 + 7, 1 * 512 + 3]);
    const geo = buildPlateGeometry(pairs, 2, 1);
    const pos = geo.getAttribute('position');
    const plate = geo.getAttribute('plate');
    expect(geo.getIndex().count).toBe(3 * 6);
    // plate 3: 3 x 2 corner grid = 6 vertices; plate 7: its own 4 corners
    expect(pos.count).toBe(10);
    const counts = {};
    for (let i = 0; i < plate.count; i++) counts[plate.getX(i)] = (counts[plate.getX(i)] || 0) + 1;
    expect(counts).toEqual({ 3: 6, 7: 4 });
    for (let i = 0; i < pos.count; i++) expect(Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i))).toBeCloseTo(1, 6);
    for (const idx of geo.getIndex().array) expect(idx).toBeLessThan(pos.count);
  });

  it('never mixes plates inside a triangle', () => {
    const pairs = new Uint32Array([0 * 512 + 1, 1 * 512 + 2, 2 * 512 + 1, 3 * 512 + 2]);
    const geo = buildPlateGeometry(pairs, 2, 2);
    const idx = geo.getIndex().array;
    const plate = geo.getAttribute('plate');
    for (let i = 0; i < idx.length; i += 3) {
      expect(plate.getX(idx[i])).toBe(plate.getX(idx[i + 1]));
      expect(plate.getX(idx[i])).toBe(plate.getX(idx[i + 2]));
    }
  });
});

describe('real plate model (public/data)', () => {
  const meta = readJson('meta.json');
  const rot = new PlateRotations({ meta, rotations: readBuffer('rotations.bin') });
  const africa = meta.labels.find((l) => l.id === 'af');
  const southAmerica = meta.labels.find((l) => l.id === 'sa');

  it('has no rotation at the present day (the last frame is today’s Earth)', () => {
    for (let p = 0; p < meta.plates; p++) expect(Math.abs(rot.quat(p, 0)[0])).toBeGreaterThan(1 - 1e-6);
  });

  it('closes the South Atlantic in the past', () => {
    const angle = (a, b) => Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * (180 / Math.PI);
    const af0 = geoFromLatLon(africa.lat, africa.lon), sa0 = geoFromLatLon(southAmerica.lat, southAmerica.lon);
    const today = angle(af0, sa0);
    const pangaea = angle(rot.rotate(africa.plate, 200, af0), rot.rotate(southAmerica.plate, 200, sa0));
    expect(pangaea).toBeLessThan(today - 15);
  });

  it('keeps every rotation a unit quaternion', () => {
    for (let t = 0; t <= meta.tMax; t += 25)
      for (let p = 0; p < meta.plates; p += 7) expect(Math.hypot(...rot.quat(p, t))).toBeCloseTo(1, 5);
  });
});
