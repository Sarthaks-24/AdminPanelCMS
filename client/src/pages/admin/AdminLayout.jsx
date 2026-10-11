import React, { useEffect, useRef, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme, THEME_GROUPS } from '../../context/ThemeContext';
import { SITE } from '../../content/site';
import { DASHBOARD } from '../../lib/routes';
import Wordmark from '../../components/Wordmark';
import ResendVerification from '../../components/admin/ResendVerification';
import {
  LayoutDashboard,
  User,
  Share2,
  Cpu,
  FolderGit2,
  Briefcase,
  GraduationCap,
  Award,
  FileText,
  LogOut,
  Menu,
  X,
  Palette,
  Check,
  Boxes,
  BookOpen,
  Settings,
  ShieldCheck,
} from 'lucide-react';

/** Two letters for the avatar, from the email's local part: "jane.doe@…" → "JD", "sam@…" → "SA". */
function initialsFor(email) {
  const local = String(email || '').split('@')[0];
  const words = local.split(/[._\-+\s]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : local.slice(0, 2);
  return letters.toUpperCase() || '?';
}

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { themeId, changeTheme, themes, groups } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [topThemePickerOpen, setTopThemePickerOpen] = useState(false);
  const drawerRef = useRef(null);
  const menuButtonRef = useRef(null);
  const themeButtonRef = useRef(null);

  const handleLogout = () => {
    navigate('/login');
    logout();
  };

  // Content (what Apps serve) · API (how sites read it) · Account (you).
  const navGroups = [
    { label: null, links: [{ to: DASHBOARD, label: 'Overview', icon: LayoutDashboard, exact: true }] },
    {
      label: 'Content',
      links: [
        { to: `${DASHBOARD}/profile`, label: 'Your profile', icon: User },
        { to: `${DASHBOARD}/socials`, label: 'Links', icon: Share2 },
        { to: `${DASHBOARD}/skills`, label: 'Skills', icon: Cpu },
        { to: `${DASHBOARD}/projects`, label: 'Projects', icon: FolderGit2 },
        { to: `${DASHBOARD}/experience`, label: 'Work experience', icon: Briefcase },
        { to: `${DASHBOARD}/education`, label: 'Education', icon: GraduationCap },
        { to: `${DASHBOARD}/certifications`, label: 'Certifications', icon: Award },
        { to: `${DASHBOARD}/resume`, label: 'Résumé', icon: FileText },
      ],
    },
    {
      label: 'API',
      links: [
        { to: `${DASHBOARD}/apps`, label: 'Apps', icon: Boxes },
        { to: '/docs/quickstart', label: 'Docs', icon: BookOpen, external: true },
      ],
    },
    {
      label: 'Account',
      links: [
        { to: `${DASHBOARD}/account`, label: 'Account', icon: Settings },
        ...(user?.role === 'superadmin' ? [{ to: `${DASHBOARD}/superadmin`, label: 'Platform admin', icon: ShieldCheck }] : []),
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
    if (path.startsWith(`${DASHBOARD}/apps/`)) return ['Apps', 'App settings'];
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

  const closeDrawer = () => setMobileMenuOpen(false);
  const currentTheme = themes[themeId];

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
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-64 flex-col justify-between border-r border-t-border bg-t-surface shadow-xl transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : 'invisible -translate-x-full md:visible'
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-t-border bg-t-bg p-4">
            <Wordmark to={DASHBOARD} subtitle="Dashboard" onClick={closeDrawer} label={`${SITE.name} dashboard, Overview`} />
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => { closeDrawer(); menuButtonRef.current?.focus(); }}
              className={`-m-1 rounded p-2.5 text-t-muted hover:text-t-text md:hidden ${focusRing}`}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <nav aria-label="Main" className="flex-1 space-y-1 overflow-y-auto p-3">
            {navGroups.map((group) => (
              <div key={group.label || 'top'} className={group.label ? 'pt-3' : ''}>
                {group.label && <p className="px-3 pb-1 text-xs font-medium text-t-dim">{group.label}</p>}
                <ul className="space-y-1">
                  {group.links.map((link) => {
                    const active = isActive(link);
                    const Icon = link.icon;
                    const className = `${focusRing} flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active ? 'bg-t-accent/15 font-semibold text-t-text shadow-[inset_2px_0_0_var(--theme-accent)]' : 'text-t-muted hover:bg-t-surface-hi hover:text-t-text'
                    }`;
                    const icon = <Icon size={16} aria-hidden="true" className={active ? 'text-t-accent' : 'text-t-dim'} />;
                    return (
                      <li key={link.to}>
                        {link.external ? (
                          <a href={link.to} target="_blank" rel="noopener noreferrer" onClick={closeDrawer} className={className}>
                            {icon}<span>{link.label} <span aria-hidden="true">↗</span></span><span className="sr-only"> (opens in a new tab)</span>
                          </a>
                        ) : (
                          <Link to={link.to} onClick={closeDrawer} aria-current={active ? 'page' : undefined} className={className}>
                            {icon}<span>{link.label}</span>
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Signed-in account */}
        <div className="border-t border-t-border bg-t-bg p-3">
          <div className="space-y-2.5 rounded border border-t-border bg-t-surface p-3">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-t-border-hi bg-t-surface-hi text-xs font-bold text-t-accent">
                {initialsFor(user?.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-t-text" title={user?.email}>{user?.email}</p>
                <p className="text-xs text-t-muted">{user?.role === 'superadmin' ? 'Platform admin' : 'Signed in'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className={`flex w-full items-center justify-center gap-1.5 rounded border border-t-danger/30 bg-t-danger-dim py-1.5 text-xs font-semibold text-t-danger transition-colors hover:bg-t-danger/20 ${focusRing}`}
            >
              <LogOut size={12} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col bg-t-bg md:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-t-border bg-t-bg/95 px-4 py-3 backdrop-blur-md sm:px-8">
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
                aria-haspopup="true"
                aria-expanded={topThemePickerOpen}
                aria-controls="theme-picker"
                aria-label={`Theme: ${currentTheme?.label || 'Theme'}. Change theme`}
                className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded border border-t-border bg-t-surface px-3 py-2 text-xs font-medium text-t-text transition-colors hover:border-t-border-hi ${focusRing}`}
              >
                <Palette size={14} aria-hidden="true" className="text-t-accent" />
                <span className="hidden sm:inline">{currentTheme?.label || 'Theme'}</span>
                <span aria-hidden="true" className="flex items-center gap-1">
                  {currentTheme?.preview?.map((colour, index) => (
                    <span key={index} className="h-2.5 w-2.5 rounded-full border border-t-border-hi" style={{ backgroundColor: colour }} />
                  ))}
                </span>
              </button>

              {topThemePickerOpen && (
                <>
                  <div aria-hidden="true" className="fixed inset-0 z-40" onClick={() => setTopThemePickerOpen(false)} />
                  <div
                    id="theme-picker"
                    role="group"
                    aria-label="Themes"
                    className="absolute right-0 z-50 mt-2 max-h-[380px] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded border border-t-border-hi bg-t-surface shadow-2xl"
                  >
                    {(groups || THEME_GROUPS).map((group) => {
                      const groupThemes = Object.values(themes).filter((theme) => theme.group === group && !theme.hidden);
                      if (groupThemes.length === 0) return null;
                      return (
                        <div key={group}>
                          <p className="sticky top-0 border-b border-t-border bg-t-surface-hi px-3 py-2 text-xs font-semibold text-t-accent">{group} themes</p>
                          {groupThemes.map((theme) => {
                            const selected = theme.id === themeId;
                            return (
                              <button
                                key={theme.id}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => { changeTheme(theme.id); setTopThemePickerOpen(false); themeButtonRef.current?.focus(); }}
                                className={`flex w-full cursor-pointer items-center gap-2.5 border-b border-t-border px-3 py-2 text-left text-xs transition-colors hover:bg-t-surface-hi focus-visible:bg-t-surface-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-t-accent ${selected ? 'bg-t-surface-hi' : ''}`}
                              >
                                <span aria-hidden="true" className="flex shrink-0 -space-x-1">
                                  {theme.preview.map((colour, index) => (
                                    <span key={index} className="h-3.5 w-3.5 rounded-full border border-t-border-hi" style={{ backgroundColor: colour }} />
                                  ))}
                                </span>
                                <span className="min-w-0 flex-1 truncate font-medium text-t-text">{theme.label}</span>
                                {selected && <Check size={13} aria-hidden="true" className="shrink-0 text-t-accent" />}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
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
          style={{ backgroundImage: 'radial-gradient(ellipse at 52% -20%, color-mix(in srgb, var(--theme-accent) 7%, transparent), transparent 52%)' }}
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
