import React, { createContext, useContext, useState, useEffect } from 'react';

// ─── Designer Themes with Balanced & Softened Contrast ────────────────────────
export const THEMES = {

  // ══════════════════════════════════════════════
  //  MODERN DARK THEMES (Softened Contrast)
  // ══════════════════════════════════════════════

  'powershell': {
    id: 'powershell',
    label: 'PowerShell Modern',
    description: 'Refined deep terminal slate with classic blue',
    preview: ['#0c1017', '#2563eb', '#10b981'],
    group: 'Dark',
    isLight: false,
  },
  'linear-obsidian': {
    id: 'linear-obsidian',
    label: 'Linear Obsidian',
    description: 'Sleek dark graphite & subtle indigo glow',
    preview: ['#08090d', '#6366f1', '#a855f7'],
    group: 'Dark',
    isLight: false,
  },
  'vercel-jet': {
    id: 'vercel-jet',
    label: 'Vercel Jet',
    description: 'Clean dark zinc with electric blue accents',
    preview: ['#09090b', '#0070f3', '#10b981'],
    group: 'Dark',
    isLight: false,
  },
  'supabase-emerald': {
    id: 'supabase-emerald',
    label: 'Supabase Emerald',
    description: 'Dark obsidian slate with emerald highlights',
    preview: ['#0a0f12', '#24b47e', '#10b981'],
    group: 'Dark',
    isLight: false,
  },
  'raycast-purple': {
    id: 'raycast-purple',
    label: 'Raycast Violet',
    description: 'Cosmic night violet & soft magenta accents',
    preview: ['#0c0a14', '#8b5cf6', '#ec4899'],
    group: 'Dark',
    isLight: false,
  },
  'nordic-slate': {
    id: 'nordic-slate',
    label: 'Nordic Slate',
    description: 'Deep navy-slate with soft cyan & mint',
    preview: ['#0b1320', '#38bdf8', '#34d399'],
    group: 'Dark',
    isLight: false,
  },
  'warm-titanium': {
    id: 'warm-titanium',
    label: 'Warm Titanium',
    description: 'Espresso charcoal with champagne gold',
    preview: ['#11100f', '#d4a373', '#a7c957'],
    group: 'Dark',
    isLight: false,
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
  },
  'editorial-linen': {
    id: 'editorial-linen',
    label: 'Warm Linen',
    description: 'Warm cream canvas with terracotta & amber',
    preview: ['#faf7f2', '#c2410c', '#d97706'],
    group: 'Light',
    isLight: true,
  },
  'nordic-frost': {
    id: 'nordic-frost',
    label: 'Nordic Frost',
    description: 'Pale mist slate with deep oceanic cyan',
    preview: ['#f1f5f9', '#0284c7', '#0d9488'],
    group: 'Light',
    isLight: true,
  },
  'sage-mint': {
    id: 'sage-mint',
    label: 'Sage & Mint',
    description: 'Soft organic eucalyptus & spearmint',
    preview: ['#f2f6f4', '#059669', '#10b981'],
    group: 'Light',
    isLight: true,
  },
  'soft-lavender': {
    id: 'soft-lavender',
    label: 'Soft Lavender',
    description: 'Gentle pale lilac with royal amethyst',
    preview: ['#f5f3f9', '#7c3aed', '#a855f7'],
    group: 'Light',
    isLight: true,
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
  },
  'synthwave-sunset': {
    id: 'synthwave-sunset',
    label: 'Synthwave Sunset',
    description: 'Velvet night, warm sunset rose & violet',
    preview: ['#0f081c', '#f43f5e', '#8b5cf6'],
    group: 'Funky',
    isLight: false,
  },
  'dracula-modern': {
    id: 'dracula-modern',
    label: 'Dracula Modern',
    description: 'Refined dusk purple, bat-wing pink & green',
    preview: ['#171724', '#bd93f9', '#50fa7b'],
    group: 'Funky',
    isLight: false,
  },
  'tokyo-neon': {
    id: 'tokyo-neon',
    label: 'Tokyo Neon',
    description: 'Midnight navy, hot magenta & cyber aqua',
    preview: ['#080c14', '#ff2a6d', '#05d9e8'],
    group: 'Funky',
    isLight: false,
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
  },
  'royal-gold': {
    id: 'royal-gold',
    label: 'Royal Noir',
    description: 'Stealth dark carbon & warm imperial gold',
    preview: ['#0e0d0c', '#e5a93c', '#9b7a42'],
    group: 'Unique',
    isLight: false,
  },
  'aurora': {
    id: 'aurora',
    label: 'Aurora Borealis',
    description: 'Arctic twilight with dancing emerald lights',
    preview: ['#050e14', '#2dd4bf', '#818cf8'],
    group: 'Unique',
    isLight: false,
  },
  'noir-film': {
    id: 'noir-film',
    label: 'Cinematic Noir',
    description: 'Softened studio monochrome — subtle slate silver',
    preview: ['#0e0e10', '#d4d4d8', '#a1a1aa'],
    group: 'Unique',
    isLight: false,
  },
};

export const THEME_GROUPS = ['Dark', 'Light', 'Funky', 'Unique'];

const DEFAULT_THEME = 'powershell';
const STORAGE_KEY = 'admin_dashboard_theme';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [themeId, setThemeId] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && THEMES[stored] ? stored : DEFAULT_THEME;
  });

  // Apply data-theme attribute to document root for CSS variable scoping
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', themeId);
    // Apply light/dark color-scheme so browsers adjust native controls
    const theme = THEMES[themeId];
    if (theme?.isLight) {
      root.style.colorScheme = 'light';
    } else {
      root.style.colorScheme = 'dark';
    }
  }, [themeId]);

  const changeTheme = (id) => {
    if (!THEMES[id]) return;
    setThemeId(id);
    localStorage.setItem(STORAGE_KEY, id);
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
