// Shared GLSL: geographic helpers, ocean-depth model, glaciation history, noise.
// Convention: "geo" vectors are x = (lat 0, lon 0), y = (lat 0, lon 90E), z = north pole.

export const COMMON = /* glsl */ `
#define PI 3.141592653589793

vec2 dirToUV(vec3 d) {
  return vec2(atan(d.y, d.x) * (0.5 / PI) + 0.5, 0.5 - asin(clamp(d.z, -1.0, 1.0)) / PI);
}

vec3 uvToDir(vec2 uv) {
  float lon = (uv.x - 0.5) * 2.0 * PI;
  float lat = (0.5 - uv.y) * PI;
  return vec3(cos(lat) * cos(lon), cos(lat) * sin(lon), sin(lat));
}

float latDeg(vec3 d) { return degrees(asin(clamp(d.z, -1.0, 1.0))); }
float lonDeg(vec3 d) { return degrees(atan(d.y, d.x)); }

// Seafloor depth (m, positive down) vs crust age (Myr): GDH1 plate model, Stein & Stein (1992).
float oceanDepth(float age) {
  age = max(age, 0.0);
  return age < 20.0 ? 2600.0 + 365.0 * sqrt(age) : 5651.0 - 2473.0 * exp(-0.0278 * age);
}

// 0 = no ice sheet, 1 = present-day ice sheet, as a function of present-day position and age.
float glaciation(vec3 orig, float t) {
  float la = latDeg(orig), lo = lonDeg(orig);
  if (la < -58.0) return 1.0 - smoothstep(31.0, 36.0, t);            // Antarctica, Eocene-Oligocene boundary
  if (la > 59.0 && lo > -75.0 && lo < -10.0) return 1.0 - smoothstep(2.7, 7.0, t);  // Greenland
  return 1.0 - smoothstep(0.8, 3.5, t);                               // Arctic islands, mountain glaciers
}

// --- Simplex noise 3D (Ashima Arts / Stefan Gustavson, MIT) ---
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p, int oct) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    s += a * snoise(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return s;
}

float ridged(vec3 p, int oct) {
  float a = 0.5, s = 0.0, w = 1.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(snoise(p));
    n *= n * w;
    w = clamp(n * 1.8, 0.0, 1.0);
    s += a * n;
    p = p * 2.1 + vec3(3.3, 1.1, 7.7);
    a *= 0.5;
  }
  return s;
}
`;
