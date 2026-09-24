// Single-scattering atmosphere (Rayleigh + Mie), ray-marched on an outer shell.
// Units: planet radius = 1. The shell is drawn additively over the globe, which
// also produces aerial perspective (blue haze) over the surface.

export const atmoVert = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const atmoFrag = /* glsl */ `
precision highp float;
#define PI 3.141592653589793
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform float uNight;
uniform float uExposure;
uniform float uIntensity;
varying vec3 vWorld;

const float RP = 1.0;
const float RA = 1.028;
const float HR = 0.0042;   // Rayleigh scale height
const float HM = 0.0009;   // Mie scale height
const vec3 BETA_R = vec3(5.8, 13.5, 33.1) * 3.4;
const vec3 BETA_M = vec3(21.0) * 0.9;

vec2 raySphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return vec2(1e9, -1e9);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

void main() {
  vec3 ro = uCamPos;
  vec3 rd = normalize(vWorld - uCamPos);
  vec2 ta = raySphere(ro, rd, RA);
  if (ta.y < 0.0) discard;
  vec2 tp = raySphere(ro, rd, RP);
  float t0 = max(ta.x, 0.0);
  float t1 = ta.y;
  if (tp.x > 0.0) t1 = min(t1, tp.x);
  vec3 L = normalize(uSunDir);

  const int N = 16;
  const int M = 6;
  float ds = (t1 - t0) / float(N);
  vec3 sumR = vec3(0.0), sumM = vec3(0.0);
  float odR = 0.0, odM = 0.0;
  for (int i = 0; i < N; i++) {
    vec3 p = ro + rd * (t0 + ds * (float(i) + 0.5));
    float hgt = length(p) - RP;
    float dR = exp(-hgt / HR) * ds;
    float dM = exp(-hgt / HM) * ds;
    odR += dR;
    odM += dM;
    // light path towards the sun
    vec2 tl = raySphere(p, L, RA);
    float dsl = tl.y / float(M);
    float lR = 0.0, lM = 0.0;
    bool shadow = false;
    for (int j = 0; j < M; j++) {
      vec3 pl = p + L * dsl * (float(j) + 0.5);
      float hl = length(pl) - RP;
      if (hl < 0.0) { shadow = true; break; }
      lR += exp(-hl / HR) * dsl;
      lM += exp(-hl / HM) * dsl;
    }
    if (shadow && uNight > 0.5) continue;
    vec3 tau = BETA_R * (odR + lR) + BETA_M * 1.1 * (odM + lM);
    vec3 att = exp(-tau);
    sumR += dR * att;
    sumM += dM * att;
  }
  float mu = dot(rd, L);
  float phaseR = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
  float g = 0.76;
  float phaseM = 3.0 / (8.0 * PI) * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  vec3 col = uIntensity * (sumR * BETA_R * phaseR + sumM * BETA_M * phaseM);
  gl_FragColor = vec4(col * uExposure, 1.0);
}
`;

export const starsVert = /* glsl */ `
attribute float size;
attribute vec3 tint;
varying vec3 vTint;
void main() {
  vTint = tint;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size;
  gl_Position = projectionMatrix * mv;
}
`;

export const starsFrag = /* glsl */ `
precision highp float;
varying vec3 vTint;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c);
  float a = smoothstep(0.5, 0.0, r);
  a *= a;
  gl_FragColor = vec4(vTint * a, 1.0);
}
`;
