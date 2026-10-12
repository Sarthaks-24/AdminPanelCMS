import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEMES, THEME_ALIASES, THEME_GROUPS } from '../context/ThemeContext';
import { audit } from './checks';
import { parseColor, deltaE } from './color';
import { parseThemeBlocks } from './cssThemes';

const css = fs.readFileSync(path.join(import.meta.dirname, '..', 'index.css'), 'utf8');
const blocks = parseThemeBlocks(css).filter((block) => block.ids.length);
const byId = Object.fromEntries(blocks.map((block) => [block.ids[0], block]));

// Pairs of the original 20 that were already this close before the gate existed; they are kept for the
// accounts that use them. A new theme may not join them.
const KNOWN_NEAR_PAIRS = new Set(['powershell|vercel-jet', 'synthwave-sunset|tokyo-neon', 'abyssal-ocean|aurora']);

describe('preset themes', () => {
  it('has exactly one CSS block per theme, and no block without a theme', () => {
    expect(Object.keys(byId).sort()).toEqual(Object.keys(THEMES).sort());
  });

  it('never gives a theme an id that is already a legacy alias', () => {
    const aliasIds = blocks.flatMap((block) => block.ids.slice(1));
    for (const id of Object.keys(THEMES)) expect(aliasIds).not.toContain(id);
    for (const [alias, target] of Object.entries(THEME_ALIASES)) expect(byId[target].ids).toContain(alias);
    expect(Object.keys(THEME_ALIASES).sort()).toEqual(aliasIds.sort());
  });

  it('shows every theme in a known group, with its real colours as the preview', () => {
    for (const theme of Object.values(THEMES)) {
      expect(THEME_GROUPS).toContain(theme.group);
      expect(theme.hidden).toBeUndefined();
      const { vars } = byId[theme.id];
      expect(theme.preview).toEqual([vars.bg, vars.accent, vars.accent2]);
      expect(theme.isLight).toBe(/color-scheme:\s*light/.test(css.slice(css.indexOf(`[data-theme="${theme.id}"]`)).split('}')[0]));
    }
  });

  for (const block of blocks) {
    it(`${block.ids[0]} passes every readability rule`, () => {
      expect(audit(block.vars, { high: block.ids[0].startsWith('hc-') })).toEqual([]);
    });
  }

  it('has no two themes that look the same (background and accent both within ΔE 0.06)', () => {
    const ids = Object.keys(byId);
    const close = [];
    for (let i = 0; i < ids.length; i += 1) {
      for (let j = i + 1; j < ids.length; j += 1) {
        const [a, b] = [byId[ids[i]].vars, byId[ids[j]].vars];
        if (deltaE(parseColor(a.bg), parseColor(b.bg)) < 0.06 && deltaE(parseColor(a.accent), parseColor(b.accent)) < 0.06) close.push(`${ids[i]}|${ids[j]}`);
      }
    }
    expect(close.filter((pair) => !KNOWN_NEAR_PAIRS.has(pair))).toEqual([]);
  });
});

describe('components', () => {
  // A fixed black or white class is invisible on half the themes (the light-theme bugs of 2026-10-11).
  it('use theme tokens, never fixed black or white classes', () => {
    const offenders = [];
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.jsx$/.test(entry.name) && !/\.test\.jsx$/.test(entry.name)) {
          for (const match of fs.readFileSync(full, 'utf8').matchAll(/\b(?:bg|text|border|ring|from|to|via)-(?:black|white)\b/g)) offenders.push(`${path.relative(path.join(import.meta.dirname, '..'), full)}: ${match[0]}`);
        }
      }
    };
    walk(path.join(import.meta.dirname, '..'));
    expect(offenders).toEqual([]);
  });
});
