import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Boxes, Globe2, Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { describeApiError } from '../../lib/apiErrors';
import { ConfirmDialog } from '../../components/admin/ui/Modal';

const ALL = { enabled: true, mode: 'all' };
const EVERYTHING = {
  profile: { enabled: true }, resume: { enabled: true }, socials: ALL, skills: ALL, projects: ALL,
  experience: ALL, education: ALL, certifications: ALL, fs: { enabled: false },
};

// Exact payloads. `fields` and `ids` are omitted so the server falls back to DEFAULT_FIELDS,
// which withholds email, phone, teammates, lastUpdated and driveUrl.
export const PRESETS = [
  { id: 'everything', label: 'Everything published', hint: 'Profile, résumé, links, skills, projects, experience, education and certifications. The usual choice for a portfolio site.', include: EVERYTHING },
  { id: 'resume', label: 'Résumé page', hint: 'Profile, résumé link, experience, education, skills and certifications. No projects or links.', include: { profile: { enabled: true }, resume: { enabled: true }, experience: ALL, education: ALL, skills: ALL, certifications: ALL } },
  { id: 'terminal', label: 'Terminal / file tree', hint: 'Everything published, plus /v1/fs: your content as a browsable file tree for terminal-style sites.', include: { ...EVERYTHING, fs: { enabled: true } } },
  { id: 'empty', label: 'Start empty', hint: 'Turn sections on one by one in the App’s settings.', include: {}, warning: '0 sections enabled: every request returns 403 until you turn one on.' },
];

export const TYPE_OPTIONS = [
  { id: 'protected', label: 'Build or server (recommended)', hint: 'Secret key (sk_), never shipped to a browser. 600 requests/min.' },
  { id: 'static', label: 'Visitors’ browsers', hint: 'Publishable key (pk_), checked against the origins you allow. 120 requests/min per visitor, shared by everyone on your site.' },
];

export const typeLabel = (type) => (type === 'static' ? 'Visitors’ browsers' : 'Build or server');

const enabledCount = (app) => Object.values(app.include || {}).filter((value) => value?.enabled).length;

function ErrorLine({ error }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded border border-t-danger/40 bg-t-danger-dim p-3 text-sm text-t-danger">
      {error.message}{error.fix && <> <Link to={error.fix.to} className="font-medium underline underline-offset-4">{error.fix.label}</Link></>}
    </p>
  );
}

export default function AppsPage() {
  const navigate = useNavigate();
  const [apps, setApps] = useState([]);
  const [name, setName] = useState('');
  const [preset, setPreset] = useState('everything');
  const [type, setType] = useState('protected');
  const [origin, setOrigin] = useState('');
  const [anyOrigin, setAnyOrigin] = useState(false);
  const [error, setError] = useState(null);
  const [listError, setListError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true); setListError(null);
    try { const { data } = await api.get('/apps'); setApps(Array.isArray(data) ? data : []); }
    catch (err) { setListError(describeApiError(err, { fallback: 'Could not load your Apps.' })); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const chosen = useMemo(() => PRESETS.find((item) => item.id === preset) || PRESETS[0], [preset]);

  async function createApp(event) {
    event.preventDefault();
    setError(null);
    // A browser App needs either listed origins or the explicit "any website" opt-in; the server
    // refuses an empty list.
    const listed = origin.split(/[\s,]+/).filter(Boolean);
    if (type === 'static' && !anyOrigin && listed.length === 0) {
      setError({ message: 'Add at least one origin, such as https://example.com, or tick “Any website (*)”.', fix: null });
      document.getElementById('app-origins')?.focus();
      return;
    }
    setBusy(true);
    const allowedOrigins = type !== 'static' ? [] : anyOrigin ? ['*'] : listed;
    try {
      const { data } = await api.post('/apps', { name: name.trim(), type, allowedOrigins, include: chosen.include });
      navigate(`/dashboard/apps/${data._id}`, { state: { justCreated: true } });
    } catch (err) {
      setError(describeApiError(err, { fallback: 'Could not create the App.' }));
      setBusy(false);
    }
  }

  async function removeApp(app) {
    setDeleting(true); setError(null);
    try { await api.delete(`/apps/${app._id}`); setPendingDelete(null); await load(); }
    catch (err) { setError(describeApiError(err, { appId: app._id, fallback: 'Could not delete the App.' })); }
    finally { setDeleting(false); }
  }

  const radioClass = (checked) => `flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${checked ? 'border-t-accent bg-t-accent/5' : 'border-t-border hover:border-t-border-hi'}`;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="border-b border-t-border pb-5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl text-t-text">Apps</h1>
          <span className="text-sm text-t-muted">{apps.length} of 10</span>
        </div>
        <p className="mt-2 max-w-prose text-sm text-t-muted">An App is a read-only view of your content with its own key. Each site you build gets one, and reads only the sections and fields you grant it.</p>
      </header>

      <form onSubmit={createApp} aria-labelledby="create-app-title" className="space-y-6 rounded-lg border border-t-border bg-t-surface p-5 sm:p-6">
        <div>
          <h2 id="create-app-title" className="text-base font-semibold text-t-text">Create an App</h2>
          <p className="mt-1 text-sm text-t-muted">You land in the App straight after, with the URL and a snippet ready.</p>
        </div>

        <div className="max-w-md">
          <label htmlFor="app-name" className="block text-sm font-medium text-t-text">Name</label>
          <input id="app-name" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. portfolio-site" autoComplete="off" spellCheck={false} aria-describedby="app-name-hint" className="mt-1 h-10 w-full rounded border border-t-border-hi bg-t-bg px-3 text-sm text-t-text outline-none focus:border-t-accent focus:ring-2 focus:ring-t-accent/20" />
          <p id="app-name-hint" className="mt-1 text-xs text-t-muted">Only you see it. Name it after the site or script that will fetch.</p>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-t-text">What will this App read?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {PRESETS.map((item) => (
              <label key={item.id} className={radioClass(preset === item.id)}>
                <input type="radio" name="preset" value={item.id} checked={preset === item.id} onChange={() => setPreset(item.id)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--theme-accent)]" />
                <span className="min-w-0"><span className="block text-sm font-medium text-t-text">{item.label}</span><span className="mt-0.5 block text-xs leading-5 text-t-muted">{item.hint}</span></span>
              </label>
            ))}
          </div>
          {chosen.warning && <p role="note" className="mt-2 rounded border border-t-warn/40 bg-t-warn/10 p-3 text-sm text-t-text">{chosen.warning}</p>}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-t-text">Where will you fetch from?</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {TYPE_OPTIONS.map((item) => (
              <label key={item.id} className={radioClass(type === item.id)}>
                <input type="radio" name="type" value={item.id} checked={type === item.id} onChange={() => setType(item.id)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--theme-accent)]" />
                <span className="min-w-0"><span className="block text-sm font-medium text-t-text">{item.label}</span><span className="mt-0.5 block text-xs leading-5 text-t-muted">{item.hint}</span></span>
              </label>
            ))}
          </div>
          {type === 'static' && (
            <div className="mt-3 max-w-xl">
              <label htmlFor="app-origins" className="block text-sm font-medium text-t-text">Allowed origins</label>
              <input id="app-origins" value={anyOrigin ? '' : origin} disabled={anyOrigin} required={!anyOrigin} onChange={(event) => setOrigin(event.target.value)} placeholder="https://example.com, https://www.example.com" autoComplete="off" spellCheck={false} aria-describedby="app-origins-hint" className="mt-1 h-10 w-full rounded border border-t-border-hi bg-t-bg px-3 text-sm text-t-text outline-none focus:border-t-accent focus:ring-2 focus:ring-t-accent/20 disabled:cursor-not-allowed disabled:opacity-60" />
              <p id="app-origins-hint" className="mt-1 text-xs leading-5 text-t-muted">The sites allowed to use this App’s key in a browser: scheme and host, no path. <code translate="no">http://localhost:5173</code> works in development. Browser keys are public; the list stops other websites, not scripts.</p>
              <label htmlFor="app-any-origin" className="mt-3 flex items-start gap-2.5 text-sm text-t-text">
                <input id="app-any-origin" type="checkbox" checked={anyOrigin} onChange={(event) => setAnyOrigin(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--theme-accent)]" />
                <span>Any website (<code translate="no">*</code>)</span>
              </label>
              {anyOrigin && <p role="note" className="mt-2 rounded border border-t-warn/40 bg-t-warn/10 p-3 text-sm text-t-text">Any website can use this App’s publishable key from a browser, and every visit counts against its limit. Prefer listing your site’s origins.</p>}
            </div>
          )}
        </fieldset>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ErrorLine error={error} />
          <button disabled={busy || apps.length >= 10} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded bg-t-accent px-4 text-sm font-semibold text-t-on-accent hover:bg-t-accent-br disabled:opacity-50 sm:ml-auto">
            <Plus size={15} aria-hidden="true" />{busy ? 'Creating…' : 'Create App'}
          </button>
        </div>
        {apps.length >= 10 && <p className="text-xs text-t-muted">You have 10 Apps, the most an account can hold. Delete one to create another.</p>}
      </form>

      <section aria-labelledby="apps-list-title">
        <h2 id="apps-list-title" className="text-base font-semibold text-t-text">Your Apps</h2>
        {loading && <p role="status" className="mt-3 text-sm text-t-muted">Loading Apps…</p>}
        {listError && (
          <div role="alert" className="mt-3 rounded border border-t-danger/40 bg-t-danger-dim p-4 text-sm text-t-danger">
            {listError.message} <button type="button" onClick={load} className="font-medium underline underline-offset-4">Retry</button>
          </div>
        )}
        {!loading && !listError && apps.length === 0 && (
          <div className="mt-3 rounded-lg border border-dashed border-t-border bg-t-surface p-10 text-center">
            <Boxes size={24} aria-hidden="true" className="mx-auto text-t-muted" />
            <p className="mt-3 text-sm font-semibold text-t-text">No Apps yet</p>
            <p className="mt-1 text-sm text-t-muted">Create one above. The default preset returns everything you’ve published.</p>
          </div>
        )}
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {apps.map((app) => (
            <article key={app._id} className="space-y-4 rounded-lg border border-t-border bg-t-surface p-5 transition-colors hover:border-t-accent/60">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-t-text">{app.name}</h3>
                  <p className="mt-1 text-sm text-t-muted">{typeLabel(app.type)} · {enabledCount(app)} {enabledCount(app) === 1 ? 'section' : 'sections'} enabled</p>
                  <p className="mt-1 text-xs text-t-dim">Created {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(app.createdAt))}</p>
                </div>
                <button type="button" onClick={() => setPendingDelete(app)} aria-label={`Delete ${app.name}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-t-danger hover:underline"><Trash2 size={13} aria-hidden="true" />Delete</button>
              </div>
              {app.type === 'static' && (
                <div className="flex items-start gap-2 text-xs text-t-muted"><Globe2 size={13} aria-hidden="true" className="mt-0.5 shrink-0" /><span className="break-all">{app.allowedOrigins?.includes('*') || !app.allowedOrigins?.length ? 'Any origin' : app.allowedOrigins.join(', ')}</span></div>
              )}
              <Link to={`/dashboard/apps/${app._id}`} className="inline-flex min-h-9 items-center gap-2 rounded border border-t-border-hi px-3 text-sm text-t-text transition-colors hover:border-t-accent hover:text-t-accent">Open App <ArrowRight size={13} aria-hidden="true" /></Link>
            </article>
          ))}
        </div>
      </section>

      {pendingDelete && (
        <ConfirmDialog
          title={`Delete ${pendingDelete.name}?`}
          consequence="Its keys stop working within a minute (browsers may keep a copy for up to 60 s): after that, every site or build that fetches with them gets 401. Your content is not touched."
          confirmLabel="Delete App"
          busy={deleting}
          onConfirm={() => removeApp(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
