import * as THREE from 'three';
import { COMMON } from './shaders/common.glsl.js';

// Active plate boundaries (resolved topologies of Müller et al. 2019, one snapshot per Myr)
// rendered as oriented splats into a cube map:
//   R  mid-ocean ridge crest proximity (synthetic oceans get their ridges from it)
//   G  elevation change from trenches and volcanic arcs (m)
//   B  subduction-zone line mask, A  ridge / transform line mask (tectonics overlay)
// Points move with their boundary's own velocity between snapshots, and consecutive
// snapshots are cross-faded, so boundaries glide smoothly instead of jumping each Myr.


const vert = /* glsl */ `
precision highp float;
attribute vec3 iPos;
attribute vec3 iVel;
attribute vec3 iNrm;
attribute vec2 iRT;     // rate (mm/yr), type
uniform float uDt;      // Myr to move forward in time from the snapshot
varying vec2 vSU;       // across (towards overriding / left side), along (km)
varying vec3 vWorld;
flat varying vec2 vRT;

void main() {
  vec3 p = normalize(iPos + iVel * uDt);
  vec3 n = iNrm - dot(iNrm, p) * p;
  float nl = length(n);
  vRT = iRT;
  if (nl < 1e-3) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  n /= nl;
  vec3 a = cross(p, n);
  float type = iRT.y;
  vec2 across = type < 1.5 ? vec2(-160.0, 320.0) : (type < 2.5 ? vec2(-760.0, 760.0) : vec2(-60.0, 60.0));
  vec2 c = position.xy * 0.5 + 0.5;
  float s = mix(across.x, across.y, c.y);
  float u = mix(-280.0, 280.0, c.x);
  vec3 w = normalize(p + (n * s + a * u) / 6371.0);
  vSU = vec2(s, u);
  vWorld = w;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}
`;

const frag = /* glsl */ `
precision highp float;
${COMMON}
uniform float uWeight;
varying vec2 vSU;
varying vec3 vWorld;
flat varying vec2 vRT;

void main() {
  float s = vSU.x, u = vSU.y;
  // boundary samples are ~111 km apart: Gaussian along strike, normalised so the sum is ~1
  float g = exp(-pow(u / 95.0, 2.0)) / 1.52 * uWeight;
  float rate = vRT.x;
  vec4 o = vec4(0.0);
  if (vRT.y < 1.5) {
    float k = clamp(rate / 45.0, 0.35, 1.2);
    float volc = 0.55 + 0.45 * smoothstep(-0.2, 0.6, snoise(vWorld * 95.0));
    float trench = -3300.0 * exp(-pow((s + 45.0) / 38.0, 2.0));
    float arc = 2700.0 * exp(-pow((s - 175.0) / 55.0, 2.0)) * volc;
    o.g = (trench + arc) * k;
    o.b = exp(-pow(s / 20.0, 2.0));
  } else if (vRT.y < 2.5) {
    o.r = exp(-pow(s / 300.0, 2.0)) * clamp(rate / 25.0, 0.5, 1.0);
    o.g = -350.0 * exp(-pow(s / 14.0, 2.0));    // axial rift valley
    o.a = exp(-pow(s / 20.0, 2.0));
  } else {
    o.a = 0.4 * exp(-pow(s / 16.0, 2.0));
  }
  gl_FragColor = o * g;
}
`;

// Decode boundaries.bin records (layout: scripts/build_tectonics.py BOUNDARY_DTYPE).
export function parseBoundaries(buffer, stride) {
  const n = buffer.byteLength / stride;
  const dv = new DataView(buffer);
  const pos = new Float32Array(n * 3);
  const vel = new Float32Array(n * 3);
  const nrm = new Float32Array(n * 3);
  const rt = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const o = i * stride;
    for (let k = 0; k < 3; k++) {
      pos[i * 3 + k] = dv.getInt16(o + 2 * k, true) / 32767;
      vel[i * 3 + k] = dv.getInt16(o + 6 + 2 * k, true) / 1e5;
      nrm[i * 3 + k] = dv.getInt8(o + 12 + k) / 127;
    }
    rt[i * 2] = dv.getUint8(o + 15);
    rt[i * 2 + 1] = dv.getUint8(o + 16);
  }
  return { pos, vel, nrm, rt };
}

// Which two 1-Myr snapshots to show at `time`, how far to move each, and their weights.
export function snapshotBlend(time, tMax) {
  const older = Math.min(Math.ceil(time), tMax);
  const newer = Math.max(older - 1, 0);
  const f = older - time; // 0 at the older snapshot, 1 at the newer one
  const single = older === newer;
  return {
    older,
    newer,
    olderDt: older - time,
    newerDt: newer - time,
    olderWeight: single ? 1 : 1 - f,
    newerWeight: single ? 0 : f,
  };
}

export class TectonicFeatures {
  constructor(renderer, raw, size = 1024) {
    this.renderer = renderer;
    const { index, tMax, stride } = raw.boundariesIndex;
    this.index = index;
    this.tMax = tMax;
    Object.assign(this, parseBoundaries(raw.boundaries, stride));
    const maxCount = Math.max(...index.map((e) => e[1]));

    this.target = new THREE.WebGLCubeRenderTarget(size, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
    });
    this.scene = new THREE.Scene();
    this.layers = [0, 1].map(() => {
      const geo = new THREE.InstancedBufferGeometry();
      const quad = new THREE.PlaneGeometry(2, 2);
      geo.index = quad.index;
      geo.setAttribute('position', quad.getAttribute('position'));
      const attr = (itemSize) => new THREE.InstancedBufferAttribute(new Float32Array(maxCount * itemSize), itemSize).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('iPos', attr(3));
      geo.setAttribute('iVel', attr(3));
      geo.setAttribute('iNrm', attr(3));
      geo.setAttribute('iRT', attr(2));
      geo.instanceCount = 0;
      const mat = new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: { uDt: { value: 0 }, uWeight: { value: 1 } },
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        blending: THREE.CustomBlending,
        blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneFactor,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      return { geo, mat, snapshot: -1 };
    });
    this.cam = new THREE.CubeCamera(0.05, 10, this.target);
  }

  get texture() {
    return this.target.texture;
  }

  load(layer, snapTime) {
    if (layer.snapshot === snapTime) return;
    layer.snapshot = snapTime;
    const [off, count] = this.index[this.tMax - snapTime];
    const g = layer.geo;
    g.getAttribute('iPos').array.set(this.pos.subarray(off * 3, (off + count) * 3));
    g.getAttribute('iVel').array.set(this.vel.subarray(off * 3, (off + count) * 3));
    g.getAttribute('iNrm').array.set(this.nrm.subarray(off * 3, (off + count) * 3));
    g.getAttribute('iRT').array.set(this.rt.subarray(off * 2, (off + count) * 2));
    for (const name of ['iPos', 'iVel', 'iNrm', 'iRT']) {
      const a = g.getAttribute(name);
      a.clearUpdateRanges();
      a.addUpdateRange(0, count * a.itemSize);
      a.needsUpdate = true;
    }
    g.instanceCount = count;
  }

  update(time) {
    const s = snapshotBlend(time, this.tMax);
    const [a, b] = this.layers;
    this.load(a, s.older);
    this.load(b, s.newer);
    a.mat.uniforms.uDt.value = s.olderDt;
    a.mat.uniforms.uWeight.value = s.olderWeight;
    b.mat.uniforms.uDt.value = s.newerDt;
    b.mat.uniforms.uWeight.value = s.newerWeight;

    const r = this.renderer;
    const prevColor = r.getClearColor(new THREE.Color());
    const prevAlpha = r.getClearAlpha();
    r.setClearColor(0x000000, 0);
    this.cam.update(r, this.scene);
    r.setClearColor(prevColor, prevAlpha);
  }

  dispose() {
    this.target.dispose();
  }
}

