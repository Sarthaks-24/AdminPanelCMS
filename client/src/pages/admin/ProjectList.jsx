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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-t-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-t-surface text-t-accent border border-t-border">
              <FolderGit2 size={20} />
            </div>
            <h1 className="text-xl font-bold text-t-text tracking-tight">Engineering Projects Studio</h1>
            <span className="px-2 py-0.5 rounded bg-t-surface-hi text-[11px] font-mono text-t-muted border border-t-border-hi">
              {projects.length} Total
            </span>
          </div>
          <p className="text-xs text-t-muted mt-1">
            Case studies, architectural deep dives, and solo/team engineering systems served across client applications.
          </p>
        </div>

        <Link
          to="/admin/projects/new"
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-xs transition-all shadow-sm cursor-pointer"
        >
          <Plus size={15} />
          <span>New Case Study</span>
        </Link>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-t-surface border border-t-border rounded p-3.5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3 top-2.5 text-t-dim" />
          <input
            type="text"
            placeholder="Search by title, slug, or tech stack..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 rounded bg-t-bg border border-t-border-hi text-xs text-t-text placeholder-slate-500 focus:outline-none focus:border-t-accent transition-colors"
          />
        </div>

        {/* Mode Filter Tabs */}
        <div className="flex items-center gap-1 bg-t-bg border border-t-border-hi p-1 rounded w-full md:w-auto">
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
                  ? 'bg-t-accent text-t-on-accent font-bold shadow-sm'
                  : 'text-t-muted hover:text-t-text'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-t-accent animate-pulse">
          Querying engineering case studies...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="p-12 text-center text-xs font-mono text-t-dim border border-dashed border-t-border rounded bg-t-surface">
          No projects found matching the filter criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProjects.map((p) => (
            <div
              key={p._id}
              className="rounded bg-t-surface border border-t-border hover:border-t-accent transition-all flex flex-col justify-between overflow-hidden group"
            >
              <div>
                {/* Thumbnail Preview Banner */}
                {p.thumbnail ? (
                  <div className="h-36 w-full overflow-hidden bg-t-bg relative border-b border-t-border">
                    <img
                      src={p.thumbnail}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => (e.target.style.display = 'none')}
                    />
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-t-bg/80 backdrop-blur-md text-[10px] font-mono text-t-accent-br border border-t-border-hi uppercase">
                        {p.mode}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="h-20 w-full bg-t-bg p-3 flex items-center justify-between border-b border-t-border">
                    <span className="px-2 py-0.5 rounded bg-t-surface text-[10px] font-mono text-t-accent-br border border-t-border-hi uppercase">
                      {p.mode}
                    </span>
                  </div>
                )}

                {/* Content */}
                <div className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/admin/projects/edit/${p._id}`}
                      className="text-sm font-bold text-t-text hover:text-t-accent-br transition-colors leading-tight line-clamp-1"
                    >
                      {p.title}
                    </Link>

                    <button
                      onClick={() => handleToggleFeatured(p)}
                      className={`p-1 rounded transition-colors cursor-pointer shrink-0 ${
                        p.featured ? 'text-t-accent2' : 'text-t-dim hover:text-t-muted'
                      }`}
                      title={p.featured ? 'Featured on homepage' : 'Mark as featured'}
                    >
                      <Star size={14} className={p.featured ? 'fill-current' : ''} />
                    </button>
                  </div>

                  {/* Slug & Role */}
                  <div className="flex items-center gap-2 text-[11px] font-mono text-t-muted">
                    <span className="text-t-accent">/{p.slug}</span>
                    <span className="text-t-dim">·</span>
                    <span className="truncate">{p.role}</span>
                  </div>

                  {/* Metric Pill */}
                  {p.keyMetric && (
                    <div className="inline-block px-2 py-0.5 rounded bg-t-bg border border-t-accent2/30 text-[10px] font-mono text-t-accent2">
                      {p.keyMetric}
                    </div>
                  )}

                  <p className="text-xs text-t-muted line-clamp-2 leading-relaxed">
                    {p.shortDescription}
                  </p>

                  {/* Tech Stack Chips */}
                  {p.stack && p.stack.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {p.stack.slice(0, 4).map((tech, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded bg-t-bg text-[10px] font-mono text-t-muted border border-t-border-hi"
                        >
                          {tech}
                        </span>
                      ))}
                      {p.stack.length > 4 && (
                        <span className="px-1.5 py-0.5 rounded bg-t-bg text-[10px] font-mono text-t-dim border border-t-border-hi">
                          +{p.stack.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-3 border-t border-t-border bg-t-bg flex items-center justify-between">
                <div className="flex items-center gap-2 text-t-dim">
                  {p.links?.github && (
                    <a
                      href={p.links.github}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 hover:text-t-accent transition-colors"
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
                      className="p-1 hover:text-t-accent2 transition-colors"
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
                    className="p-1.5 rounded text-t-muted hover:text-t-text hover:bg-t-surface-hi transition-all cursor-pointer"
                    title="Edit Case Study"
                  >
                    <Edit2 size={13} />
                  </Link>
                  <button
                    onClick={() => handleDelete(p._id, p.title)}
                    className="p-1.5 rounded text-t-danger hover:text-t-text hover:bg-red-950 transition-all cursor-pointer"
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
