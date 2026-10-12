import { describe, expect, it } from 'vitest';
import { audit, TOKENS } from './checks';
import { deriveTheme, fromShareCode, toShareCode, validateStored, VAR_KEY, VAR_VALUE } from './derive';

// A seeded generator, so a failure names an input that can be replayed.
function seeded(seed) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
}
const randomHex = (next) => `#${Math.floor(next() * 0xffffff).toString(16).padStart(6, '0')}`;

describe('deriveTheme', () => {
  it('emits every token as hex the pre-paint script accepts', () => {
    const { vars } = deriveTheme({ bg: '#0c1017', accent: '#2563eb', accent2: '#10b981' });
    expect(Object.keys(vars).sort()).toEqual([...TOKENS].sort());
    for (const [key, value] of Object.entries(vars)) {
      expect(key).toMatch(VAR_KEY);
      expect(value).toMatch(VAR_VALUE);
    }
  });

  it('works out light or dark from the background', () => {
    expect(deriveTheme({ bg: '#fafafa', accent: '#2563eb' }).light).toBe(true);
    expect(deriveTheme({ bg: '#101010', accent: '#2563eb' }).light).toBe(false);
  });

  for (const level of ['standard', 'high']) {
    it(`never produces an unreadable dashboard (1,000 random inputs, ${level} contrast)`, () => {
      const next = seeded(level === 'high' ? 7 : 42);
      for (let i = 0; i < 1000; i += 1) {
        const input = { bg: randomHex(next), accent: randomHex(next), accent2: next() < 0.2 ? undefined : randomHex(next), contrast: level };
        const failures = audit(deriveTheme(input).vars, { high: level === 'high' });
        if (failures.length) throw new Error(`${JSON.stringify(input)} fails ${JSON.stringify(failures)}`);
      }
    });
  }
});

describe('share codes', () => {
  it('round-trips the inputs', () => {
    const input = { bg: '#0c1017', accent: '#2563eb', accent2: '#10b981', contrast: 'high' };
    expect(toShareCode(input)).toBe('pc1:0c1017.2563eb.10b981.h');
    expect(fromShareCode(toShareCode(input))).toEqual(input);
  });

  it('refuses anything that is not a code', () => {
    for (const bad of ['', 'pc1:0c1017.2563eb.10b981', 'pc2:0c1017.2563eb.10b981.s', 'pc1:url(x).2563eb.10b981.s', 'pc1:0c1017.2563eb.10b981.s;color:red']) {
      expect(fromShareCode(bad)).toBeNull();
    }
  });
});

describe('validateStored', () => {
  it('accepts a derived theme', () => {
    const { vars } = deriveTheme({ bg: '#f5f5f4', accent: '#7c3aed' });
    expect(validateStored({ v: 1, vars })).not.toBeNull();
  });

  it('rejects values or keys that could carry more than a colour', () => {
    for (const vars of [
      { bg: 'url(https://example.test/pixel)' },
      { bg: '#000000; background: red' },
      { bg: 'red' },
      { 'bg;x': '#000000' },
      { 'BG': '#000000' },
      {},
    ]) expect(validateStored({ v: 1, vars })).toBeNull();
    expect(validateStored(null)).toBeNull();
    expect(validateStored({ v: 1 })).toBeNull();
  });
});
