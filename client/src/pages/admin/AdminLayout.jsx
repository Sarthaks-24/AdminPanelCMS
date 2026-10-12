import React, { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SITE } from '../../content/site';
import { APPEARANCE, DASHBOARD } from '../../lib/routes';
import Wordmark from '../../components/Wordmark';
import ResendVerification from '../../components/admin/ResendVerification';
import ThemeGrid from '../../components/admin/ThemeGrid';
import useContentSummary from '../../hooks/useContentSummary';
import { Menu, X, Palette } from 'lucide-react';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-focus';

// The content sections in the order a portfolio is usually filled in. `count` reads the summary from
// GET /account/summary: a number for lists, a yes/no for the two single documents.
const CONTENT = [
  { to: 'profile', label: 'Profile', count: (s) => s.profile },
  { to: 'socials', label: 'Links', count: (s) => s.socials },
  { to: 'skills', label: 'Skills', count: (s) => s.skills },
  { to: 'projects', label: 'Projects', count: (s) => s.projects },
  { to: 'experience', label: 'Work experience', count: (s) => s.experience },
  { to: 'education', label: 'Education', count: (s) => s.education },
  { to: 'certifications', label: 'Certifications', count: (s) => s.certifications },
  { to: 'resume', label: 'Résumé', count: (s) => s.resume },
];

const filled = (value) => (typeof value === 'number' ? value > 0 : Boolean(value));

/** The right-hand column of a content row: how much is there, in figures, with words for screen readers. */
function Count({ value }) {
  if (value === undefined) return null;
  if (!filled(value)) return <span className="font-mono text-xs text-t-dim"><span aria-hidden="true">–</span><span className="sr-only">, empty</span></span>;
  if (typeof value === 'number') return <span className="font-mono text-xs tabular-nums text-t-muted"><span className="sr-only">, </span>{value}<span className="sr-only"> {value === 1 ? 'item' : 'items'}</span></span>;
  return <span className="font-mono text-xs text-t-muted"><span aria-hidden="true">✓</span><span className="sr-only">, added</span></span>;
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { theme, resetTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const summary = useContentSummary();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [topThemePickerOpen, setTopThemePickerOpen] = useState(false);
  const drawerRef = useRef(null);
  const menuButtonRef = useRef(null);
  const themeButtonRef = useRef(null);
  const pickerRef = useRef(null);

  const handleLogout = () => {
    navigate('/login');
    logout();
  };

  // Content (what Apps serve) · API (how sites read it) · Account (you).
  const navGroups = [
    { label: null, links: [{ to: DASHBOARD, label: 'Overview', exact: true }] },
    { label: 'Content', links: CONTENT.map((item) => ({ ...item, to: `${DASHBOARD}/${item.to}` })) },
    {
      label: 'API',
      links: [
        { to: `${DASHBOARD}/apps`, label: 'Apps & keys' },
        { to: '/docs/quickstart', label: 'Docs', external: true },
      ],
    },
    {
      label: 'Account',
      links: [
        { to: `${DASHBOARD}/account`, label: 'Account' },
        { to: APPEARANCE, label: 'Appearance' },
        ...(user?.role === 'superadmin' ? [{ to: `${DASHBOARD}/superadmin`, label: 'Platform admin' }] : []),
      ],
    },
  ];
  const navLinks = navGroups.flatMap((group) => group.links);
  const isActive = (link) => !link.external && (link.exact ? location.pathname === link.to || location.pathname === `${link.to}/` : location.pathname.startsWith(link.to));

  // Where you are, in plain words: the section, and the item inside it when there is one.
  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === DASHBOARD || path === `${DASHBOARD}/`) return ['Overview'];
    if (path.startsWith(`${DASHBOARD}/projects/new`)) return ['Projects', 'New project'];
    if (path.startsWith(`${DASHBOARD}/projects/edit`)) return ['Projects', 'Edit project'];
    if (path.startsWith(`${DASHBOARD}/apps/`)) return ['Apps & keys', 'App settings'];
    const match = navLinks.find((link) => !link.exact && !link.external && path.startsWith(link.to));
    return [match?.label || SITE.name];
  };

  // Keep the browser tab title in step with the page, and let Escape close anything that is open.
  const crumbs = getBreadcrumb();
  const pageTitle = crumbs[crumbs.length - 1];
  useEffect(() => { document.title = `${pageTitle} · ${SITE.name}`; }, [pageTitle]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      setMobileMenuOpen((open) => { if (open) menuButtonRef.current?.focus(); return false; });
      setTopThemePickerOpen((open) => { if (open) themeButtonRef.current?.focus(); return false; });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The mobile drawer takes focus when it opens, so keyboard and screen-reader users land in it.
  useEffect(() => {
    if (mobileMenuOpen) drawerRef.current?.querySelector('a, button')?.focus();
  }, [mobileMenuOpen]);
  // So does the theme picker: focus goes to the current theme.
  useEffect(() => {
    if (topThemePickerOpen) (pickerRef.current?.querySelector('[data-theme-card][aria-pressed="true"]') || pickerRef.current?.querySelector('button'))?.focus();
  }, [topThemePickerOpen]);

  const closeDrawer = () => setMobileMenuOpen(false);
  const closePicker = (returnFocus = true) => { setTopThemePickerOpen(false); if (returnFocus) themeButtonRef.current?.focus(); };

  const filledCount = summary ? CONTENT.filter((item) => filled(item.count(summary))).length : null;

  return (
    <div className="flex min-h-screen flex-col bg-t-bg font-sans text-t-text antialiased md:flex-row">
      <a href="#main-content" className="skip-link">Skip to content</a>

      {/* Mobile drawer overlay */}
      {mobileMenuOpen && (
        <div aria-hidden="true" className="fixed inset-0 z-40 bg-t-bg/80 backdrop-blur-sm md:hidden" onClick={closeDrawer} />
      )}

      {/* Sidebar navigation */}
      <aside
        ref={drawerRef}
        aria-label="Sidebar"
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-64 flex-col justify-between border-r border-t-border bg-t-surface transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : 'invisible -translate-x-full md:visible'
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex h-[3.75rem] items-center justify-between px-5">
            <Wordmark to={DASHBOARD} onClick={closeDrawer} label={`${SITE.name} dashboard, Overview`} />
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => { closeDrawer(); menuButtonRef.current?.focus(); }}
              className={`-m-1 rounded p-2.5 text-t-muted hover:text-t-text md:hidden ${focusRing}`}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
            {navGroups.map((group) => (
              <div key={group.label || 'top'} className={group.label ? 'mt-5' : ''}>
                {group.label && <p className="mb-1 px-3 text-xs font-medium text-t-dim">{group.label}</p>}
                <ul>
                  {group.links.map((link) => {
                    const active = isActive(link);
                    // The active row is marked three ways: the caret, the weight and aria-current.
                    const className = `${focusRing} flex items-baseline gap-1 rounded py-[0.4375rem] pl-2 pr-3 text-sm transition-colors ${
                      active ? 'font-semibold text-t-text' : 'text-t-muted hover:text-t-text'
                    }`;
                    const caret = <span aria-hidden="true" className="w-3 shrink-0 font-mono text-t-accent-br">{active ? '›' : ''}</span>;
                    return (
                      <li key={link.to}>
                        {link.external ? (
                          <a href={link.to} target="_blank" rel="noopener noreferrer" onClick={closeDrawer} className={className}>
                            {caret}<span className="flex-1">{link.label}</span><span aria-hidden="true" className="text-xs text-t-dim">↗</span><span className="sr-only"> (opens in a new tab)</span>
                          </a>
                        ) : (
                          <Link to={link.to} onClick={closeDrawer} aria-current={active ? 'page' : undefined} className={className}>
                            {caret}
                            <span className="min-w-0 flex-1 truncate">{link.label}</span>
                            {link.count && summary && <Count value={link.count(summary)} />}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* How much of the portfolio is filled in: one tick per content section. */}
          {filledCount !== null && (
            <div className="px-5 pb-4">
              <p className="text-xs text-t-muted">{filledCount} of {CONTENT.length} sections filled</p>
              <div aria-hidden="true" className="mt-2 flex gap-1">
                {CONTENT.map((item) => (
                  <span key={item.to} className={`h-1 flex-1 rounded-full ${filled(item.count(summary)) ? 'bg-t-accent' : 'bg-t-border'}`} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Signed-in account */}
        <div className="flex items-center gap-3 border-t border-t-border px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8125rem] font-medium text-t-text" title={user?.email}>{user?.email}</p>
            {user?.role === 'superadmin' && <p className="text-xs text-t-dim">Platform admin</p>}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className={`shrink-0 rounded px-1.5 py-1 text-xs text-t-muted underline-offset-4 transition-colors hover:text-t-danger hover:underline focus-visible:text-t-danger ${focusRing}`}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-t-bg md:pl-64">
        <header className="sticky top-0 z-30 flex h-[3.75rem] items-center justify-between border-b border-t-border bg-t-bg/95 px-4 backdrop-blur-md sm:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="Open navigation"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
              className={`-m-1 rounded border border-t-border bg-t-surface-hi p-2.5 text-t-muted md:hidden ${focusRing}`}
            >
              <Menu size={16} aria-hidden="true" />
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm text-t-muted">
              {crumbs.map((part, index, parts) => (
                <React.Fragment key={part}>
                  {index > 0 && <span aria-hidden="true">/</span>}
                  <span className={`truncate ${index === parts.length - 1 ? 'font-medium text-t-text' : ''}`} aria-current={index === parts.length - 1 ? 'page' : undefined}>{part}</span>
                </React.Fragment>
              ))}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Theme picker */}
            <div className="relative">
              <button
                ref={themeButtonRef}
                type="button"
                onClick={() => setTopThemePickerOpen((open) => !open)}
                aria-haspopup="dialog"
                aria-expanded={topThemePickerOpen}
                aria-controls="theme-picker"
                aria-label={`Theme: ${theme.label}. Change theme`}
                className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded border border-t-border bg-t-surface px-3 py-2 text-xs font-medium text-t-text transition-colors hover:border-t-border-hi ${focusRing}`}
              >
                <Palette size={14} aria-hidden="true" className="text-t-accent-br" />
                <span className="hidden sm:inline">{theme.label}</span>
                <span aria-hidden="true" className="flex items-center gap-1">
                  {theme.preview.map((colour, index) => (
                    <span key={index} className="h-2.5 w-2.5 rounded-full border border-t-border-hi" style={{ backgroundColor: colour }} />
                  ))}
                </span>
              </button>

              {topThemePickerOpen && (
                <>
                  <div aria-hidden="true" className="fixed inset-0 z-40" onClick={() => closePicker(false)} />
                  <div
                    ref={pickerRef}
                    id="theme-picker"
                    role="dialog"
                    aria-label="Themes"
                    className="fixed inset-x-2 top-16 z-50 flex max-h-[calc(100dvh-5rem)] flex-col rounded-lg border border-t-border-hi bg-t-surface shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[min(40rem,calc(100vw-2rem))] sm:max-h-[min(36rem,calc(100dvh-6rem))]"
                  >
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
                      <ThemeGrid compact onChoose={() => closePicker()} onNavigate={() => closePicker(false)} />
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-t-border px-3 py-2.5 sm:px-4">
                      <button type="button" onClick={() => { resetTheme(); closePicker(); }} className={`rounded px-1.5 py-1 text-xs text-t-muted hover:text-t-text ${focusRing}`}>Reset to default</button>
                      <Link to={APPEARANCE} onClick={() => closePicker(false)} className={`rounded px-1.5 py-1 text-xs font-medium text-t-text underline-offset-4 hover:underline ${focusRing}`}>Make your own theme</Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="admin-content flex-1 overflow-y-auto p-4 outline-none sm:p-6 lg:p-8"
        >
          {user && !user.emailVerified && (
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-t-warn/40 bg-t-warn/10 p-4 text-sm">
              <span className="text-t-text">Verify your email to edit content and create keys.</span>
              <ResendVerification email={user.email} />
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
