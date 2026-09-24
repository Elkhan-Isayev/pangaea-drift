import * as THREE from 'three';
import { COMMON } from './shaders/common.glsl.js';
import { CLOUDS, CLOUD_DRY } from './shaders/surface.glsl.js';

// The procedural cloud field is expensive, so it is baked into a cube map.
// One face is re-rendered per frame (clouds drift slowly), and the cloud shell,
// the cloud shadows and the flat map all just sample the cube.
const bakeVert = /* glsl */ `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;

const bakeFrag = /* glsl */ `
precision highp float;
precision highp samplerCube;
${COMMON}
${CLOUDS}
uniform samplerCube tElevT;
uniform float uClock;
${CLOUD_DRY}
varying vec3 vPos;
void main() {
  vec3 d = normalize(vPos);
  gl_FragColor = vec4(cloudField(d, uClock, 6, cloudDry(d)), 0.0, 0.0, 1.0);
}
`;

export class CloudLayer {
  constructor(renderer, elevUniform, size = 1024) {
    this.renderer = renderer;
    this.target = new THREE.WebGLCubeRenderTarget(size, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    this.material = new THREE.ShaderMaterial({
      vertexShader: bakeVert,
      fragmentShader: bakeFrag,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      uniforms: { tElevT: elevUniform, uClock: { value: 0 } },
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), this.material);
    box.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(box);
    this.cam = new THREE.CubeCamera(0.05, 10, this.target);
    this.face = 0;
  }

  get texture() {
    return this.target.texture;
  }

  // Bake all faces (first frame / after big jumps) or just the next one.
  update(clock, all = false) {
    const r = this.renderer;
    const prev = r.getRenderTarget();
    this.material.uniforms.uClock.value = clock;
    if (all || !this.baked) {
      this.cam.update(r, this.scene);
      this.baked = true;
    } else {
      r.setRenderTarget(this.target, this.face);
      r.render(this.scene, this.cam.children[this.face]);
      this.face = (this.face + 1) % 6;
    }
    r.setRenderTarget(prev);
  }
}
