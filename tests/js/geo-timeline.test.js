import { describe, expect, it } from 'vitest';
import {
  BASE_RATE,
  EPOCHS,
  EVENTS,
  PERIODS,
  T_MAX,
  advanceTime,
  epochAt,
  eventAt,
  periodAt,
  seaLevelAt,
  tempAnomalyAt,
} from '../../src/geo-timeline.js';

describe('palaeo-environment curves', () => {
  it('end exactly at present-day values', () => {
    expect(seaLevelAt(0)).toBe(0);
    expect(tempAnomalyAt(0)).toBe(0);
  });

  it('peak in the Cretaceous greenhouse and stay in plausible ranges', () => {
    let maxSea = -Infinity, maxAt = 0;
    for (let t = 0; t <= T_MAX; t += 0.5) {
      const s = seaLevelAt(t);
      const c = tempAnomalyAt(t);
      expect(s).toBeGreaterThanOrEqual(-5);
      expect(s).toBeLessThanOrEqual(260);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(14);
      if (s > maxSea) [maxSea, maxAt] = [s, t];
    }
    expect(maxAt).toBeGreaterThan(80);
    expect(maxAt).toBeLessThan(100);
  });

  it('are continuous (no jumps between keyframes)', () => {
    for (let t = 0; t < T_MAX; t += 0.1) {
      expect(Math.abs(seaLevelAt(t + 0.1) - seaLevelAt(t))).toBeLessThan(10);
      expect(Math.abs(tempAnomalyAt(t + 0.1) - tempAnomalyAt(t))).toBeLessThan(1);
    }
  });

  it('clamp outside the modelled range', () => {
    expect(seaLevelAt(400)).toBe(seaLevelAt(T_MAX));
    expect(seaLevelAt(-5)).toBe(0);
  });
});

describe('geological time scale', () => {
  it('periods and epochs are contiguous and cover 0..250 Ma', () => {
    for (const list of [PERIODS, EPOCHS]) {
      for (let i = 1; i < list.length; i++) expect(list[i].start).toBe(list[i - 1].end);
      expect(list[0].start).toBeGreaterThanOrEqual(T_MAX);
      expect(list.at(-1).end).toBe(0);
      expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
    }
  });

  it('periodAt / epochAt pick the right interval', () => {
    expect(periodAt(250).id).toBe('triassic');
    expect(periodAt(150).id).toBe('jurassic');
    expect(periodAt(66.1).id).toBe('cretaceous');
    expect(periodAt(65.9).id).toBe('paleogene');
    expect(periodAt(0).id).toBe('quaternary');
    expect(epochAt(55).id).toBe('eocene');
    expect(epochAt(0).id).toBe('holocene');
  });

  it('every epoch lies inside a period', () => {
    for (const e of EPOCHS.filter((x) => x.end < T_MAX)) {
      const mid = (e.start + e.end) / 2;
      const p = periodAt(mid);
      expect(mid).toBeLessThanOrEqual(p.start);
      expect(mid).toBeGreaterThanOrEqual(p.end);
    }
  });
});

describe('events', () => {
  it('run from Pangaea (250 Ma) to today in chronological order', () => {
    expect(EVENTS[0]).toEqual({ t: 250, id: 'pangaea' });
    expect(EVENTS.at(-1)).toEqual({ t: 0, id: 'today' });
    for (let i = 1; i < EVENTS.length; i++) expect(EVENTS[i].t).toBeLessThan(EVENTS[i - 1].t);
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
  });

  it('eventAt returns the latest event already reached', () => {
    expect(eventAt(250).id).toBe('pangaea');
    expect(eventAt(240).id).toBe('pangaea');
    expect(eventAt(100).id).toBe('india');
    expect(eventAt(66).id).toBe('dinosaurs');
    expect(eventAt(0).id).toBe('today');
  });
});

describe('playback', () => {
  it('moves towards the present and never overshoots', () => {
    expect(advanceTime(200, 1)).toBeLessThan(200);
    expect(advanceTime(0.001, 10)).toBe(0);
    expect(advanceTime(0, 1)).toBe(0);
  });

  it('scales with speed and slows down near the present', () => {
    const step = (t, s = 1) => t - advanceTime(t, 0.1, s);
    expect(step(200, 2)).toBeCloseTo(2 * step(200), 10);
    expect(step(5)).toBeLessThan(step(200));
    expect(step(200)).toBeCloseTo(0.1 * BASE_RATE, 10);
  });

  it('a full run at ×1 takes roughly 1.5–2.5 minutes (80–150 s)', () => {
    let t = T_MAX, seconds = 0;
    while (t > 0 && seconds < 1000) {
      t = advanceTime(t, 1 / 60);
      seconds += 1 / 60;
    }
    expect(seconds).toBeGreaterThan(80);
    expect(seconds).toBeLessThan(150);
  });
});
