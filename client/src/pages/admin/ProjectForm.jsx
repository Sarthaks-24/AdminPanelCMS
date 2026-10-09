import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../components/admin/Toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowLeft,
  Save,
  Code,
  Bold,
  Italic,
  List,
  Heading2,
  Quote,
} from 'lucide-react';

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-')
    .replace(/(^-|-$)/g, '');

export default function ProjectForm() {
  const { notify } = useToast();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    mode: 'solo',
    shortDescription: '',
    thumbnail: '',
    stack: '',
    role: 'Lead Engineer',
    teammates: '',
    keyMetric: 'Latency: <15ms',
    highlights: '',
    caseStudyBody:
      '# Project Architecture & Technical Overview\n\n### Problem Statement\nDescribe the engineering challenge, latency constraints, or scale requirements.\n\n### Architecture & Key Decisions\n- **Microservices / Decoupled Core**: Explain system design.\n- **State Management**: Explain client/server data caching.\n\n```ts\n// Example system loop or configuration\nconst latency = measureSubsystem();\n```\n\n### Engineering Results\nDetail performance metrics, test coverage, and outcomes.',
    github: '',
    live: '',
    demo: '',
    order: 0,
    featured: true,
  });

  const [availableSkills, setAvailableSkills] = useState([]);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [viewMode, setViewMode] = useState('split'); // 'split', 'editor', 'preview'

  useEffect(() => {
    // Fetch available skills for quick tags
    api.get('/skills')
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data.skills || [];
        setAvailableSkills(list.map((s) => s.name));
      })
      .catch(() => {});

    if (isEdit) {
      api.get(`/projects/${id}`)
        .then((res) => {
          const p = res.data;
          setFormData({
            title: p.title || '',
            slug: p.slug || '',
            mode: p.mode === 'team' ? 'team' : 'solo',
            shortDescription: p.shortDescription || '',
            thumbnail: p.thumbnail || '',
            stack: p.stack?.join(', ') || '',
            role: p.role || 'Lead Engineer',
            teammates: p.teammates?.join(', ') || '',
            keyMetric: p.keyMetric || '',
            highlights: p.highlights?.join('\n') || '',
            caseStudyBody: p.caseStudyBody || '',
            github: p.links?.github || '',
            live: p.links?.live || '',
            demo: p.links?.demo || '',
            order: p.order ?? 0,
            featured: p.featured ?? true,
          });
          setSlugManuallyEdited(true);
        })
        .catch((err) => {
          notify('Could not load this project. ' + (err.response?.data?.message || err.message));
          navigate('/admin/projects');
        })
        .finally(() => setFetching(false));
    }
  }, [id, isEdit, navigate]);

  const handleTitleChange = (val) => {
    setFormData((prev) => {
      const next = { ...prev, title: val };
      if (!slugManuallyEdited && !isEdit) {
        next.slug = slugify(val);
      }
      return next;
    });
  };

  const addStackTag = (skillName) => {
    const current = formData.stack
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!current.includes(skillName)) {
      setFormData((prev) => ({
        ...prev,
        stack: current.length ? `${prev.stack}, ${skillName}` : skillName,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const isTeam = formData.mode === 'team';
    const highlightList = formData.highlights
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      title: formData.title,
      slug: formData.slug || slugify(formData.title),
      mode: formData.mode,
      shortDescription: formData.shortDescription,
      thumbnail: formData.thumbnail,
      stack: formData.stack
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      role: formData.role,
      teammates: isTeam
        ? formData.teammates
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      keyMetric: formData.keyMetric,
      highlights: highlightList,
      caseStudyBody: formData.caseStudyBody,
      links: {
        github: formData.github,
        live: formData.live,
        demo: formData.demo,
      },
      order: Number(formData.order),
      featured: formData.featured,
    };

    try {
      if (isEdit) {
        await api.put(`/projects/${id}`, payload);
      } else {
        await api.post('/projects', payload);
      }
      navigate('/admin/projects');
    } catch (err) {
      notify(err.response?.data?.message || 'Could not save the project. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const insertMarkdown = (prefix, suffix = '') => {
    const textarea = document.getElementById('caseStudyTextarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selection = text.substring(start, end);

    const replacement = prefix + (selection || 'text') + suffix;
    const newText = text.substring(0, start) + replacement + text.substring(end);

    setFormData((prev) => ({ ...prev, caseStudyBody: newText }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selection.length || 4));
    }, 10);
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-xs font-mono text-t-accent animate-pulse">
          Fetching case study data...
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-6xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-t-border">
        <div className="flex items-center gap-3">
          <Link
            to="/admin/projects"
            className="p-2 rounded bg-t-surface text-t-muted hover:text-t-text border border-t-border transition-all"
            title="Return to Projects List"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-t-text tracking-tight">
              {isEdit ? 'Edit Engineering Case Study' : 'Create Engineering Case Study'}
            </h1>
            <p className="text-xs text-t-muted mt-0.5">
              The write-up, link and details for this project.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/admin/projects"
            className="px-3 py-1.5 rounded text-xs font-semibold text-t-muted hover:text-t-text hover:bg-t-surface-hi"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-t-accent2 hover:bg-t-accent2 text-t-on-accent2 font-semibold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <Save size={14} />
            <span>{loading ? 'Saving...' : isEdit ? 'Update Case Study' : 'Publish Case Study'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Core Metadata) */}
        <div className="lg:col-span-1 space-y-5">
          {/* Section: Basic Info */}
          <div className="p-4 rounded bg-t-surface border border-t-border space-y-3.5">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-t-muted block pb-2 border-b border-t-border">
              Project Identification
            </span>

            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">Project Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Real-time Order Flow Dashboard"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">Public URL Slug *</label>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) => {
                  setSlugManuallyEdited(true);
                  setFormData({ ...formData, slug: slugify(e.target.value) });
                }}
                placeholder="e.g. real-time-order-flow-dashboard"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-accent-br font-mono text-xs focus:border-t-accent outline-none"
              />
              <span className="text-[10px] font-mono text-t-dim mt-1 block">
                endpoint: <code className="text-t-accent2">/api/projects/{formData.slug || 'slug'}</code>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-mono text-t-muted mb-1">Project Mode</label>
                <select
                  value={formData.mode}
                  onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                  className="w-full px-2.5 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
                >
                  <option value="solo">Solo Project</option>
                  <option value="team">Team Collaboration</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono text-t-muted mb-1">Display Order</label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                  className="w-full px-2.5 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">Engineering Role</label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="Lead Full Stack Engineer"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
              />
            </div>

            {formData.mode === 'team' && (
              <div>
                <label className="block text-xs font-mono text-t-muted mb-1">Collaborators (Comma-separated)</label>
                <input
                  type="text"
                  value={formData.teammates}
                  onChange={(e) => setFormData({ ...formData, teammates: e.target.value })}
                  placeholder="Alex Rivera, Sarah Chen"
                  className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">Key Performance Metric</label>
              <input
                type="text"
                value={formData.keyMetric}
                onChange={(e) => setFormData({ ...formData, keyMetric: e.target.value })}
                placeholder="e.g. Latency: <15ms, 99.98% Uptime"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-accent2 font-mono text-xs focus:border-t-accent outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="projFeatured"
                checked={formData.featured}
                onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                className="w-4 h-4 rounded bg-t-bg border-t-border-hi text-t-accent2 focus:ring-t-accent2"
              />
              <label htmlFor="projFeatured" className="text-xs text-t-muted cursor-pointer">
                Feature this project
              </label>
            </div>
          </div>

          {/* Section: Short Bio & Tech Stack */}
          <div className="p-4 rounded bg-t-surface border border-t-border space-y-3.5">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-t-muted block pb-2 border-b border-t-border">
              Summary and tools
            </span>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-mono text-t-muted">Short Summary (Max 260) *</label>
                <span className={`text-[10px] font-mono ${formData.shortDescription.length > 260 ? 'text-t-danger' : 'text-t-dim'}`}>
                  {formData.shortDescription.length}/260
                </span>
              </div>
              <textarea
                required
                maxLength={260}
                rows={3}
                value={formData.shortDescription}
                onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                placeholder="High-frequency options order flow visualization with sub-15ms WebSocket updates..."
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">Tech Stack (Comma-separated)</label>
              <input
                type="text"
                value={formData.stack}
                onChange={(e) => setFormData({ ...formData, stack: e.target.value })}
                placeholder="React, Node.js, WebSockets, Redis"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
              />

              {availableSkills.length > 0 && (
                <div className="mt-2">
                  <span className="text-[10px] font-mono text-t-dim block mb-1">Add from your skills:</span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                    {availableSkills.map((sk) => (
                      <button
                        key={sk}
                        type="button"
                        onClick={() => addStackTag(sk)}
                        className="px-1.5 py-0.5 rounded bg-t-bg hover:bg-t-surface-hi text-[10px] font-mono text-t-muted hover:text-t-text border border-t-border-hi cursor-pointer"
                      >
                        + {sk}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">
                Key Accomplishments / Highlights (One per line)
              </label>
              <textarea
                rows={3}
                value={formData.highlights}
                onChange={(e) => setFormData({ ...formData, highlights: e.target.value })}
                placeholder="Black-Scholes approximations executed in real time&#10;Redis pub/sub channels fan out 1,200 ticks/sec"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
              />
            </div>
          </div>

          {/* Section: Media & URLs */}
          <div className="p-4 rounded bg-t-surface border border-t-border space-y-3.5">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-t-muted block pb-2 border-b border-t-border">
              Images and links
            </span>

            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">Thumbnail Preview URL</label>
              <input
                type="url"
                value={formData.thumbnail}
                onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
              />
              {formData.thumbnail && (
                <div className="mt-2 rounded overflow-hidden border border-t-border h-28 bg-t-bg">
                  <img
                    src={formData.thumbnail}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => (e.target.style.display = 'none')}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">GitHub Repository URL</label>
              <input
                type="url"
                value={formData.github}
                onChange={(e) => setFormData({ ...formData, github: e.target.value })}
                placeholder="https://github.com/username/project"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">Live Application URL</label>
              <input
                type="url"
                value={formData.live}
                onChange={(e) => setFormData({ ...formData, live: e.target.value })}
                placeholder="https://app.example.com"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">Demo Video URL</label>
              <input
                type="url"
                value={formData.demo}
                onChange={(e) => setFormData({ ...formData, demo: e.target.value })}
                placeholder="https://youtube.com/..."
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
              />
            </div>
          </div>
        </div>

        {/* Right Column (Markdown Case Study Editor) */}
        <div className="lg:col-span-2 flex flex-col space-y-3">
          <div className="p-3 rounded bg-t-surface border border-t-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code size={16} className="text-t-accent" />
              <span className="text-xs font-mono font-bold text-t-text uppercase tracking-wider">
                Full Case Study Document (Markdown)
              </span>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-t-bg border border-t-border-hi rounded p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('editor')}
                className={`px-2.5 py-1 text-[11px] font-mono rounded ${
                  viewMode === 'editor' ? 'bg-t-accent text-t-on-accent font-bold' : 'text-t-muted hover:text-t-text'
                }`}
              >
                Editor
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 text-[11px] font-mono rounded hidden sm:inline-block ${
                  viewMode === 'split' ? 'bg-t-accent text-t-on-accent font-bold' : 'text-t-muted hover:text-t-text'
                }`}
              >
                Split
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                className={`px-2.5 py-1 text-[11px] font-mono rounded ${
                  viewMode === 'preview' ? 'bg-t-accent text-t-on-accent font-bold' : 'text-t-muted hover:text-t-text'
                }`}
              >
                Preview
              </button>
            </div>
          </div>

          {/* Quick Toolbar */}
          <div className="p-2 rounded bg-t-surface border border-t-border flex flex-wrap items-center gap-1 text-t-muted">
            <button
              type="button"
              onClick={() => insertMarkdown('## ')}
              className="p-1.5 hover:bg-t-surface-hi hover:text-t-text rounded"
              title="Heading 2"
            >
              <Heading2 size={13} />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('**', '**')}
              className="p-1.5 hover:bg-t-surface-hi hover:text-t-text rounded"
              title="Bold"
            >
              <Bold size={13} />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('*', '*')}
              className="p-1.5 hover:bg-t-surface-hi hover:text-t-text rounded"
              title="Italic"
            >
              <Italic size={13} />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('- ')}
              className="p-1.5 hover:bg-t-surface-hi hover:text-t-text rounded"
              title="Bullet list"
            >
              <List size={13} />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('> ')}
              className="p-1.5 hover:bg-t-surface-hi hover:text-t-text rounded"
              title="Quote"
            >
              <Quote size={13} />
            </button>
            <button
              type="button"
              onClick={() => insertMarkdown('```ts\n', '\n```')}
              className="p-1.5 hover:bg-t-surface-hi hover:text-t-text rounded font-mono text-[11px]"
              title="Code block"
            >
              &lt;/&gt;
            </button>
          </div>

          {/* Main Markdown Body Grid */}
          <div className="flex-1 min-h-[500px] grid grid-cols-1 gap-4">
            {viewMode === 'split' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                <textarea
                  id="caseStudyTextarea"
                  required
                  value={formData.caseStudyBody}
                  onChange={(e) => setFormData({ ...formData, caseStudyBody: e.target.value })}
                  className="w-full h-full min-h-[480px] p-4 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none resize-none leading-relaxed"
                />
                <div className="h-full min-h-[480px] p-5 rounded bg-t-bg border border-t-border-hi overflow-y-auto preview-prose">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {formData.caseStudyBody || '*Empty preview*'}
                  </ReactMarkdown>
                </div>
              </div>
            ) : viewMode === 'editor' ? (
              <textarea
                id="caseStudyTextarea"
                required
                value={formData.caseStudyBody}
                onChange={(e) => setFormData({ ...formData, caseStudyBody: e.target.value })}
                className="w-full h-full min-h-[500px] p-4 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none resize-none leading-relaxed"
              />
            ) : (
              <div className="w-full h-full min-h-[500px] p-6 rounded bg-t-bg border border-t-border-hi overflow-y-auto preview-prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {formData.caseStudyBody || '*Empty preview*'}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
