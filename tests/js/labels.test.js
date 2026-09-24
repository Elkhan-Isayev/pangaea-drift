import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Labels } from '../../src/labels.js';
import { setLang } from '../../src/i18n.js';
import { geoFromLatLon, geoToWorld } from '../../src/reconstruction.js';
import { readJson } from './helpers.js';

const meta = readJson('meta.json');
const identity = { rotate: (plate, t, v) => v };

function globeScene(lat, lon) {
  const camera = new THREE.PerspectiveCamera(32, 1.6, 0.01, 200);
  camera.position.copy(geoToWorld(geoFromLatLon(lat, lon)).multiplyScalar(4));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  return { mode: 'globe', camera };
}

const byText = (root, text) => [...root.querySelectorAll('.lbl')].find((el) => el.textContent === text);

beforeEach(() => {
  document.body.innerHTML = '<div id="labels"></div>';
  setLang('en');
});

describe('Labels', () => {
  it('creates one element per continent plus the supercontinents and palaeo-oceans', () => {
    const root = document.getElementById('labels');
    new Labels(root, meta, identity);
    expect(root.children.length).toBe(meta.labels.length + 8);
    expect(byText(root, 'Africa').className).toContain('continent');
    expect(byText(root, 'Pangaea').className).toContain('super');
    expect(byText(root, 'Tethys').className).toContain('ocean');
  });

  it('re-translates in place', () => {
    const root = document.getElementById('labels');
    const labels = new Labels(root, meta, identity);
    setLang('az');
    labels.translate();
    expect(byText(root, 'Afrika')).toBeTruthy();
    expect(byText(root, 'Sakit okean')).toBeTruthy();
    setLang('ru');
    labels.translate();
    expect(byText(root, 'Гондвана')).toBeTruthy();
  });

  it('shows labels on the near side of the globe and hides the far side', () => {
    const root = document.getElementById('labels');
    const labels = new Labels(root, meta, identity);
    labels.update(0, globeScene(5, 20)); // camera above Africa
    expect(Number(byText(root, 'Africa').style.opacity)).toBeGreaterThan(0.9);
    expect(Number(byText(root, 'Australia').style.opacity)).toBe(0);
    expect(byText(root, 'Africa').style.transform).toMatch(/translate\(/);
  });

  it('fades names in and out with geological time', () => {
    const root = document.getElementById('labels');
    const labels = new Labels(root, meta, identity);
    const scene = globeScene(0, 0);
    const opacity = (name) => Number(byText(root, name).style.opacity);
    labels.update(0, scene);
    expect(opacity('Pangaea')).toBe(0);
    labels.update(250, scene);
    expect(opacity('Atlantic Ocean')).toBe(0);
    expect(opacity('Tethys') + opacity('Pangaea') + opacity('Panthalassa')).toBeGreaterThan(0);
  });

  it('hides everything when switched off', () => {
    const root = document.getElementById('labels');
    const labels = new Labels(root, meta, identity);
    labels.visible = false;
    labels.update(0, globeScene(5, 20));
    for (const el of root.children) expect(Number(el.style.opacity)).toBe(0);
  });
});
