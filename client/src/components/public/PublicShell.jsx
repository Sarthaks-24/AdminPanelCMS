import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SITE, supportMailto } from '../../content/site';
import { DASHBOARD } from '../../lib/routes';

// The one product mark, shared with the auth pages and the dashboard (components/Wordmark.jsx).
import Wordmark from '../Wordmark';

// The three pages a consumer of the API needs. Everything else is one click further in.
const NAV = [
  { to: '/docs/quickstart', label: 'Quickstart' },
  { to: '/docs/api', label: 'API reference' },
  { to: '/docs/limits', label: 'Limits' },
];

// `href` entries leave the single-page app (mail, the external status page); `to` entries stay in it.
const FOOTER_LINKS = [
  { to: '/docs/quickstart', label: 'Quickstart' },
  { to: '/docs/api', label: 'API reference' },
  { to: '/docs/limits', label: 'Limits & errors' },
  { to: '/docs/changelog', label: 'Changelog' },
  { to: '/legal/terms', label: 'Terms' },
  { to: '/legal/privacy', label: 'Privacy' },
  ...(SITE.statusUrl ? [{ href: SITE.statusUrl, label: 'Status', external: true }] : []),
  { href: supportMailto(), label: 'Contact' },
];

export default function PublicShell({ children, wide = false }) {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  // The route the menu was opened on travels with the state, so navigating anywhere — including by
  // browser back — closes it without an effect. The header persists across routes, so otherwise an
  // open menu would stay open on top of the new page.
  const [menu, setMenu] = useState({ open: false, at: pathname });
  const menuOpen = menu.open && menu.at === pathname;
  const setMenuOpen = (open) => setMenu({ open: typeof open === 'function' ? open(menuOpen) : open, at: pathname });

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setMenu((current) => ({ ...current, open: false })); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const linkClass = ({ isActive }) =>
    `rounded-md px-1 py-1 text-[0.875rem] transition ${isActive ? 'text-t-text' : 'text-t-muted hover:text-t-text'}`;
  const menuLinkClass = 'block rounded-lg px-2 py-2 text-sm text-t-muted hover:bg-t-surface-hi hover:text-t-text';

  return (
    <div className="min-h-dvh bg-t-bg text-t-text antialiased">
      <a href="#main" className="skip-link">Skip to content</a>

      <header className="sticky top-0 z-40 border-b border-t-border bg-t-bg/90 backdrop-blur">
        <div className={`mx-auto flex h-14 items-center gap-4 px-4 sm:px-6 ${wide ? 'max-w-[90rem]' : 'max-w-6xl'}`}>
          <Wordmark />

          <nav aria-label="Pages" className="ml-4 hidden items-center gap-5 md:flex">
            {NAV.map((item) => <NavLink key={item.to} to={item.to} className={linkClass}>{item.label}</NavLink>)}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {isAuthenticated ? (
              <Link to={DASHBOARD} className="rounded-lg bg-t-accent px-3.5 py-1.5 text-[0.8125rem] font-semibold text-t-on-accent transition hover:bg-t-accent-br">Dashboard</Link>
            ) : (
              <>
                {/* Sign in moves into the menu below sm; the account button stays at every width, in
                    every signup mode. The signup page itself explains invite-only or closed. */}
                <Link to="/login" className="hidden rounded-lg px-2 py-1.5 text-[0.875rem] text-t-muted transition hover:text-t-text sm:block">Sign in</Link>
                <Link to="/signup" className="rounded-lg bg-t-accent px-3.5 py-1.5 text-[0.8125rem] font-semibold text-t-on-accent transition hover:bg-t-accent-br">Create account</Link>
              </>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="rounded-lg border border-t-border p-1.5 text-t-muted transition hover:border-t-border-hi hover:text-t-text md:hidden"
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
                  <NavLink to={item.to} className={menuLinkClass}>{item.label}</NavLink>
                </li>
              ))}
              {!isAuthenticated && <li className="sm:hidden"><Link to="/login" className={menuLinkClass}>Sign in</Link></li>}
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
            <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2 text-[0.8125rem]">
              {FOOTER_LINKS.map((item) => (item.to ? (
                <Link key={item.label} to={item.to} className="text-t-muted hover:text-t-text">{item.label}</Link>
              ) : (
                <a key={item.label} href={item.href} {...(item.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})} className="text-t-muted hover:text-t-text">{item.label}</a>
              )))}
            </nav>
          </div>
          <p className="mt-10 border-t border-t-border pt-6 text-xs text-t-dim">
            © 2026 {SITE.legal.operator}. {SITE.name} is a hosted service; using it is covered by the{' '}
            <Link to="/legal/terms" className="text-t-muted hover:text-t-text hover:underline">Terms</Link>.
          </p>
        </div>
      </footer>
    </div>
  );
}
