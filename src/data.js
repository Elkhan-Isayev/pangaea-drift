import * as THREE from 'three';
import { t } from './i18n.js';

const BASE = `${import.meta.env.BASE_URL}data/`;

// Downloads every asset with byte-level progress reporting.
export async function loadData(onProgress) {
  const files = {
    meta: { url: 'meta.json', type: 'json', size: 6e3 },
    rotations: { url: 'rotations.bin', type: 'bin', size: 3.2e6 },
    cells: { url: 'cells.bin', type: 'bin', size: 2.3e6 },
    plateid: { url: 'plateid.png', type: 'img', size: 0.14e6 },
    elevation: { url: 'elevation.bin', type: 'bin', size: 37.7e6 },
    crust: { url: 'crust.png', type: 'img', size: 0.43e6 },
    surface: { url: 'surface.png', type: 'img', size: 0.79e6 },
    tect: { url: 'tect.png', type: 'img', size: 0.18e6 },
    albedo: { url: 'albedo.jpg', type: 'img', size: 3.5e6 },
    lights: { url: 'lights.jpg', type: 'img', size: 0.53e6 },
  };
  const loaded = {};
  const total = Object.values(files).reduce((s, f) => s + f.size, 0);
  const report = () => {
    const done = Object.values(loaded).reduce((s, v) => s + v, 0);
    onProgress?.(Math.min(done / total, 1));
  };

  const fetchOne = async (key, f) => {
    const res = await fetch(BASE + f.url);
    if (!res.ok) throw new Error(`${t('loadFailed')(f.url)} (${res.status})`);
    const len = Number(res.headers.get('content-length')) || f.size;
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      got += value.length;
      loaded[key] = (got / len) * f.size;
      report();
    }
    loaded[key] = f.size;
    report();
    const blob = new Blob(chunks);
    if (f.type === 'json') return JSON.parse(await blob.text());
    if (f.type === 'bin') return await blob.arrayBuffer();
    return await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none', imageOrientation: 'none' });
  };

  const entries = await Promise.all(Object.entries(files).map(async ([k, f]) => [k, await fetchOne(k, f)]));
  return Object.fromEntries(entries);
}

function imageTexture(bitmap, { srgb = false, mipmaps = true } = {}) {
  const tex = new THREE.Texture(bitmap);
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.generateMipmaps = mipmaps;
  tex.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function createTextures(raw) {
  const { meta } = raw;
  const [ew, eh] = meta.elevation;
  const elev = new THREE.DataTexture(new Uint16Array(raw.elevation), ew, eh, THREE.RedFormat, THREE.HalfFloatType);
  elev.wrapS = THREE.RepeatWrapping;
  elev.minFilter = THREE.LinearFilter;
  elev.magFilter = THREE.LinearFilter;
  elev.needsUpdate = true;

  const rot = new THREE.DataTexture(new Float32Array(raw.rotations), meta.plates, meta.times, THREE.RGBAFormat, THREE.FloatType);
  rot.minFilter = rot.magFilter = THREE.NearestFilter;
  rot.needsUpdate = true;

  const plateid = imageTexture(raw.plateid, { mipmaps: false });
  plateid.minFilter = plateid.magFilter = THREE.NearestFilter;

  return {
    elev,
    plateid,
    rot,
    crust: imageTexture(raw.crust, { mipmaps: false }),
    surface: imageTexture(raw.surface),
    tect: imageTexture(raw.tect, { mipmaps: false }),
    albedo: imageTexture(raw.albedo, { srgb: true }),
    lights: imageTexture(raw.lights),
  };
}
