import { createTextures, loadData } from './data.js';
import { EVENTS, PERIODS, T_MAX, advanceTime, epochAt, eventAt, periodAt, seaLevelAt, tempAnomalyAt } from './geo-timeline.js';
import { Labels } from './labels.js';
import { LANGS, epochName, eventText, fmt, getLang, onLangChange, periodName, setLang, t, translateDom } from './i18n.js';
import { PlateRotations, Reconstruction } from './reconstruction.js';
import { PlanetScene } from './scene.js';

const $ = (id) => document.getElementById(id);

const state = {
  time: T_MAX,
  playing: false,
  speed: 1,
  dirty: true,
  scrubbing: false,
  lastEvent: null,
};

function buildLangSwitcher() {
  const nav = $('lang');
  for (const l of LANGS) {
    const b = document.createElement('button');
    b.textContent = l.label;
    b.title = l.name;
    b.dataset.lang = l.code;
    b.addEventListener('click', () => setLang(l.code));
    nav.appendChild(b);
  }
  const mark = () => nav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.lang === getLang()));
  mark();
  onLangChange(mark);
}

async function main() {
  buildLangSwitcher();
  translateDom();
  onLangChange(() => translateDom());

  const scene = new PlanetScene($('scene'));
  if (!scene.renderer.capabilities.isWebGL2) throw new Error(t('webgl2'));

  const raw = await loadData((p) => {
    $('load-bar').style.width = `${(p * 100).toFixed(1)}%`;
    $('load-status').textContent = `${Math.round(p * 100)}%`;
  });
  $('load-status').textContent = t('building');
  await new Promise((r) => setTimeout(r, 30));

  const tex = createTextures(raw);
  const quality = Number($('opt-quality').value);
  scene.setPixelRatio(quality);
  let recon = new Reconstruction(scene.renderer, raw, tex, quality);
  scene.init(tex, recon);
  const rotations = new PlateRotations(raw);
  const labels = new Labels($('labels'), raw.meta, rotations);

  buildTimeline();
  onLangChange(() => {
    labels.translate();
    renderPeriods();
    state.lastEvent = null;
    updateHUD(state.time, seaLevelAt(state.time), tempAnomalyAt(state.time));
  });
  bindUI(scene, () => recon, (size) => {
    recon.dispose();
    scene.setPixelRatio(size);
    recon = new Reconstruction(scene.renderer, raw, tex, size);
    scene.setRecon(recon);
    applyOptions(scene);
    state.dirty = true;
  }, labels);
  applyOptions(scene);

  // first frame before revealing
  updateWorld(scene, recon);
  scene.render(0);

  $('loader').style.opacity = 0;
  setTimeout(() => $('loader').remove(), 1000);
  for (const id of ['hud', 'event', 'settings', 'timeline-wrap']) $(id).classList.remove('hidden');
  applyOptions(scene);
  setTimeout(() => setPlaying(true), 1800);

  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (state.playing && !state.scrubbing) {
      setTime(advanceTime(state.time, dt, state.speed));
      if (state.time <= 0) setPlaying(false);
    }
    if (state.dirty) updateWorld(scene, recon);
    labels.update(state.time, scene);
    scene.render(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function setTime(t) {
  const nt = Math.min(Math.max(t, 0), T_MAX);
  if (nt !== state.time) {
    state.time = nt;
    state.dirty = true;
  }
}

function setPlaying(p) {
  if (p && state.time <= 0) setTime(T_MAX);
  state.playing = p;
  $('ico-play').style.display = p ? 'none' : '';
  $('ico-pause').style.display = p ? '' : 'none';
}

function updateWorld(scene, recon) {
  const t = state.time;
  const sea = seaLevelAt(t);
  const temp = tempAnomalyAt(t);
  recon.update(t, sea);
  scene.setState({ time: t, seaLevel: sea, temp });
  state.dirty = false;
  updateHUD(t, sea, temp);
}

function updateHUD(time, sea, temp) {
  const now = time <= 0.0005;
  $('age-value').textContent = now ? t('today') : fmt(time, time < 10 ? 2 : 1);
  $('age-unit').textContent = now ? '' : t('maAgo');
  const p = periodAt(time);
  $('period-name').textContent = periodName(p.id);
  $('period-swatch').style.background = p.color;
  $('period-swatch').style.color = p.color;
  $('epoch-name').textContent = epochName(epochAt(time).id);
  $('stat-sea').textContent = `${sea >= 0.5 ? '+' : ''}${fmt(Math.round(sea))} ${t('meters')}`;
  $('stat-temp').textContent = `${temp >= 0.05 ? '+' : ''}${fmt(temp, 1)} °C`;

  const x = ((T_MAX - time) / T_MAX) * 100;
  $('tl-head').style.left = `${x}%`;
  $('tl-progress').style.width = `${x}%`;
  document.querySelectorAll('#tl-events .ev').forEach((el) => el.classList.toggle('past', Number(el.dataset.t) >= time - 1e-6));

  const ev = eventAt(time);
  if (ev !== state.lastEvent) {
    state.lastEvent = ev;
    const card = $('event');
    card.classList.add('swap');
    setTimeout(() => {
      const [title, text] = eventText(ev.id);
      $('event-age').textContent = ev.t === 0 ? t('eventNow') : t('eventAgo')(fmt(ev.t, ev.t % 1 ? 1 : 0));
      $('event-title').textContent = title;
      $('event-text').textContent = text;
      card.classList.remove('swap');
    }, 280);
  }
}

function renderPeriods() {
  const periods = $('tl-periods');
  periods.textContent = '';
  for (const p of PERIODS) {
    const a = Math.min(p.start, T_MAX);
    const b = Math.max(p.end, 0);
    if (a <= b) continue;
    const el = document.createElement('div');
    const name = periodName(p.id);
    el.className = 'p';
    el.style.left = `${((T_MAX - a) / T_MAX) * 100}%`;
    el.style.width = `${((a - b) / T_MAX) * 100}%`;
    el.style.background = p.color;
    el.textContent = a - b > 12 ? name : '';
    el.title = t('periodRange')(name, fmt(p.start, 1), fmt(p.end, p.end ? 1 : 0));
    periods.appendChild(el);
  }
}

function buildTimeline() {
  renderPeriods();
  const ticks = $('tl-ticks');
  for (let t = T_MAX; t >= 0; t -= 25) {
    const s = document.createElement('span');
    s.style.left = `${((T_MAX - t) / T_MAX) * 100}%`;
    s.textContent = t === 0 ? '0' : `${t}`;
    ticks.appendChild(s);
  }
  const evs = $('tl-events');
  const tip = document.createElement('div');
  tip.className = 'tl-tip';
  tip.style.display = 'none';
  document.body.appendChild(tip);
  for (const e of EVENTS) {
    const el = document.createElement('div');
    el.className = 'ev';
    el.dataset.t = e.t;
    el.style.left = `${((T_MAX - e.t) / T_MAX) * 100}%`;
    el.addEventListener('pointerenter', () => {
      const r = el.getBoundingClientRect();
      tip.innerHTML = `<b>${e.t === 0 ? t('tipNow') : t('tipMa')(fmt(e.t, e.t % 1 ? 1 : 0))}</b>${eventText(e.id)[0]}`;
      tip.style.left = `${r.left + r.width / 2}px`;
      tip.style.top = `${r.top}px`;
      tip.style.display = '';
    });
    el.addEventListener('pointerleave', () => (tip.style.display = 'none'));
    el.addEventListener('pointerdown', (ev) => {
      ev.stopPropagation();
      setTime(e.t);
    });
    evs.appendChild(el);
  }

  const tl = $('timeline');
  const scrub = (ev) => {
    const r = tl.getBoundingClientRect();
    const f = Math.min(Math.max((ev.clientX - r.left) / r.width, 0), 1);
    setTime(T_MAX * (1 - f));
  };
  tl.addEventListener('pointerdown', (ev) => {
    state.scrubbing = true;
    tl.setPointerCapture(ev.pointerId);
    scrub(ev);
  });
  tl.addEventListener('pointermove', (ev) => state.scrubbing && scrub(ev));
  const end = () => (state.scrubbing = false);
  tl.addEventListener('pointerup', end);
  tl.addEventListener('pointercancel', end);
}

const options = {};

function applyOptions(scene) {
  const u = scene.uniforms;
  u.uCloudShadows.value = options.clouds ? 1 : 0;
  scene.clouds.visible = options.clouds && scene.mode === 'globe';
  scene.cloudsEnabled = options.clouds;
  scene.atmo.visible = options.atmo;
  u.uShowBoundaries.value = options.bounds ? 1 : 0;
  u.uShowTectonics.value = options.tectonics ? 1 : 0;
  $('legend').classList.toggle('hidden', !options.tectonics);
  u.uShowCoast.value = options.coast ? 1 : 0;
  u.uShowGrid.value = options.grid ? 1 : 0;
  u.uNight.value = options.night ? 1 : 0;
  scene.sunFollow = !options.night;
  scene.controls.autoRotate = options.rotate;
  u.uRelief.value = options.relief;
  u.uDisp.value = (options.relief * 0.5) / 6371000;
  $('labels').style.display = options.labels ? '' : 'none';
}

function bindUI(scene, getRecon, rebuild, labels) {
  const read = () => {
    options.clouds = $('opt-clouds').checked;
    options.atmo = $('opt-atmo').checked;
    options.labels = $('opt-labels').checked;
    options.night = $('opt-night').checked;
    options.bounds = $('opt-bounds').checked;
    options.tectonics = $('opt-tectonics').checked;
    options.coast = $('opt-coast').checked;
    options.grid = $('opt-grid').checked;
    options.rotate = $('opt-rotate').checked;
    options.relief = Number($('opt-relief').value);
    $('opt-relief-v').textContent = `×${options.relief}`;
    applyOptions(scene);
  };
  read();
  document.querySelectorAll('#settings-panel input').forEach((el) => el.addEventListener('input', read));
  $('opt-quality').addEventListener('change', (e) => rebuild(Number(e.target.value)));

  $('settings-toggle').addEventListener('click', () => $('settings-panel').classList.toggle('closed'));
  if (window.innerWidth < 760) $('settings-panel').classList.add('closed');

  const setView = (v) => {
    document.body.classList.toggle('map-mode', v === 'map');
    if (v === 'map') $('settings-panel').classList.add('closed'); // keep the event card visible
    scene.setMode(v);
    document.querySelectorAll('#view-mode button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
    applyOptions(scene);
  };
  document.querySelectorAll('#view-mode button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.v)));

  $('btn-play').addEventListener('click', () => setPlaying(!state.playing));
  $('btn-restart').addEventListener('click', () => {
    setTime(T_MAX);
    setPlaying(true);
  });
  document.querySelectorAll('#speed button').forEach((b) =>
    b.addEventListener('click', () => {
      state.speed = Number(b.dataset.s);
      document.querySelectorAll('#speed button').forEach((x) => x.classList.toggle('on', x === b));
    }),
  );

  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.code === 'Space') {
      e.preventDefault();
      setPlaying(!state.playing);
    } else if (e.code === 'ArrowLeft') setTime(state.time + (e.shiftKey ? 10 : 1));
    else if (e.code === 'ArrowRight') setTime(state.time - (e.shiftKey ? 10 : 1));
    else if (e.code === 'KeyM') setView(scene.mode === 'globe' ? 'map' : 'globe');
    else if (e.code === 'KeyR') {
      setTime(T_MAX);
      setPlaying(true);
    }
  });
  window.addEventListener('resize', () => scene.resize());
  // OrbitControls cancels the default pointerdown, so a stale selection would never clear
  $('scene').addEventListener('pointerdown', () => window.getSelection()?.removeAllRanges());

  // debugging / automation hook
  window.__drift = { state, setTime, setPlaying, scene, getRecon, labels, setView };
}

main().catch((err) => {
  console.error(err);
  $('load-status').textContent = `${t('error')}: ${err.message}`;
});
