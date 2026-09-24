import { describe, expect, it } from 'vitest';
import { TectonicFeatures, parseBoundaries, snapshotBlend } from '../../src/tectonics.js';
import { readBuffer, readJson } from './helpers.js';

const STRIDE = 20;

function record(view, i, { pos, vel, nrm, rate, type }) {
  const o = i * STRIDE;
  pos.forEach((v, k) => view.setInt16(o + 2 * k, Math.round(v * 32767), true));
  vel.forEach((v, k) => view.setInt16(o + 6 + 2 * k, Math.round(v * 1e5), true));
  nrm.forEach((v, k) => view.setInt8(o + 12 + k, Math.round(v * 127)));
  view.setUint8(o + 15, rate);
  view.setUint8(o + 16, type);
}

describe('parseBoundaries', () => {
  it('decodes the binary layout written by build_tectonics.py', () => {
    const buf = new ArrayBuffer(2 * STRIDE);
    const dv = new DataView(buf);
    record(dv, 0, { pos: [1, 0, 0], vel: [0, 0.0123, 0], nrm: [0, 1, 0], rate: 83, type: 1 });
    record(dv, 1, { pos: [0, 0, -1], vel: [-0.001, 0, 0], nrm: [-1, 0, 0], rate: 30, type: 2 });
    const b = parseBoundaries(buf, STRIDE);
    expect(Array.from(b.pos)).toEqual([1, 0, 0, 0, 0, -1]);
    expect(b.vel[1]).toBeCloseTo(0.0123, 5);
    expect(b.vel[3]).toBeCloseTo(-0.001, 5);
    expect(Array.from(b.nrm)).toEqual([0, 1, 0, -1, 0, 0]);
    expect(Array.from(b.rt)).toEqual([83, 1, 30, 2]);
  });
});

describe('snapshotBlend', () => {
  it('shows only the snapshot itself at whole Myr', () => {
    expect(snapshotBlend(100, 250)).toMatchObject({ older: 100, newer: 99, olderWeight: 1, newerWeight: 0, olderDt: 0 });
  });

  it('cross-fades and moves both snapshots towards the current time', () => {
    const s = snapshotBlend(99.25, 250);
    expect(s.older).toBe(100);
    expect(s.newer).toBe(99);
    expect(s.olderWeight + s.newerWeight).toBeCloseTo(1, 12);
    expect(s.newerWeight).toBeCloseTo(0.75, 12);
    expect(s.olderDt).toBeCloseTo(0.75, 12);
    expect(s.newerDt).toBeCloseTo(-0.25, 12);
  });

  it('handles both ends of the timeline', () => {
    expect(snapshotBlend(0, 250)).toMatchObject({ older: 0, newer: 0, olderWeight: 1, newerWeight: 0 });
    expect(snapshotBlend(250, 250)).toMatchObject({ older: 250, newer: 249, olderWeight: 1 });
    expect(snapshotBlend(300, 250).older).toBe(250);
  });
});

describe('boundaries data (public/data)', () => {
  const idx = readJson('boundaries.json');
  const buf = readBuffer('boundaries.bin');
  const b = parseBoundaries(buf, idx.stride);

  it('has one contiguous snapshot per Myr covering the whole file', () => {
    expect(idx.stride).toBe(STRIDE);
    expect(idx.index.length).toBe(idx.tMax / idx.step + 1);
    let expected = 0;
    for (const [off, count] of idx.index) {
      expect(off).toBe(expected);
      expect(count).toBeGreaterThan(500);
      expected += count;
    }
    expect(expected * idx.stride).toBe(buf.byteLength);
  });

  it('contains unit positions, valid types and subduction + ridges in every snapshot', () => {
    for (const [off, count] of idx.index) {
      const types = new Set();
      for (let i = off; i < off + count; i += 13) {
        expect(Math.hypot(b.pos[i * 3], b.pos[i * 3 + 1], b.pos[i * 3 + 2])).toBeCloseTo(1, 3);
        types.add(b.rt[i * 2 + 1]);
      }
      for (let i = off; i < off + count; i++) types.add(b.rt[i * 2 + 1]);
      expect([...types].every((t) => t >= 1 && t <= 3)).toBe(true);
      expect(types.has(1) && types.has(2)).toBe(true);
    }
  });
});

describe('TectonicFeatures', () => {
  it('loads snapshots into its instanced layers', () => {
    const buf = new ArrayBuffer(3 * STRIDE);
    const dv = new DataView(buf);
    for (let i = 0; i < 3; i++) record(dv, i, { pos: [1, 0, 0], vel: [0, 0, 0], nrm: [0, 1, 0], rate: 50, type: 1 + (i % 2) });
    const raw = { boundaries: buf, boundariesIndex: { tMax: 1, stride: STRIDE, step: 1, index: [[0, 2], [2, 1]] } };
    const f = new TectonicFeatures(null, raw, 16);
    const [a] = f.layers;
    f.load(a, 1); // t = 1 Ma is index[0]
    expect(a.geo.instanceCount).toBe(2);
    expect(Array.from(a.geo.getAttribute('iRT').array.slice(0, 4))).toEqual([50, 1, 50, 2]);
    f.load(a, 0);
    expect(a.geo.instanceCount).toBe(1);
    f.dispose();
  });
});
