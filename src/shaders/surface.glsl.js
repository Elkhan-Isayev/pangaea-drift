import { COMMON } from './common.glsl.js';

// Cloud field shared by the cloud shell, the cloud shadows and the flat map.
export const CLOUDS = /* glsl */ `
float cloudField(vec3 d, float clock, int detail, float landDry) {
  float la = latDeg(d);
  // zonal advection: easterly trades in the tropics, westerlies at mid-latitudes
  float speed = (abs(la) < 28.0 ? -0.55 : 1.0) * 0.0035;
  float ang = clock * speed;
  vec3 p = vec3(d.x * cos(ang) - d.y * sin(ang), d.x * sin(ang) + d.y * cos(ang), d.z);

  // large weather systems (fronts, cyclones), slowly evolving
  vec3 q = p * 1.7;
  vec3 w = vec3(fbm(q + vec3(0.0, 0.0, clock * 0.005), 3),
                fbm(q + vec3(5.2, 1.3, 2.8 + clock * 0.004), 3),
                fbm(q + vec3(2.1, 7.7, 4.4), 3));
  float cover = fbm(q * 1.2 + w * 1.5, 4);

  // ITCZ and storm tracks are cloudy, the subtropical highs and poles are clearer
  float band = 0.16 * exp(-pow(la / 7.0, 2.0)) + 0.16 * exp(-pow((abs(la) - 56.0) / 12.0, 2.0))
             - 0.20 * exp(-pow((abs(la) - 22.0) / 9.0, 2.0)) - 0.08 * smoothstep(70.0, 88.0, abs(la));

  // small-scale texture, stretched along the winds
  vec3 ps = vec3(p.x, p.y, p.z * 1.9) * 9.0 + w * 2.2;
  float det = fbm(ps, detail);
  float fine = detail > 4 ? fbm(ps * 4.1 + det * 1.5, 3) : 0.0;
  float v = cover + band - 0.07 + det * 0.40 + fine * 0.2 - landDry;
  float c = smoothstep(0.0, 0.27, v);
  return c * c;
}
`;

// Subtropical continental interiors are cloud-free (Sahara-like deserts).
export const CLOUD_DRY = /* glsl */ `
float cloudDry(vec3 d) {
  float cont = textureLod(tElevT, d, 7.0).g;
  float la = abs(latDeg(d));
  float subtrop = exp(-pow((la - 22.0) / 11.0, 2.0));
  return 0.22 * smoothstep(0.35, 0.9, cont) * (0.4 + 0.6 * subtrop);
}
`;

const SURFACE_UNIFORMS = /* glsl */ `
uniform samplerCube tRecon;   // original directions (pass A)
uniform samplerCube tElevT;   // palaeo-topography (pass B, mip-mapped)
uniform samplerCube tClouds;  // baked cloud density
uniform samplerCube tFeat;    // active plate boundaries
uniform float uShowTectonics;
uniform sampler2D tAlbedo;
uniform sampler2D tSurf;
uniform sampler2D tLights;
uniform sampler2D tElevNow;
uniform float uTime;
uniform float uSeaLevel;
uniform float uTempAnom;
uniform float uRelief;
uniform float uTexel;
uniform float uClock;
uniform float uLightsAmt;
uniform float uNight;
uniform float uCloudShadows;
uniform float uShowBoundaries;
uniform float uShowCoast;
uniform float uShowGrid;
uniform vec3 uSunGeo;
uniform vec3 uCamGeo;
uniform float uExposure;
`;

export const surfaceVert = /* glsl */ `
precision highp float;
precision highp samplerCube;
uniform samplerCube tElevT;
uniform float uDisp;
uniform float uSeaLevel;
varying vec3 vGeo;
varying vec2 vMapUv;
${COMMON}
void main() {
#ifdef MAP_MODE
  vMapUv = vec2(uv.x, 1.0 - uv.y);
  vGeo = vec3(0.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
#else
  vec3 w = normalize(position);
  vGeo = vec3(w.z, w.x, w.y);
  float e = textureLod(tElevT, vGeo, 0.0).r;
  float r = 1.0 + max(e - uSeaLevel, 0.0) * uDisp;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(w * r, 1.0);
#endif
}
`;

export const surfaceFrag = /* glsl */ `
precision highp float;
precision highp sampler2D;
precision highp samplerCube;
${COMMON}
${SURFACE_UNIFORMS}
varying vec3 vGeo;
varying vec2 vMapUv;

// Equirectangular lookup with seam-aware derivatives (no mip seam at the dateline).
vec4 sampleEq(sampler2D tex, vec2 uv) {
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  vec2 dxb = dFdx(vec2(fract(uv.x + 0.5), uv.y));
  vec2 dyb = dFdy(vec2(fract(uv.x + 0.5), uv.y));
  if (abs(dx.x) + abs(dy.x) > abs(dxb.x) + abs(dyb.x) + 1e-6) { dx.x = dxb.x; dy.x = dyb.x; }
  return textureGrad(tex, uv, dx, dy);
}

float meanTemp(float latAbs, float elev, float anom) {
  float s = sin(radians(latAbs));
  float s2 = s * s;
  return 28.0 - 30.0 * s2 - 20.0 * s2 * s2 + anom * (0.7 + 1.8 * s2) - 6.5 * max(elev, 0.0) / 1000.0;
}

// Palaeo-biome colour from climate zone (latitude), continentality, altitude and global warmth.
vec3 paleoBiome(float latAbs, float elev, float cont, float anom, out float T) {
  T = meanTemp(latAbs, elev, anom);
  float M = 0.28 + 0.95 * exp(-pow(latAbs / 11.0, 2.0)) + 0.6 * exp(-pow((latAbs - 58.0) / 17.0, 2.0))
          - 0.6 * exp(-pow((latAbs - 24.0) / 9.0, 2.0));
  // arid supercontinent interiors (weaker at high latitudes, where evaporation is low)
  M *= mix(1.15, mix(0.28, 0.7, smoothstep(45.0, 70.0, latAbs)), smoothstep(0.5, 0.95, cont));
  M += 0.25 * smoothstep(500.0, 2500.0, elev) * (1.0 - smoothstep(3500.0, 5000.0, elev));  // orographic rain
  M = clamp(M, 0.0, 1.2);

  vec3 redDesert = vec3(0.42, 0.16, 0.065);
  vec3 desert    = vec3(0.50, 0.33, 0.16);
  vec3 steppe    = vec3(0.24, 0.20, 0.085);
  vec3 savanna   = vec3(0.11, 0.105, 0.035);
  vec3 forest    = vec3(0.028, 0.052, 0.013);
  vec3 jungle    = vec3(0.012, 0.030, 0.006);
  vec3 taiga     = vec3(0.020, 0.034, 0.014);
  vec3 tundra    = vec3(0.13, 0.12, 0.075);
  vec3 rock      = vec3(0.19, 0.16, 0.13);

  vec3 dry = mix(desert, redDesert, smoothstep(24.0, 32.0, T));
  vec3 c = mix(dry, steppe, smoothstep(0.12, 0.32, M));
  c = mix(c, savanna, smoothstep(0.32, 0.52, M));
  c = mix(c, mix(forest, jungle, smoothstep(18.0, 25.0, T)), smoothstep(0.52, 0.82, M));
  c = mix(c, taiga, smoothstep(6.0, -1.0, T) * smoothstep(0.3, 0.55, M));
  c = mix(c, tundra, smoothstep(-3.0, -9.0, T));
  c = mix(c, rock, smoothstep(2600.0, 4800.0, elev));
  return c;
}

float gridLine(float v, float step_) {
  float f = abs(fract(v / step_ + 0.5) - 0.5) * step_;
  return 1.0 - smoothstep(0.0, fwidth(v) * 1.2, f);
}

void main() {
#ifdef MAP_MODE
  vec3 d = uvToDir(vMapUv);
#else
  vec3 d = normalize(vGeo);
#endif
  vec3 eastRaw = cross(vec3(0.0, 0.0, 1.0), d);
  vec3 east = length(eastRaw) > 1e-5 ? normalize(eastRaw) : vec3(0.0, 1.0, 0.0);
  vec3 north = cross(d, east);

  // ---- palaeo-topography and its gradient
  vec4 B = textureLod(tElevT, d, 0.0);
  float e = B.r;
  float h = uTexel * 1.0;
  float eE = textureLod(tElevT, normalize(d + east * h), 0.0).r;
  float eW = textureLod(tElevT, normalize(d - east * h), 0.0).r;
  float eN = textureLod(tElevT, normalize(d + north * h), 0.0).r;
  float eS = textureLod(tElevT, normalize(d - north * h), 0.0).r;
  vec2 grad = vec2(eE - eW, eN - eS) / (2.0 * h * 6371000.0);
  vec3 nLand = normalize(d - uRelief * (grad.x * east + grad.y * north));
  vec3 nBed = normalize(d - uRelief * 0.35 * (grad.x * east + grad.y * north));

  // ---- where did this crust come from?
  vec4 A = textureLod(tRecon, d, 0.0);
  float alen = length(A.xyz);
  float inPlate = smoothstep(0.97, 0.997, alen) * step(0.5, A.a);
  vec3 o = A.xyz / max(alen, 1e-4);
  vec2 uv = dirToUV(o);
  vec3 surf = sampleEq(tSurf, uv).rgb * inPlate;

  float sea = uSeaLevel;
  float lake = surf.r * (1.0 - smoothstep(0.5, 3.0, uTime));
  float aa = max(fwidth(e) * 0.7, 3.0);
  float land = smoothstep(-aa, aa, e - sea) * (1.0 - smoothstep(0.35, 0.65, lake));
  float elevAbove = e - sea;

  // ---- lighting setup
#ifdef MAP_MODE
  vec3 L = normalize(0.62 * d + 0.52 * north - 0.58 * east);
  vec3 V = d;
  float sunUp = 1.0;
  float day = 1.0;
#else
  vec3 L = normalize(uSunGeo);
  vec3 V = normalize(uCamGeo - d);
  float sunUp = dot(d, L);
  float day = mix(1.0, smoothstep(-0.10, 0.10, sunUp), uNight);
#endif
  vec3 sunCol = mix(vec3(1.0, 0.5, 0.25), vec3(1.0, 0.97, 0.93), smoothstep(-0.04, 0.16, sunUp)) * 2.15;
  vec3 skyAmb = vec3(0.11, 0.16, 0.26);

  float cloudShade = 1.0;
#ifndef MAP_MODE
  if (uCloudShadows > 0.0) {
    cloudShade = 1.0 - 0.6 * uCloudShadows * textureLod(tClouds, normalize(d + L * 0.006), 1.0).r;
  }
#endif

  // ---- land colour
  vec3 alb = sampleEq(tAlbedo, uv).rgb;
  vec3 albLow = textureLod(tAlbedo, uv, 7.0).rgb;
  float lum = dot(alb, vec3(0.3, 0.59, 0.11));
  float lumLow = dot(albLow, vec3(0.3, 0.59, 0.11));
  float detail = mix(1.0, clamp(lum / max(lumLow, 1e-3), 0.6, 1.6), inPlate);
  float la = latDeg(d);
  float cont = mix(textureLod(tElevT, d, 6.5).g, textureLod(tElevT, d, 8.0).g, 0.5);
  float T;
  vec3 paleo = paleoBiome(abs(la), elevAbove, cont, uTempAnom, T) * detail;
  float g = glaciation(o, uTime);
  float iceMask = surf.g;
  float presentW = (1.0 - smoothstep(0.3, 20.0, uTime)) * inPlate * (1.0 - iceMask * (1.0 - g));
  vec3 landCol = mix(paleo, alb, presentW);
  // ice sheets and permanent snow
  float ice = iceMask * g;
  ice = max(ice, smoothstep(-9.0, -17.0, T) * (1.0 - presentW));
  vec3 iceCol = vec3(0.56, 0.61, 0.68);
  landCol = mix(landCol, iceCol, clamp(ice, 0.0, 1.0));

  float ndl = dot(nLand, L);
  float diffuse = max(ndl, 0.0);
  float wrapSun = max(dot(d, L) * 0.5 + 0.5, 0.0);
  vec3 landLit = landCol * (sunCol * diffuse * cloudShade * day + skyAmb * (0.35 + 0.65 * wrapSun * day));
  // subtle specular sheen on ice
  vec3 Hh = normalize(L + V);
  landLit += ice * sunCol * 0.08 * pow(max(dot(nLand, Hh), 0.0), 24.0) * day * cloudShade;

  // ---- ocean colour
  float depth = max(sea - e, 0.0);
  vec3 deep = vec3(0.0025, 0.014, 0.045);
  vec3 mid = vec3(0.005, 0.045, 0.10);
  vec3 shallow = vec3(0.025, 0.21, 0.24);
  float ridge = smoothstep(6200.0, 2300.0, depth);
  vec3 water = mix(deep, mid, ridge * 0.75);
  water = mix(water, shallow, exp(-depth / 85.0));
  water = mix(water, vec3(0.20, 0.30, 0.22), exp(-depth / 12.0) * 0.6);   // sandy bottom in the surf zone
  float bedLight = dot(nBed, L) - dot(d, L);
  water *= clamp(1.0 + bedLight * 6.0 * smoothstep(0.0, 800.0, depth), 0.55, 1.6);

  // sea ice (none in greenhouse times; Antarctic after ~34 Ma, Arctic after ~3 Ma)
  float iceLatN = mix(73.0, 95.0, smoothstep(2.0, 7.0, uTime));
  float iceLatS = mix(63.5, 95.0, smoothstep(10.0, 36.0, uTime));
  float seaIce = 0.0, cracks = 1.0;
  if (abs(la) > min(iceLatN, iceLatS) - 6.0) {
    float edge = (la > 0.0 ? iceLatN : iceLatS) + 2.2 * fbm(d * 9.0, 4);
    seaIce = smoothstep(edge, edge + 1.8, abs(la));
    cracks = 0.85 + 0.15 * smoothstep(0.1, 0.5, abs(snoise(d * 90.0)));
  }

  // waves + sun glint
  vec3 wn = vec3(snoise(d * 400.0 + uClock * 0.05), snoise(d * 400.0 + 17.0 - uClock * 0.04), 0.0) * 0.035;
  vec3 nW = normalize(d + wn.x * east + wn.y * north);
  float NdH = max(dot(nW, Hh), 0.0);
  float rough = 0.11;
  float a2 = rough * rough;
  float Dggx = a2 / (PI * pow(NdH * NdH * (a2 - 1.0) + 1.0, 2.0));
  float NdV = max(dot(nW, V), 0.02);
  float F = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
  vec3 spec = sunCol * Dggx * F * 0.25 * max(dot(nW, L), 0.0) * cloudShade * day;
  vec3 skyRefl = mix(vec3(0.05, 0.10, 0.20), vec3(0.20, 0.32, 0.50), 1.0 - NdV) * F * (0.3 + 0.7 * day);
#ifdef MAP_MODE
  spec *= 0.0;
  skyRefl *= 0.3;
#endif
  vec3 waterLit = water * (sunCol * 0.45 * max(dot(d, L), 0.0) * cloudShade * day + skyAmb * 0.9) + spec + skyRefl;
  vec3 seaIceLit = vec3(0.46, 0.52, 0.58) * cracks * (sunCol * max(dot(d, L), 0.0) * cloudShade * day + skyAmb);
  waterLit = mix(waterLit, seaIceLit, seaIce);

  vec3 col = mix(waterLit, landLit, land);

  // ---- night side: city lights appear only in the present day
#ifndef MAP_MODE
  float lights = sampleEq(tLights, uv).r;
  lights = pow(lights, 2.2) * inPlate;
  col += vec3(1.0, 0.68, 0.34) * lights * 3.0 * (1.0 - day) * uLightsAmt * land * uNight;
#endif

  // ---- overlays
  if (uShowBoundaries > 0.0) {
    float fb = fwidth(A.a);
    float bnd = clamp((fb - 0.05) * 3.0, 0.0, 1.0);
    col = mix(col, vec3(1.0, 0.36, 0.12) * 1.6, bnd * 0.85 * uShowBoundaries);
  }
  if (uShowTectonics > 0.0) {
    // red = rising (mountain building), blue = sinking (cooling seafloor, eroding ranges)
    float rate = B.a;
    float up = smoothstep(3.0, 80.0, rate);
    float down = smoothstep(3.0, 110.0, -rate);
    vec3 lum = vec3(dot(col, vec3(0.3, 0.59, 0.11)));
    vec3 base = mix(col, lum, 0.55 * uShowTectonics);
    base = mix(base, vec3(1.0, 0.22, 0.08) * (0.5 + 0.9 * up), up * 0.8 * uShowTectonics);
    base = mix(base, vec3(0.12, 0.42, 1.0) * (0.35 + 0.6 * down), down * 0.7 * uShowTectonics);
    vec4 F = textureLod(tFeat, d, 0.0);
    float aa = 1.0 + 60.0 * fwidth(d.x + d.y + d.z);
    base = mix(base, vec3(1.0, 0.3, 0.12) * 2.2, clamp(F.b * 1.6 * aa, 0.0, 1.0) * uShowTectonics);
    base = mix(base, vec3(1.0, 0.86, 0.3) * 2.0, clamp(F.a * 1.6 * aa, 0.0, 1.0) * uShowTectonics);
    col = base;
  }
  if (uShowCoast > 0.0) {
    float en = texture(tElevNow, dirToUV(d)).r;
    float cl = 1.0 - smoothstep(0.0, fwidth(en) * 1.3 + 1.0, abs(en));
    col = mix(col, vec3(0.55, 0.95, 1.0) * 1.3, cl * 0.8 * uShowCoast);
  }
  if (uShowGrid > 0.0) {
    float lo = lonDeg(d);
    float gl = max(gridLine(la, 30.0), gridLine(lo, 30.0) * smoothstep(88.0, 80.0, abs(la)));
    float eq = 1.0 - smoothstep(0.0, fwidth(la) * 1.5, abs(la));
    col = mix(col, vec3(0.8, 0.9, 1.0), (gl * 0.28 + eq * 0.3) * uShowGrid);
  }

#ifdef MAP_MODE
  // clouds drawn directly onto the flat map
  if (uCloudShadows > 0.0) {
    float c = texture(tClouds, d).r;
    col = mix(col, vec3(0.9, 0.92, 0.95) * 1.2, c * 0.5 * uCloudShadows);
  }
#endif

  gl_FragColor = vec4(col * uExposure, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Cloud shell
// ---------------------------------------------------------------------------
export const cloudVert = /* glsl */ `
varying vec3 vGeo;
varying vec3 vWorld;
void main() {
  vec3 w = normalize(position);
  vGeo = vec3(w.z, w.x, w.y);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const cloudFrag = /* glsl */ `
precision highp float;
precision highp samplerCube;
${COMMON}
uniform samplerCube tClouds;
uniform vec3 uSunGeo;
uniform vec3 uCamGeo;
uniform float uNight;
uniform float uOpacity;
uniform float uExposure;
varying vec3 vGeo;
void main() {
  vec3 d = normalize(vGeo);
  float c = texture(tClouds, d).r;
  // extra fine detail for close-ups, only on the soft edges
  c = clamp(c + 0.5 * snoise(d * 240.0) * c * (1.0 - c), 0.0, 1.0);
  if (c < 0.004) discard;
  vec3 L = normalize(uSunGeo);
  float sunUp = dot(d, L);
  float day = mix(1.0, smoothstep(-0.12, 0.12, sunUp), uNight);
  vec3 sunCol = mix(vec3(1.0, 0.55, 0.3), vec3(1.0, 0.98, 0.95), smoothstep(-0.04, 0.16, sunUp)) * 2.15;
  // self-shadowing approximation: denser surroundings towards the sun darken the base
  float thick = textureLod(tClouds, normalize(d + L * 0.004), 2.0).r;
  float lit = max(sunUp * 0.6 + 0.4, 0.0) * day;
  vec3 col = vec3(0.78) * (sunCol * lit * (1.0 - 0.3 * thick) + vec3(0.10, 0.13, 0.19));
  float V = max(dot(d, normalize(uCamGeo - d)), 0.0);
  float alpha = c * uOpacity * (0.8 + 0.2 * V);
  gl_FragColor = vec4(col * uExposure, alpha);
}
`;
