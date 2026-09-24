import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { atmoFrag, atmoVert, starsFrag, starsVert } from './shaders/atmosphere.glsl.js';
import { cloudFrag, cloudVert, surfaceFrag, surfaceVert } from './shaders/surface.glsl.js';
import { geoFromLatLon, geoToWorld, worldToGeo } from './reconstruction.js';
import { CloudLayer } from './clouds.js';

const EXPOSURE = 1.0;

export class PlanetScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(32, aspect, 0.01, 200);
    const start = geoToWorld(geoFromLatLon(6, 14)).multiplyScalar(this.defaultDistance());
    this.camera.position.copy(start);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 1.18;
    this.controls.maxDistance = 9;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 0.8;
    this.controls.autoRotateSpeed = 0.35;

    // flat map camera
    this.mapCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.mapCamera.position.set(0, 0, 5);
    this.mapControls = new OrbitControls(this.mapCamera, canvas);
    this.mapControls.enableRotate = false;
    this.mapControls.screenSpacePanning = true;
    this.mapControls.minZoom = 1;
    this.mapControls.maxZoom = 12;
    this.mapControls.enabled = false;
    this.mapControls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.mapControls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };

    this.mode = 'globe';
    this.sunFollow = true;
    this.clock = 0;
    this.addStars();
    this.resize();
  }

  defaultDistance() {
    const aspect = window.innerWidth / window.innerHeight;
    return aspect < 0.8 ? 6.4 : 4.3;
  }

  setRecon(recon) {
    this.recon = recon;
    this.uniforms.tRecon.value = recon.targetA.texture;
    this.uniforms.tElevT.value = recon.targetB.texture;
    this.uniforms.uTexel.value = recon.texelAngle;
  }

  init(tex, recon) {
    this.recon = recon;
    const common = {
      tRecon: { value: recon.targetA.texture },
      tElevT: { value: recon.targetB.texture },
      tAlbedo: { value: tex.albedo },
      tSurf: { value: tex.surface },
      tLights: { value: tex.lights },
      tElevNow: { value: tex.elev },
      uTime: { value: 250 },
      uSeaLevel: { value: 0 },
      uTempAnom: { value: 0 },
      uRelief: { value: 16 },
      uDisp: { value: (16 * 0.5) / 6371000 },
      uTexel: { value: recon.texelAngle },
      uClock: { value: 0 },
      uLightsAmt: { value: 0 },
      uNight: { value: 0 },
      uCloudShadows: { value: 1 },
      uShowBoundaries: { value: 0 },
      uShowCoast: { value: 0 },
      uShowGrid: { value: 0 },
      uSunGeo: { value: new THREE.Vector3(1, 0, 0) },
      uCamGeo: { value: new THREE.Vector3(3, 0, 0) },
      uExposure: { value: EXPOSURE },
      tClouds: { value: null },
    };
    this.uniforms = common;
    this.cloudLayer = new CloudLayer(this.renderer, common.tElevT);
    common.tClouds.value = this.cloudLayer.texture;

    this.globeMat = new THREE.ShaderMaterial({
      vertexShader: surfaceVert,
      fragmentShader: surfaceFrag,
      uniforms: common,
    });
    this.globe = new THREE.Mesh(new THREE.SphereGeometry(1, 720, 360), this.globeMat);
    this.scene.add(this.globe);

    this.cloudUniforms = {
      tClouds: common.tClouds,
      uSunGeo: common.uSunGeo,
      uCamGeo: common.uCamGeo,
      uNight: common.uNight,
      uExposure: common.uExposure,
      uOpacity: { value: 0.82 },
    };
    this.clouds = new THREE.Mesh(
      new THREE.SphereGeometry(1.009, 256, 128),
      new THREE.ShaderMaterial({
        vertexShader: cloudVert,
        fragmentShader: cloudFrag,
        uniforms: this.cloudUniforms,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.clouds.renderOrder = 1;
    this.scene.add(this.clouds);

    this.atmoUniforms = {
      uCamPos: { value: new THREE.Vector3() },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uNight: common.uNight,
      uExposure: common.uExposure,
      uIntensity: { value: 2.4 },
    };
    this.atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.028, 160, 80),
      new THREE.ShaderMaterial({
        vertexShader: atmoVert,
        fragmentShader: atmoFrag,
        uniforms: this.atmoUniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.atmo.renderOrder = 2;
    this.scene.add(this.atmo);

    // flat map
    this.mapMat = new THREE.ShaderMaterial({
      vertexShader: surfaceVert,
      fragmentShader: surfaceFrag,
      uniforms: common,
      defines: { MAP_MODE: 1 },
    });
    this.map = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), this.mapMat);
    this.map.visible = false;
    this.mapScene = new THREE.Scene();
    this.mapScene.background = new THREE.Color(0x02040a);
    this.mapScene.add(this.map);

    this.setupComposer();
  }

  addStars() {
    const n = 9000;
    const pos = new Float32Array(n * 3);
    const size = new Float32Array(n);
    const tint = new Float32Array(n * 3);
    const rnd = mulberry32(7);
    for (let i = 0; i < n; i++) {
      // concentrate some stars along a "galactic" band
      let v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
      if (i % 3 === 0) {
        v.y *= 0.18;
        v.normalize();
        v.applyAxisAngle(new THREE.Vector3(1, 0, 0.3).normalize(), 1.05);
      }
      v.multiplyScalar(80);
      pos.set([v.x, v.y, v.z], i * 3);
      const m = Math.pow(rnd(), 9);
      size[i] = 1.0 + m * 5.5;
      const temp = rnd();
      const c = temp < 0.2 ? [0.75, 0.85, 1.0] : temp > 0.85 ? [1.0, 0.85, 0.7] : [1, 1, 1];
      const b = 0.25 + m * 2.5 + rnd() * 0.35;
      tint.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('size', new THREE.BufferAttribute(size, 1));
    g.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
    this.stars = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        vertexShader: starsVert,
        fragmentShader: starsFrag,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    );
    this.stars.renderOrder = -1;
    this.scene.add(this.stars);
  }

  setupComposer() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.5, 1.05);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
  }

  // Quality presets: cube-map size and a matching cap on the device pixel ratio.
  setPixelRatio(cubeSize) {
    const cap = cubeSize >= 2048 ? 2 : cubeSize >= 1536 ? 1.5 : 1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cap));
    this.resize();
  }

  setMode(mode) {
    this.mode = mode;
    const map = mode === 'map';
    this.map.visible = map;
    this.controls.enabled = !map;
    this.mapControls.enabled = map;
    this.renderPass.scene = map ? this.mapScene : this.scene;
    this.renderPass.camera = map ? this.mapCamera : this.camera;
    this.bloom.enabled = !map;
    this.resize();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // fit the 2:1 map into the free area between the HUD (top) and the timeline (bottom)
    const top = w < 760 ? 120 : 190;
    const bottom = w < 760 ? 190 : 130;
    const side = w < 760 ? 10 : 30;
    const aw = w - 2 * side;
    const ah = Math.max(h - top - bottom, 100);
    const scale = Math.min(aw / 2, ah); // pixels per world unit
    const cy = (top - bottom) / 2; // area centre offset from the screen centre (px, down)
    Object.assign(this.mapCamera, {
      left: -w / 2 / scale,
      right: w / 2 / scale,
      top: (h / 2 + cy) / scale,
      bottom: (-h / 2 + cy) / scale,
    });
    this.mapCamera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setSize(w, h);
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
    }
  }

  setState(s) {
    const u = this.uniforms;
    u.uTime.value = s.time;
    u.uSeaLevel.value = s.seaLevel;
    u.uTempAnom.value = s.temp;
    u.uLightsAmt.value = 1 - smoothstep(0.0, 0.5, s.time);
  }

  render(dt) {
    this.clock += dt;
    this.uniforms.uClock.value = this.clock;
    if (this.cloudsEnabled !== false) this.cloudLayer.update(this.clock);
    if (this.mode === 'globe') {
      this.controls.update();
      const cam = this.camera;
      const camDir = cam.position.clone().normalize();
      let sun;
      if (this.sunFollow) {
        const right = new THREE.Vector3().crossVectors(cam.up, camDir).normalize();
        const up = new THREE.Vector3().crossVectors(camDir, right).normalize();
        sun = camDir.clone().multiplyScalar(1.0).addScaledVector(up, 0.55).addScaledVector(right, -0.75).normalize();
      } else {
        sun = geoToWorld(geoFromLatLon(8, 25)).normalize();
      }
      this.uniforms.uSunGeo.value.copy(worldToGeo(sun));
      this.uniforms.uCamGeo.value.copy(worldToGeo(cam.position));
      this.atmoUniforms.uSunDir.value.copy(sun);
      this.atmoUniforms.uCamPos.value.copy(cam.position);
      // keep the sun direction fixed relative to the view when following
      this.stars.position.copy(cam.position);
    } else {
      this.mapControls.update();
      this.clampMap();
    }
    this.composer.render();
  }

  clampMap() {
    const c = this.mapCamera;
    const visW = (c.right - c.left) / c.zoom;
    const visH = (c.top - c.bottom) / c.zoom;
    const maxX = Math.max(0, 1.0 - visW / 2);
    const maxY = Math.max(0, 0.5 - visH / 2);
    const tx = THREE.MathUtils.clamp(this.mapControls.target.x, -maxX, maxX);
    const ty = THREE.MathUtils.clamp(this.mapControls.target.y, -maxY, maxY);
    const dx = tx - this.mapControls.target.x;
    const dy = ty - this.mapControls.target.y;
    if (dx || dy) {
      this.mapControls.target.set(tx, ty, 0);
      c.position.x += dx;
      c.position.y += dy;
    }
  }
}

export function smoothstep(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
