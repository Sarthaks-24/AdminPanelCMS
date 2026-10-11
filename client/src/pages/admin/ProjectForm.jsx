import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api } from '../../api/client';
import { PENDING_BASE, useApiBase } from '../../lib/apiBase';
import { apiErrorMessage } from '../../lib/apiErrors';
import { chosenVisibility, submitKeepingVisibility } from '../../lib/visibilitySubmit';
import { slugify, slugifyTyping } from '../../lib/slug';
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

// Blank, not the previous owner's project. Helpful examples live in placeholders only.
const EMPTY = {
  title: '',
  slug: '',
  mode: 'solo',
  shortDescription: '',
  thumbnail: '',
  stack: '',
  role: '',
  teammates: '',
  keyMetric: '',
  highlights: '',
  caseStudyBody: '',
  github: '',
  live: '',
  demo: '',
  order: 0,
  featured: true,
};

const input = 'w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-sm focus:border-t-accent outline-none';
const labelClass = 'block text-sm font-medium text-t-text mb-1';
const hintClass = 'text-xs text-t-muted mt-1 block';

export default function ProjectForm() {
  const { notify } = useToast();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { v1Base: resolvedBase, resolved: baseResolved } = useApiBase();
  // Show `…` until the server has said what the public base is, so nobody copies a guess.
  const v1Base = baseResolved ? resolvedBase : PENDING_BASE;

  const [formData, setFormData] = useState(EMPTY);
  const [visibility, setVisibility] = useState('published');
  const [availableSkills, setAvailableSkills] = useState([]);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [viewMode, setViewMode] = useState('split'); // 'split', 'editor', 'preview'

  useEffect(() => {
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
            role: p.role || '',
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
          setVisibility(p.visibility === 'published' ? 'published' : 'draft');
          setSlugManuallyEdited(true);
        })
        .catch((err) => {
          notify(apiErrorMessage(err, 'Could not load this project.'));
          navigate('/dashboard/projects');
        })
        .finally(() => setFetching(false));
    }
  }, [id, isEdit, navigate]);

  const handleTitleChange = (val) => {
    setFormData((prev) => {
      const next = { ...prev, title: val };
      if (!slugManuallyEdited && !isEdit) {
        next.slug = slugify(val, '');
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
    // A click on either button is a choice. Enter (no submitter) keeps what the project already is,
    // so editing a published project and pressing Enter never unpublishes it (FX-38), and a new
    // project is saved as a draft: Enter never publishes (FE-02).
    const chosen = chosenVisibility(e, isEdit ? visibility : 'draft');
    setLoading(true);

    const isTeam = formData.mode === 'team';
    const highlightList = formData.highlights
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      title: formData.title,
      slug: slugify(formData.slug || formData.title),
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
      visibility: chosen,
    };

    try {
      if (isEdit) {
        await api.put(`/projects/${id}`, payload);
      } else {
        await api.post('/projects', payload);
      }
      notify(chosen === 'published' ? 'Project saved and published.' : 'Project saved as a draft. Apps won’t see it until you publish.', 'success');
      navigate('/dashboard/projects');
    } catch (err) {
      notify(apiErrorMessage(err, 'Could not save the project. Try again.'));
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
        <p role="status" className="text-sm text-t-muted">Loading project…</p>
      </div>
    );
  }

  const publicUrl = `${v1Base}/projects/${formData.slug || 'slug'}`;

  return (
    <form onSubmit={handleSubmit} onKeyDown={submitKeepingVisibility} className="max-w-6xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-t-border">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard/projects"
            className="p-2 rounded bg-t-surface text-t-muted hover:text-t-text border border-t-border transition-all"
            aria-label="Back to projects"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-t-text tracking-tight">
              {isEdit ? 'Edit project' : 'New project'}
            </h1>
            <p className="text-sm text-t-muted mt-0.5">
              {isEdit ? (visibility === 'published' ? 'Published: Apps serve it now.' : 'Draft: no App can see it yet.') : 'The write-up, links and details for this project.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/dashboard/projects"
            className="px-3 py-1.5 rounded text-sm font-semibold text-t-muted hover:text-t-text hover:bg-t-surface-hi"
          >
            Cancel
          </Link>
          <button
            type="submit"
            name="visibility"
            value="draft"
            disabled={loading}
            className="px-3.5 py-1.5 rounded border border-t-border-hi text-sm font-semibold text-t-text hover:bg-t-surface-hi disabled:opacity-50"
          >
            Save as draft
          </button>
          <button
            type="submit"
            name="visibility"
            value="published"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-sm shadow-md transition-all disabled:opacity-50"
          >
            <Save size={14} aria-hidden="true" />
            <span>{loading ? 'Saving…' : 'Save and publish'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Core Metadata) */}
        <div className="lg:col-span-1 space-y-5">
          <fieldset className="p-4 rounded bg-t-surface border border-t-border space-y-3.5">
            <legend className="text-sm font-semibold text-t-text px-1">About the project</legend>

            <div>
              <label htmlFor="project-title" className={labelClass}>Title</label>
              <input
                id="project-title"
                type="text"
                required
                maxLength={120}
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Order flow dashboard"
                autoComplete="off"
                className={input}
              />
            </div>

            <div>
              <label htmlFor="project-slug" className={labelClass}>Slug</label>
              <input
                id="project-slug"
                type="text"
                required
                maxLength={80}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={formData.slug}
                onChange={(e) => {
                  setSlugManuallyEdited(true);
                  setFormData({ ...formData, slug: slugifyTyping(e.target.value) });
                }}
                onBlur={() => setFormData((prev) => ({ ...prev, slug: slugify(prev.slug, '') }))}
                placeholder="e.g. order-flow-dashboard"
                aria-describedby="project-slug-hint"
                autoComplete="off"
                spellCheck={false}
                className={`${input} font-mono`}
              />
              <span id="project-slug-hint" className={hintClass}>
                Public at <code translate="no" className="text-t-text">{publicUrl}</code>{isEdit && <>. Changing the slug changes that URL.</>}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="project-mode" className={labelClass}>Solo or team</label>
                <select
                  id="project-mode"
                  value={formData.mode}
                  onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                  className={input}
                >
                  <option value="solo">Solo</option>
                  <option value="team">Team</option>
                </select>
              </div>

              <div>
                <label htmlFor="project-order" className={labelClass}>Order</label>
                <input
                  id="project-order"
                  type="number"
                  inputMode="numeric"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: e.target.value })}
                  aria-describedby="project-order-hint"
                  className={`${input} font-mono`}
                />
                <span id="project-order-hint" className={hintClass}>Lower comes first.</span>
              </div>
            </div>

            <div>
              <label htmlFor="project-role" className={labelClass}>Your role</label>
              <input
                id="project-role"
                type="text"
                maxLength={80}
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                placeholder="e.g. Designer and developer"
                autoComplete="off"
                className={input}
              />
            </div>

            {formData.mode === 'team' && (
              <div>
                <label htmlFor="project-teammates" className={labelClass}>Teammates</label>
                <input
                  id="project-teammates"
                  type="text"
                  value={formData.teammates}
                  onChange={(e) => setFormData({ ...formData, teammates: e.target.value })}
                  placeholder="e.g. Alex Rivera, Sam Chen"
                  aria-describedby="project-teammates-hint"
                  autoComplete="off"
                  className={input}
                />
                <span id="project-teammates-hint" className={hintClass}>Comma-separated. Served only to Apps that opt in to this field.</span>
              </div>
            )}

            <div>
              <label htmlFor="project-metric" className={labelClass}>Key result</label>
              <input
                id="project-metric"
                type="text"
                maxLength={120}
                value={formData.keyMetric}
                onChange={(e) => setFormData({ ...formData, keyMetric: e.target.value })}
                placeholder="e.g. 2,000 weekly users"
                aria-describedby="project-metric-hint"
                autoComplete="off"
                className={input}
              />
              <span id="project-metric-hint" className={hintClass}>One number or outcome worth leading with.</span>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="projFeatured"
                checked={formData.featured}
                onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                className="w-4 h-4 rounded bg-t-bg border-t-border-hi accent-[var(--theme-accent)]"
              />
              <label htmlFor="projFeatured" className="text-sm text-t-text cursor-pointer">
                Featured
              </label>
            </div>
          </fieldset>

          <fieldset className="p-4 rounded bg-t-surface border border-t-border space-y-3.5">
            <legend className="text-sm font-semibold text-t-text px-1">Summary and tools</legend>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label htmlFor="project-summary" className="text-sm font-medium text-t-text">Short summary</label>
                <span aria-live="polite" className={`text-xs ${formData.shortDescription.length > 500 ? 'text-t-danger' : 'text-t-dim'}`}>
                  {formData.shortDescription.length}/500
                </span>
              </div>
              <textarea
                id="project-summary"
                required
                maxLength={500}
                rows={3}
                value={formData.shortDescription}
                onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                placeholder="One or two sentences on what it is and who it is for…"
                className={`${input} resize-none`}
              />
            </div>

            <div>
              <label htmlFor="project-stack" className={labelClass}>Stack</label>
              <input
                id="project-stack"
                type="text"
                value={formData.stack}
                onChange={(e) => setFormData({ ...formData, stack: e.target.value })}
                placeholder="e.g. React, Node.js, Postgres"
                aria-describedby="project-stack-hint"
                autoComplete="off"
                className={`${input} font-mono`}
              />
              <span id="project-stack-hint" className={hintClass}>Comma-separated.</span>

              {availableSkills.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-t-muted block mb-1">Add from your skills:</span>
                  <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                    {availableSkills.map((sk) => (
                      <button
                        key={sk}
                        type="button"
                        onClick={() => addStackTag(sk)}
                        aria-label={`Add ${sk} to the stack`}
                        className="px-1.5 py-0.5 rounded bg-t-bg hover:bg-t-surface-hi text-xs text-t-muted hover:text-t-text border border-t-border-hi"
                      >
                        + {sk}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="project-highlights" className={labelClass}>Highlights</label>
              <textarea
                id="project-highlights"
                rows={3}
                value={formData.highlights}
                onChange={(e) => setFormData({ ...formData, highlights: e.target.value })}
                placeholder={'e.g. Cut page load from 4 s to 1 s\nShipped to 3 countries'}
                aria-describedby="project-highlights-hint"
                className={input}
              />
              <span id="project-highlights-hint" className={hintClass}>One per line, up to 15.</span>
            </div>
          </fieldset>

          <fieldset className="p-4 rounded bg-t-surface border border-t-border space-y-3.5">
            <legend className="text-sm font-semibold text-t-text px-1">Images and links</legend>

            <div>
              <label htmlFor="project-thumbnail" className={labelClass}>Thumbnail URL</label>
              <input
                id="project-thumbnail"
                type="url"
                value={formData.thumbnail}
                onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                placeholder="https://…/cover.png"
                aria-describedby="project-thumbnail-hint"
                autoComplete="off"
                spellCheck={false}
                className={`${input} font-mono`}
              />
              <span id="project-thumbnail-hint" className={hintClass}>An https image link. Uploads aren’t supported yet.</span>
              {formData.thumbnail && (
                <div className="mt-2 rounded overflow-hidden border border-t-border h-28 bg-t-bg">
                  <img
                    src={formData.thumbnail}
                    alt=""
                    width={448}
                    height={112}
                    className="w-full h-full object-cover"
                    onError={(e) => (e.target.style.display = 'none')}
                  />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="project-github" className={labelClass}>Repository URL</label>
              <input id="project-github" type="url" value={formData.github} onChange={(e) => setFormData({ ...formData, github: e.target.value })} placeholder="https://github.com/you/project" autoComplete="off" spellCheck={false} className={`${input} font-mono`} />
            </div>

            <div>
              <label htmlFor="project-live" className={labelClass}>Live URL</label>
              <input id="project-live" type="url" value={formData.live} onChange={(e) => setFormData({ ...formData, live: e.target.value })} placeholder="https://project.example.com" autoComplete="off" spellCheck={false} className={`${input} font-mono`} />
            </div>

            <div>
              <label htmlFor="project-demo" className={labelClass}>Demo video URL</label>
              <input id="project-demo" type="url" value={formData.demo} onChange={(e) => setFormData({ ...formData, demo: e.target.value })} placeholder="https://youtube.com/watch?v=…" autoComplete="off" spellCheck={false} className={`${input} font-mono`} />
            </div>
          </fieldset>
        </div>

        {/* Right Column (Markdown write-up) */}
        <div className="lg:col-span-2 flex flex-col space-y-3">
          <div className="p-3 rounded bg-t-surface border border-t-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Code size={16} aria-hidden="true" className="text-t-accent" />
              <label htmlFor="caseStudyTextarea" className="text-sm font-semibold text-t-text">Write-up (Markdown, optional)</label>
            </div>

            <div role="group" aria-label="Editor view" className="flex items-center bg-t-bg border border-t-border-hi rounded p-0.5">
              {[['editor', 'Editor', ''], ['split', 'Split', 'hidden sm:inline-block'], ['preview', 'Preview', '']].map(([mode, label, extra]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  className={`px-2.5 py-1 text-xs rounded ${extra} ${viewMode === mode ? 'bg-t-accent text-t-on-accent font-bold' : 'text-t-muted hover:text-t-text'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div role="toolbar" aria-label="Formatting" className="p-2 rounded bg-t-surface border border-t-border flex flex-wrap items-center gap-1 text-t-muted">
            {[
              ['Heading', () => insertMarkdown('## '), <Heading2 key="h" size={13} aria-hidden="true" />],
              ['Bold', () => insertMarkdown('**', '**'), <Bold key="b" size={13} aria-hidden="true" />],
              ['Italic', () => insertMarkdown('*', '*'), <Italic key="i" size={13} aria-hidden="true" />],
              ['Bullet list', () => insertMarkdown('- '), <List key="l" size={13} aria-hidden="true" />],
              ['Quote', () => insertMarkdown('> '), <Quote key="q" size={13} aria-hidden="true" />],
              ['Code block', () => insertMarkdown('```\n', '\n```'), <span key="c" className="font-mono text-xs" aria-hidden="true">&lt;/&gt;</span>],
            ].map(([label, action, icon]) => (
              <button key={label} type="button" onClick={action} aria-label={label} title={label} className="p-1.5 hover:bg-t-surface-hi hover:text-t-text rounded">{icon}</button>
            ))}
          </div>

          <div className="flex-1 min-h-[500px] grid grid-cols-1 gap-4">
            {viewMode === 'split' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
                <textarea
                  id="caseStudyTextarea"
                  value={formData.caseStudyBody}
                  onChange={(e) => setFormData({ ...formData, caseStudyBody: e.target.value })}
                  placeholder="What was the problem, what did you build, what happened…"
                  className="w-full h-full min-h-[480px] p-4 rounded bg-t-bg border border-t-border-hi text-t-text text-sm font-mono focus:border-t-accent outline-none resize-none leading-relaxed"
                />
                <div className="h-full min-h-[480px] p-5 rounded bg-t-bg border border-t-border-hi overflow-y-auto preview-prose">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {formData.caseStudyBody || '*Nothing written yet.*'}
                  </ReactMarkdown>
                </div>
              </div>
            ) : viewMode === 'editor' ? (
              <textarea
                id="caseStudyTextarea"
                value={formData.caseStudyBody}
                onChange={(e) => setFormData({ ...formData, caseStudyBody: e.target.value })}
                placeholder="What was the problem, what did you build, what happened…"
                className="w-full h-full min-h-[500px] p-4 rounded bg-t-bg border border-t-border-hi text-t-text text-sm font-mono focus:border-t-accent outline-none resize-none leading-relaxed"
              />
            ) : (
              <div className="w-full h-full min-h-[500px] p-6 rounded bg-t-bg border border-t-border-hi overflow-y-auto preview-prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {formData.caseStudyBody || '*Nothing written yet.*'}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
