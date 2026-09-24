import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createTextures, loadData } from '../../src/data.js';

const FILES = ['meta.json', 'rotations.bin', 'cells.bin', 'plateid.png', 'elevation.bin', 'crust.png', 'surface.png', 'tect.png',
  'albedo.jpg', 'lights.jpg', 'orogeny.bin', 'boundaries.bin', 'boundaries.json', 'networks.bin'];

function mockFetch(status = 200) {
  return vi.fn(async (url) => {
    const name = url.split('/').pop();
    if (!FILES.includes(name)) throw new Error(`unexpected ${url}`);
    const body = name.endsWith('.json') ? JSON.stringify({ file: name }) : new Uint8Array(4096).fill(7);
    return new Response(body, { status });
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('loadData', () => {
  it('downloads every asset and reports monotonic progress up to 100%', async () => {
    vi.stubGlobal('fetch', mockFetch());
    vi.stubGlobal('createImageBitmap', vi.fn(async (blob) => ({ bitmapOf: blob.size })));
    const progress = [];
    const raw = await loadData((p) => progress.push(p));
    expect(Object.keys(raw).sort()).toEqual(
      ['albedo', 'boundaries', 'boundariesIndex', 'cells', 'crust', 'elevation', 'lights', 'meta', 'networks', 'orogeny', 'plateid', 'rotations', 'surface', 'tect'].sort(),
    );
    expect(raw.meta).toEqual({ file: 'meta.json' });
    expect(raw.rotations).toBeInstanceOf(ArrayBuffer);
    expect(raw.rotations.byteLength).toBe(4096);
    expect(raw.albedo).toEqual({ bitmapOf: 4096 });
    expect(progress.at(-1)).toBe(1);
    // loads run in parallel, but the overall fraction never goes backwards
    for (let i = 1; i < progress.length; i++) expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1] - 1e-12);
  });

  it('fails with a readable error when a file is missing', async () => {
    vi.stubGlobal('fetch', mockFetch(404));
    await expect(loadData()).rejects.toThrow(/could not load .* \(404\)/);
  });
});

describe('createTextures', () => {
  const meta = {
    elevation: [8, 4], plates: 2, times: 3,
    orogeny: { size: [4, 2], slices: 3, step: 10 },
    networks: { size: [4, 2], slices: 2, step: 4 },
  };
  const img = { width: 2, height: 1 };
  const raw = {
    meta,
    elevation: new Uint16Array(8 * 4).buffer,
    rotations: new Float32Array(2 * 3 * 4).buffer,
    orogeny: new Uint8Array(4 * 2 * 3 * 2).buffer,
    networks: new Uint8Array(4 * 2 * 2 * 2).buffer,
    plateid: img, crust: img, surface: img, tect: img, albedo: img, lights: img,
  };

  it('creates correctly typed GPU textures', () => {
    const tex = createTextures(raw);
    expect(tex.elev).toBeInstanceOf(THREE.DataTexture);
    expect([tex.elev.image.width, tex.elev.image.height]).toEqual([8, 4]);
    expect(tex.elev.type).toBe(THREE.HalfFloatType);
    expect(tex.elev.format).toBe(THREE.RedFormat);
    expect([tex.rot.image.width, tex.rot.image.height]).toEqual([2, 3]);
    expect(tex.rot.magFilter).toBe(THREE.NearestFilter);
    for (const [t, depth] of [[tex.orogeny, 3], [tex.networks, 2]]) {
      expect(t).toBeInstanceOf(THREE.Data3DTexture);
      expect(t.format).toBe(THREE.RGFormat);
      expect(t.image.depth).toBe(depth);
      expect(t.wrapS).toBe(THREE.RepeatWrapping);
    }
    expect(tex.plateid.magFilter).toBe(THREE.NearestFilter);
    expect(tex.albedo.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(tex.crust.colorSpace).toBe(THREE.NoColorSpace);
    for (const t of [tex.crust, tex.surface, tex.albedo]) expect(t.flipY).toBe(false);
  });
});
