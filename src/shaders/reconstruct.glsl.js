import { COMMON } from './common.glsl.js';

// ---------------------------------------------------------------------------
// Pass A — rigid plate reconstruction.
// The present-day globe is tessellated per plate; every vertex is rotated by its
// plate's absolute Euler rotation at time t and rendered into a cube map from the
// planet centre. Each texel stores the ORIGINAL (present-day) direction of the
// crust that sits there now, plus the plate index. Crust younger than t is
// discarded; overlaps are resolved in favour of continental and higher crust.
// ---------------------------------------------------------------------------
export const plateVert = /* glsl */ `
precision highp float;
precision highp sampler2D;
attribute float plate;
uniform sampler2D tRot;     // width = plates, height = time samples, RGBA32F quaternion (w,x,y,z)
uniform float uTimeIdx;     // t / step (fractional)
uniform float uTimeRows;
varying vec3 vOrig;
flat varying float vPlate;

vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.yzw, cross(q.yzw, v) + q.x * v); }

void main() {
  int i0 = int(floor(uTimeIdx));
  int i1 = min(i0 + 1, int(uTimeRows) - 1);
  float f = uTimeIdx - float(i0);
  int pc = int(plate + 0.5);
  vec4 q = normalize(mix(texelFetch(tRot, ivec2(pc, i0), 0), texelFetch(tRot, ivec2(pc, i1), 0), f));
  vOrig = position;
  vPlate = plate;
  gl_Position = projectionMatrix * viewMatrix * vec4(qrot(q, position), 1.0);
}
`;

export const plateFrag = /* glsl */ `
precision highp float;
precision highp sampler2D;
${COMMON}
uniform sampler2D tCrust;
uniform sampler2D tElev;
uniform sampler2D tPlateId;   // exact plate boundaries (nearest filtering)
uniform float uTime;
varying vec3 vOrig;
flat varying float vPlate;

void main() {
  vec3 d = normalize(vOrig);
  vec2 uv = dirToUV(d);
  vec2 pid = texture(tPlateId, uv).rg * 255.0;
  if (abs(pid.r + 256.0 * pid.g - vPlate) > 0.5) discard;   // pixel belongs to another plate
  vec3 cr = textureLod(tCrust, uv, 0.0).rgb;
  float birth = cr.r * 255.0;
  if (birth < 254.5 && birth < uTime) discard;          // this crust did not exist yet
  float e = textureLod(tElev, uv, 0.0).r;
  gl_FragDepth = 0.9 - 0.35 * cr.g - 0.4 * clamp((e + 11000.0) / 20000.0, 0.0, 1.0);
  gl_FragColor = vec4(d, vPlate + 1.0);
}
`;

// ---------------------------------------------------------------------------
// Pass B — palaeo-topography at time t, per cube texel.
//   R: elevation (m, relative to today's sea-level datum)
//   G: land flag at the current sea level (mip-mapped → continentality)
//   B: covered by reconstructed crust (0 = synthetic ocean floor)
//   A: continental crust flag
// ---------------------------------------------------------------------------
export const resolveVert = /* glsl */ `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;

export const resolveFrag = /* glsl */ `
precision highp float;
precision highp sampler2D;
${COMMON}
uniform samplerCube tRecon;
uniform sampler2D tElev;
uniform sampler2D tCrust;   // R birth age, G continental, B orogen onset
uniform sampler2D tSurf;    // R lakes, G ice, B old orogen weight
uniform sampler2D tTect;    // R young-orogen weight, G residual height / 25 m
uniform float uTime;
uniform float uSeaLevel;
uniform float uTexel;       // angular size of one cube texel (rad)
varying vec3 vPos;

float abyss(vec3 dir) {
  return -5350.0 + 380.0 * fbm(dir * 7.0, 4) + 160.0 * snoise(dir * 40.0);
}

void main() {
  vec3 dir = normalize(vPos);
  vec4 A = textureLod(tRecon, dir, 0.0);
  float covered = step(0.5, A.a);
  float cont = 0.0;
  float e;

  if (covered > 0.5) {
    vec3 o = normalize(A.xyz);
    vec2 uv = dirToUV(o);
    e = textureLod(tElev, uv, 0.0).r;
    vec3 cr = textureLod(tCrust, uv, 0.0).rgb;
    vec3 sf = textureLod(tSurf, uv, 0.0).rgb;
    vec3 tc = textureLod(tTect, uv, 0.0).rgb;
    cont = cr.g;
    float birth = cr.r * 255.0;

    // Oceanic lithosphere was younger and hotter at time t, hence shallower:
    // undo the thermal subsidence accumulated since then (ridges re-appear).
    if (birth < 254.5) {
      float oce = 1.0 - smoothstep(0.3, 0.7, cont);
      e += oce * (oceanDepth(birth) - oceanDepth(birth - uTime));
    }

    // Young mountain belts: flattened before their onset, rising afterwards.
    float w = tc.r;
    if (w > 0.002) {
      float onset = cr.b * 255.0;
      float resid = tc.g * 255.0 * 25.0;
      float uplift = 1.0 - smoothstep(onset * 0.2, onset, uTime);
      float flat_ = min(e, resid + 0.1 * max(e - resid, 0.0));
      e = mix(e, mix(flat_, e, uplift), w);
    }

    // Ice sheets: without ice the (isostatically rebounded) bedrock is much lower.
    float ice = sf.g;
    if (ice > 0.002) {
      float g = glaciation(o, uTime);
      float bed = e * 0.35 + 120.0 * snoise(o * 60.0);
      e = mix(e, mix(bed, e, g), ice);
    }

    // Late-Palaeozoic (Central Pangean) mountains, eroding through the Mesozoic.
    float old = sf.b;
    if (old > 0.002) {
      float r = ridged(o * 22.0, 5);
      float youth = smoothstep(90.0, 245.0, uTime);
      e += old * youth * (600.0 + 3600.0 * r * r);
    }
  } else {
    // Oceanic crust that has since been subducted (Panthalassa, Tethys):
    // blend towards the reconstructed neighbours, else a generic abyssal plain.
    vec3 t1 = normalize(cross(abs(dir.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0), dir));
    vec3 t2 = cross(dir, t1);
    float acc = 0.0, wsum = 0.0, wall = 0.0;
    for (int ring = 0; ring < 3; ring++) {
      float rad = uTexel * (ring == 0 ? 3.0 : (ring == 1 ? 10.0 : 28.0));
      float wr = ring == 0 ? 1.0 : (ring == 1 ? 0.6 : 0.3);
      for (int k = 0; k < 6; k++) {
        float ang = (float(k) + 0.5 * float(ring)) * (PI / 3.0);
        vec3 nd = normalize(dir + rad * (cos(ang) * t1 + sin(ang) * t2));
        vec4 N = textureLod(tRecon, nd, 0.0);
        wall += wr;
        if (N.a > 0.5) {
          vec2 nuv = dirToUV(normalize(N.xyz));
          vec2 cr = textureLod(tCrust, nuv, 0.0).rg;
          float ne = textureLod(tElev, nuv, 0.0).r;
          float birth = cr.r * 255.0;
          if (birth < 254.5) ne += (1.0 - cr.g) * (oceanDepth(birth) - oceanDepth(birth - uTime));
          acc += wr * min(ne, 400.0);
          wsum += wr;
        }
      }
    }
    float base = abyss(dir);
    e = wsum > 0.0 ? mix(base, acc / wsum, pow(clamp(wsum / wall * 1.5, 0.0, 1.0), 0.7)) : base;
  }

  gl_FragColor = vec4(e, step(uSeaLevel, e), covered, cont);
}
`;
