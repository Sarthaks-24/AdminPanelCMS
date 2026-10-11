import React, { createContext, useContext, useState, useEffect } from 'react';

// ─── Designer Themes with Balanced & Softened Contrast ────────────────────────
// Every theme keeps its id and its CSS block in index.css: a stored id must keep rendering, and the
// pre-paint script in index.html applies whatever id it finds. `hidden` only decides whether a
// picker offers the theme. Four are offered; the rest are kept for accounts that already use them.
// Labels are descriptive, never a product's name.
export const THEMES = {

  // ══════════════════════════════════════════════
  //  MODERN DARK THEMES (Softened Contrast)
  // ══════════════════════════════════════════════

  'powershell': {
    id: 'powershell',
    label: 'Terminal Slate',
    description: 'Refined deep terminal slate with classic blue',
    preview: ['#0c1017', '#2563eb', '#10b981'],
    group: 'Dark',
    isLight: false,
    hidden: false,
  },
  'linear-obsidian': {
    id: 'linear-obsidian',
    label: 'Obsidian',
    description: 'Sleek dark graphite & subtle indigo glow',
    preview: ['#08090d', '#6366f1', '#a855f7'],
    group: 'Dark',
    isLight: false,
    hidden: true,
  },
  'vercel-jet': {
    id: 'vercel-jet',
    label: 'Jet',
    description: 'Clean dark zinc with electric blue accents',
    preview: ['#09090b', '#0070f3', '#10b981'],
    group: 'Dark',
    isLight: false,
    hidden: true,
  },
  'supabase-emerald': {
    id: 'supabase-emerald',
    label: 'Emerald',
    description: 'Dark obsidian slate with emerald highlights',
    preview: ['#0a0f12', '#24b47e', '#10b981'],
    group: 'Dark',
    isLight: false,
    hidden: true,
  },
  'raycast-purple': {
    id: 'raycast-purple',
    label: 'Cosmic Violet',
    description: 'Cosmic night violet & soft magenta accents',
    preview: ['#0c0a14', '#8b5cf6', '#ec4899'],
    group: 'Dark',
    isLight: false,
    hidden: true,
  },
  'nordic-slate': {
    id: 'nordic-slate',
    label: 'Nordic Slate',
    description: 'Deep navy-slate with soft cyan & mint',
    preview: ['#0b1320', '#38bdf8', '#34d399'],
    group: 'Dark',
    isLight: false,
    hidden: false,
  },
  'warm-titanium': {
    id: 'warm-titanium',
    label: 'Warm Titanium',
    description: 'Espresso charcoal with champagne gold',
    preview: ['#11100f', '#d4a373', '#a7c957'],
    group: 'Dark',
    isLight: false,
    hidden: true,
  },

  // ══════════════════════════════════════════════
  //  REFINED LIGHT THEMES (Gentle & Balanced)
  // ══════════════════════════════════════════════

  'clean-studio': {
    id: 'clean-studio',
    label: 'Clean Studio',
    description: 'Off-white canvas, clean cards, royal indigo',
    preview: ['#f8fafc', '#2563eb', '#059669'],
    group: 'Light',
    isLight: true,
    hidden: false,
  },
  'editorial-linen': {
    id: 'editorial-linen',
    label: 'Warm Linen',
    description: 'Warm cream canvas with terracotta & amber',
    preview: ['#faf7f2', '#c2410c', '#d97706'],
    group: 'Light',
    isLight: true,
    hidden: true,
  },
  'nordic-frost': {
    id: 'nordic-frost',
    label: 'Nordic Frost',
    description: 'Pale mist slate with deep oceanic cyan',
    preview: ['#f1f5f9', '#0284c7', '#0d9488'],
    group: 'Light',
    isLight: true,
    hidden: false,
  },
  'sage-mint': {
    id: 'sage-mint',
    label: 'Sage & Mint',
    description: 'Soft organic eucalyptus & spearmint',
    preview: ['#f2f6f4', '#059669', '#10b981'],
    group: 'Light',
    isLight: true,
    hidden: true,
  },
  'soft-lavender': {
    id: 'soft-lavender',
    label: 'Soft Lavender',
    description: 'Gentle pale lilac with royal amethyst',
    preview: ['#f5f3f9', '#7c3aed', '#a855f7'],
    group: 'Light',
    isLight: true,
    hidden: true,
  },

  // ══════════════════════════════════════════════
  //  FUNKY THEMES (Tasteful & Vibrant)
  // ══════════════════════════════════════════════

  'cyberpunk-luxe': {
    id: 'cyberpunk-luxe',
    label: 'Cyberpunk Luxe',
    description: 'High-tech dark carbon, electric cyan & amber',
    preview: ['#0a0b12', '#00f0ff', '#ffaa00'],
    group: 'Funky',
    isLight: false,
    hidden: true,
  },
  'synthwave-sunset': {
    id: 'synthwave-sunset',
    label: 'Synthwave Sunset',
    description: 'Velvet night, warm sunset rose & violet',
    preview: ['#0f081c', '#f43f5e', '#8b5cf6'],
    group: 'Funky',
    isLight: false,
    hidden: true,
  },
  'dracula-modern': {
    id: 'dracula-modern',
    label: 'Dusk Purple',
    description: 'Refined dusk purple, soft pink & green',
    preview: ['#171724', '#bd93f9', '#50fa7b'],
    group: 'Funky',
    isLight: false,
    hidden: true,
  },
  'tokyo-neon': {
    id: 'tokyo-neon',
    label: 'Tokyo Neon',
    description: 'Midnight navy, hot magenta & cyber aqua',
    preview: ['#080c14', '#ff2a6d', '#05d9e8'],
    group: 'Funky',
    isLight: false,
    hidden: true,
  },

  // ══════════════════════════════════════════════
  //  UNIQUE / ARTISTIC THEMES
  // ══════════════════════════════════════════════

  'abyssal-ocean': {
    id: 'abyssal-ocean',
    label: 'Abyssal Ocean',
    description: 'Deep oceanic abyss & bioluminescent teal',
    preview: ['#050c14', '#00d2d3', '#2e86de'],
    group: 'Unique',
    isLight: false,
    hidden: true,
  },
  'royal-gold': {
    id: 'royal-gold',
    label: 'Royal Noir',
    description: 'Stealth dark carbon & warm imperial gold',
    preview: ['#0e0d0c', '#e5a93c', '#9b7a42'],
    group: 'Unique',
    isLight: false,
    hidden: true,
  },
  'aurora': {
    id: 'aurora',
    label: 'Aurora Borealis',
    description: 'Arctic twilight with dancing emerald lights',
    preview: ['#050e14', '#2dd4bf', '#818cf8'],
    group: 'Unique',
    isLight: false,
    hidden: true,
  },
  'noir-film': {
    id: 'noir-film',
    label: 'Cinematic Noir',
    description: 'Softened studio monochrome — subtle slate silver',
    preview: ['#0e0e10', '#d4d4d8', '#a1a1aa'],
    group: 'Unique',
    isLight: false,
    hidden: true,
  },
};

export const THEME_GROUPS = ['Dark', 'Light', 'Funky', 'Unique'];

const DEFAULT_THEME = 'powershell';
const STORAGE_KEY = 'admin_dashboard_theme';

const ThemeContext = createContext();

const hasWindow = typeof window !== 'undefined';

// Storage can be blocked (private mode, cookie settings, embedded views). Reading or writing it
// must never take the whole app down with it.
function readStoredTheme() {
  if (!hasWindow) return null;
  try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function storeTheme(id) {
  if (!hasWindow) return;
  try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* storage unavailable: the choice lasts this visit */ }
}

export const ThemeProvider = ({ children }) => {
  const [themeId, setThemeId] = useState(() => {
    const stored = readStoredTheme();
    return stored && THEMES[stored] ? stored : DEFAULT_THEME;
  });

  // Apply data-theme attribute to document root for CSS variable scoping
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.setAttribute('data-theme', themeId);
    // Apply light/dark color-scheme so browsers adjust native controls
    const theme = THEMES[themeId];
    // Match the browser chrome (mobile address bar) to the theme's background.
    const meta = document.querySelector('meta[name="theme-color"]');
    const background = getComputedStyle(root).getPropertyValue('--theme-bg').trim();
    if (meta && background) meta.setAttribute('content', background);
    if (theme?.isLight) {
      root.style.colorScheme = 'light';
    } else {
      root.style.colorScheme = 'dark';
    }
  }, [themeId]);

  const changeTheme = (id) => {
    if (!THEMES[id]) return;
    setThemeId(id);
    storeTheme(id);
  };

  return (
    <ThemeContext.Provider
      value={{
        themeId,
        theme: THEMES[themeId] || THEMES[DEFAULT_THEME],
        changeTheme,
        themes: THEMES,
        groups: THEME_GROUPS,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
