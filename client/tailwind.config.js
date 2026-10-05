/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        readable: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
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
        't-bg':           'var(--theme-bg)',
        't-surface':      'var(--theme-surface)',
        't-surface-hi':   'var(--theme-surface-hi)',
        't-border':       'var(--theme-border)',
        't-border-hi':    'var(--theme-border-hi)',
        't-accent':       'var(--theme-accent)',
        't-accent-br':    'var(--theme-accent-bright)',
        't-on-accent':    'var(--theme-on-accent)',
        't-accent2':      'var(--theme-accent2)',
        't-accent2-dim':  'var(--theme-accent2-dim)',
        't-on-accent2':   'var(--theme-on-accent2)',
        't-text':         'var(--theme-text)',
        't-muted':        'var(--theme-text-muted)',
        't-dim':          'var(--theme-text-dim)',
        't-danger':       'var(--theme-danger)',
        't-danger-dim':   'var(--theme-danger-dim)',
        't-code':         'var(--theme-code-bg)',
      },
      boxShadow: {
        'card':           '0 4px 20px -2px rgba(0, 0, 0, 0.25)',
        'card-hover':     '0 10px 25px -3px rgba(0, 0, 0, 0.35)',
        'glow-indigo':    '0 0 25px -5px rgba(99, 102, 241, 0.3)',
        'glow-emerald':   '0 0 25px -5px rgba(16, 185, 129, 0.3)',
        'glow-accent':    '0 0 20px -4px var(--theme-brand-glow)',
      },
    },
  },
  plugins: [],
};
