import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
  Terminal,
} from 'lucide-react';

export default function AdminLayout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    return 'admin > console';
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row antialiased font-sans">
      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#070a10] border-r border-[#1a2333] flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="p-4 border-b border-[#1a2333] flex items-center justify-between bg-black">
            <Link to="/admin/dashboard" className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[#0078d4] text-white flex items-center justify-center font-mono font-bold text-xs shadow-md shadow-[#0078d4]/30 border border-[#1e90ff]/40">
                PS
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight text-white block">Admin Panel CMS</span>
                <span className="text-[10px] text-[#10b981] font-mono tracking-wider">v2.0 · PowerShell Active</span>
              </div>
            </Link>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded text-slate-400 hover:text-white md:hidden"
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-slate-400">
              System Modules
            </div>
            {navLinks.map(({ to, label, icon: Icon, exact }) => {
              const active = exact
                ? location.pathname === to
                : location.pathname.startsWith(to);

              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-all group ${
                    active
                      ? 'bg-[#0078d4] text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-[#111827] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      size={16}
                      className={active ? 'text-white' : 'text-slate-400 group-hover:text-[#1e90ff] transition-colors'}
                    />
                    <span>{label}</span>
                  </div>
                  {active && <ChevronRight size={12} className="text-white/80" />}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Sidebar Footer / Telemetry */}
        <div className="p-3 border-t border-[#1a2333] bg-black">
          <div className="p-3 rounded bg-[#090d15] border border-[#1a2333] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#10b981] shadow-sm shadow-[#10b981]"></span>
                <span className="text-[11px] font-mono text-[#10b981]">System Online</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black text-slate-400 border border-[#1e293b]">
                PORT: 5000
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-[#1a2333]">
              <div className="w-7 h-7 rounded bg-[#111827] text-[#0078d4] border border-[#1e293b] flex items-center justify-center font-mono font-bold text-xs uppercase">
                {admin?.email ? admin.email.substring(0, 2) : 'AD'}
              </div>
              <div className="truncate flex-1">
                <div className="text-xs font-semibold text-white truncate">{admin?.email}</div>
                <div className="text-[10px] text-slate-400 font-mono">Administrator</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-[#1f1619] hover:bg-red-900/60 text-red-400 hover:text-red-200 text-xs font-semibold border border-red-900/40 transition-all cursor-pointer"
            >
              <LogOut size={12} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen bg-black">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-black/95 backdrop-blur-md border-b border-[#1a2333] px-4 sm:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded bg-[#0f141f] text-slate-300 hover:text-white border border-[#1a2333] md:hidden"
            >
              <Menu size={16} />
            </button>
            <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
              <Terminal size={14} className="text-[#10b981]" />
              <span className="text-[#0078d4]">PS C:\admin-panel-cms&gt;</span>
              <span className="text-slate-200">{getBreadcrumb()}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/admin/projects/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0078d4] hover:bg-[#1e90ff] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>New Project</span>
            </Link>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 p-4 sm:p-8 overflow-y-auto bg-black">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
