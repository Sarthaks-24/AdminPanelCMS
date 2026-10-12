import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { deriveTheme, SCHEMA_VERSION, validateStored } from '../theme/derive';
import { TOKENS } from '../theme/checks';

// ─── Themes ───────────────────────────────────────────────────────────────────
// Every preset has a CSS block in index.css with the same id; src/theme/themes.test.js checks the two
// match, that each block passes the readability rules in src/theme/checks.js, and that `preview` is the
// block's [bg, accent, accent2]. Labels are descriptive, never a product's name.
export const THEMES = {

  // ── Dark ──────────────────────────────────────────────────────────────────
  'powershell': {
    id: 'powershell', label: 'Terminal Slate', group: 'Dark', isLight: false,
    description: 'Deep terminal slate with classic blue',
    preview: ['#0c1017', '#2563eb', '#10b981'],
  },
  'linear-obsidian': {
    id: 'linear-obsidian', label: 'Obsidian', group: 'Dark', isLight: false,
    description: 'Dark graphite with an indigo glow',
    preview: ['#08090d', '#6264ef', '#ab69f0'],
  },
  'vercel-jet': {
    id: 'vercel-jet', label: 'Jet', group: 'Dark', isLight: false,
    description: 'Near-black zinc with electric blue',
    preview: ['#09090b', '#0070f3', '#10b981'],
  },
  'supabase-emerald': {
    id: 'supabase-emerald', label: 'Emerald', group: 'Dark', isLight: false,
    description: 'Obsidian slate with emerald highlights',
    preview: ['#0a0f12', '#24b47e', '#10b981'],
  },
  'raycast-purple': {
    id: 'raycast-purple', label: 'Cosmic Violet', group: 'Dark', isLight: false,
    description: 'Night violet with soft magenta',
    preview: ['#0c0a14', '#8b5cf6', '#ec4899'],
  },
  'nordic-slate': {
    id: 'nordic-slate', label: 'Nordic Slate', group: 'Dark', isLight: false,
    description: 'Navy slate with soft cyan and mint',
    preview: ['#0b1320', '#38bdf8', '#34d399'],
  },
  'warm-titanium': {
    id: 'warm-titanium', label: 'Warm Titanium', group: 'Dark', isLight: false,
    description: 'Espresso charcoal with champagne gold',
    preview: ['#11100f', '#d4a373', '#a7c957'],
  },
  'oled-black': {
    id: 'oled-black', label: 'OLED Black', group: 'Dark', isLight: false,
    description: 'True black for OLED screens, with ember orange',
    preview: ['#000000', '#ff8a3d', '#7dd3fc'],
  },
  'overcast': {
    id: 'overcast', label: 'Overcast', group: 'Dark', isLight: false,
    description: 'A dimmer mid-grey dark, easier in a bright room',
    preview: ['#22272e', '#8ddb8c', '#f69d50'],
  },

  // ── Light ─────────────────────────────────────────────────────────────────
  'clean-studio': {
    id: 'clean-studio', label: 'Clean Studio', group: 'Light', isLight: true,
    description: 'Off-white canvas, clean cards, royal blue',
    preview: ['#f8fafc', '#2563eb', '#0f7c57'],
  },
  'editorial-linen': {
    id: 'editorial-linen', label: 'Warm Linen', group: 'Light', isLight: true,
    description: 'Warm cream with terracotta and bronze',
    preview: ['#faf7f2', '#c2410c', '#a05d21'],
  },
  'nordic-frost': {
    id: 'nordic-frost', label: 'Nordic Frost', group: 'Light', isLight: true,
    description: 'Pale mist slate with oceanic cyan',
    preview: ['#f1f5f9', '#0284c7', '#137b71'],
  },
  'sage-mint': {
    id: 'sage-mint', label: 'Sage & Mint', group: 'Light', isLight: true,
    description: 'Soft eucalyptus and spearmint',
    preview: ['#f2f6f4', '#059669', '#147c56'],
  },
  'soft-lavender': {
    id: 'soft-lavender', label: 'Soft Lavender', group: 'Light', isLight: true,
    description: 'Pale lilac with royal amethyst',
    preview: ['#f5f3f9', '#7c3aed', '#913add'],
  },
  'solar-light': {
    id: 'solar-light', label: 'Solar Light', group: 'Light', isLight: true,
    description: 'Solarized-style warm paper with cyan and magenta',
    preview: ['#fdf6e3', '#209b92', '#be1c70'],
  },

  // ── Bold ──────────────────────────────────────────────────────────────────
  'cyberpunk-luxe': {
    id: 'cyberpunk-luxe', label: 'Cyberpunk Luxe', group: 'Bold', isLight: false,
    description: 'Dark carbon, electric cyan and amber',
    preview: ['#0a0b12', '#00f0ff', '#ffaa00'],
  },
  'synthwave-sunset': {
    id: 'synthwave-sunset', label: 'Synthwave Sunset', group: 'Bold', isLight: false,
    description: 'Velvet night, sunset rose and violet',
    preview: ['#0f081c', '#f43f5e', '#9472f3'],
  },
  'dracula-modern': {
    id: 'dracula-modern', label: 'Dusk Purple', group: 'Bold', isLight: false,
    description: 'Dusk purple, soft pink and green',
    preview: ['#171724', '#bd93f9', '#50fa7b'],
  },
  'tokyo-neon': {
    id: 'tokyo-neon', label: 'Tokyo Neon', group: 'Bold', isLight: false,
    description: 'Midnight navy, hot magenta and aqua',
    preview: ['#080c14', '#ff2a6d', '#05d9e8'],
  },
  'riso-print': {
    id: 'riso-print', label: 'Riso', group: 'Bold', isLight: true,
    description: 'Risograph inks on cream: fluoro pink and federal blue',
    preview: ['#f6f1e7', '#d6246e', '#1d4ed8'],
  },

  // ── Atmospheric ───────────────────────────────────────────────────────────
  'abyssal-ocean': {
    id: 'abyssal-ocean', label: 'Abyssal Ocean', group: 'Atmospheric', isLight: false,
    description: 'Ocean abyss with bioluminescent teal',
    preview: ['#050c14', '#00d2d3', '#378ee7'],
  },
  'royal-gold': {
    id: 'royal-gold', label: 'Royal Noir', group: 'Atmospheric', isLight: false,
    description: 'Dark carbon and warm imperial gold',
    preview: ['#0e0d0c', '#e5a93c', '#ac8b52'],
  },
  'aurora': {
    id: 'aurora', label: 'Aurora Borealis', group: 'Atmospheric', isLight: false,
    description: 'Arctic twilight with emerald lights',
    preview: ['#050e14', '#2dd4bf', '#818cf8'],
  },
  'noir-film': {
    id: 'noir-film', label: 'Cinematic Noir', group: 'Atmospheric', isLight: false,
    description: 'Studio monochrome in slate silver',
    preview: ['#0e0e10', '#e4e4e7', '#a1a1aa'],
  },
  'solar-dark': {
    id: 'solar-dark', label: 'Solar Dark', group: 'Atmospheric', isLight: false,
    description: 'Solarized-style deep teal with yellow and cyan',
    preview: ['#002b36', '#b58900', '#4abab1'],
  },

  // ── Accessible ────────────────────────────────────────────────────────────
  'hc-dark': {
    id: 'hc-dark', label: 'High Contrast Dark', group: 'Accessible', isLight: false,
    description: 'Pure black and white, yellow accent; all text 7:1 or more',
    preview: ['#000000', '#ffd400', '#00e5ff'],
  },
  'hc-light': {
    id: 'hc-light', label: 'High Contrast Light', group: 'Accessible', isLight: true,
    description: 'Pure white and black, deep blue accent; all text 7:1 or more',
    preview: ['#ffffff', '#0033cc', '#8a1c5c'],
  },
  'cb-signal': {
    id: 'cb-signal', label: 'Signal', group: 'Accessible', isLight: false,
    description: 'Colour-blind safe: orange and sky blue, no red against green',
    preview: ['#1d2129', '#e69f00', '#56b4e9'],
  },
};

export const THEME_GROUPS = ['Dark', 'Light', 'Bold', 'Atmospheric', 'Accessible'];

// Ids that older builds stored, mapped to the theme whose CSS block they still share. The pre-paint
// script applies them as-is (the alias selector exists); the app moves them to the canonical id.
export const THEME_ALIASES = {
  forest: 'supabase-emerald', 'obsidian-purple': 'raycast-purple', midnight: 'nordic-slate', arctic: 'nordic-slate',
  'burnt-titanium': 'warm-titanium', 'amber-console': 'warm-titanium', paper: 'clean-studio', 'cloud-ui': 'clean-studio',
  linen: 'editorial-linen', sandstorm: 'editorial-linen', glacier: 'nordic-frost', 'mint-fresh': 'sage-mint',
  'lavender-mist': 'soft-lavender', sakura: 'soft-lavender', matrix: 'cyberpunk-luxe', synthwave: 'synthwave-sunset',
  outrun: 'synthwave-sunset', vaporwave: 'synthwave-sunset', 'dracula-pro': 'dracula-modern', 'rose-noir': 'tokyo-neon',
  'y2k-brat': 'tokyo-neon', 'deep-sea': 'abyssal-ocean', 'carbon-red': 'noir-film',
};

export const CUSTOM_THEME_ID = 'custom';
const DEFAULT_THEME = 'powershell';

const STORAGE_KEY = 'pc_theme';
// The custom theme: { v, in: { bg, accent, accent2, contrast }, light, vars: { token: '#hex' } }.
// index.html's pre-paint script applies `vars` (hex values only) before the first paint.
const CUSTOM_KEY = 'pc_theme_custom';
// The key older builds used. Its value is moved to STORAGE_KEY once, then removed. index.html's
// first-paint script reads both, so a returning visitor never sees the default flash.
const LEGACY_STORAGE_KEY = 'admin_dashboard_theme';

const ThemeContext = createContext();

const hasWindow = typeof window !== 'undefined';

// Storage can be blocked (private mode, cookie settings, embedded views). Reading or writing it
// must never take the whole app down with it.
function readStoredTheme() {
  if (!hasWindow) return null;
  try {
    const storage = window.localStorage;
    const current = storage.getItem(STORAGE_KEY);
    const legacy = storage.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null) {
      if (current === null) storage.setItem(STORAGE_KEY, legacy);
      storage.removeItem(LEGACY_STORAGE_KEY);
    }
    return current ?? legacy;
  } catch { return null; }
}
function store(key, value) {
  if (!hasWindow) return;
  try { window.localStorage.setItem(key, value); } catch { /* storage unavailable: the choice lasts this visit */ }
}

/** Builds the stored record for a set of inputs. */
export function buildCustomRecord(input) {
  const { light, vars } = deriveTheme(input);
  return { v: SCHEMA_VERSION, in: { ...input }, light, vars };
}

// A record from an older schema is rebuilt from its inputs, so a token added later is never missing.
function readCustomTheme() {
  if (!hasWindow) return null;
  try {
    const record = validateStored(JSON.parse(window.localStorage.getItem(CUSTOM_KEY)));
    if (!record) return null;
    if (record.v !== SCHEMA_VERSION && record.in?.bg && record.in?.accent) {
      const rebuilt = buildCustomRecord(record.in);
      store(CUSTOM_KEY, JSON.stringify(rebuilt));
      return rebuilt;
    }
    return record;
  } catch { return null; }
}

function resolveId(stored, custom) {
  if (stored === CUSTOM_THEME_ID) return custom ? CUSTOM_THEME_ID : DEFAULT_THEME;
  if (stored && THEMES[stored]) return stored;
  if (stored && THEME_ALIASES[stored]) return THEME_ALIASES[stored];
  return DEFAULT_THEME;
}

/** Writes the theme onto <html>: the attribute for presets, inline custom properties for a custom theme. */
function applyToDocument(themeId, custom) {
  const root = document.documentElement;
  // Clear what a custom theme set inline, so a preset's CSS block shows through again.
  for (const token of TOKENS) root.style.removeProperty(`--theme-${token}`);
  let light;
  if (themeId === CUSTOM_THEME_ID && custom) {
    for (const [token, value] of Object.entries(custom.vars)) root.style.setProperty(`--theme-${token}`, value);
    light = custom.light;
  } else {
    light = THEMES[themeId]?.isLight;
  }
  root.setAttribute('data-theme', themeId);
  // Light/dark color-scheme so browsers adjust native controls.
  root.style.colorScheme = light ? 'light' : 'dark';
  // Match the browser chrome (mobile address bar) to the theme's background.
  const meta = document.querySelector('meta[name="theme-color"]');
  const background = getComputedStyle(root).getPropertyValue('--theme-bg').trim();
  if (meta && background) meta.setAttribute('content', background);
}

export const ThemeProvider = ({ children }) => {
  const [customTheme, setCustomTheme] = useState(readCustomTheme);
  const [themeId, setThemeId] = useState(() => resolveId(readStoredTheme(), readCustomTheme()));

  useEffect(() => {
    if (typeof document === 'undefined') return;
    applyToDocument(themeId, customTheme);
  }, [themeId, customTheme]);

  const changeTheme = useCallback((id) => {
    if (id === CUSTOM_THEME_ID ? !customTheme : !THEMES[id]) return;
    setThemeId(id);
    store(STORAGE_KEY, id);
  }, [customTheme]);

  /** Derives, stores and switches to a custom theme. Returns the record, so the caller can show what changed. */
  const saveCustomTheme = useCallback((input) => {
    const record = buildCustomRecord(input);
    setCustomTheme(record);
    store(CUSTOM_KEY, JSON.stringify(record));
    setThemeId(CUSTOM_THEME_ID);
    store(STORAGE_KEY, CUSTOM_THEME_ID);
    return record;
  }, []);

  const resetTheme = useCallback(() => {
    setThemeId(DEFAULT_THEME);
    store(STORAGE_KEY, DEFAULT_THEME);
  }, []);

  const current = themeId === CUSTOM_THEME_ID && customTheme
    ? { id: CUSTOM_THEME_ID, label: 'Custom', group: 'Custom', isLight: customTheme.light, description: 'Your own colours', preview: [customTheme.vars.bg, customTheme.vars.accent, customTheme.vars.accent2] }
    : THEMES[themeId] || THEMES[DEFAULT_THEME];

  return (
    <ThemeContext.Provider
      value={{
        themeId,
        theme: current,
        changeTheme,
        saveCustomTheme,
        resetTheme,
        customTheme,
        themes: THEMES,
        groups: THEME_GROUPS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
