import React, { useEffect, useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme, THEME_GROUPS } from '../../context/ThemeContext';
import { api } from '../../api/client';
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
  Settings,
  ShieldCheck,
} from 'lucide-react';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { themeId, changeTheme, themes, groups } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [topThemePickerOpen, setTopThemePickerOpen] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [resendingVerification, setResendingVerification] = useState(false);

  const resendVerification = async () => {
    setResendingVerification(true);
    setVerificationMessage('');
    try {
      await api.post('/auth/resend-verification');
      setVerificationMessage('If verification is needed, a message will be sent.');
    } catch {
      setVerificationMessage('Could not request a verification email. Please try again later.');
    } finally { setResendingVerification(false); }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const navLinks = [
    { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
    { to: '/admin/profile', label: 'Your profile', icon: User },
    { to: '/admin/socials', label: 'Links', icon: Share2 },
    { to: '/admin/skills', label: 'Skills', icon: Cpu },
    { to: '/admin/projects', label: 'Projects', icon: FolderGit2 },
    { to: '/admin/experience', label: 'Work experience', icon: Briefcase },
    { to: '/admin/education', label: 'Education', icon: GraduationCap },
    { to: '/admin/certifications', label: 'Certifications', icon: Award },
    { to: '/admin/resume', label: 'Resume', icon: FileText },
    { to: '/admin/apps', label: 'Connected websites', icon: Boxes },
    { to: '/admin/account', label: 'Account', icon: Settings },
    ...(user?.role === 'superadmin' ? [{ to: '/admin/superadmin', label: 'Platform admin', icon: ShieldCheck }] : []),
  ];

  // Where you are, in plain words: the section, and the item inside it when there is one.
  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/admin/dashboard' || path === '/admin') return ['Overview'];
    if (path.includes('/admin/projects/new')) return ['Projects', 'New project'];
    if (path.includes('/admin/projects/edit')) return ['Projects', 'Edit project'];
    if (path.includes('/admin/apps/')) return ['Connected websites', 'Settings'];
    const match = navLinks.find((link) => !link.exact && path.startsWith(link.to));
    return [match?.label || 'Portfolio Control'];
  };

  // Keep the browser tab title in step with the page, and let Escape close anything that is open.
  const crumbs = getBreadcrumb();
  const pageTitle = crumbs[crumbs.length - 1];
  useEffect(() => { document.title = `${pageTitle} · Portfolio Control`; }, [pageTitle]);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      setMobileMenuOpen(false);
      setTopThemePickerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const currentTheme = themes[themeId];

  return (
    <div
      className="min-h-screen text-t-text flex flex-col md:flex-row antialiased font-sans"
      style={{ backgroundColor: 'var(--theme-bg)' }}
    >
      <a href="#main-content" className="skip-link">Skip to content</a>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-t-bg/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        aria-label="Sidebar"
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 flex flex-col justify-between shadow-xl transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full invisible md:visible'
        }`}
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderRight: '1px solid var(--theme-border)',
        }}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Brand Header */}
          <div
            className="p-4 flex items-center justify-between"
            style={{
              backgroundColor: 'var(--theme-bg)',
              borderBottom: '1px solid var(--theme-border)',
            }}
          >
            <Link to="/admin/dashboard" className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shadow-md"
                style={{
                  backgroundColor: 'var(--theme-accent)',
                  color: 'var(--theme-on-accent)',
                  boxShadow: '0 0 12px var(--theme-brand-glow)',
                  border: '1px solid var(--theme-accent-bright)',
                }}
              >
                PC
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight block" style={{ color: 'var(--theme-text)' }}>
                  Portfolio Control
                </span>
                <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>Content manager</span>
              </div>
            </Link>

            <button
              aria-label="Close navigation"
              onClick={() => setMobileMenuOpen(false)}
              className="-m-1 rounded p-2.5 md:hidden"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Links */}
          <nav aria-label="Main" className="p-3 space-y-1 flex-1 overflow-y-auto">
            <div className="px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--theme-text-dim)' }}>
              Your portfolio
            </div>
            {navLinks.map(({ to, label, icon: Icon, exact }) => {
              const active = exact
                ? location.pathname === to
                : location.pathname.startsWith(to);

              return (
                <div key={to}>
                {to === '/admin/apps' && <div className="px-3 pb-1 pt-4 text-xs font-medium" style={{ color: 'var(--theme-text-dim)' }}>Connections and account</div>}
                <Link
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group"
                  style={
                    active
                      ? {
                          backgroundColor: 'color-mix(in srgb, var(--theme-accent) 14%, transparent)',
                          boxShadow: 'inset 2px 0 0 var(--theme-accent)',
                          color: 'var(--theme-text)',
                          fontWeight: 600,
                        }
                      : {
                          color: 'var(--theme-text-muted)',
                        }
                  }
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = 'var(--theme-surface-hi)';
                      e.currentTarget.style.color = 'var(--theme-text)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.backgroundColor = '';
                      e.currentTarget.style.color = 'var(--theme-text-muted)';
                    }
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      size={16}
                      style={{ color: active ? 'var(--theme-accent)' : 'var(--theme-text-dim)' }}
                    />
                    <span>{label}</span>
                  </div>
                </Link>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3" style={{ borderTop: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-bg)' }}>
          <div
            className="p-3 rounded space-y-2.5"
            style={{ backgroundColor: 'var(--theme-surface)', border: '1px solid var(--theme-border)' }}
          >
            {/* Admin User Info */}
            <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid var(--theme-border)' }}>
              <div
                className="w-7 h-7 rounded flex items-center justify-center font-bold text-xs uppercase"
                style={{
                  backgroundColor: 'var(--theme-surface-hi)',
                  color: 'var(--theme-accent)',
                  border: '1px solid var(--theme-border-hi)',
                }}
              >
                {user?.email ? user.email.substring(0, 2) : 'AD'}
              </div>
              <div className="truncate flex-1">
                <div className="text-xs font-semibold truncate" style={{ color: 'var(--theme-text)' }}>
                  {user?.email}
                </div>
                <div className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                  {user?.role === 'superadmin' ? 'Platform admin' : 'Signed in'}
                </div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-semibold transition-all cursor-pointer"
              style={{
                backgroundColor: 'var(--theme-danger-dim)',
                color: 'var(--theme-danger)',
                border: '1px solid color-mix(in srgb, var(--theme-danger) 30%, transparent)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--theme-danger) 20%, transparent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--theme-danger-dim)';
              }}
            >
              <LogOut size={12} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen" style={{ backgroundColor: 'var(--theme-bg)' }}>
        {/* Top Header */}
        <header
          className="sticky top-0 z-30 backdrop-blur-md px-4 sm:px-8 py-3 flex items-center justify-between"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--theme-bg) 95%, transparent)',
            borderBottom: '1px solid var(--theme-border)',
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              aria-label="Open navigation"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
              className="-m-1 rounded p-2.5 md:hidden"
              style={{
                backgroundColor: 'var(--theme-surface-hi)',
                color: 'var(--theme-text-muted)',
                border: '1px solid var(--theme-border)',
              }}
            >
              <Menu size={16} />
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm" style={{ color: 'var(--theme-text-muted)' }}>
              {crumbs.map((part, index, parts) => (
                <React.Fragment key={part}>
                  {index > 0 && <span aria-hidden="true">/</span>}
                  <span className={`truncate ${index === parts.length - 1 ? 'font-medium' : ''}`} style={index === parts.length - 1 ? { color: 'var(--theme-text)' } : undefined} aria-current={index === parts.length - 1 ? 'page' : undefined}>{part}</span>
                </React.Fragment>
              ))}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* Top Bar Quick Theme Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setTopThemePickerOpen((p) => !p)}
                aria-haspopup="true"
                aria-expanded={topThemePickerOpen}
                aria-label={`Theme: ${currentTheme?.label || 'Theme'}. Change theme`}
                className="inline-flex min-h-10 items-center gap-2 rounded px-3 py-2 text-xs font-medium transition-colors cursor-pointer"
                style={{
                  backgroundColor: 'var(--theme-surface)',
                  border: '1px solid var(--theme-border)',
                  color: 'var(--theme-text)',
                }}
              >
                <Palette size={14} style={{ color: 'var(--theme-accent)' }} />
                <span className="hidden sm:inline">{currentTheme?.label || 'Theme'}</span>
                <div className="flex items-center gap-1">
                  {currentTheme?.preview?.map((c, i) => (
                    <span
                      key={i}
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: c, border: '1px solid rgba(128,128,128,0.3)' }}
                    />
                  ))}
                </div>
              </button>

              {topThemePickerOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setTopThemePickerOpen(false)}
                  />
                  <div
                    className="absolute right-0 mt-2 w-64 rounded shadow-2xl z-50 overflow-hidden"
                    style={{
                      border: '1px solid var(--theme-border-hi)',
                      backgroundColor: 'var(--theme-surface)',
                      maxHeight: '380px',
                      overflowY: 'auto',
                      overscrollBehavior: 'contain',
                    }}
                  >
                    {(groups || THEME_GROUPS).map((group) => {
                      const groupThemes = Object.values(themes).filter((t) => t.group === group);
                      if (groupThemes.length === 0) return null;
                      return (
                        <div key={group}>
                          <div
                            className="px-3 py-2 text-xs font-semibold sticky top-0"
                            style={{
                              backgroundColor: 'var(--theme-surface-hi)',
                              color: 'var(--theme-accent)',
                              borderBottom: '1px solid var(--theme-border)',
                            }}
                          >
                            {group} themes
                          </div>
                          {groupThemes.map((t) => {
                            const isActive = t.id === themeId;
                            return (
                              <button
                                key={t.id}
                                type="button"
                                aria-current={isActive ? 'true' : undefined}
                                onClick={() => {
                                  changeTheme(t.id);
                                  setTopThemePickerOpen(false);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-all cursor-pointer"
                                style={{
                                  backgroundColor: isActive ? 'var(--theme-surface-hi)' : 'transparent',
                                  borderBottom: '1px solid var(--theme-border)',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--theme-surface-hi)';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <div className="flex -space-x-1 shrink-0">
                                  {t.preview.map((c, i) => (
                                    <span
                                      key={i}
                                      className="w-3.5 h-3.5 rounded-full"
                                      style={{
                                        backgroundColor: c,
                                        border: '1px solid rgba(128,128,128,0.4)',
                                      }}
                                    />
                                  ))}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate" style={{ color: 'var(--theme-text)' }}>
                                    {t.label}
                                  </div>
                                </div>
                                {isActive && (
                                  <Check size={13} style={{ color: 'var(--theme-accent)', flexShrink: 0 }} />
                                )}
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

        {/* Main Body */}
        <main id="main-content" tabIndex={-1} className="admin-content flex-1 outline-none p-4 sm:p-6 lg:p-8 overflow-y-auto" style={{ backgroundColor: 'var(--theme-bg)', backgroundImage: 'radial-gradient(ellipse at 52% -20%, color-mix(in srgb, var(--theme-accent) 7%, transparent), transparent 52%)' }}>
          {user && !user.emailVerified && <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm">
            <span className="text-t-text">Verify your email to unlock content editing and API token management.{verificationMessage && <span role="status" className="ml-2 text-t-muted">{verificationMessage}</span>}</span>
            <button type="button" onClick={resendVerification} disabled={resendingVerification} className="font-semibold text-t-accent hover:underline disabled:opacity-60">{resendingVerification ? 'Sending…' : 'Resend verification'}</button>
          </div>}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
