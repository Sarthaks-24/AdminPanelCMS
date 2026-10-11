import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Circle, Eye, FileJson2, FolderKanban, Globe2, Save, UserRound, BriefcaseBusiness, GraduationCap, Award, Share2, Cpu, KeyRound, Folder, FileText } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useApiBase } from '../../lib/apiBase';
import { describeApiError } from '../../lib/apiErrors';
import ConnectPanel from '../../components/admin/ConnectPanel';
import TokenManagerModal from './TokenManagerModal';
import { typeLabel } from './AppsPage';

const SECTIONS = {
  profile: { label: 'Profile', description: 'Name, headline, bio, location and contact fields.', icon: UserRound, fields: ['name', 'initials', 'headline', 'shortBio', 'aboutMarkdown', 'email', 'location.city', 'location.country', 'location.isRemoteAvailable', 'statusText', 'isAvailableForHire', 'terminalUser', 'terminalHost', 'bootGreeting', 'metrics'] },
  resume: { label: 'Résumé', description: 'The résumé link and its details.', icon: FileJson2, fields: ['resumeUrl', 'driveUrl', 'fileName', 'version', 'lastUpdated', 'summaryText'] },
  socials: { label: 'Links', description: 'Which of your links this App can read.', icon: Share2, fields: ['platform', 'label', 'url', 'username', 'icon', 'order', 'featured'] },
  skills: { label: 'Skills', description: 'Skills by selection, featured status or category.', icon: Cpu, fields: ['name', 'category', 'proficiency', 'yearsOfExperience', 'featured', 'order'] },
  projects: { label: 'Projects', description: 'Which projects, and which project fields, this App can read.', icon: FolderKanban, fields: ['title', 'slug', 'mode', 'role', 'shortDescription', 'keyMetric', 'highlights', 'caseStudyBody', 'stack', 'teammates', 'thumbnail', 'links.github', 'links.live', 'links.demo', 'order', 'featured', 'lastUpdated'] },
  experience: { label: 'Work experience', description: 'Selected roles and history.', icon: BriefcaseBusiness, fields: ['company', 'role', 'employmentType', 'period', 'startDate', 'endDate', 'isCurrent', 'location', 'companyUrl', 'description', 'achievements', 'technologies', 'order', 'featured'] },
  education: { label: 'Education', description: 'Education history and achievements.', icon: GraduationCap, fields: ['institution', 'degree', 'fieldOfStudy', 'period', 'startDate', 'endDate', 'grade', 'location', 'achievements', 'order', 'featured'] },
  certifications: { label: 'Certifications', description: 'Credentials and verification details.', icon: Award, fields: ['title', 'issuer', 'issueDate', 'expirationDate', 'credentialId', 'credentialUrl', 'skills', 'order', 'featured'] },
};
const ENDPOINTS = { socials: '/socials', skills: '/skills', projects: '/projects', experience: '/experience', education: '/education', certifications: '/certifications' };

// Mirrors server/lib/modelConstants.js DEFAULT_FIELDS: what the server serves when `fields` is empty.
// Opt-in only (never in the defaults): profile.email, resume.driveUrl, projects.teammates, projects.lastUpdated.
const OPT_IN = { profile: ['email'], resume: ['driveUrl'], projects: ['teammates', 'lastUpdated'] };
const DEFAULTS = Object.fromEntries(Object.entries(SECTIONS).map(([key, section]) => [key, section.fields.filter((field) => !(OPT_IN[key] || []).includes(field))]));

function moveId(ids, index, offset) {
  const target = index + offset;
  if (target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function Switch({ checked, onChange, label }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? 'bg-t-accent' : 'border border-t-border-hi bg-t-surface-hi'}`}>
    <span className={`inline-block h-4 w-4 transform rounded-full shadow transition-transform ${checked ? 'translate-x-6 bg-t-on-accent' : 'translate-x-1 bg-t-muted'}`} />
  </button>;
}

const inputClass = 'mt-1 block h-10 w-full rounded border border-t-border-hi bg-t-bg px-3 text-sm text-t-text outline-none transition focus:border-t-accent focus:ring-2 focus:ring-t-accent/20 disabled:cursor-not-allowed disabled:opacity-60';

function FieldGroup({ sectionKey, fields, chosen, optIn, onToggle }) {
  const groups = fields.reduce((result, field) => {
    const parent = field.split('.')[0];
    (result[parent] ||= []).push(field);
    return result;
  }, {});
  return <div className="space-y-4">{Object.entries(groups).map(([parent, paths]) => (
    <fieldset key={parent} className="rounded-lg border border-t-border p-4">
      <legend className="px-1.5 text-xs font-semibold text-t-muted">{parent}</legend>
      <div className="grid gap-1 sm:grid-cols-2">{paths.map((path) => {
        const id = `${sectionKey}-field-${path.replace(/\W/g, '-')}`;
        return <label key={path} htmlFor={id} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-sm text-t-text hover:bg-t-surface-hi">
          <input id={id} type="checkbox" checked={chosen.includes(path)} onChange={() => onToggle(path)} className="h-4 w-4 accent-[var(--theme-accent)]" />
          <span>{path.includes('.') ? path.slice(parent.length + 1) : path}{optIn.includes(path) && <span className="ml-2 text-xs text-t-muted">opt-in</span>}</span>
        </label>;
      })}</div>
    </fieldset>
  ))}</div>;
}

function FsTree({ node, depth = 0 }) {
  if (!node) return null;
  const isDir = node.type === 'directory';
  return (
    <li>
      <div className="flex items-center gap-2 py-0.5 text-sm" style={{ paddingLeft: depth * 16 }}>
        {isDir ? <Folder size={14} aria-hidden="true" className="shrink-0 text-t-accent" /> : <FileText size={14} aria-hidden="true" className="shrink-0 text-t-muted" />}
        <code translate="no" className="text-t-text">{node.name}{isDir && node.name !== '/' ? '/' : ''}</code>
        {!isDir && <span className="text-xs text-t-dim">{node.targetUrl ? 'link' : node.mimeType}{typeof node.size === 'number' ? ` · ${node.size} B` : ''}</span>}
      </div>
      {isDir && node.children?.length > 0 && <ul>{node.children.map((child) => <FsTree key={child.path} node={child} depth={depth + 1} />)}</ul>}
      {isDir && node.children?.length === 0 && <p className="text-xs text-t-dim" style={{ paddingLeft: (depth + 1) * 16 }}>empty</p>}
    </li>
  );
}

export default function AppEditorPage() {
  const { id } = useParams();
  const location = useLocation();
  const { v1Base } = useApiBase();
  const [app, setApp] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [records, setRecords] = useState({});
  const [recordErrors, setRecordErrors] = useState({});
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [categories, setCategories] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [activeTokens, setActiveTokens] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [activeSection, setActiveSection] = useState('profile');
  const [fieldsMode, setFieldsMode] = useState({});
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTokens, setShowTokens] = useState(false);
  const settingsRef = useRef(null);
  const sectionsRef = useRef(null);
  const connectRef = useRef(null);

  const loadApp = useCallback(async () => {
    setLoadError(null);
    try {
      const { data } = await api.get(`/apps/${id}`);
      setApp(data);
      setFieldsMode(Object.fromEntries(Object.keys(SECTIONS).map((key) => [key, data.include?.[key]?.fields?.length ? 'custom' : 'default'])));
    } catch (err) { setLoadError(describeApiError(err, { fallback: 'Could not load this App.' })); }
  }, [id]);

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    const entries = await Promise.all(Object.entries(ENDPOINTS).map(async ([section, path]) => {
      try {
        const { data } = await api.get(path);
        return [section, Array.isArray(data) ? data : data.skills || data.items || [], null];
      } catch (err) { return [section, [], describeApiError(err, { fallback: `Could not load ${section}.` })]; }
    }));
    setRecords(Object.fromEntries(entries.map(([section, list]) => [section, list])));
    setRecordErrors(Object.fromEntries(entries.filter(([, , err]) => err).map(([section, , err]) => [section, err])));
    setLoadingRecords(false);
  }, []);

  const loadTokens = useCallback(async () => {
    try {
      const { data } = await api.get(`/apps/${id}/tokens`);
      const list = Array.isArray(data) ? data : [];
      const now = Date.now();
      setTokens(list);
      setActiveTokens(list.filter((token) => !token.revokedAt && (!token.expiresAt || new Date(token.expiresAt).getTime() > now)));
    } catch { setTokens([]); setActiveTokens([]); }
  }, [id]);

  const loadCategories = useCallback(async () => {
    try { const { data } = await api.get('/skills/categories'); setCategories(Array.isArray(data?.categories) ? data.categories : []); }
    catch { setCategories([]); }
  }, []);

  useEffect(() => { loadApp(); loadRecords(); loadTokens(); loadCategories(); }, [loadApp, loadRecords, loadTokens, loadCategories]);

  // Arriving from "Create App": the connect panel is the thing to look at.
  useEffect(() => {
    if (app && location.state?.justCreated) connectRef.current?.scrollIntoView({ block: 'start' });
  }, [app, location.state]);

  const typeLocked = activeTokens.length > 0;
  const config = app?.include?.[activeSection] || {};
  const section = SECTIONS[activeSection];
  const recordName = (item) => item.title || item.name || item.company || item.institution || item.platform || String(item._id).slice(-6);
  const skillCategories = useMemo(() => {
    const fromRecords = (records.skills || []).map((skill) => skill.category).filter(Boolean);
    const fromConfig = app?.include?.skills?.categories || [];
    return Array.from(new Set([...categories, ...fromRecords, ...fromConfig])).sort((a, b) => a.localeCompare(b));
  }, [categories, records.skills, app]);

  function changeApp(patch) {
    setApp((current) => ({ ...current, ...patch }));
    setSaved(false);
    setPreview(null);
  }
  function updateSection(key, patch) {
    setApp((current) => ({ ...current, include: { ...current.include, [key]: { ...(current.include?.[key] || {}), ...patch } } }));
    setSaved(false);
    setPreview(null);
  }
  function setMode(mode) {
    setFieldsMode((current) => ({ ...current, [activeSection]: mode }));
    updateSection(activeSection, { fields: mode === 'custom' ? [...DEFAULTS[activeSection]] : [] });
  }
  function toggleField(field) {
    const fields = config.fields || [];
    updateSection(activeSection, { fields: fields.includes(field) ? fields.filter((value) => value !== field) : [...fields, field] });
  }
  async function save() {
    if (saved) return;
    setSaving(true);
    setError(null);
    try {
      const { data } = await api.put(`/apps/${id}`, { name: app.name, type: app.type, allowedOrigins: app.allowedOrigins, include: app.include });
      setApp(data);
      setSaved(true);
    } catch (err) { setError(describeApiError(err, { appId: id, fallback: 'Could not save changes.' })); }
    finally { setSaving(false); }
  }
  async function loadPreview() {
    setPreviewError(null);
    if (!saved) { setPreview(null); setPreviewError({ message: 'Save your changes before loading the preview.', fix: null }); return; }
    try { const { data } = await api.get(`/apps/${id}/preview`); setPreview(data); }
    catch (err) { setPreviewError(describeApiError(err, { appId: id, fallback: 'Could not load the preview.' })); }
  }
  function openPreview() { setActiveSection('preview'); loadPreview(); }
  function onFix(target) {
    if (target === 'keys') { setShowTokens(true); return; }
    if (target === 'settings') { settingsRef.current?.scrollIntoView({ block: 'start' }); settingsRef.current?.querySelector('input')?.focus(); return; }
    const firstOff = Object.keys(SECTIONS).find((key) => !app?.include?.[key]?.enabled) || 'profile';
    setActiveSection(firstOff);
    sectionsRef.current?.scrollIntoView({ block: 'start' });
  }

  if (loadError) {
    return <div className="mx-auto max-w-7xl">
      <Link to="/admin/apps" className="inline-flex items-center gap-2 text-sm text-t-muted hover:text-t-accent"><ArrowLeft size={14} aria-hidden="true" />All Apps</Link>
      <div role="alert" className="mt-6 rounded border border-t-danger/40 bg-t-danger-dim p-4 text-sm text-t-danger">
        {loadError.message} <button type="button" onClick={loadApp} className="font-medium underline underline-offset-4">Retry</button>
        {loadError.fix && <> <Link to={loadError.fix.to} className="font-medium underline underline-offset-4">{loadError.fix.label}</Link></>}
      </div>
    </div>;
  }
  if (!app) {
    return <div className="mx-auto max-w-7xl"><Link to="/admin/apps" className="inline-flex items-center gap-2 text-sm text-t-muted hover:text-t-accent"><ArrowLeft size={14} aria-hidden="true" />All Apps</Link><p role="status" className="mt-6 text-sm text-t-muted">Loading App…</p></div>;
  }

  const navButton = (key, label, Icon, enabled, extra = '') => {
    const active = activeSection === key;
    return <button key={key} type="button" onClick={() => setActiveSection(key)} aria-current={active ? 'true' : undefined} className={`flex shrink-0 items-center gap-2.5 rounded px-3 py-2.5 text-left text-sm transition lg:w-full ${active ? 'bg-t-accent text-t-on-accent' : 'text-t-muted hover:bg-t-surface-hi hover:text-t-text'} ${extra}`}>
      <Icon size={15} aria-hidden="true" /><span className="flex-1 whitespace-nowrap">{label}</span>{enabled === undefined ? null : enabled ? <Check size={13} aria-label="on" /> : <Circle size={11} aria-label="off" className="opacity-40" />}
    </button>;
  };

  const chosenFields = fieldsMode[activeSection] === 'custom' ? (config.fields || []) : DEFAULTS[activeSection] || [];

  return <div className="mx-auto max-w-7xl space-y-6 pb-12">
    <header className="flex flex-col gap-4 border-b border-t-border pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <Link to="/admin/apps" className="inline-flex items-center gap-1.5 text-sm text-t-muted hover:text-t-accent"><ArrowLeft size={13} aria-hidden="true" />All Apps</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <h1 className="truncate text-2xl font-bold tracking-tight text-t-text">{app.name}</h1>
          <span className="rounded-full border border-t-border-hi bg-t-surface px-2.5 py-1 text-xs text-t-muted">{typeLabel(app.type)}</span>
          <span aria-live="polite" className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${saved ? 'bg-t-accent2-dim text-t-accent2' : 'bg-t-warn/10 text-t-warn'}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{saved ? 'Saved' : 'Unsaved changes'}</span>
        </div>
        <p className="mt-1.5 max-w-2xl text-sm text-t-muted">What this App can read. Changes take effect after saving; responses are cached for about a minute.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setShowTokens(true)} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded border border-t-border-hi px-4 text-sm font-semibold text-t-text hover:border-t-accent hover:text-t-accent"><KeyRound size={14} aria-hidden="true" />Keys{activeTokens.length ? ` (${activeTokens.length})` : ''}</button>
        <button type="button" onClick={save} disabled={saving || saved} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded bg-t-accent px-4 text-sm font-semibold text-t-on-accent shadow-sm transition hover:bg-t-accent-br disabled:cursor-not-allowed disabled:opacity-60"><Save size={14} aria-hidden="true" />{saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}</button>
      </div>
    </header>

    {error && <div role="alert" className="rounded border border-t-danger/40 bg-t-danger-dim px-4 py-3 text-sm text-t-danger">{error.message}{error.fix && <> <Link to={error.fix.to} className="font-medium underline underline-offset-4">{error.fix.label}</Link></>}</div>}
    {showTokens && <TokenManagerModal app={app} v1Base={v1Base} onClose={() => { setShowTokens(false); loadTokens(); }} onChange={loadTokens} />}

    <div ref={connectRef} tabIndex={-1} className="scroll-mt-24 outline-none">
      <ConnectPanel app={app} v1Base={v1Base} tokens={tokens} onOpenKeys={() => setShowTokens(true)} onFix={onFix} />
    </div>

    <section ref={settingsRef} aria-labelledby="app-settings-title" className="scroll-mt-24 rounded-lg border border-t-border bg-t-surface p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2"><Globe2 size={15} aria-hidden="true" className="text-t-accent" /><h2 id="app-settings-title" className="text-sm font-semibold text-t-text">App settings</h2></div>
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label htmlFor="app-edit-name" className="block text-sm font-medium text-t-text">Name</label>
          <input id="app-edit-name" maxLength={80} value={app.name} onChange={(event) => changeApp({ name: event.target.value })} autoComplete="off" className={inputClass} />
        </div>
        <div>
          <label htmlFor="app-edit-type" className="block text-sm font-medium text-t-text">Where it fetches from</label>
          <select id="app-edit-type" value={app.type} disabled={typeLocked} aria-describedby="app-edit-type-hint" onChange={(event) => changeApp({ type: event.target.value })} className={inputClass}>
            <option value="protected">Build or server (recommended)</option>
            <option value="static">Visitors’ browsers</option>
          </select>
          <p id="app-edit-type-hint" className="mt-1 text-xs text-t-muted">{typeLocked ? 'Revoke this App’s keys to change where it fetches from.' : app.type === 'static' ? 'Publishable keys (pk_), origin-checked.' : 'Secret keys (sk_), never in a browser.'}</p>
        </div>
        <div>
          <label htmlFor="app-edit-origins" className="block text-sm font-medium text-t-text">Allowed origins</label>
          <input id="app-edit-origins" value={(app.allowedOrigins || []).join(', ')} disabled={app.type !== 'static'} onChange={(event) => changeApp({ allowedOrigins: event.target.value.split(/[\s,]+/).filter(Boolean) })} placeholder="https://example.com" autoComplete="off" spellCheck={false} aria-describedby="app-edit-origins-hint" className={inputClass} />
          <p id="app-edit-origins-hint" className="mt-1 text-xs text-t-muted">{app.type === 'static' ? 'Exact https origins, or * for any. The list stops other sites using the key in a browser; it doesn’t stop scripts.' : 'Only Visitors’ browsers Apps check origins.'}</p>
        </div>
      </div>
    </section>

    <div ref={sectionsRef} className="grid scroll-mt-24 items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
      <nav aria-label="App sections" className="flex gap-1 overflow-x-auto rounded-lg border border-t-border bg-t-surface p-2 lg:sticky lg:top-24 lg:block lg:space-y-1 lg:overflow-visible">
        <p className="hidden px-2 pb-2 pt-1 text-xs font-medium text-t-dim lg:block">Sections</p>
        {Object.entries(SECTIONS).map(([key, item]) => navButton(key, item.label, item.icon, Boolean(app.include?.[key]?.enabled)))}
        {navButton('filesystem', 'File tree', FileJson2, Boolean(app.include?.fs?.enabled))}
        <div className="hidden border-t border-t-border pt-1 lg:block">
          <button type="button" onClick={openPreview} aria-current={activeSection === 'preview' ? 'true' : undefined} className={`flex w-full items-center gap-2.5 rounded px-3 py-2.5 text-left text-sm transition ${activeSection === 'preview' ? 'bg-t-accent text-t-on-accent' : 'text-t-muted hover:bg-t-surface-hi hover:text-t-text'}`}><Eye size={15} aria-hidden="true" /><span className="flex-1">Preview</span><ArrowRight size={13} aria-hidden="true" /></button>
        </div>
        <button type="button" onClick={openPreview} aria-current={activeSection === 'preview' ? 'true' : undefined} className={`flex shrink-0 items-center gap-2.5 rounded px-3 py-2.5 text-left text-sm transition lg:hidden ${activeSection === 'preview' ? 'bg-t-accent text-t-on-accent' : 'text-t-muted hover:bg-t-surface-hi hover:text-t-text'}`}><Eye size={15} aria-hidden="true" /><span className="whitespace-nowrap">Preview</span></button>
      </nav>

      <section aria-label="Selected section settings" className="min-w-0 space-y-4">
        {section && (
          <section className="rounded-lg border border-t-border bg-t-surface">
            <div className="flex flex-col gap-4 border-b border-t-border p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded bg-t-accent/10 text-t-accent"><section.icon size={19} aria-hidden="true" /></span><div><h2 className="text-base font-semibold text-t-text">{section.label}</h2><p className="mt-1 text-sm leading-relaxed text-t-muted">{section.description}</p></div></div>
              <div className="flex items-center justify-between gap-3 rounded border border-t-border px-3 py-2 sm:justify-start"><span className="text-sm font-medium text-t-text">Serve {section.label.toLowerCase()}</span><Switch checked={Boolean(config.enabled)} onChange={(enabled) => updateSection(activeSection, { enabled })} label={`Serve ${section.label.toLowerCase()}`} /></div>
            </div>
            {!config.enabled && <p className="border-b border-t-border bg-t-bg/40 px-5 py-2.5 text-sm text-t-muted">Off: <code translate="no">GET {v1Base}/{activeSection}</code> answers 403 section_disabled.</p>}
            <div className="space-y-6 p-5">
              {!['profile', 'resume'].includes(activeSection) && <>
                <div>
                  <label htmlFor={`${activeSection}-mode`} className="block text-sm font-medium text-t-text">Which items</label>
                  <select id={`${activeSection}-mode`} value={config.mode || 'all'} onChange={(event) => updateSection(activeSection, { mode: event.target.value })} className="mt-1 h-10 w-full max-w-md rounded border border-t-border-hi bg-t-bg px-3 text-sm text-t-text outline-none focus:border-t-accent"><option value="all">All published items</option><option value="featured">Featured items only</option><option value="selected">Chosen items, in the order below</option></select>
                </div>
                {config.mode === 'selected' && (
                  <div className="rounded border border-t-border bg-t-bg p-3 sm:p-4">
                    <div className="mb-3 flex items-center justify-between"><div><h3 className="text-sm font-semibold text-t-text">Choose items</h3><p className="mt-1 text-xs text-t-muted">Drafts are listed but never served. Use the arrows to set their order in the response.</p></div><span className="rounded-full bg-t-surface-hi px-2 py-1 text-xs text-t-muted">{config.ids?.length || 0} chosen</span></div>
                    {recordErrors[activeSection] && <p role="alert" className="mb-3 rounded border border-t-danger/40 bg-t-danger-dim p-3 text-sm text-t-danger">{recordErrors[activeSection].message} <button type="button" onClick={loadRecords} className="font-medium underline underline-offset-4">Retry</button></p>}
                    {loadingRecords ? <p role="status" className="py-4 text-center text-sm text-t-muted">Loading items…</p> : <div className="max-h-72 divide-y divide-t-border overflow-y-auto">{(records[activeSection] || []).map((record) => {
                      const ids = (config.ids || []).map(String);
                      const recordId = String(record._id);
                      const index = ids.indexOf(recordId);
                      const draft = record.visibility !== 'published';
                      return <div key={recordId} className="flex items-center gap-3 py-2.5">
                        <input id={`${activeSection}-${recordId}`} type="checkbox" checked={index !== -1} onChange={() => updateSection(activeSection, { ids: index !== -1 ? ids.filter((value) => value !== recordId) : [...ids, recordId] })} className="h-4 w-4 accent-[var(--theme-accent)]" />
                        <label htmlFor={`${activeSection}-${recordId}`} className="min-w-0 flex-1 cursor-pointer truncate text-sm text-t-text">{recordName(record)}{draft && <span className="ml-2 rounded bg-t-warn/10 px-1.5 py-0.5 text-xs text-t-warn">Draft · not served</span>}</label>
                        {index !== -1 && <span className="text-xs text-t-dim">{index + 1}</span>}
                        {index !== -1 && <div className="flex"><button type="button" aria-label={`Move ${recordName(record)} up`} disabled={index === 0} onClick={() => updateSection(activeSection, { ids: moveId(ids, index, -1) })} className="rounded p-1 text-t-muted hover:bg-t-surface-hi hover:text-t-text disabled:opacity-30"><ArrowUp size={14} aria-hidden="true" /></button><button type="button" aria-label={`Move ${recordName(record)} down`} disabled={index === ids.length - 1} onClick={() => updateSection(activeSection, { ids: moveId(ids, index, 1) })} className="rounded p-1 text-t-muted hover:bg-t-surface-hi hover:text-t-text disabled:opacity-30"><ArrowDown size={14} aria-hidden="true" /></button></div>}
                      </div>;
                    })}{!loadingRecords && !recordErrors[activeSection] && !records[activeSection]?.length && <p className="py-5 text-center text-sm text-t-muted">Nothing in this section yet. <Link to={`/admin/${activeSection}`} className="font-medium text-t-accent underline underline-offset-4">Add some</Link></p>}</div>}
                  </div>
                )}
                {activeSection === 'skills' && (
                  <fieldset className="rounded border border-t-border p-4">
                    <legend className="px-1.5 text-xs font-semibold text-t-muted">Skill categories</legend>
                    <p className="mb-3 text-xs text-t-muted">Leave every category unticked to serve all of them. Categories come from your skills.</p>
                    {skillCategories.length === 0 ? <p className="text-sm text-t-muted">No categories yet. <Link to="/admin/skills" className="font-medium text-t-accent underline underline-offset-4">Add skills</Link> and they appear here.</p> : (
                      <div className="grid gap-1 sm:grid-cols-2">{skillCategories.map((category) => <label key={category} className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded px-2 text-sm text-t-text hover:bg-t-surface-hi"><input type="checkbox" checked={(config.categories || []).includes(category)} onChange={() => { const current = config.categories || []; updateSection(activeSection, { categories: current.includes(category) ? current.filter((value) => value !== category) : [...current, category] }); }} className="h-4 w-4 accent-[var(--theme-accent)]" />{category}</label>)}</div>
                    )}
                  </fieldset>
                )}
              </>}
              <div>
                <fieldset>
                  <legend className="text-sm font-semibold text-t-text">Fields</legend>
                  <p className="mt-1 text-xs text-t-muted">Private fields (phone, timestamps) are never served. Opt-in fields are served only when you choose them.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[['default', 'Default fields', 'The safe set: everything except opt-in fields.'], ['custom', 'Choose fields', 'Tick exactly what this App may read.']].map(([mode, label, hint]) => (
                      <label key={mode} className={`flex cursor-pointer gap-2.5 rounded-lg border px-3 py-2 ${fieldsMode[activeSection] === mode ? 'border-t-accent bg-t-accent/5' : 'border-t-border hover:border-t-border-hi'}`}>
                        <input type="radio" name={`${activeSection}-fields-mode`} value={mode} checked={fieldsMode[activeSection] === mode} onChange={() => setMode(mode)} className="mt-1 h-4 w-4 accent-[var(--theme-accent)]" />
                        <span><span className="block text-sm font-medium text-t-text">{label}</span><span className="block text-xs text-t-muted">{hint}</span></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="mt-4">
                  {fieldsMode[activeSection] === 'custom' && (config.fields || []).length === 0 && <p role="note" className="mb-3 rounded border border-t-warn/40 bg-t-warn/10 p-3 text-sm text-t-text">No fields ticked. The server serves the default set in that case, so tick at least one or switch back to Default fields.</p>}
                  <div className={fieldsMode[activeSection] === 'custom' ? '' : 'pointer-events-none opacity-70'} aria-disabled={fieldsMode[activeSection] !== 'custom'}>
                    <FieldGroup sectionKey={activeSection} fields={section.fields} chosen={chosenFields} optIn={OPT_IN[activeSection] || []} onToggle={toggleField} />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-t-border bg-t-bg/40 px-5 py-3"><span className="text-xs text-t-muted">{fieldsMode[activeSection] === 'custom' ? `${(config.fields || []).length} of ${section.fields.length} fields chosen` : `Default fields (${DEFAULTS[activeSection].length} of ${section.fields.length})`}</span><button type="button" onClick={openPreview} className="inline-flex items-center gap-1.5 text-sm font-medium text-t-accent hover:text-t-accent-br">Preview the response <ArrowRight size={13} aria-hidden="true" /></button></div>
          </section>
        )}

        {activeSection === 'filesystem' && (
          <section className="overflow-hidden rounded-lg border border-t-border bg-t-surface">
            <div className="border-b border-t-border p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded bg-t-accent/10 text-t-accent"><FileJson2 size={19} aria-hidden="true" /></span><div><h2 className="text-base font-semibold text-t-text">File tree</h2><p className="mt-1 text-sm text-t-muted"><code translate="no">GET {v1Base}/fs</code> returns the sections above as a browsable tree, for terminal-style sites.</p></div></div></div>
            <div className="p-5">
              <div className="flex items-center justify-between rounded border border-t-border bg-t-bg p-4"><div><h3 className="text-sm font-semibold text-t-text">Serve the file tree</h3><p className="mt-1 text-xs text-t-muted">Built only from the sections this App serves.</p></div><Switch checked={Boolean(app.include?.fs?.enabled)} onChange={(enabled) => { setApp((current) => ({ ...current, include: { ...current.include, fs: { enabled } } })); setSaved(false); setPreview(null); }} label="Serve the file tree" /></div>
              <div className="mt-5 rounded border border-t-border bg-t-bg p-4">
                {preview?.fs ? <ul aria-label="File tree"><FsTree node={preview.fs} /></ul> : (
                  <p className="text-sm text-t-muted">
                    {!app.include?.fs?.enabled ? 'Turn the tree on and save to see the real paths.' : !saved ? 'Save your changes, then load the preview to see the real tree.' : <>The tree is built from your saved sections. <button type="button" onClick={loadPreview} className="font-medium text-t-accent underline underline-offset-4">Load it</button></>}
                  </p>
                )}
                {previewError && activeSection === 'filesystem' && <p role="alert" className="mt-3 text-sm text-t-danger">{previewError.message}</p>}
              </div>
            </div>
          </section>
        )}

        {activeSection === 'preview' && (
          <section className="overflow-hidden rounded-lg border border-t-border bg-t-surface">
            <div className="flex flex-col gap-3 border-b border-t-border p-5 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Eye size={16} aria-hidden="true" className="text-t-accent" /><h2 className="text-base font-semibold text-t-text">Preview</h2></div><p className="mt-1 text-sm text-t-muted">The exact data this App serves, section by section, from the saved configuration.</p></div><button type="button" onClick={loadPreview} disabled={!saved} className="inline-flex h-9 items-center justify-center gap-2 rounded border border-t-border-hi px-3 text-sm text-t-text transition hover:border-t-accent hover:text-t-accent disabled:cursor-not-allowed disabled:opacity-40"><Eye size={13} aria-hidden="true" />Refresh preview</button></div>
            <div className="p-4 sm:p-5">
              {previewError && <p role="alert" className="mb-3 rounded border border-t-danger/40 bg-t-danger-dim p-3 text-sm text-t-danger">{previewError.message} {saved && <button type="button" onClick={loadPreview} className="font-medium underline underline-offset-4">Retry</button>}</p>}
              {!preview ? <div className="grid min-h-48 place-items-center rounded border border-dashed border-t-border bg-t-bg p-6 text-center"><p className="text-sm text-t-muted">{saved ? 'Refresh to load the saved configuration.' : 'Save your changes first.'}</p></div> : <pre className="max-h-[65vh] overflow-auto rounded border border-t-border bg-t-code p-4 text-xs leading-relaxed text-t-text"><code translate="no">{JSON.stringify(preview, null, 2)}</code></pre>}
            </div>
          </section>
        )}
      </section>
    </div>
  </div>;
}
