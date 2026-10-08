import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';

export default function AppsPage() {
  const [apps, setApps] = useState([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('static');
  const [origin, setOrigin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () => api.get('/apps').then(({ data }) => setApps(data));
  useEffect(() => { refresh().catch((err) => setError(err.response?.data?.message || 'Could not load apps.')); }, []);

  async function createApp(event) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await api.post('/apps', { name, type, allowedOrigins: origin.split(/[\s,]+/).filter(Boolean), include: {} });
      setName(''); setOrigin(''); await refresh();
    } catch (err) { setError(err.response?.data?.details?.join(', ') || err.response?.data?.message || 'Could not create app.'); }
    finally { setBusy(false); }
  }

  async function removeApp(id) {
    if (!window.confirm('Delete this app?')) return;
    try { await api.delete(`/apps/${id}`); await refresh(); }
    catch (err) { setError(err.response?.data?.message || 'Could not delete app.'); }
  }

  return <div className="max-w-5xl mx-auto space-y-6">
    <header><p className="text-xs uppercase tracking-widest text-t-accent font-mono">Exposure settings</p><h1 className="text-3xl font-bold mt-2">Apps</h1><p className="opacity-70 mt-2">Create scoped views of your portfolio data for each website or integration.</p></header>
    <form onSubmit={createApp} className="p-5 rounded-xl border border-t-border bg-t-surface space-y-4">
      <h2 className="font-semibold">Create an app <span className="opacity-60 text-sm">({apps.length}/10)</span></h2>
      <div className="grid md:grid-cols-3 gap-3">
        <input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="App name" className="rounded-lg border border-t-border bg-t-bg px-3 py-2" />
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-lg border border-t-border bg-t-bg px-3 py-2"><option value="static">Static app</option><option value="protected">Protected app</option></select>
        <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="https://example.com (comma separated)" className="rounded-lg border border-t-border bg-t-bg px-3 py-2" />
      </div>
      <p className="text-xs opacity-60">Static apps require at least one HTTPS origin. Local HTTP origins are accepted in development.</p>
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <button disabled={busy || apps.length >= 10} className="rounded-lg px-4 py-2 bg-t-accent text-t-on-accent disabled:opacity-50">{busy ? 'Creating…' : 'Create app'}</button>
    </form>
    <section className="grid md:grid-cols-2 gap-4">
      {apps.map((app) => <article key={app._id} className="p-5 rounded-xl border border-t-border bg-t-surface flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold text-lg">{app.name}</h2><p className="text-sm opacity-60">{app.type} · {Object.values(app.include || {}).filter((value) => value?.enabled).length} sections enabled</p><p className="text-xs opacity-50 mt-1">Created {new Date(app.createdAt).toLocaleDateString()}</p></div><button onClick={() => removeApp(app._id)} className="text-sm text-red-500">Delete</button></div>
        <p className="text-xs opacity-60">{(app.allowedOrigins || []).join(', ') || 'No origins configured'}</p>
        <Link to={`/admin/apps/${app._id}`} className="self-start rounded-lg border border-t-border px-3 py-2 text-sm">Configure app →</Link>
      </article>)}
      {!apps.length && <p className="opacity-60">No apps yet.</p>}
    </section>
  </div>;
}
