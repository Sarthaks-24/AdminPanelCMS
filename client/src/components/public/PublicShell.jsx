import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Check, Menu, Palette, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSignupMode } from '../../hooks/useSignupMode';
import { REPO_URL, SITE } from '../../content/site';

function Wordmark() {
  return (
    <Link to="/" className="group flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent">
      {/* A pool and the two narrower views drawn from it: the product's own shape, not a generic glyph. */}
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
        <rect x="1" y="2" width="22" height="7" rx="2" fill="var(--theme-accent)" />
        <rect x="1" y="12" width="13" height="4" rx="1.5" fill="var(--theme-text-dim)" />
        <rect x="1" y="18" width="18" height="4" rx="1.5" fill="var(--theme-text-dim)" />
      </svg>
      <span className="font-display text-[0.9375rem] font-semibold tracking-tight text-t-text">{SITE.name}</span>
    </Link>
  );
}

/** The 18 themes are a real feature of the dashboard, so the public pages let you drive them. */
function ThemePicker() {
  const { themeId, themes, changeTheme, groups } = useTheme();
  const [open, setOpen] = useState(false);
  const container = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (!container.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const byGroup = groups.map((group) => [group, Object.values(themes).filter((theme) => theme.group === group)]);

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-2 rounded-lg border border-t-border px-2.5 py-1.5 text-[0.8125rem] text-t-muted transition hover:border-t-border-hi hover:text-t-text"
      >
        <Palette size={15} aria-hidden="true" />
        <span className="hidden sm:inline">Theme</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Choose a theme"
          className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-64 overflow-y-auto rounded-xl border border-t-border bg-t-surface p-2 shadow-card"
        >
          <p className="px-2 py-1.5 text-xs leading-5 text-t-dim">Switches this page and the dashboard you sign into.</p>
          {byGroup.map(([group, list]) => (
            <div key={group} className="mt-1">
              <p className="px-2 py-1 text-[0.6875rem] font-medium text-t-dim">{group}</p>
              {list.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={theme.id === themeId}
                  onClick={() => { changeTheme(theme.id); setOpen(false); }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[0.8125rem] text-t-muted transition hover:bg-t-surface-hi hover:text-t-text"
                >
                  <span className="flex shrink-0 gap-0.5" aria-hidden="true">
                    {theme.preview.map((color) => (
                      <span key={color} className="h-3.5 w-2 rounded-sm" style={{ background: color }} />
                    ))}
                  </span>
                  <span className="flex-1 truncate">{theme.label}</span>
                  {theme.id === themeId && <Check size={14} className="shrink-0 text-t-accent" aria-hidden="true" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const NAV = [
  { to: '/docs', label: 'Docs' },
  { to: '/readme', label: 'Readme' },
  { to: '/license', label: 'License' },
];

export default function PublicShell({ children, wide = false }) {
  const { isAuthenticated } = useAuth();
  const { isOpen, isInviteOnly } = useSignupMode();
  const [menuOpen, setMenuOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    `rounded-md px-1 py-1 text-[0.875rem] transition ${isActive ? 'text-t-text' : 'text-t-muted hover:text-t-text'}`;

  return (
    <div className="min-h-dvh bg-t-bg text-t-text antialiased">
      <a href="#main" className="skip-link">Skip to content</a>

      <header className="sticky top-0 z-40 border-b border-t-border bg-t-bg/90 backdrop-blur">
        <div className={`mx-auto flex h-14 items-center gap-4 px-4 sm:px-6 ${wide ? 'max-w-[90rem]' : 'max-w-6xl'}`}>
          <Wordmark />

          <nav aria-label="Pages" className="ml-4 hidden items-center gap-5 md:flex">
            {NAV.map((item) => <NavLink key={item.to} to={item.to} className={linkClass}>{item.label}</NavLink>)}
            <a href={REPO_URL} target="_blank" rel="noreferrer noopener" className="rounded-md px-1 py-1 text-[0.875rem] text-t-muted transition hover:text-t-text">GitHub</a>
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <ThemePicker />
            {isAuthenticated ? (
              <Link to="/admin/dashboard" className="rounded-lg bg-t-accent px-3.5 py-1.5 text-[0.8125rem] font-semibold text-t-on-accent transition hover:bg-t-accent-br">Dashboard</Link>
            ) : (
              <>
                <Link to="/admin/login" className="hidden rounded-lg px-2 py-1.5 text-[0.875rem] text-t-muted transition hover:text-t-text sm:block">Sign in</Link>
                {isOpen && <Link to="/admin/signup" className="rounded-lg bg-t-accent px-3.5 py-1.5 text-[0.8125rem] font-semibold text-t-on-accent transition hover:bg-t-accent-br">Create account</Link>}
                {isInviteOnly && <Link to="/admin/signup" className="rounded-lg border border-t-border-hi px-3.5 py-1.5 text-[0.8125rem] font-medium text-t-text transition hover:border-t-accent">Redeem an invite</Link>}
              </>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="rounded-lg border border-t-border p-1.5 text-t-muted md:hidden"
            >
              {menuOpen ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav aria-label="Pages" className="border-t border-t-border px-4 py-3 md:hidden">
            <ul className="space-y-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink to={item.to} onClick={() => setMenuOpen(false)} className="block rounded-lg px-2 py-2 text-sm text-t-muted hover:bg-t-surface-hi hover:text-t-text">{item.label}</NavLink>
                </li>
              ))}
              <li><a href={REPO_URL} target="_blank" rel="noreferrer noopener" className="block rounded-lg px-2 py-2 text-sm text-t-muted hover:bg-t-surface-hi hover:text-t-text">GitHub</a></li>
              {!isAuthenticated && <li><Link to="/admin/login" onClick={() => setMenuOpen(false)} className="block rounded-lg px-2 py-2 text-sm text-t-muted hover:bg-t-surface-hi hover:text-t-text">Sign in</Link></li>}
            </ul>
          </nav>
        )}
      </header>

      <main id="main">{children}</main>

      <footer className="mt-24 border-t border-t-border">
        <div className={`mx-auto px-4 py-10 sm:px-6 ${wide ? 'max-w-[90rem]' : 'max-w-6xl'}`}>
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-xs">
              <Wordmark />
              <p className="mt-3 text-[0.8125rem] leading-6 text-t-muted">{SITE.claim} {SITE.mechanism}</p>
              <p className="mt-3 text-xs leading-5 text-t-dim">{SITE.status}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-[0.8125rem] sm:grid-cols-2">
              <Link to="/docs" className="text-t-muted hover:text-t-text">Docs</Link>
              <a href={REPO_URL} target="_blank" rel="noreferrer noopener" className="text-t-muted hover:text-t-text">GitHub</a>
              <Link to="/readme" className="text-t-muted hover:text-t-text">Readme</Link>
              <Link to="/docs/api" className="text-t-muted hover:text-t-text">API reference</Link>
              <Link to="/license" className="text-t-muted hover:text-t-text">License</Link>
              <Link to="/admin/login" className="text-t-muted hover:text-t-text">Sign in</Link>
            </div>
          </div>
          <p className="mt-10 border-t border-t-border pt-6 text-xs text-t-dim">
            Released under the <Link to="/license" className="text-t-muted hover:text-t-text hover:underline">MIT License</Link>. Run your own copy; nothing here is a hosted service.
          </p>
        </div>
      </footer>
    </div>
  );
}
