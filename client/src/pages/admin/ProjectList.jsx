import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  FolderGit2,
  Globe,
  GitBranch,
  Video,
  Star,
  ExternalLink,
  Code,
} from 'lucide-react';

export default function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // all, solo, team, featured

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res.data || []);
    } catch (err) {
      console.error('Failed to load projects', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Permanently delete case study "${title}" from the database?`)) return;
    try {
      await api.delete(`/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete project');
    }
  };

  const handleToggleFeatured = async (project) => {
    try {
      const updated = { ...project, featured: !project.featured };
      const res = await api.put(`/projects/${project._id}`, updated);
      setProjects((prev) => prev.map((p) => (p._id === project._id ? res.data : p)));
    } catch (err) {
      alert('Error updating featured status');
    }
  };

  // Filter projects by search and mode
  const filteredProjects = projects.filter((p) => {
    const matchesSearch =
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.shortDescription?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.stack?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterMode === 'solo') return p.mode === 'solo';
    if (filterMode === 'team') return p.mode === 'team';
    if (filterMode === 'featured') return p.featured !== false;
    return true;
  });

  const soloCount = projects.filter((p) => p.mode === 'solo').length;
  const teamCount = projects.filter((p) => p.mode === 'team').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1a2333]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-[#090d15] text-[#0078d4] border border-[#1a2333]">
              <FolderGit2 size={20} />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Engineering Projects Studio</h1>
            <span className="px-2 py-0.5 rounded bg-[#0f141f] text-[11px] font-mono text-slate-300 border border-[#1e293b]">
              {projects.length} Total
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Case studies, architectural deep dives, and solo/team engineering systems served across client applications.
          </p>
        </div>

        <Link
          to="/admin/projects/new"
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded bg-[#0078d4] hover:bg-[#1e90ff] text-white font-semibold text-xs transition-all shadow-sm cursor-pointer"
        >
          <Plus size={15} />
          <span>New Case Study</span>
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#070a10] border border-[#1a2333] rounded p-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by title, slug, or tech stack..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded bg-black border border-[#1e293b] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#0078d4] transition-colors"
          />
        </div>

        {/* Mode Filter Tabs */}
        <div className="flex items-center gap-1 bg-black border border-[#1e293b] p-1 rounded w-full md:w-auto">
          {[
            { id: 'all', label: `All (${projects.length})` },
            { id: 'solo', label: `Solo (${soloCount})` },
            { id: 'team', label: `Team (${teamCount})` },
            { id: 'featured', label: `Featured` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterMode(tab.id)}
              className={`flex-1 md:flex-none px-3 py-1 text-xs font-mono rounded transition-all cursor-pointer ${
                filterMode === tab.id
                  ? 'bg-[#0078d4] text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-[#0078d4] animate-pulse">
          Querying engineering case studies...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="p-12 text-center text-xs font-mono text-slate-500 border border-dashed border-[#1a2333] rounded bg-[#070a10]">
          No projects found matching the filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((p) => (
            <div
              key={p._id}
              className="rounded bg-[#070a10] border border-[#1a2333] hover:border-[#0078d4] transition-all flex flex-col justify-between overflow-hidden group"
            >
              <div>
                {/* Thumbnail Preview Banner */}
                {p.thumbnail ? (
                  <div className="h-36 w-full overflow-hidden bg-black relative border-b border-[#1a2333]">
                    <img
                      src={p.thumbnail}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[10px] font-mono text-[#1e90ff] border border-[#1e293b] uppercase">
                        {p.mode}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-20 w-full bg-black p-3 flex items-center justify-between border-b border-[#1a2333]">
                    <span className="px-2 py-0.5 rounded bg-[#090d15] text-[10px] font-mono text-[#1e90ff] border border-[#1e293b] uppercase">
                      {p.mode}
                    </span>
                  </div>
                )}

                {/* Content */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/admin/projects/edit/${p._id}`}
                      className="text-sm font-bold text-white hover:text-[#1e90ff] transition-colors leading-tight line-clamp-1"
                    >
                      {p.title}
                    </Link>

                    <button
                      onClick={() => handleToggleFeatured(p)}
                      className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
                        p.featured ? 'text-[#10b981]' : 'text-slate-600 hover:text-slate-300'
                      }`}
                      title={p.featured ? 'Featured on homepage' : 'Mark as featured'}
                    >
                      <Star size={14} className={p.featured ? 'fill-current' : ''} />
                    </button>
                  </div>

                  {/* Slug & Role */}
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
                    <span className="text-[#0078d4]">/{p.slug}</span>
                    <span className="text-slate-600">·</span>
                    <span className="truncate">{p.role}</span>
                  </div>

                  {/* Metric Pill */}
                  {p.keyMetric && (
                    <div className="inline-block px-2 py-0.5 rounded bg-black border border-[#10b981]/30 text-[10px] font-mono text-[#10b981]">
                      {p.keyMetric}
                    </div>
                  )}

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {p.shortDescription}
                  </p>

                  {/* Tech Stack Chips */}
                  {p.stack && p.stack.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {p.stack.slice(0, 4).map((tech, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded bg-black text-[10px] font-mono text-slate-300 border border-[#1e293b]"
                        >
                          {tech}
                        </span>
                      ))}
                      {p.stack.length > 4 && (
                        <span className="px-1.5 py-0.5 rounded bg-black text-[10px] font-mono text-slate-500 border border-[#1e293b]">
                          +{p.stack.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 border-t border-[#1a2333] bg-black flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-500">
                  {p.links?.github && (
                    <a
                      href={p.links.github}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 hover:text-[#0078d4] transition-colors"
                      title="GitHub Repository"
                    >
                      <GitBranch size={13} />
                    </a>
                  )}
                  {p.links?.live && (
                    <a
                      href={p.links.live}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 hover:text-[#10b981] transition-colors"
                      title="Live Production URL"
                    >
                      <Globe size={13} />
                    </a>
                  )}
                  {p.links?.demo && (
                    <a
                      href={p.links.demo}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 hover:text-amber-400 transition-colors"
                      title="Demo Video"
                    >
                      <Video size={13} />
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <Link
                    to={`/admin/projects/edit/${p._id}`}
                    className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#111827] transition-all cursor-pointer"
                    title="Edit Case Study"
                  >
                    <Edit2 size={13} />
                  </Link>
                  <button
                    onClick={() => handleDelete(p._id, p.title)}
                    className="p-1.5 rounded text-red-400 hover:text-white hover:bg-red-950 transition-all cursor-pointer"
                    title="Delete Case Study"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
