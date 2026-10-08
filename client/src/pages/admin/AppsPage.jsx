import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Boxes, Globe2, Plus, Trash2 } from 'lucide-react';
import { api } from '../../api/client';

export default function AppsPage() {
  const [apps, setApps] = useState([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('static');
  const [origin, setOrigin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/apps')
      .then(({ data }) => { if (active) setApps(data); })
      .catch((err) => { if (active) setError(err.response?.data?.message || 'Could not load apps.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function refresh() {
    const { data } = await api.get('/apps');
    setApps(data);
  }

  async function createApp(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/apps', { name: name.trim(), type, allowedOrigins: origin.split(/[\s,]+/).filter(Boolean), include: {} });
      setName('');
      setOrigin('');
      await refresh();
    } catch (err) {
      setError(err.response?.data?.details?.join(', ') || err.response?.data?.message || 'Could not create app.');
    } finally { setBusy(false); }
  }

  async function removeApp(id) {
    if (!window.confirm('Delete this app?')) return;
    setDeletingId(id);
    setError('');
    try { await api.delete(`/apps/${id}`); await refresh(); }
    catch (err) { setError(err.response?.data?.message || 'Could not delete app.'); }
    finally { setDeletingId(''); }
  }

  return <div className="max-w-7xl mx-auto space-y-6">
    <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-t-border">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded bg-t-surface text-t-accent border border-t-border"><Boxes size={20} /></div>
          <h1 className="text-xl font-bold text-t-text tracking-tight">Apps &amp; Views</h1>
          <span className="px-2 py-0.5 rounded bg-t-surface-hi text-[11px] font-mono text-t-muted border border-t-border-hi">{apps.length} / 10</span>
        </div>
        <p className="text-xs text-t-muted mt-2">Create scoped portfolio views for your websites and integrations.</p>
      </div>
    </header>

    <form onSubmit={createApp} className="bg-t-surface border border-t-border rounded p-5 space-y-4">
      <div><h2 className="font-semibold text-sm">Create an app</h2><p className="text-xs text-t-muted mt-1">You can choose exactly which published content and fields each app exposes.</p></div>
      <div className="grid md:grid-cols-3 gap-3">
        <label className="block text-xs font-mono text-t-muted">App name
          <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Portfolio website" className="mt-1 w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:outline-none focus:border-t-accent" />
        </label>
        <label className="block text-xs font-mono text-t-muted">App type
          <select value={type} onChange={(event) => setType(event.target.value)} className="mt-1 w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:outline-none focus:border-t-accent"><option value="static">Static website</option><option value="protected">Protected app</option></select>
        </label>
        <label className="block text-xs font-mono text-t-muted">Allowed origins
          <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="https://example.com" className="mt-1 w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:outline-none focus:border-t-accent" />
        </label>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[11px] text-t-muted">Use HTTPS origins separated by commas. Static apps require an origin; HTTP localhost is allowed in development.</p>
        <button disabled={busy || apps.length >= 10} className="inline-flex shrink-0 items-center justify-center gap-2 px-3.5 py-2 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-xs disabled:opacity-50">
          <Plus size={14} />{busy ? 'Creating…' : 'Create app'}
        </button>
      </div>
      {error && <p role="alert" className="text-xs text-t-danger">{error}</p>}
    </form>

    <section aria-label="Your apps" className="grid md:grid-cols-2 gap-4">
      {loading && <p className="text-xs text-t-muted">Loading apps…</p>}
      {!loading && !apps.length && <div className="md:col-span-2 p-10 text-center rounded border border-dashed border-t-border bg-t-surface">
        <Boxes size={24} className="mx-auto text-t-muted" /><h2 className="mt-3 text-sm font-semibold">No apps created</h2><p className="mt-1 text-xs text-t-muted">Create an app above to start configuring a scoped view.</p>
      </div>}
      {apps.map((app) => <article key={app._id} className="p-5 rounded border border-t-border bg-t-surface hover:border-t-accent/60 transition-colors space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0"><h2 className="font-semibold text-sm text-t-text truncate">{app.name}</h2><p className="text-[11px] text-t-muted mt-1">{app.type === 'static' ? 'Static website' : 'Protected app'} · {Object.values(app.include || {}).filter((value) => value?.enabled).length} sections enabled</p><p className="text-[10px] text-t-dim mt-1">Created {new Date(app.createdAt).toLocaleDateString()}</p></div>
          <button type="button" disabled={deletingId === app._id} onClick={() => removeApp(app._id)} aria-label={`Delete ${app.name}`} className="inline-flex items-center gap-1.5 text-[11px] text-t-danger hover:opacity-80 disabled:opacity-50"><Trash2 size={13} />{deletingId === app._id ? 'Deleting…' : 'Delete'}</button>
        </div>
        <div className="flex items-start gap-2 text-[11px] text-t-muted"><Globe2 size={13} className="mt-0.5 shrink-0" /><span className="break-all">{(app.allowedOrigins || []).join(', ') || 'No allowed origins'}</span></div>
        <Link to={`/admin/apps/${app._id}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-t-border-hi text-xs text-t-text hover:border-t-accent hover:text-t-accent transition-colors">Configure view <ArrowRight size={13} /></Link>
      </article>)}
    </section>
  </div>;
}
