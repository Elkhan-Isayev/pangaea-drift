import * as THREE from 'three';
import { plateFrag, plateVert, resolveFrag, resolveVert } from './shaders/reconstruct.glsl.js';

// Builds a per-plate tessellation of the present-day globe from (cell, plate)
// pairs. Boundary cells are emitted once per plate touching them; vertices are
// duplicated per plate so every plate can rotate independently. The exact
// boundary is resolved per fragment against the high-resolution plate raster.
function buildPlateGeometry(pairs, mw, mh) {
  const vw = mw + 1;
  const firstIdx = new Int32Array(vw * (mh + 1)).fill(-1);
  const firstPlate = new Int32Array(vw * (mh + 1));
  const extra = new Map();
  const pos = [];
  const plateAttr = [];
  const index = new Uint32Array(pairs.length * 6);
  let vcount = 0;
  let icount = 0;

  const vertex = (i, j, p) => {
    const g = j * vw + i;
    if (firstIdx[g] >= 0 && firstPlate[g] === p) return firstIdx[g];
    if (firstIdx[g] >= 0) {
      const hit = extra.get(g * 512 + p);
      if (hit !== undefined) return hit;
    }
    const lon = -Math.PI + (i / mw) * 2 * Math.PI;
    const lat = Math.PI / 2 - (j / mh) * Math.PI;
    pos.push(Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat));
    plateAttr.push(p);
    const id = vcount++;
    if (firstIdx[g] < 0) {
      firstIdx[g] = id;
      firstPlate[g] = p;
    } else extra.set(g * 512 + p, id);
    return id;
  };

  for (let k = 0; k < pairs.length; k++) {
    const key = pairs[k];
    const p = key & 511;
    const cell = key >>> 9;
    const i = cell % mw;
    const j = (cell - i) / mw;
    const a = vertex(i, j, p);
    const b = vertex(i + 1, j, p);
    const c = vertex(i, j + 1, p);
    const d = vertex(i + 1, j + 1, p);
    index[icount++] = a; index[icount++] = c; index[icount++] = b;
    index[icount++] = b; index[icount++] = c; index[icount++] = d;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('plate', new THREE.Float32BufferAttribute(plateAttr, 1));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  return geo;
}

export class Reconstruction {
  constructor(renderer, raw, tex, size = 1536) {
    this.renderer = renderer;
    this.meta = raw.meta;
    this.size = size;
    const [mw, mh] = this.meta.mesh;
    const pairs = new Uint32Array(raw.cells);

    // ---- pass A: rotated plates -> original directions
    this.targetA = new THREE.WebGLCubeRenderTarget(size, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: true,
    });
    this.matA = new THREE.ShaderMaterial({
      vertexShader: plateVert,
      fragmentShader: plateFrag,
      side: THREE.DoubleSide,
      uniforms: {
        tRot: { value: tex.rot },
        tCrust: { value: tex.crust },
        tElev: { value: tex.elev },
        tPlateId: { value: tex.plateid },
        uTime: { value: 0 },
        uTimeIdx: { value: 0 },
        uTimeRows: { value: this.meta.times },
      },
    });
    const mesh = new THREE.Mesh(buildPlateGeometry(pairs, mw, mh), this.matA);
    mesh.frustumCulled = false;
    this.sceneA = new THREE.Scene();
    this.sceneA.add(mesh);
    this.camA = new THREE.CubeCamera(0.05, 10, this.targetA);

    // ---- pass B: palaeo-topography
    this.targetB = new THREE.WebGLCubeRenderTarget(size, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true,
      depthBuffer: false,
    });
    this.matB = new THREE.ShaderMaterial({
      vertexShader: resolveVert,
      fragmentShader: resolveFrag,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tRecon: { value: this.targetA.texture },
        tElev: { value: tex.elev },
        tCrust: { value: tex.crust },
        tSurf: { value: tex.surface },
        tTect: { value: tex.tect },
        uTime: { value: 0 },
        uSeaLevel: { value: 0 },
        uTexel: { value: Math.PI / 2 / size },
      },
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), this.matB);
    box.frustumCulled = false;
    this.sceneB = new THREE.Scene();
    this.sceneB.add(box);
    this.camB = new THREE.CubeCamera(0.05, 10, this.targetB);
  }

  get texelAngle() {
    return Math.PI / 2 / this.size;
  }

  update(time, seaLevel) {
    const r = this.renderer;
    const prevColor = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    const prevTarget = r.getRenderTarget();
    r.setClearColor(0x000000, 0);

    this.matA.uniforms.uTime.value = time;
    this.matA.uniforms.uTimeIdx.value = Math.min(time / this.meta.tStep, this.meta.times - 1);
    this.camA.update(r, this.sceneA);

    this.matB.uniforms.uTime.value = time;
    this.matB.uniforms.uSeaLevel.value = seaLevel;
    this.camB.update(r, this.sceneB);

    r.setClearColor(prevColor, prevAlpha);
    r.setRenderTarget(prevTarget);
  }

  dispose() {
    this.targetA.dispose();
    this.targetB.dispose();
  }
}

// CPU-side plate rotation (for labels): same interpolation as the vertex shader.
export class PlateRotations {
  constructor(raw) {
    this.meta = raw.meta;
    this.q = new Float32Array(raw.rotations);
  }

  quat(plate, time, out = [1, 0, 0, 0]) {
    const { plates, times, tStep } = this.meta;
    const fi = Math.min(Math.max(time / tStep, 0), times - 1);
    const i0 = Math.floor(fi);
    const i1 = Math.min(i0 + 1, times - 1);
    const f = fi - i0;
    const a = (i0 * plates + plate) * 4;
    const b = (i1 * plates + plate) * 4;
    let n = 0;
    for (let k = 0; k < 4; k++) {
      out[k] = this.q[a + k] * (1 - f) + this.q[b + k] * f;
      n += out[k] * out[k];
    }
    n = Math.sqrt(n);
    for (let k = 0; k < 4; k++) out[k] /= n;
    return out;
  }

  // Rotate a present-day geo unit vector (x: 0N 0E, y: 0N 90E, z: N pole) to time t.
  rotate(plate, time, v) {
    const [w, x, y, z] = this.quat(plate, time);
    const [vx, vy, vz] = v;
    // t = 2 * cross(q.xyz, v)
    const tx = 2 * (y * vz - z * vy);
    const ty = 2 * (z * vx - x * vz);
    const tz = 2 * (x * vy - y * vx);
    return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
  }
}

export function geoFromLatLon(lat, lon) {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
}

// geo (x: 0N0E, y: 0N90E, z: north) <-> three.js world (y up)
export const geoToWorld = (g) => new THREE.Vector3(g[1], g[2], g[0]);
export const worldToGeo = (w) => new THREE.Vector3(w.z, w.x, w.y);
