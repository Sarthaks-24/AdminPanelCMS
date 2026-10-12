// Colour maths for the theme system: parsing, WCAG contrast and OKLCH lightness nudging.
// Pure functions with no DOM access, so the contrast tests and the custom-theme builder share them.

const HEX = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i;
const RGBA = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/i;

/** '#rrggbb', '#rrggbbaa' or 'rgb(a)(…)' → { r, g, b, a } with r/g/b in 0–255. Throws on anything else. */
export function parseColor(value) {
  const text = String(value).trim();
  const hex = HEX.exec(text);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: hex[2] ? parseInt(hex[2], 16) / 255 : 1 };
  }
  const rgba = RGBA.exec(text);
  if (rgba) return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] === undefined ? 1 : +rgba[4] };
  throw new Error(`Not a colour: ${value}`);
}

export const isHex = (value) => HEX.test(String(value).trim());

const toHexByte = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
export const toHex = ({ r, g, b }) => `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
/** '#rrggbbaa', the form custom themes store translucent tokens in (the pre-paint script only accepts hex). */
export const toHexAlpha = (color, alpha) => `${toHex(color)}${toHexByte(alpha * 255)}`;
export const toRgba = ({ r, g, b }, alpha) => `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;

/** Paints `top` (which may be translucent) over an opaque `bottom`. */
export function composite(top, bottom) {
  const a = top.a ?? 1;
  return { r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a), a: 1 };
}

/** Linear mix: weight 0 → a, weight 1 → b. */
export function mix(a, b, weight) {
  return { r: a.r + (b.r - a.r) * weight, g: a.g + (b.g - a.g) * weight, b: a.b + (b.b - a.b) * weight, a: 1 };
}

const toLinear = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const fromLinear = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** WCAG 2 relative luminance. */
export function luminance(color) {
  return 0.2126 * toLinear(color.r) + 0.7152 * toLinear(color.g) + 0.0722 * toLinear(color.b);
}

/** WCAG 2 contrast ratio, 1–21. A translucent foreground is composited over the background first. */
export function contrast(fg, bg) {
  const front = (fg.a ?? 1) < 1 ? composite(fg, bg) : fg;
  const [hi, lo] = [luminance(front), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ── OKLCH ─────────────────────────────────────────────────────────────────────

export function toOklch({ r, g, b }) {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

function oklchToLinear({ l: L, c, h }) {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

/** OKLCH → sRGB, pulling chroma in until the colour fits the sRGB gamut (keeps hue and lightness). */
export function fromOklch({ l, c, h }) {
  const L = Math.min(1, Math.max(0, l));
  let chroma = c;
  let rgb = oklchToLinear({ l: L, c: chroma, h });
  for (let i = 0; i < 24 && rgb.some((v) => v < -0.0005 || v > 1.0005); i += 1) {
    chroma *= 0.85;
    rgb = oklchToLinear({ l: L, c: chroma, h });
  }
  const [r, g, b] = rgb.map((v) => fromLinear(Math.min(1, Math.max(0, v))));
  return { r, g, b, a: 1 };
}

/**
 * Moves `fg`'s OKLCH lightness away from `bg` until the pair reaches `ratio`, keeping its hue.
 * The user owns the hue; the system owns the lightness. Falls back to black or white, which always
 * reach 4.5:1 against something on the other side of mid-grey.
 */
export function ensureContrast(fg, bg, ratio) {
  if (contrast(fg, bg) >= ratio) return fg;
  const start = toOklch(fg);
  const lighter = luminance(bg) < 0.18;
  for (let step = 1; step <= 100; step += 1) {
    const candidate = fromOklch({ ...start, l: start.l + (lighter ? step : -step) * 0.01 });
    if (contrast(candidate, bg) >= ratio) return candidate;
  }
  return lighter ? { r: 255, g: 255, b: 255, a: 1 } : { r: 0, g: 0, b: 0, a: 1 };
}

/** Whichever of the two text candidates reads better on `bg`. */
export function bestText(bg, light = { r: 255, g: 255, b: 255, a: 1 }, dark = { r: 8, g: 10, b: 14, a: 1 }) {
  return contrast(light, bg) >= contrast(dark, bg) ? light : dark;
}

/** Perceptual distance in OKLab, 0–~1. Used to stop near-duplicate presets. */
export function deltaE(a, b) {
  const p = toOklch(a);
  const q = toOklch(b);
  const pa = p.c * Math.cos((p.h * Math.PI) / 180);
  const pb = p.c * Math.sin((p.h * Math.PI) / 180);
  const qa = q.c * Math.cos((q.h * Math.PI) / 180);
  const qb = q.c * Math.sin((q.h * Math.PI) / 180);
  return Math.hypot(p.l - q.l, pa - qa, pb - qb);
}
