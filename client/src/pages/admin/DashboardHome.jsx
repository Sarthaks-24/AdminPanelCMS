import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import {
  FolderGit2,
  Briefcase,
  Cpu,
  Award,
  Share2,
  FileText,
  Plus,
  ArrowRight,
  Activity,
  ExternalLink,
  RefreshCw,
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
      <div className="rounded bg-t-surface border border-t-border p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full bg-t-accent2 animate-pulse"></span>
              <span className="text-[11px] font-mono text-t-accent2 uppercase tracking-wider">
                Production Control Interface · Port 5000
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-t-text tracking-tight">
              {profile?.name || 'Developer'} - Engineering CMS
            </h1>
            <p className="text-xs text-t-muted mt-1 max-w-2xl font-sans">
              Centralized content authority governing case studies, categorized competencies, career timeline, and hierarchical content APIs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              to="/admin/projects/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Create Project</span>
            </Link>
            <Link
              to="/admin/profile"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-t-surface-hi hover:bg-t-surface-hi text-t-muted text-xs font-semibold border border-t-border transition-all cursor-pointer"
            >
              <span>Edit Profile</span>
            </Link>
            <button
              onClick={fetchDashboardData}
              className="p-2 rounded bg-t-surface-hi text-t-muted hover:text-t-text border border-t-border transition-all cursor-pointer"
              title="Refresh telemetry"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Real-time Status Switch & Resume Quick Action */}
        <div className="mt-5 pt-4 border-t border-t-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleAvailability}
              disabled={togglingAvailability || !profile}
              className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                profile?.isAvailableForHire ? 'bg-t-accent2' : 'bg-t-border-hi'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-t-bg shadow-lg ring-0 transition duration-200 ease-in-out ${
                  profile?.isAvailableForHire ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <div className="text-xs">
              <span className="font-mono text-t-muted">
                {profile?.isAvailableForHire ? (
                  <span className="text-t-accent2 font-bold">AVAILABLE FOR HIRE</span>
                ) : (
                  <span className="text-t-muted font-bold">CURRENTLY ENGAGED</span>
                )}
              </span>
              <span className="text-t-dim font-mono text-[11px] ml-2 hidden sm:inline">
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
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-t-bg border border-t-border hover:border-t-accent text-[11px] font-mono text-t-accent transition-all"
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
          <div className="mt-2 text-[11px] font-mono text-t-accent2">
            ✓ {statusFeedback}
          </div>
        )}
      </div>

      {/* KPI Metric Cards (All 8 Collections) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Projects Card */}
        <div className="rounded bg-t-surface border border-t-border p-4 flex flex-col justify-between hover:border-t-accent transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-t-muted">
              Projects Studio
            </span>
            <div className="p-1.5 rounded bg-t-bg text-t-accent border border-t-border">
              <FolderGit2 size={16} />
            </div>
          </div>
          <div className="my-3">
            <span className="text-2xl font-mono font-bold text-t-text tracking-tight">
              {loading ? '...' : projects.length}
            </span>
            <span className="text-[11px] font-mono text-t-accent-br ml-2">
              ({featuredProjects} featured)
            </span>
          </div>
          <div className="pt-2 border-t border-t-border flex items-center justify-between text-xs">
            <span className="text-[11px] text-t-dim font-mono">Case Studies</span>
            <Link to="/admin/projects" className="text-t-accent hover:text-t-accent-br flex items-center gap-1 font-mono text-[11px]">
              <span>Manage</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>

        {/* Career Timeline Card */}
        <div className="rounded bg-t-surface border border-t-border p-4 flex flex-col justify-between hover:border-t-accent transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-t-muted">
              Career Timeline
            </span>
            <div className="p-1.5 rounded bg-t-bg text-t-accent2 border border-t-border">
              <Briefcase size={16} />
            </div>
          </div>
          <div className="my-3">
            <span className="text-2xl font-mono font-bold text-t-text tracking-tight">
              {loading ? '...' : experience.length}
            </span>
            <span className="text-[11px] font-mono text-t-accent2 ml-2">Milestones</span>
          </div>
          <div className="pt-2 border-t border-t-border flex items-center justify-between text-xs">
            <span className="text-[11px] text-t-dim font-mono truncate max-w-[120px]">
              {experience[0]?.company || 'None logged'}
            </span>
            <Link to="/admin/experience" className="text-t-accent2 hover:underline flex items-center gap-1 font-mono text-[11px]">
              <span>Timeline</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>

        {/* Skills Matrix Card */}
        <div className="rounded bg-t-surface border border-t-border p-4 flex flex-col justify-between hover:border-t-accent transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-t-muted">
              Skills Matrix
            </span>
            <div className="p-1.5 rounded bg-t-bg text-t-accent border border-t-border">
              <Cpu size={16} />
            </div>
          </div>
          <div className="my-3">
            <span className="text-2xl font-mono font-bold text-t-text tracking-tight">
              {loading ? '...' : skills.length}
            </span>
            <span className="text-[11px] font-mono text-t-accent-br ml-2">
              ({featuredSkills} spotlighted)
            </span>
          </div>
          <div className="pt-2 border-t border-t-border flex items-center justify-between text-xs">
            <span className="text-[11px] text-t-dim font-mono">Categorized Matrix</span>
            <Link to="/admin/skills" className="text-t-accent hover:text-t-accent-br flex items-center gap-1 font-mono text-[11px]">
              <span>Matrix</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>

        {/* Education & Certs Combined KPI Card */}
        <div className="rounded bg-t-surface border border-t-border p-4 flex flex-col justify-between hover:border-t-accent transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-t-muted">
              Credentials
            </span>
            <div className="p-1.5 rounded bg-t-bg text-t-accent2 border border-t-border">
              <Award size={16} />
            </div>
          </div>
          <div className="my-3">
            <span className="text-2xl font-mono font-bold text-t-text tracking-tight">
              {loading ? '...' : education.length + certifications.length}
            </span>
            <span className="text-[11px] font-mono text-t-muted ml-2">
              ({education.length} Edu · {certifications.length} Cert)
            </span>
          </div>
          <div className="pt-2 border-t border-t-border flex items-center justify-between text-xs">
            <span className="text-[11px] text-t-dim font-mono">Academic &amp; Licenses</span>
            <Link to="/admin/education" className="text-t-accent2 hover:underline flex items-center gap-1 font-mono text-[11px]">
              <span>View</span>
              <ArrowRight size={11} />
            </Link>
          </div>
        </div>
      </div>

      {/* System Infrastructure & Telemetry Strip */}
      <div className="rounded bg-t-surface border border-t-border p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-t-bg text-t-accent2 border border-t-border">
              <Activity size={18} />
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-t-text flex items-center gap-2">
                <span>Database: MongoDB Atlas (`Portfolio_db`)</span>
                <span className="px-1.5 py-0.2 rounded bg-t-accent2-dim text-t-accent2 text-[10px]">CONNECTED</span>
              </div>
              <div className="text-[11px] font-mono text-t-muted mt-0.5">
                Server Uptime: {health?.uptime ? `${Math.floor(health.uptime / 60)}m ${health.uptime % 60}s` : 'Active'} · Social Links: {socials.length} Active
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/admin/socials"
              className="px-3 py-1.5 rounded bg-t-bg border border-t-border hover:border-t-accent text-[11px] font-mono text-t-muted hover:text-t-text transition-all flex items-center gap-1.5"
            >
              <Share2 size={12} className="text-t-accent" />
              <span>Manage Socials</span>
            </Link>
            <Link
              to="/admin/resume"
              className="px-3 py-1.5 rounded bg-t-bg border border-t-border hover:border-t-accent2 text-[11px] font-mono text-t-muted hover:text-t-text transition-all flex items-center gap-1.5"
            >
              <FileText size={12} className="text-t-accent2" />
              <span>Resume Asset</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
