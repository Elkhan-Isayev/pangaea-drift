import * as THREE from 'three';
import { geoFromLatLon, geoToWorld } from './reconstruction.js';
import { smoothstep } from './scene.js';
import { placeName } from './i18n.js';

const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const add = (...vs) => vs.reduce((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]], [0, 0, 0]);
const neg = (v) => [-v[0], -v[1], -v[2]];
const window01 = (t, a, b, fade = 8) => smoothstep(a - fade, a, t) * (1 - smoothstep(b, b + fade, t));

// Labels that ride on their plates, plus supercontinent and palaeo-ocean names
// placed from the reconstructed continent positions.
export class Labels {
  constructor(container, meta, rotations) {
    this.rot = rotations;
    this.items = [];
    this.byId = {};
    for (const l of meta.labels) {
      const item = { ...l, geo0: geoFromLatLon(l.lat, l.lon), el: this.make(container, l.kind) };
      this.items.push(item);
      this.byId[l.id] = item;
    }
    const dyn = [
      ['pangaea', 'super'],
      ['laurasia', 'super'],
      ['gondwana', 'super'],
      ['panthalassa', 'ocean'],
      ['tethys', 'ocean'],
      ['atlantic', 'ocean'],
      ['pacific', 'ocean'],
      ['indian', 'ocean'],
    ];
    this.dynamic = dyn.map(([id, kind]) => ({ id, kind, el: this.make(container, kind) }));
    this.visible = true;
    this.tmp = new THREE.Vector3();
    this.translate();
  }

  make(container, kind) {
    const el = document.createElement('div');
    el.className = `lbl ${kind}`;
    container.appendChild(el);
    return el;
  }

  translate() {
    for (const it of [...this.items, ...this.dynamic]) it.el.textContent = placeName(it.id);
  }

  pos(id, t) {
    const it = this.byId[id];
    return this.rot.rotate(it.plate, t, it.geo0);
  }

  update(t, scene) {
    const P = (id) => this.pos(id, t);
    const na = P('na'), sa = P('sa'), af = P('af'), eu = P('eu'), as = P('as');
    const ind = P('in'), au = P('au'), an = P('an'), ar = P('ar');
    const pangea = norm(add(af, sa, na, eu, an));
    const dynPos = {
      pangaea: [pangea, window01(t, 185, 260, 12)],
      laurasia: [norm(add(na, eu, as)), window01(t, 100, 178, 10)],
      gondwana: [norm(add(af, sa, an, ind, au)), window01(t, 110, 178, 10)],
      panthalassa: [neg(pangea), window01(t, 150, 260, 12)],
      tethys: [norm(add(ar, ind, as, as)), window01(t, 45, 260, 10)],
      atlantic: [norm(add(na, af)), window01(t, -10, 130, 15)],
      pacific: [neg(norm(add(af, eu, af))), window01(t, -10, 140, 15)],
      indian: [norm(add(af, au, ind, [0, 0, -1.2])), window01(t, -10, 85, 12)],
    };

    for (const it of this.items) this.place(it.el, this.rot.rotate(it.plate, t, it.geo0), 1, scene);
    for (const d of this.dynamic) {
      const [g, a] = dynPos[d.id];
      this.place(d.el, g, a, scene);
    }
  }

  place(el, geo, alpha, scene) {
    if (!this.visible || alpha < 0.01) {
      el.style.opacity = 0;
      return;
    }
    const w = window.innerWidth, h = window.innerHeight;
    let x, y, vis;
    if (scene.mode === 'map') {
      const lon = Math.atan2(geo[1], geo[0]);
      const lat = Math.asin(Math.max(-1, Math.min(1, geo[2])));
      this.tmp.set(lon / Math.PI, (lat / Math.PI), 0).project(scene.mapCamera);
      vis = 1;
    } else {
      const p = geoToWorld(geo).normalize();
      const camDir = scene.camera.position.clone().normalize();
      const facing = p.dot(camDir);
      // visible only on the near hemisphere (with the horizon cut accounting for camera distance)
      const horizon = 1 / scene.camera.position.length();
      vis = smoothstep(horizon + 0.02, horizon + 0.2, facing);
      this.tmp.copy(p).multiplyScalar(1.015).project(scene.camera);
    }
    x = (this.tmp.x * 0.5 + 0.5) * w;
    y = (-this.tmp.y * 0.5 + 0.5) * h;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    el.style.opacity = (alpha * vis).toFixed(3);
  }
}
