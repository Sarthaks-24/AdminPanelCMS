import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme, THEME_GROUPS } from '../../context/ThemeContext';
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
  Plus,
  ChevronRight,
  Palette,
  Check,
  Boxes,
} from 'lucide-react';

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { themeId, changeTheme, themes, groups } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [topThemePickerOpen, setTopThemePickerOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const navLinks = [
    { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
    { to: '/admin/profile', label: 'Profile & Identity', icon: User },
    { to: '/admin/socials', label: 'Social Links', icon: Share2 },
    { to: '/admin/skills', label: 'Skills Matrix', icon: Cpu },
    { to: '/admin/projects', label: 'Projects Studio', icon: FolderGit2 },
    { to: '/admin/experience', label: 'Career Timeline', icon: Briefcase },
    { to: '/admin/education', label: 'Education', icon: GraduationCap },
    { to: '/admin/certifications', label: 'Certifications', icon: Award },
    { to: '/admin/resume', label: 'Resume Hub', icon: FileText },
    { to: '/admin/apps', label: 'Apps & Views', icon: Boxes },
  ];

  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path === '/admin/dashboard' || path === '/admin') return 'admin > overview';
    if (path.includes('/admin/profile')) return 'admin > profile & identity';
    if (path.includes('/admin/socials')) return 'admin > socials';
    if (path.includes('/admin/skills')) return 'admin > skills matrix';
    if (path.includes('/admin/projects/new')) return 'admin > projects > create';
    if (path.includes('/admin/projects/edit')) return 'admin > projects > edit';
    if (path.includes('/admin/projects')) return 'admin > projects';
    if (path.includes('/admin/experience')) return 'admin > career timeline';
    if (path.includes('/admin/education')) return 'admin > education';
    if (path.includes('/admin/certifications')) return 'admin > certifications';
    if (path.includes('/admin/resume')) return 'admin > resume hub';
    if (path.includes('/admin/apps/')) return 'admin > apps > configuration';
    if (path.includes('/admin/apps')) return 'admin > apps & views';
    return 'admin > console';
  };

  const currentTheme = themes[themeId];

  return (
    <div
      className="min-h-screen text-t-text flex flex-col md:flex-row antialiased font-sans"
      style={{ backgroundColor: 'var(--theme-bg)' }}
    >
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-t-bg/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 flex flex-col justify-between shadow-xl transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
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
                className="w-8 h-8 rounded flex items-center justify-center font-mono font-bold text-xs shadow-md"
                style={{
                  backgroundColor: 'var(--theme-accent)',
                  color: 'var(--theme-on-accent)',
                  boxShadow: '0 0 12px var(--theme-brand-glow)',
                  border: '1px solid var(--theme-accent-bright)',
                }}
              >
                PS
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight block" style={{ color: 'var(--theme-text)' }}>
                  Portfolio Control
                </span>
                <span className="text-[10px] font-mono tracking-wider" style={{ color: 'var(--theme-accent2)' }}>
                  ADMIN WORKSPACE
                </span>
              </div>
            </Link>

            <button
              aria-label="Close navigation"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded md:hidden"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-1 flex-1 overflow-y-auto">
            <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--theme-text-dim)' }}>
              Workspace
            </div>
            {navLinks.map(({ to, label, icon: Icon, exact }) => {
              const active = exact
                ? location.pathname === to
                : location.pathname.startsWith(to);

              return (
                <div key={to}>
                {to === '/admin/apps' && <div className="px-3 pb-1 pt-4 text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--theme-text-dim)' }}>Developer tools</div>}
                <Link
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className="flex items-center justify-between border-l-2 px-3 py-2.5 rounded-r text-xs font-medium transition-all group"
                  style={
                    active
                      ? {
                          backgroundColor: 'color-mix(in srgb, var(--theme-accent) 14%, transparent)',
                          borderColor: 'var(--theme-accent)',
                          color: 'var(--theme-text)',
                          fontWeight: 600,
                        }
                      : {
                          borderColor: 'transparent',
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
                  {active && <ChevronRight size={12} style={{ color: 'var(--theme-accent)', opacity: 0.85 }} />}
                </Link>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3" style={{ borderTop: '1px solid var(--theme-border)', backgroundColor: 'var(--theme-bg)' }}>
          <div
            className="p-3 rounded space-y-2.5"
            style={{ backgroundColor: 'var(--theme-surface)', border: '1px solid var(--theme-border)' }}
          >
            {/* System Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shadow-sm"
                  style={{ backgroundColor: 'var(--theme-accent2)', boxShadow: '0 0 6px var(--theme-accent2)' }}
                />
                <span className="text-[11px] font-mono" style={{ color: 'var(--theme-accent2)' }}>
                  Workspace ready
                </span>
              </div>
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  color: 'var(--theme-text-muted)',
                  backgroundColor: 'var(--theme-bg)',
                  border: '1px solid var(--theme-border-hi)',
                }}
              >
                ADMIN
              </span>
            </div>

            {/* ── Theme Picker ──────────────────────────────── */}
            <div style={{ borderTop: '1px solid var(--theme-border)' }} className="pt-2">
              <button
                onClick={() => setThemePickerOpen((p) => !p)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-mono transition-all cursor-pointer"
                style={{
                  backgroundColor: 'var(--theme-surface-hi)',
                  border: '1px solid var(--theme-border-hi)',
                  color: 'var(--theme-text-muted)',
                }}
              >
                <div className="flex items-center gap-2">
                  <Palette size={13} style={{ color: 'var(--theme-accent)' }} />
                  <span style={{ color: 'var(--theme-text)' }}>{currentTheme?.label ?? 'Theme'}</span>
                  {currentTheme?.isLight !== undefined && (
                    <span
                      className="text-[9px] font-bold px-1 py-0.5 rounded uppercase tracking-wider"
                      style={{
                        backgroundColor: currentTheme.isLight ? 'rgba(255,200,50,0.15)' : 'rgba(100,150,255,0.15)',
                        color: currentTheme.isLight ? '#c8870a' : '#7090e0',
                        border: `1px solid ${currentTheme.isLight ? 'rgba(200,135,10,0.3)' : 'rgba(100,150,255,0.3)'}`,
                      }}
                    >
                      {currentTheme.isLight ? '☀ Light' : '☾ Dark'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {currentTheme?.preview.map((c, i) => (
                    <span
                      key={i}
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: c, border: '1px solid rgba(128,128,128,0.35)' }}
                    />
                  ))}
                </div>
              </button>

              {themePickerOpen && (
                <div
                  className="mt-1.5 rounded overflow-hidden"
                  style={{
                    border: '1px solid var(--theme-border-hi)',
                    backgroundColor: 'var(--theme-bg)',
                    maxHeight: '340px',
                    overflowY: 'auto',
                  }}
                >
                  {(groups || THEME_GROUPS).map((group) => {
                    const groupThemes = Object.values(themes).filter((t) => t.group === group);
                    if (groupThemes.length === 0) return null;
                    return (
                      <div key={group}>
                        {/* Group Header */}
                        <div
                          className="px-3 py-1 text-[9px] font-bold uppercase tracking-widest sticky top-0"
                          style={{
                            backgroundColor: 'var(--theme-surface-hi)',
                            color: 'var(--theme-accent)',
                            borderBottom: '1px solid var(--theme-border)',
                            letterSpacing: '0.12em',
                          }}
                        >
                          {group === 'Dark' && '🌑 '}
                          {group === 'Light' && '☀️ '}
                          {group === 'Funky' && '⚡ '}
                          {group === 'Unique' && '✦ '}
                          {group}
                        </div>
                        {/* Theme Rows */}
                        {groupThemes.map((t) => {
                          const isActive = t.id === themeId;
                          return (
                            <button
                              key={t.id}
                              onClick={() => {
                                changeTheme(t.id);
                                setThemePickerOpen(false);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-all cursor-pointer"
                              style={{
                                backgroundColor: isActive ? 'var(--theme-surface-hi)' : 'transparent',
                                borderBottom: '1px solid var(--theme-border)',
                              }}
                              onMouseEnter={(e) => {
                                if (!isActive) e.currentTarget.style.backgroundColor = 'var(--theme-surface)';
                              }}
                              onMouseLeave={(e) => {
                                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              {/* Swatch stack */}
                              <div className="flex -space-x-1 shrink-0">
                                {t.preview.map((c, i) => (
                                  <span
                                    key={i}
                                    className="w-3 h-3 rounded-full"
                                    style={{
                                      backgroundColor: c,
                                      border: '1px solid rgba(128,128,128,0.4)',
                                      position: 'relative',
                                      zIndex: t.preview.length - i,
                                    }}
                                  />
                                ))}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold truncate" style={{ color: 'var(--theme-text)', fontSize: '11px' }}>
                                  {t.label}
                                </div>
                              </div>
                              {isActive && (
                                <Check size={11} style={{ color: 'var(--theme-accent)', flexShrink: 0 }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {/* ─────────────────────────────────────────────── */}

            {/* Admin User Info */}
            <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid var(--theme-border)' }}>
              <div
                className="w-7 h-7 rounded flex items-center justify-center font-mono font-bold text-xs uppercase"
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
                <div className="text-[10px] font-mono" style={{ color: 'var(--theme-text-muted)' }}>
                  Administrator
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
              <span>Sign Out</span>
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
          <div className="flex items-center gap-3">
            <button
              aria-label="Open navigation"
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded md:hidden"
              style={{
                backgroundColor: 'var(--theme-surface-hi)',
                color: 'var(--theme-text-muted)',
                border: '1px solid var(--theme-border)',
              }}
            >
              <Menu size={16} />
            </button>
            <div className="flex items-center gap-2 font-mono text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              <span className="hidden h-2 w-2 rounded-full sm:block" style={{ backgroundColor: 'var(--theme-accent2)' }} />
              <span className="flex items-center gap-1.5" style={{ color: 'var(--theme-text)' }}>
                {getBreadcrumb().split(' > ').map((part, index, parts) => <React.Fragment key={`${part}-${index}`}>{index > 0 && <ChevronRight size={11} style={{ color: 'var(--theme-text-dim)' }} />}<span className={index === parts.length - 1 ? 'font-semibold' : ''}>{part}</span></React.Fragment>)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Top Bar Quick Theme Switcher */}
            <div className="relative">
              <button
                onClick={() => setTopThemePickerOpen((p) => !p)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-all cursor-pointer"
                style={{
                  backgroundColor: 'var(--theme-surface)',
                  border: '1px solid var(--theme-border)',
                  color: 'var(--theme-text)',
                }}
                title="Change Dashboard Theme"
              >
                <Palette size={14} style={{ color: 'var(--theme-accent)' }} />
                <span className="hidden sm:inline font-mono">{currentTheme?.label || 'Theme'}</span>
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
                    }}
                  >
                    {(groups || THEME_GROUPS).map((group) => {
                      const groupThemes = Object.values(themes).filter((t) => t.group === group);
                      if (groupThemes.length === 0) return null;
                      return (
                        <div key={group}>
                          <div
                            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider sticky top-0"
                            style={{
                              backgroundColor: 'var(--theme-surface-hi)',
                              color: 'var(--theme-accent)',
                              borderBottom: '1px solid var(--theme-border)',
                            }}
                          >
                            {group === 'Dark' && '🌑 '}
                            {group === 'Light' && '☀️ '}
                            {group === 'Funky' && '⚡ '}
                            {group === 'Unique' && '✦ '}
                            {group} Themes
                          </div>
                          {groupThemes.map((t) => {
                            const isActive = t.id === themeId;
                            return (
                              <button
                                key={t.id}
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

            <Link
              to="/admin/projects/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow-sm transition-all cursor-pointer"
              style={{
                backgroundColor: 'var(--theme-accent)',
                color: 'var(--theme-on-accent)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--theme-accent-bright)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--theme-accent)')}
            >
              <Plus size={14} />
              <span>New Project</span>
            </Link>
          </div>
        </header>

        {/* Main Body */}
        <main className="admin-content flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto" style={{ backgroundColor: 'var(--theme-bg)', backgroundImage: 'radial-gradient(ellipse at 52% -20%, color-mix(in srgb, var(--theme-accent) 7%, transparent), transparent 52%)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
