// Geological time scale, key events and palaeo-environment curves (0–250 Ma).

export const T_MAX = 250;

// ICS International Chronostratigraphic Chart colours.
// ICS International Chronostratigraphic Chart colours. Names live in i18n.js.
export const PERIODS = [
  { id: 'permian', start: 298.9, end: 251.9, color: '#F04028' },
  { id: 'triassic', start: 251.9, end: 201.4, color: '#812B92' },
  { id: 'jurassic', start: 201.4, end: 145.0, color: '#34B2C9' },
  { id: 'cretaceous', start: 145.0, end: 66.0, color: '#7FC64E' },
  { id: 'paleogene', start: 66.0, end: 23.03, color: '#FD9A52' },
  { id: 'neogene', start: 23.03, end: 2.58, color: '#FFE619' },
  { id: 'quaternary', start: 2.58, end: 0, color: '#F9F97F' },
];

export const EPOCHS = [
  { id: 'lopingian', start: 259.5, end: 251.9 },
  { id: 'earlyTriassic', start: 251.9, end: 247.2 },
  { id: 'middleTriassic', start: 247.2, end: 237 },
  { id: 'lateTriassic', start: 237, end: 201.4 },
  { id: 'earlyJurassic', start: 201.4, end: 174.7 },
  { id: 'middleJurassic', start: 174.7, end: 161.5 },
  { id: 'lateJurassic', start: 161.5, end: 145 },
  { id: 'earlyCretaceous', start: 145, end: 100.5 },
  { id: 'lateCretaceous', start: 100.5, end: 66 },
  { id: 'paleocene', start: 66, end: 56 },
  { id: 'eocene', start: 56, end: 33.9 },
  { id: 'oligocene', start: 33.9, end: 23.03 },
  { id: 'miocene', start: 23.03, end: 5.333 },
  { id: 'pliocene', start: 5.333, end: 2.58 },
  { id: 'pleistocene', start: 2.58, end: 0.0117 },
  { id: 'holocene', start: 0.0117, end: 0 },
];

// Key events (Ma). Titles and descriptions live in i18n.js.
export const EVENTS = [
  { t: 250, id: 'pangaea' },
  { t: 230, id: 'mountains' },
  { t: 201, id: 'rifting' },
  { t: 180, id: 'atlantic' },
  { t: 160, id: 'gondwana' },
  { t: 135, id: 'southAtlantic' },
  { t: 120, id: 'india' },
  { t: 92, id: 'seaLevel' },
  { t: 88, id: 'madagascar' },
  { t: 66, id: 'dinosaurs' },
  { t: 55, id: 'himalaya' },
  { t: 45, id: 'australia' },
  { t: 34, id: 'antarcticIce' },
  { t: 30, id: 'alps' },
  { t: 20, id: 'arabia' },
  { t: 5.3, id: 'zanclean' },
  { t: 3, id: 'panama' },
  { t: 0, id: 'today' },
];

function interp(keys, t) {
  // keys: [[age, value], ...] sorted by descending age
  if (t >= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [a1, v1] = keys[i];
    if (t >= a1) {
      const [a0, v0] = keys[i - 1];
      const f = (t - a1) / (a0 - a1);
      const s = f * f * (3 - 2 * f);
      return v1 + (v0 - v1) * s;
    }
  }
  return keys[keys.length - 1][1];
}

// Long-term eustatic sea level relative to today (m), after Haq (2018) / Miller et al. (2005), smoothed.
const SEA_LEVEL = [
  [250, 10], [235, 25], [215, 20], [200, 35], [185, 55], [170, 60], [155, 95], [145, 110], [130, 110],
  [115, 150], [100, 190], [92, 235], [80, 205], [70, 170], [60, 130], [50, 110], [40, 85], [34, 40],
  [28, 45], [20, 55], [15, 45], [10, 25], [5, 15], [3, 10], [1.5, 0], [0, 0],
];

// Global mean surface temperature anomaly vs. pre-industrial (°C), after Scotese et al. (2021), smoothed.
const TEMP = [
  [250, 12], [240, 9], [225, 8], [210, 7], [200, 7], [185, 6], [175, 5], [160, 5], [145, 4.5], [130, 6],
  [115, 7], [100, 9], [92, 11], [80, 8], [70, 6], [60, 8], [56, 13], [50, 11], [45, 8], [38, 6], [34, 3.5],
  [28, 4.5], [23, 4], [16, 5], [12, 3.5], [8, 3], [5, 3], [3, 2], [1.5, 0.5], [0, 0],
];

export const seaLevelAt = (t) => interp(SEA_LEVEL, t);

// Playback: advance time towards the present, slowing down near the end so the finale is readable.
export const BASE_RATE = T_MAX / 90; // Ma per second at ×1 (full run ≈ 90 s)
export function advanceTime(time, dt, speed = 1) {
  const ease = 0.35 + 0.65 * Math.min(1, time / 40 + 0.15);
  return Math.max(time - dt * BASE_RATE * speed * ease, 0);
}
export const tempAnomalyAt = (t) => interp(TEMP, t);

export function periodAt(t) {
  return PERIODS.find((p) => t <= p.start && t >= p.end) || PERIODS[1];
}

export function epochAt(t) {
  return EPOCHS.find((p) => t <= p.start && t >= p.end) || EPOCHS[1];
}

export function eventAt(t) {
  // the most recent event whose time has been reached (time flows 250 -> 0)
  let best = EVENTS[0];
  for (const e of EVENTS) if (t <= e.t + 1e-6) best = e;
  return best;
}
