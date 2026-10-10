/**
 * A theme token that still works with an opacity modifier.
 *
 * Tailwind can only apply `/50` to a colour whose value it can take apart, so a plain
 * `var(--theme-accent)` makes utilities like `bg-t-accent/10` compile to nothing at all —
 * silently, with no build error. Returning color-mix for the modifier case keeps the token
 * tied to the active theme and makes the whole `/<alpha>` range usable.
 */
const themeColor = (variable) => ({ opacityValue }) => (
  opacityValue === undefined
    ? `var(${variable})`
    : `color-mix(in srgb, var(${variable}) calc(${opacityValue} * 100%), transparent)`
);

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Geist"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        display: ['"Bricolage Grotesque"', '"Geist"', 'system-ui', 'sans-serif'],
        readable: ['"Geist"', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        // ── Legacy brand palette (kept for backward compatibility) ─────────
        brand: {
          50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
          400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
          800: '#3730a3', 900: '#312e81', 950: '#1e1b4b',
        },
        panel: {
          bg: '#090d16', surface: '#0f172a', card: '#131d31',
          border: '#1e293b', borderLight: '#334155', muted: '#64748b', hover: '#1e293b',
        },
        // ── Theme-aware CSS-variable tokens (t- prefix) ────────────────────
        // Use these everywhere instead of hardcoded hex values.
        // They update automatically when the user switches themes.
        't-bg':           themeColor('--theme-bg'),
        't-surface':      themeColor('--theme-surface'),
        't-surface-hi':   themeColor('--theme-surface-hi'),
        't-border':       themeColor('--theme-border'),
        't-border-hi':    themeColor('--theme-border-hi'),
        't-accent':       themeColor('--theme-accent'),
        't-accent-br':    themeColor('--theme-accent-bright'),
        't-on-accent':    themeColor('--theme-on-accent'),
        't-accent2':      themeColor('--theme-accent2'),
        't-accent2-dim':  themeColor('--theme-accent2-dim'),
        't-on-accent2':   themeColor('--theme-on-accent2'),
        't-text':         themeColor('--theme-text'),
        't-muted':        themeColor('--theme-text-muted'),
        't-dim':          themeColor('--theme-text-dim'),
        't-danger':       themeColor('--theme-danger'),
        't-danger-dim':   themeColor('--theme-danger-dim'),
        't-code':         themeColor('--theme-code-bg'),
      },
      boxShadow: {
        // Shadows take their tint from the active theme instead of pure black.
        'card':           '0 1px 0 color-mix(in srgb, var(--theme-text) 6%, transparent) inset, 0 8px 24px -12px color-mix(in srgb, var(--theme-bg) 70%, var(--theme-brand))',
        'card-hover':     '0 1px 0 color-mix(in srgb, var(--theme-text) 8%, transparent) inset, 0 16px 32px -14px color-mix(in srgb, var(--theme-bg) 60%, var(--theme-brand))',
        'glow-indigo':    '0 0 25px -5px rgba(99, 102, 241, 0.3)',
        'glow-emerald':   '0 0 25px -5px rgba(16, 185, 129, 0.3)',
        'glow-accent':    '0 0 20px -4px var(--theme-brand-glow)',
      },
    },
  },
  plugins: [],
};
