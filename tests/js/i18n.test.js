import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EPOCHS, EVENTS, PERIODS } from '../../src/geo-timeline.js';
import { readJson } from './helpers.js';

const meta = readJson('meta.json');
const CODES = ['en', 'az', 'de', 'ru'];

async function freshI18n(search = '') {
  vi.resetModules();
  window.history.replaceState(null, '', `/${search}`);
  return import('../../src/i18n.js');
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
});

describe('languages', () => {
  it('offers EN, AZ, DE, RU in this order and defaults to English', async () => {
    const i18n = await freshI18n();
    expect(i18n.LANGS.map((l) => l.code)).toEqual(CODES);
    expect(i18n.getLang()).toBe('en');
    expect(i18n.t('title')).toBe('Continental Drift');
  });

  it('reads the language from ?lang= and from storage', async () => {
    expect((await freshI18n('?lang=de')).getLang()).toBe('de');
    localStorage.setItem('pangaea-drift-lang', 'az');
    expect((await freshI18n()).getLang()).toBe('az');
    expect((await freshI18n('?lang=xx')).getLang()).toBe('az'); // unknown code ignored
  });
});

describe('dictionaries are complete', () => {
  it('every UI key exists in every language with the same kind of value', async () => {
    const { DICTIONARIES } = await freshI18n();
    const keys = Object.keys(DICTIONARIES.UI.en);
    for (const code of CODES) {
      expect(Object.keys(DICTIONARIES.UI[code]).sort()).toEqual([...keys].sort());
      for (const k of keys) {
        const v = DICTIONARIES.UI[code][k];
        expect(typeof v, `${code}.${k}`).toBe(typeof DICTIONARIES.UI.en[k]);
        if (typeof v === 'function') expect(String(v('42', '1', '2'))).toContain('42');
        else expect(v.length, `${code}.${k}`).toBeGreaterThan(0);
      }
    }
  });

  it('translates every period, epoch, event and place name', async () => {
    const i18n = await freshI18n();
    const places = [...meta.labels.map((l) => l.id), 'pangaea', 'laurasia', 'gondwana', 'panthalassa', 'tethys', 'atlantic', 'pacific', 'indian'];
    for (const code of CODES) {
      i18n.setLang(code);
      for (const p of PERIODS) expect(i18n.periodName(p.id)).not.toBe(p.id);
      for (const e of EPOCHS) expect(i18n.epochName(e.id)).not.toBe(e.id);
      for (const id of places) expect(i18n.placeName(id), `${code}:${id}`).not.toBe(id);
      for (const e of EVENTS) {
        const [title, text] = i18n.eventText(e.id);
        expect(title.length).toBeGreaterThan(2);
        expect(text.length).toBeGreaterThan(40);
      }
    }
  });

  it('non-English event descriptions are actually translated', async () => {
    const { DICTIONARIES } = await freshI18n();
    for (const [id, tr] of Object.entries(DICTIONARIES.EVENTS)) {
      for (const code of ['az', 'de', 'ru']) expect(tr[code][1], `${id}.${code}`).not.toBe(tr.en[1]);
    }
  });
});

describe('formatting and switching', () => {
  it('uses a decimal point in English and a comma elsewhere', async () => {
    const i18n = await freshI18n();
    expect(i18n.fmt(92, 1)).toBe('92.0');
    i18n.setLang('az');
    expect(i18n.fmt(92, 1)).toBe('92,0');
    expect(i18n.fmt(5.333, 2)).toBe('5,33');
    expect(i18n.fmt(120)).toBe('120');
  });

  it('setLang notifies listeners, persists and updates the URL', async () => {
    const i18n = await freshI18n();
    const seen = [];
    i18n.onLangChange((c) => seen.push(c));
    i18n.setLang('ru');
    i18n.setLang('ru'); // no duplicate notification
    i18n.setLang('zz'); // ignored
    expect(seen).toEqual(['ru']);
    expect(localStorage.getItem('pangaea-drift-lang')).toBe('ru');
    expect(new URL(window.location.href).searchParams.get('lang')).toBe('ru');
    expect(i18n.t('today')).toBe('Сегодня');
  });

  it('translateDom fills text, html, titles and the document language', async () => {
    const i18n = await freshI18n();
    document.body.innerHTML = `
      <h1 data-i18n="title"></h1>
      <p data-i18n-html="keys"></p>
      <button data-i18n-title="play"></button>`;
    i18n.setLang('de');
    i18n.translateDom();
    expect(document.querySelector('h1').textContent).toBe('Kontinentaldrift');
    expect(document.querySelector('p').querySelector('kbd').textContent).toBe('Leertaste');
    const btn = document.querySelector('button');
    expect(btn.title).toBe('Start / Pause (Leertaste)');
    expect(btn.getAttribute('aria-label')).toBe(btn.title);
    expect(document.documentElement.lang).toBe('de');
    expect(document.title).toContain('Pangaea');
  });

  it('falls back to English, then to the key itself', async () => {
    const i18n = await freshI18n();
    expect(i18n.t('does-not-exist')).toBe('does-not-exist');
    expect(i18n.placeName('nowhere')).toBe('nowhere');
  });
});
