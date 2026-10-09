import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { ListSkeleton, EmptyState } from '../../components/admin/States';
import { useToast } from '../../components/admin/Toast';
import VisibilityToggle from '../../components/admin/VisibilityToggle';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Globe,
  GitBranch,
  Star,
} from 'lucide-react';

const plural = (n) => `${n} ${n === 1 ? 'project' : 'projects'} shown`;

export default function ProjectList() {
  const { notify } = useToast();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // all, solo, team, featured

  const fetchProjects = async () => {
    try {
      setLoadFailed(false);
      const res = await api.get('/projects');
      setProjects(res.data || []);
    } catch {
      setLoadFailed(true);
      notify('Could not load your projects. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete “${title}”? This can’t be undone.`)) return;
    try {
      await api.delete(`/projects/${id}`);
      setProjects((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      notify(err.response?.data?.message || 'Could not delete the project. Try again.');
    }
  };

  const handleToggleFeatured = async (project) => {
    try {
      const updated = { ...project, featured: !project.featured };
      const res = await api.put(`/projects/${project._id}`, updated);
      setProjects((prev) => prev.map((p) => (p._id === project._id ? res.data : p)));
    } catch {
      notify('Could not update the featured status. Try again.');
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
    if (filterMode === 'featured') return p.featured === true;
    return true;
  });

  const soloCount = projects.filter((p) => p.mode === 'solo').length;
  const teamCount = projects.filter((p) => p.mode === 'team').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-t-border">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-3xl text-t-text">Projects</h1>
            <span className="text-sm text-t-muted">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            </span>
          </div>
          <p className="text-sm text-t-muted mt-2 max-w-prose">
            The case studies shown on your portfolio. Drafts stay hidden until you publish them.
          </p>
        </div>

        <Link
          to="/admin/projects/new"
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-xs transition-all shadow-sm cursor-pointer"
        >
          <Plus size={15} />
          <span>New project</span>
        </Link>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-80">
          <Search size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-t-dim" />
          <input
            type="search"
            aria-label="Search projects"
            placeholder="Search by title, slug or tool…" name="search" autoComplete="off" spellCheck={false}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-t-border-hi bg-t-bg py-2 pl-9 pr-3 text-sm text-t-text placeholder:text-t-dim focus:border-t-accent"
          />
        </div>
        <div role="group" aria-label="Filter projects" className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {[
            { id: 'all', label: 'All', count: projects.length },
            { id: 'solo', label: 'Solo', count: soloCount },
            { id: 'team', label: 'Team', count: teamCount },
            { id: 'featured', label: 'Featured' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={filterMode === tab.id}
              onClick={() => setFilterMode(tab.id)}
              className={`border-b-2 py-2.5 transition-colors ${filterMode === tab.id ? 'border-t-accent font-semibold text-t-text' : 'border-transparent text-t-muted hover:text-t-text'}`}
            >
              {tab.label}{tab.count !== undefined && <span className="ml-1.5 text-t-dim tabular-nums">{tab.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {!loading && !loadFailed && <p role="status" className="sr-only">{plural(filteredProjects.length)}</p>}

      {/* Projects, in the order visitors see them */}
      {loading ? (
        <ListSkeleton label="Loading projects" />
      ) : loadFailed ? (
        <EmptyState title="Your projects didn’t load" hint="Check your connection, then try again." action={<button type="button" onClick={() => { setLoading(true); fetchProjects(); }} className="rounded-lg bg-t-accent px-4 py-2 text-sm font-semibold text-t-on-accent">Try again</button>} />
      ) : projects.length === 0 ? (
        <EmptyState title="No projects yet" hint="Add your first case study. Start with the one you are proudest of." />
      ) : filteredProjects.length === 0 ? (
        <EmptyState title="No projects match" hint="Try a different search, or switch back to All." />
      ) : (
        <ol className="divide-y divide-t-border border-y border-t-border">
          {filteredProjects.map((p, index) => (
            <li key={p._id} className="group grid grid-cols-[6.5rem_1fr] items-start gap-x-5 gap-y-3 py-6 sm:grid-cols-[2.25rem_8.5rem_1fr_auto] sm:items-center">
              <span aria-hidden="true" className="hidden font-display text-3xl leading-none text-t-dim tabular-nums sm:block">{String(index + 1).padStart(2, '0')}</span>
              <div className="h-[4.5rem] w-[6.5rem] overflow-hidden rounded-md border border-t-border bg-t-surface sm:h-[5.5rem] sm:w-[8.5rem]">
                {p.thumbnail ? (
                  <img src={p.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <span aria-hidden="true" className="flex h-full w-full items-center justify-center font-display text-4xl text-t-dim">{(p.title || '?').trim().charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="min-w-0">
                <Link to={`/admin/projects/edit/${p._id}`} className="font-display text-xl font-semibold leading-tight text-t-text hover:underline hover:underline-offset-4">{p.title}</Link>
                <p className="mt-1 text-sm text-t-muted">
                  {p.mode === 'team' ? 'Team project' : 'Solo project'}{p.role ? `, ${p.role}` : ''}
                  <span className="font-mono-code ml-2 text-xs text-t-dim">/{p.slug}</span>
                </p>
                {p.shortDescription && <p className="mt-1.5 line-clamp-2 max-w-prose text-sm leading-6 text-t-muted">{p.shortDescription}</p>}
                {p.stack?.length > 0 && (
                  <p className="mt-1.5 text-sm text-t-dim">{p.stack.slice(0, 5).join(', ')}{p.stack.length > 5 ? ` and ${p.stack.length - 5} more` : ''}</p>
                )}
              </div>
              <div className="col-span-2 flex items-center gap-1 sm:col-span-1 sm:justify-end">
                <VisibilityToggle endpoint="/projects" item={p} onChange={(updated) => setProjects((prev) => prev.map((x) => x._id === updated._id ? updated : x))} />
                <button
                  type="button"
                  onClick={() => handleToggleFeatured(p)}
                  aria-pressed={Boolean(p.featured)}
                  aria-label={p.featured ? `Unfeature ${p.title}` : `Feature ${p.title}`}
                  className={`rounded p-2.5 transition-colors ${p.featured ? 'text-t-accent2' : 'text-t-dim hover:bg-t-surface hover:text-t-muted'}`}
                >
                  <Star size={16} className={p.featured ? 'fill-current' : ''} />
                </button>
                {p.links?.live && <a href={p.links.live} target="_blank" rel="noreferrer" aria-label={`Open ${p.title} live (opens in a new tab)`} className="rounded p-2.5 text-t-dim hover:bg-t-surface hover:text-t-text"><Globe size={16} /></a>}
                {p.links?.github && <a href={p.links.github} target="_blank" rel="noreferrer" aria-label={`Open ${p.title} on GitHub (opens in a new tab)`} className="rounded p-2.5 text-t-dim hover:bg-t-surface hover:text-t-text"><GitBranch size={16} /></a>}
                <Link to={`/admin/projects/edit/${p._id}`} aria-label={`Edit ${p.title}`} className="rounded p-2.5 text-t-muted hover:bg-t-surface hover:text-t-text"><Edit2 size={16} /></Link>
                <button type="button" onClick={() => handleDelete(p._id, p.title)} aria-label={`Delete ${p.title}`} className="rounded p-2.5 text-t-danger hover:bg-t-danger-dim"><Trash2 size={16} /></button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
