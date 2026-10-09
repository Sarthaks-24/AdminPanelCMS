import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, KeyRound, Plus, ShieldAlert, X } from 'lucide-react';
import { api } from '../../api/client';

export default function TokenManagerModal({ app, onClose }) {
  const [tokens, setTokens] = useState([]);
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [created, setCreated] = useState(null);
  const [savedSecret, setSavedSecret] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [now, setNow] = useState(Date.now);
  const [copiedValue, setCopiedValue] = useState('');
  const activeCount = useMemo(() => tokens.filter((token) => !token.revokedAt && (!token.expiresAt || new Date(token.expiresAt).getTime() > now)).length, [tokens, now]);

  const refresh = useCallback(async () => {
    const { data } = await api.get(`/apps/${app._id}/tokens`);
    setTokens(data);
    setLoadingTokens(false);
  }, [app._id]);

  useEffect(() => {
    refresh().catch(() => { setError('Could not load API tokens.'); setLoadingTokens(false); });
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function createToken(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const { data } = await api.post(`/apps/${app._id}/tokens`, { label, expiresInDays: expiresInDays || undefined });
      setCreated(data); setSavedSecret(false); setLabel(''); await refresh();
    } catch (err) { setError(err.response?.data?.message || err.response?.data?.error || 'Could not create token.'); }
    finally { setBusy(false); }
  }
  async function revoke(token) {
    if (!window.confirm(`Revoke ${token.prefix}? Existing integrations will stop working.`)) return;
    try { await api.delete(`/apps/${app._id}/tokens/${token._id}`); await refresh(); }
    catch (err) { setError(err.response?.data?.message || 'Could not revoke token.'); }
  }
  async function copy(value) {
    try { await navigator.clipboard.writeText(value); setCopiedValue(value); window.setTimeout(() => setCopiedValue(''), 1800); }
    catch { setError('Clipboard access failed. Select and copy the token manually.'); }
  }
  function close() {
    if (created?.type === 'sk' && !savedSecret) return;
    onClose();
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-t-bg/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="token-manager-title">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded border border-t-border-hi bg-t-surface shadow-2xl">
      <header className="flex items-center justify-between border-b border-t-border p-5"><div className="flex items-center gap-3"><KeyRound size={18} className="text-t-accent" /><div><h2 id="token-manager-title" className="text-sm font-semibold">API tokens</h2><p className="mt-1 text-[11px] text-t-muted">{app.name} · {activeCount}/2 active</p></div></div><button type="button" onClick={close} aria-label="Close token manager" className="rounded p-2 text-t-muted hover:bg-t-surface-hi"><X size={16} /></button></header>
      <div className="space-y-5 p-5">
        {error && <p role="alert" className="rounded border border-t-danger/40 bg-t-danger-dim p-3 text-xs text-t-danger">{error}</p>}
        {created && <section className="space-y-3 rounded border border-t-accent/40 bg-t-bg p-4"><div className="flex items-center gap-2 text-xs font-semibold text-t-accent"><Check size={15} />Token created</div><code className="block break-all rounded bg-black p-3 text-xs text-t-text">{created.token}</code><button type="button" onClick={() => copy(created.token)} className="inline-flex items-center gap-2 rounded border border-t-border-hi px-3 py-2 text-xs text-t-text hover:border-t-accent">{copiedValue === created.token ? <Check size={13} /> : <Copy size={13} />}{copiedValue === created.token ? 'Copied' : 'Copy token'}</button>{created.type === 'sk' && <><p className="flex gap-2 text-xs text-amber-300"><ShieldAlert size={15} className="shrink-0" />This secret will never be displayed again. Store it securely before closing.</p><label className="flex items-center gap-2 text-xs text-t-text"><input type="checkbox" checked={savedSecret} onChange={(event) => setSavedSecret(event.target.checked)} className="accent-[var(--theme-accent)]" />I have saved this secret key</label></>}</section>}
        <form onSubmit={createToken} className="grid gap-3 rounded border border-t-border bg-t-bg p-4 sm:grid-cols-[1fr_150px_auto]"><label className="text-[10px] font-mono uppercase text-t-muted">Label<input value={label} maxLength={60} onChange={(event) => setLabel(event.target.value)} placeholder="Production website" className="mt-1 h-9 w-full rounded border border-t-border-hi bg-t-surface px-3 text-xs normal-case text-t-text" /></label><label className="text-[10px] font-mono uppercase text-t-muted">Expires<select value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} className="mt-1 h-9 w-full rounded border border-t-border-hi bg-t-surface px-2 text-xs normal-case text-t-text"><option value="">Never</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">365 days</option></select></label><button disabled={busy || loadingTokens || activeCount >= 2} className="mt-auto inline-flex h-9 items-center justify-center gap-2 rounded bg-t-accent px-3 text-xs font-semibold text-t-on-accent disabled:opacity-50"><Plus size={13} />{busy ? 'Creating…' : loadingTokens ? 'Loading tokens…' : `Create ${app.type === 'static' ? 'publishable' : 'secret'} key`}</button><p className="text-[10px] text-t-muted sm:col-span-3">{app.type === 'static' ? 'Publishable keys are restricted to this app’s allowed origins.' : 'Secret keys are intended for server-side use and are never stored in plaintext.'}</p></form>
        <section className="space-y-2"><h3 className="text-xs font-semibold text-t-text">Existing tokens</h3>{loadingTokens && <p className="rounded border border-dashed border-t-border p-5 text-center text-xs text-t-muted">Loading tokens…</p>}{!loadingTokens && tokens.length === 0 && <p className="rounded border border-dashed border-t-border p-5 text-center text-xs text-t-muted">No tokens created yet.</p>}{tokens.map((token) => {
          const expiresAt = token.expiresAt ? new Date(token.expiresAt) : null;
          const expired = expiresAt && expiresAt <= new Date();
          const expiresSoon = expiresAt && !expired && expiresAt.getTime() - now <= 7 * 86_400_000;
          const status = expired ? 'Expired' : token.revokedAt ? 'Revoked' : 'Active';
          return <article key={token._id} className="flex flex-col gap-3 rounded border border-t-border bg-t-bg p-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-0.5 text-[10px] font-mono ${token.type === 'pk' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-violet-400/10 text-violet-300'}`}>{token.type}</span><strong className="text-xs text-t-text">{token.label || 'Untitled token'}</strong><span className={`text-[10px] ${status === 'Active' ? 'text-emerald-300' : 'text-t-muted'}`}>{status}</span>{expiresSoon && <span className="rounded bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-300">Expires soon</span>}</div><div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-t-muted"><code>{token.prefix}…</code>{token.type === 'pk' && token.value && <button type="button" onClick={() => copy(token.value)} className="inline-flex items-center gap-1 text-t-accent hover:underline">{copiedValue === token.value ? <Check size={11} /> : <Copy size={11} />}{copiedValue === token.value ? 'Copied' : 'Copy key'}</button>}<span>Last used: {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString() : 'Never'}</span>{expiresAt && <span>Expires: {expiresAt.toLocaleDateString()}</span>}</div></div>{!token.revokedAt && !expired && <button type="button" onClick={() => revoke(token)} className="shrink-0 rounded border border-t-danger/40 px-3 py-1.5 text-[11px] text-t-danger hover:bg-t-danger-dim">Revoke</button>}</article>;
        })}</section>
      </div>
      <footer className="flex justify-end border-t border-t-border p-4"><button type="button" onClick={close} disabled={created?.type === 'sk' && !savedSecret} className="rounded border border-t-border-hi px-4 py-2 text-xs text-t-text disabled:cursor-not-allowed disabled:opacity-40">Done</button></footer>
    </div>
  </div>;
}
