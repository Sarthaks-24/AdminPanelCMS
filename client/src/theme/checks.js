// The readability rules every theme must meet, presets and custom alike. Each rule is a pair the
// dashboard actually paints (e.g. `bg-t-danger-dim … text-t-danger` on alerts), not a guess.
import { composite, contrast, parseColor } from './color';

// The 20 tokens a theme defines, without the `--theme-` prefix. `focus` is optional in CSS (it defaults
// to accent-bright) and always present in a derived custom theme.
export const TOKENS = [
  'bg', 'surface', 'surface-hi', 'border', 'border-hi', 'accent', 'accent-bright', 'on-accent',
  'accent2', 'accent2-dim', 'on-accent2', 'text', 'text-muted', 'text-dim', 'brand', 'brand-glow',
  'danger', 'danger-dim', 'warn', 'code-bg', 'focus',
];

// [foreground, background, minimum ratio]. A background written `x/15` is token x at 15% over surface;
// translucent `*-dim` tokens are composited over surface, where they are painted.
export const RULES = [
  ['text', 'bg', 7], ['text', 'surface', 7], ['text', 'surface-hi', 7], ['text', 'code-bg', 7],
  ['text-muted', 'surface', 4.5], ['text-muted', 'surface-hi', 4.5],
  ['text-dim', 'bg', 4.5], ['text-dim', 'surface', 4.5],
  ['on-accent', 'accent', 4.5], ['on-accent2', 'accent2', 4.5],
  ['accent-bright', 'surface', 4.5],
  ['accent', 'bg', 3], ['accent', 'surface', 3], ['accent2', 'surface', 3],
  ['accent2', 'accent2-dim', 4.5],
  ['danger', 'bg', 4.5], ['danger', 'surface', 4.5], ['danger', 'danger-dim', 4.5],
  ['warn', 'surface', 4.5], ['warn', 'code-bg', 4.5],
  ['text', 'accent/15', 4.5],
  ['focus', 'bg', 3], ['focus', 'surface', 3],
];

// High contrast (custom themes only) raises the secondary text.
export const HIGH_RULES = [['text-muted', 'surface', 7], ['text-muted', 'surface-hi', 7], ['text-dim', 'bg', 7]];

/** Resolves a rule's background to an opaque colour. `vars` maps token → CSS colour string. */
export function resolveBackground(vars, name) {
  const surface = parseColor(vars.surface);
  const [token, percent] = name.split('/');
  const colour = parseColor(vars[token]);
  if (percent) return composite({ ...colour, a: Number(percent) / 100 }, surface);
  return colour.a < 1 ? composite(colour, surface) : colour;
}

const focusOf = (vars) => vars.focus ?? vars['accent-bright'];

/** Every rule a theme fails, as { fg, bg, ratio, min }. Empty means readable. */
export function audit(vars, { high = false } = {}) {
  const all = { ...vars, focus: focusOf(vars) };
  const failures = [];
  for (const [fg, bg, min] of high ? [...RULES, ...HIGH_RULES] : RULES) {
    const ratio = contrast(parseColor(all[fg]), resolveBackground(all, bg));
    // A hair of tolerance for values written as rounded hex in the stylesheet.
    if (ratio + 0.005 < min) failures.push({ fg, bg, ratio: Math.round(ratio * 100) / 100, min });
  }
  return failures;
}
