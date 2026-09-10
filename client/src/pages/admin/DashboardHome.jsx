import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import {
  FolderGit2,
  Briefcase,
  Cpu,
  GraduationCap,
  Award,
  Share2,
  FileText,
  Plus,
  ArrowRight,
  Activity,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Terminal,
} from 'lucide-react';

export default function DashboardHome() {
  const [profile, setProfile] = useState(null);
  const [projects, setProjects] = useState([]);
  const [experience, setExperience] = useState([]);
  const [skills, setSkills] = useState([]);
  const [education, setEducation] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [socials, setSocials] = useState([]);
  const [resume, setResume] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [
        profRes,
        projRes,
        expRes,
        skillRes,
        eduRes,
        certRes,
        socRes,
        resumeRes,
        healthRes,
      ] = await Promise.allSettled([
        api.get('/profile'),
        api.get('/projects'),
        api.get('/experience'),
        api.get('/skills'),
        api.get('/education'),
        api.get('/certifications'),
        api.get('/socials'),
        api.get('/resume'),
        api.get('/health'),
      ]);

      if (profRes.status === 'fulfilled') setProfile(profRes.value.data);
      if (projRes.status === 'fulfilled') setProjects(projRes.value.data || []);
      if (expRes.status === 'fulfilled') setExperience(expRes.value.data || []);
      if (skillRes.status === 'fulfilled') {
        const sData = skillRes.value.data;
        setSkills(Array.isArray(sData) ? sData : sData.skills || []);
      }
      if (eduRes.status === 'fulfilled') setEducation(eduRes.value.data || []);
      if (certRes.status === 'fulfilled') setCertifications(certRes.value.data || []);
      if (socRes.status === 'fulfilled') setSocials(socRes.value.data || []);
      if (resumeRes.status === 'fulfilled') setResume(resumeRes.value.data);
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value.data);
    } catch (err) {
      console.error('Error fetching dashboard summary', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleToggleAvailability = async () => {
    if (!profile) return;
    setTogglingAvailability(true);
    setStatusFeedback(null);
    try {
      const nextStatus = !profile.isAvailableForHire;
      const res = await api.patch('/profile/availability', {
        isAvailableForHire: nextStatus,
        statusText: nextStatus
          ? 'Available for High-Impact Software Engineering Roles'
          : 'Currently Engaged on High-Impact Systems',
      });
      setProfile(res.data);
      setStatusFeedback(`Availability set to: ${nextStatus ? 'Available for Hire' : 'Engaged'}`);
      setTimeout(() => setStatusFeedback(null), 3500);
    } catch (err) {
      alert('Error updating availability: ' + (err.response?.data?.message || err.message));
    } finally {
      setTogglingAvailability(false);
    }
  };

  const featuredProjects = projects.filter((p) => p.featured !== false).length;
  const featuredSkills = skills.filter((s) => s.featured).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Console Top Banner */}
      <div className="rounded bg-[#070a10] border border-[#1a2333] p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
              <span className="text-[11px] font-mono text-[#10b981] uppercase tracking-wider">
                Production Control Interface · Port 5000
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {profile?.name || 'Developer'} - Engineering CMS
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl font-sans">
              Centralized content authority governing case studies, categorized competencies, career timeline, and hierarchical content APIs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/admin/projects/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#0078d4] hover:bg-[#1e90ff] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Create Project</span>
            </Link>
            <Link
              to="/admin/profile"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#0f141f] hover:bg-[#151c2c] text-slate-200 text-xs font-semibold border border-[#1a2333] transition-all cursor-pointer"
            >
              <span>Edit Profile</span>
            </Link>
            <button
              onClick={fetchDashboardData}
              className="p-2 rounded bg-[#0f141f] text-slate-400 hover:text-white border border-[#1a2333] transition-all cursor-pointer"
              title="Refresh telemetry"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Real-time Status Switch & Resume Quick Action */}
        <div className="mt-5 pt-4 border-t border-[#1a2333] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleAvailability}
              disabled={togglingAvailability || !profile}
              className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                profile?.isAvailableForHire ? 'bg-[#10b981]' : 'bg-[#1e293b]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                  profile?.isAvailableForHire ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <div className="text-xs">
              <span className="font-mono text-slate-300">
                {profile?.isAvailableForHire ? (
                  <span className="text-[#10b981] font-bold">AVAILABLE FOR HIRE</span>
                ) : (
                  <span className="text-slate-400 font-bold">CURRENTLY ENGAGED</span>
                )}
              </span>
              <span className="text-slate-500 font-mono text-[11px] ml-2 hidden sm:inline">
                ({profile?.statusText || 'Status nominal'})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {resume?.resumeUrl ? (
              <a
                href={resume.resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-black border border-[#1a2333] hover:border-[#0078d4] text-[11px] font-mono text-[#0078d4] transition-all"
              >
                <FileText size={12} />
                <span>Test Resume Link ({resume.version || 'Active'})</span>
                <ExternalLink size={11} />
              </a>
            ) : (
              <Link
                to="/admin/resume"
                className="text-xs font-mono text-amber-400 hover:underline"
              >
                Set Resume Link
              </Link>
            )}
          </div>
        </div>

        {statusFeedback && (
          <div className="mt-2 text-[11px] font-mono text-[#10b981]">
            ✓ {statusFeedback}
          </div>
        )}
      </div>

      {/* KPI Metric Cards (All 8 Collections) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Projects Card */}
        <div className="rounded bg-[#070a10] border border-[#1a2333] p-4 flex flex-col justify-between hover:border-[#0078d4] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Projects Studio
            </span>
            <div className="p-1.5 rounded bg-black text-[#0078d4] border border-[#1a2333]">
              <FolderGit2 size={16} />
            </div>
          </div>
          <div className="my-3">
            <span className="text-2xl font-mono font-bold text-white tracking-tight">
              {loading ? '...' : projects.length}
            </span>
            <span className="text-[11px] font-mono text-[#1e90ff] ml-2">
              ({featuredProjects} featured)
            </span>
          </div>
          <div className="pt-2 border-t border-[#1a2333] flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 font-mono">Case Studies</span>
            <Link to="/admin/projects" className="text-[#0078d4] hover:text-[#1e90ff] flex items-center gap-1 font-mono text-[11px]">
              <span>Manage</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>

        {/* Career Timeline Card */}
        <div className="rounded bg-[#070a10] border border-[#1a2333] p-4 flex flex-col justify-between hover:border-[#0078d4] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Career Timeline
            </span>
            <div className="p-1.5 rounded bg-black text-[#10b981] border border-[#1a2333]">
              <Briefcase size={16} />
            </div>
          </div>
          <div className="my-3">
            <span className="text-2xl font-mono font-bold text-white tracking-tight">
              {loading ? '...' : experience.length}
            </span>
            <span className="text-[11px] font-mono text-[#10b981] ml-2">Milestones</span>
          </div>
          <div className="pt-2 border-t border-[#1a2333] flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 font-mono truncate max-w-[120px]">
              {experience[0]?.company || 'None logged'}
            </span>
            <Link to="/admin/experience" className="text-[#10b981] hover:underline flex items-center gap-1 font-mono text-[11px]">
              <span>Timeline</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>

        {/* Skills Matrix Card */}
        <div className="rounded bg-[#070a10] border border-[#1a2333] p-4 flex flex-col justify-between hover:border-[#0078d4] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Skills Matrix
            </span>
            <div className="p-1.5 rounded bg-black text-[#0078d4] border border-[#1a2333]">
              <Cpu size={16} />
            </div>
          </div>
          <div className="my-3">
            <span className="text-2xl font-mono font-bold text-white tracking-tight">
              {loading ? '...' : skills.length}
            </span>
            <span className="text-[11px] font-mono text-[#1e90ff] ml-2">
              ({featuredSkills} spotlighted)
            </span>
          </div>
          <div className="pt-2 border-t border-[#1a2333] flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 font-mono">Categorized Matrix</span>
            <Link to="/admin/skills" className="text-[#0078d4] hover:text-[#1e90ff] flex items-center gap-1 font-mono text-[11px]">
              <span>Matrix</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>

        {/* Education & Certs Combined KPI Card */}
        <div className="rounded bg-[#070a10] border border-[#1a2333] p-4 flex flex-col justify-between hover:border-[#0078d4] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Credentials
            </span>
            <div className="p-1.5 rounded bg-black text-[#10b981] border border-[#1a2333]">
              <Award size={16} />
            </div>
          </div>
          <div className="my-3">
            <span className="text-2xl font-mono font-bold text-white tracking-tight">
              {loading ? '...' : education.length + certifications.length}
            </span>
            <span className="text-[11px] font-mono text-slate-400 ml-2">
              ({education.length} Edu · {certifications.length} Cert)
            </span>
          </div>
          <div className="pt-2 border-t border-[#1a2333] flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-500 font-mono">Academic &amp; Licenses</span>
            <Link to="/admin/education" className="text-[#10b981] hover:underline flex items-center gap-1 font-mono text-[11px]">
              <span>View</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </div>

      {/* System Infrastructure & Telemetry Strip */}
      <div className="rounded bg-[#070a10] border border-[#1a2333] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-black text-[#10b981] border border-[#1a2333]">
              <Activity size={18} />
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-white flex items-center gap-2">
                <span>Database: MongoDB Atlas (`Portfolio_db`)</span>
                <span className="px-1.5 py-0.2 rounded bg-[#0d2a1d] text-[#10b981] text-[10px]">CONNECTED</span>
              </div>
              <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                Server Uptime: {health?.uptime ? `${Math.floor(health.uptime / 60)}m ${health.uptime % 60}s` : 'Active'} · Social Links: {socials.length} Active
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/admin/socials"
              className="px-3 py-1.5 rounded bg-black border border-[#1a2333] hover:border-[#0078d4] text-[11px] font-mono text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
            >
              <Share2 size={12} className="text-[#0078d4]" />
              <span>Manage Socials</span>
            </Link>
            <Link
              to="/admin/resume"
              className="px-3 py-1.5 rounded bg-black border border-[#1a2333] hover:border-[#10b981] text-[11px] font-mono text-slate-300 hover:text-white transition-all flex items-center gap-1.5"
            >
              <FileText size={12} className="text-[#10b981]" />
              <span>Resume Asset</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
