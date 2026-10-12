// The custom-theme generator: three colours in, every dashboard token out, readable by construction.
// The person owns the hues; this module owns lightness, and moves it until every rule in checks.js
// passes. Danger and warning keep their meaning (red-ish, amber-ish) whatever accent is chosen.
import { contrast, fromOklch, isHex, mix, parseColor, toHex, toHexAlpha, toOklch } from './color';
import { resolveBackground } from './checks';

/** Bumped when the token set or the rules change; a stored custom theme with an older `v` is re-derived. */
export const SCHEMA_VERSION = 1;

const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const INK = { r: 8, g: 10, b: 14, a: 1 };
const SIGNALS = {
  dark: { danger: '#f87171', warn: '#fbbf24' },
  light: { danger: '#c81e1e', warn: '#a14a07' },
};

const withLightness = (colour, l) => fromOklch({ ...toOklch(colour), l });

/**
 * Searches lightness outward from the colour's own (closest first) for the first value where
 * `passes(candidate)` holds. Hue is kept; chroma only shrinks where the gamut forces it.
 */
function fitLightness(colour, passes) {
  if (passes(colour)) return colour;
  const { l } = toOklch(colour);
  for (let step = 1; step <= 100; step += 1) {
    for (const sign of [1, -1]) {
      const next = l + sign * step * 0.01;
      if (next < 0 || next > 1) continue;
      const candidate = withLightness(colour, next);
      if (passes(candidate)) return candidate;
    }
  }
  return colour;
}

// The margin absorbs rounding to 8-bit hex, so the stored value still passes.
const meets = (fg, bg, min) => contrast(fg, bg) >= min + 0.06;

/**
 * @param {{ bg: string, accent: string, accent2?: string, contrast?: 'standard' | 'high' }} input hex colours
 * @returns {{ light: boolean, vars: Record<string, string> }} vars keyed by token name without `--theme-`
 */
export function deriveTheme({ bg, accent, accent2, contrast: level = 'standard' }) {
  const high = level === 'high';
  const textMin = high ? 7 : 4.5;

  // Background: keep its hue, limit chroma so it stays a canvas, and push it clearly dark or light.
  const base = toOklch(parseColor(bg));
  const light = contrast(INK, parseColor(bg)) > contrast(WHITE, parseColor(bg));
  const canvas = fromOklch({ l: light ? Math.max(base.l, 0.93) : Math.min(base.l, 0.27), c: Math.min(base.c, light ? 0.035 : 0.06), h: base.h });

  let text = fromOklch({ l: light ? 0.2 : 0.96, c: 0.012, h: base.h });
  const toward = (weight) => mix(canvas, text, weight);
  const surface = light ? mix(canvas, WHITE, 0.7) : toward(0.04);
  const surfaceHi = light ? toward(0.045) : toward(0.08);
  const border = light ? toward(0.16) : toward(0.14);
  const borderHi = light ? toward(0.3) : toward(0.22);
  const codeBg = light ? toward(0.035) : toward(0.025);
  const grounds = [canvas, surface, surfaceHi, codeBg];
  text = fitLightness(text, (c) => grounds.every((g) => meets(c, g, 7)));

  const muted = fitLightness(mix(text, canvas, 0.28), (c) => [surface, surfaceHi].every((g) => meets(c, g, textMin)));
  const dim = fitLightness(mix(text, canvas, 0.42), (c) => [canvas, surface].every((g) => meets(c, g, textMin)));

  // Accent: a fill for buttons (needs readable text on it), a mark on the canvas (3:1), and a 15% tint
  // that body text sits on.
  const onFor = (fill) => (contrast(WHITE, fill) >= contrast(INK, fill) ? WHITE : INK);
  const fillPasses = (c) => meets(c, canvas, 3) && meets(c, surface, 3) && meets(onFor(c), c, 4.5);
  const accentFill = fitLightness(parseColor(accent), (c) => fillPasses(c)
    && meets(text, resolveBackground({ surface: toHex(surface), accent: toHex(c) }, 'accent/15'), 4.5));
  const a = toOklch(accentFill);
  const accentBright = fitLightness(withLightness(accentFill, a.l + (light ? -0.07 : 0.07)), (c) => meets(c, surface, 4.5) && meets(c, canvas, 4.5));

  const secondSeed = accent2 && isHex(accent2) ? parseColor(accent2) : fromOklch({ ...a, h: (a.h + 150) % 360 });
  const dimOf = (c) => mix(surface, c, 0.12);
  const accent2Fill = fitLightness(secondSeed, (c) => meets(c, surface, 3) && meets(onFor(c), c, 4.5) && meets(c, dimOf(c), 4.5));

  const signals = SIGNALS[light ? 'light' : 'dark'];
  const danger = fitLightness(parseColor(signals.danger), (c) => [canvas, surface, mix(surface, c, 0.14)].every((g) => meets(c, g, 4.5)));
  const warn = fitLightness(parseColor(signals.warn), (c) => [surface, codeBg].every((g) => meets(c, g, 4.5)));

  const vars = {
    bg: toHex(canvas),
    surface: toHex(surface),
    'surface-hi': toHex(surfaceHi),
    border: toHex(border),
    'border-hi': toHex(borderHi),
    accent: toHex(accentFill),
    'accent-bright': toHex(accentBright),
    'on-accent': toHex(onFor(accentFill)),
    accent2: toHex(accent2Fill),
    'accent2-dim': toHexAlpha(accent2Fill, 0.12),
    'on-accent2': toHex(onFor(accent2Fill)),
    text: toHex(text),
    'text-muted': toHex(muted),
    'text-dim': toHex(dim),
    brand: toHex(accentBright),
    'brand-glow': toHexAlpha(accentFill, light ? 0.15 : 0.25),
    danger: toHex(danger),
    'danger-dim': toHexAlpha(danger, 0.14),
    warn: toHex(warn),
    'code-bg': toHex(codeBg),
    focus: toHex(accentBright),
  };
  return { light, vars };
}

/** Inline custom properties that paint one element (and its children) in a set of tokens. */
export const varsStyle = (vars) => Object.fromEntries(Object.entries(vars).map(([token, value]) => [`--theme-${token}`, value]));

// ── Share codes ───────────────────────────────────────────────────────────────
// Only the inputs travel, so a pasted code is re-derived (and re-checked) rather than trusted.

const SHARE = /^pc1:([0-9a-f]{6})\.([0-9a-f]{6})\.([0-9a-f]{6})\.([sh])$/i;

export function toShareCode({ bg, accent, accent2, contrast: level = 'standard' }) {
  const hex = (value) => toHex(parseColor(value)).slice(1);
  return `pc1:${hex(bg)}.${hex(accent)}.${hex(accent2 || accent)}.${level === 'high' ? 'h' : 's'}`;
}

/** @returns the inputs, or null when the text is not a share code. */
export function fromShareCode(code) {
  const match = SHARE.exec(String(code || '').trim());
  if (!match) return null;
  return { bg: `#${match[1].toLowerCase()}`, accent: `#${match[2].toLowerCase()}`, accent2: `#${match[3].toLowerCase()}`, contrast: match[4].toLowerCase() === 'h' ? 'high' : 'standard' };
}

// ── Storage validation ────────────────────────────────────────────────────────
// The same rules the pre-paint script in index.html applies: a token name of lowercase letters,
// digits and dashes, and a hex value. Anything else (url(), expressions, extra declarations) is refused.

export const VAR_KEY = /^[a-z0-9-]{1,24}$/;
export const VAR_VALUE = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;

/** Returns the stored record if it is safe to apply, otherwise null. */
export function validateStored(record) {
  if (!record || typeof record !== 'object' || typeof record.vars !== 'object' || !record.vars) return null;
  const entries = Object.entries(record.vars);
  if (entries.length === 0 || !entries.every(([key, value]) => VAR_KEY.test(key) && VAR_VALUE.test(String(value)))) return null;
  return record;
}
