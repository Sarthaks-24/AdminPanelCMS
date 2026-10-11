import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, KeyRound, Plus, ShieldAlert } from 'lucide-react';
import { api } from '../../api/client';
import { describeApiError } from '../../lib/apiErrors';
import Modal, { ConfirmDialog } from '../../components/admin/ui/Modal';
import ConnectPanel from '../../components/admin/ConnectPanel';

const KIND = {
  pk: { pill: 'pk · publishable', className: 'bg-t-accent2-dim text-t-accent2' },
  sk: { pill: 'sk · secret', className: 'bg-t-accent/10 text-t-accent' },
};

const BLOCKED_REASON = 'Tick “I have saved this secret key” to close. The key is shown once; after this dialog it can’t be read back.';

function formatDate(value) {
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)); } catch { return String(value); }
}
function formatDateTime(value) {
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); } catch { return String(value); }
}

export default function TokenManagerModal({ app, v1Base, baseResolved = true, baseConfigured = true, onClose, onChange }) {
  const [tokens, setTokens] = useState([]);
  const [label, setLabel] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [created, setCreated] = useState(null);
  const [savedSecret, setSavedSecret] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [copiedValue, setCopiedValue] = useState('');
  const [revoking, setRevoking] = useState(null);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const labelRef = useRef(null);
  const activeCount = useMemo(() => tokens.filter((token) => !token.revokedAt && (!token.expiresAt || new Date(token.expiresAt).getTime() > now)).length, [tokens, now]);

  const refresh = useCallback(async () => {
    setLoadFailed(false);
    try {
      const { data } = await api.get(`/apps/${app._id}/tokens`);
      setTokens(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadFailed(true);
      setError(describeApiError(err, { appId: app._id, fallback: 'Could not load this App’s keys.' }));
    } finally { setLoadingTokens(false); }
  }, [app._id]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  async function createToken(event) {
    event.preventDefault(); setBusy(true); setError(null);
    try {
      const { data } = await api.post(`/apps/${app._id}/tokens`, { label: label.trim(), expiresInDays: expiresInDays || undefined });
      setCreated(data); setSavedSecret(false); setLabel('');
      await refresh();
      onChange?.();
    } catch (err) { setError(describeApiError(err, { appId: app._id, fallback: 'Could not create the key.' })); }
    finally { setBusy(false); }
  }

  async function revoke(token) {
    setRevokeBusy(true); setError(null);
    try { await api.delete(`/apps/${app._id}/tokens/${token._id}`); await refresh(); onChange?.(); setRevoking(null); }
    catch (err) { setError(describeApiError(err, { appId: app._id, fallback: 'Could not revoke the key.' })); }
    finally { setRevokeBusy(false); }
  }

  async function copy(value) {
    try { await navigator.clipboard.writeText(value); setCopiedValue(value); window.setTimeout(() => setCopiedValue(''), 1800); }
    catch { setError({ message: 'Clipboard access failed. Select the key and copy it yourself.', fix: null }); }
  }

  const closeBlocked = created?.type === 'sk' && !savedSecret ? BLOCKED_REASON : false;
  const kindLabel = app.type === 'static' ? 'Visitors’ browsers · publishable keys' : 'Build or server · secret keys';

  return (
    <Modal
      title="Keys"
      description={`${app.name} · ${activeCount}/2 active · ${kindLabel}`}
      icon={KeyRound}
      onClose={onClose}
      closeBlocked={closeBlocked}
      initialFocusRef={labelRef}
      size="lg"
      closeLabel="Close keys"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-t-muted">{closeBlocked ? 'Closing is blocked until you confirm the key is saved.' : 'Keys take effect immediately.'}</p>
          <button type="button" onClick={onClose} disabled={Boolean(closeBlocked)} className="rounded border border-t-border-hi px-4 py-2 text-sm text-t-text hover:bg-t-surface-hi disabled:cursor-not-allowed disabled:opacity-50">Done</button>
        </div>
      }
    >
      <div className="space-y-6">
        {error && (
          <p role="alert" className="rounded border border-t-danger/40 bg-t-danger-dim p-3 text-sm text-t-danger">
            {error.message}{error.fix && <> <Link to={error.fix.to} className="font-medium underline underline-offset-4">{error.fix.label}</Link></>}
            {loadFailed && <> <button type="button" onClick={() => { setLoadingTokens(true); refresh(); }} className="font-medium underline underline-offset-4">Retry</button></>}
          </p>
        )}

        {created && (
          <section aria-labelledby="minted-title" className="space-y-4 rounded-lg border border-t-accent/40 bg-t-bg p-4">
            <h3 id="minted-title" className="flex items-center gap-2 text-sm font-semibold text-t-accent"><Check size={15} aria-hidden="true" />{created.type === 'sk' ? 'Secret key created' : 'Publishable key created'}</h3>
            <code translate="no" className="block break-all rounded border border-t-border bg-t-code p-3 text-sm text-t-text">{created.token}</code>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => copy(created.token)} className="inline-flex min-h-9 items-center gap-2 rounded border border-t-border-hi px-3 text-sm font-medium text-t-text hover:border-t-accent hover:text-t-accent">{copiedValue === created.token ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}{copiedValue === created.token ? 'Copied' : 'Copy key'}</button>
              <span aria-live="polite" className="sr-only">{copiedValue === created.token ? 'Key copied.' : ''}</span>
            </div>
            {created.type === 'sk' && (
              <div className="space-y-3 rounded border border-t-warn/40 bg-t-warn/10 p-3">
                <p className="flex gap-2 text-sm text-t-text"><ShieldAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-t-warn" />This secret key is shown once. Put it in your build secrets now; it can’t be read back later, only revoked and replaced.</p>
                <label className="flex items-start gap-3 text-sm text-t-text">
                  <input type="checkbox" checked={savedSecret} onChange={(event) => setSavedSecret(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--theme-accent)]" />
                  <span>I have saved this secret key<span className="block text-xs text-t-muted">Until this is ticked, Escape and Done won’t close the dialog, so the key can’t vanish by accident.</span></span>
                </label>
              </div>
            )}
            <ConnectPanel app={app} v1Base={v1Base} baseResolved={baseResolved} baseConfigured={baseConfigured} variant="post-mint" mintedToken={created} tokens={tokens} headingLevel={4} />
          </section>
        )}

        <form onSubmit={createToken} className="grid gap-3 rounded-lg border border-t-border bg-t-bg p-4 sm:grid-cols-[1fr_160px_auto]">
          <div>
            <label htmlFor="token-label" className="block text-sm font-medium text-t-text">Label</label>
            <input ref={labelRef} id="token-label" value={label} maxLength={60} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Production build" autoComplete="off" className="mt-1 h-10 w-full rounded border border-t-border-hi bg-t-surface px-3 text-sm text-t-text outline-none focus:border-t-accent focus:ring-2 focus:ring-t-accent/20" />
          </div>
          <div>
            <label htmlFor="token-expires" className="block text-sm font-medium text-t-text">Expires</label>
            <select id="token-expires" value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} className="mt-1 h-10 w-full rounded border border-t-border-hi bg-t-surface px-2 text-sm text-t-text outline-none focus:border-t-accent"><option value="">Never</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">365 days</option></select>
          </div>
          <button disabled={busy || loadingTokens || activeCount >= 2} className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded bg-t-accent px-3 text-sm font-semibold text-t-on-accent hover:bg-t-accent-br disabled:opacity-50"><Plus size={14} aria-hidden="true" />{busy ? 'Creating…' : loadingTokens ? 'Loading…' : app.type === 'static' ? 'Create publishable key' : 'Create secret key'}</button>
          <p className="text-xs text-t-muted sm:col-span-3">
            {activeCount >= 2 ? 'Two keys can be live at once, so you can rotate without downtime. Revoke one to create another.' : app.type === 'static' ? 'Publishable keys work only from this App’s allowed origins, 120 requests/min per visitor.' : 'Secret keys live in your build or server secrets and never ship to a browser. 600 requests/min.'}
          </p>
        </form>

        <section aria-labelledby="tokens-title" className="space-y-2">
          <h3 id="tokens-title" className="text-sm font-semibold text-t-text">Existing keys</h3>
          {loadingTokens && <p role="status" className="rounded border border-dashed border-t-border p-5 text-center text-sm text-t-muted">Loading keys…</p>}
          {!loadingTokens && !loadFailed && tokens.length === 0 && <p className="rounded border border-dashed border-t-border p-5 text-center text-sm text-t-muted">No keys yet. Create one above and the snippets fill in.</p>}
          {tokens.map((token) => {
            const expiresAt = token.expiresAt ? new Date(token.expiresAt) : null;
            const expired = expiresAt && expiresAt.getTime() <= now;
            const expiresSoon = expiresAt && !expired && expiresAt.getTime() - now <= 7 * 86_400_000;
            const status = expired ? 'Expired' : token.revokedAt ? 'Revoked' : 'Active';
            const kind = KIND[token.type] || KIND.sk;
            return (
              <article key={token._id} className="flex flex-col gap-3 rounded border border-t-border bg-t-bg p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${kind.className}`}>{kind.pill}</span>
                    <strong className="text-sm text-t-text">{token.label || 'Untitled key'}</strong>
                    <span className={`text-xs ${status === 'Active' ? 'text-t-accent2' : 'text-t-muted'}`}>{status}</span>
                    {expiresSoon && <span className="rounded bg-t-warn/10 px-2 py-0.5 text-xs text-t-warn">Expires soon</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-t-muted">
                    <code translate="no">{token.prefix}…</code>
                    {token.type === 'pk' && token.value && <button type="button" onClick={() => copy(token.value)} className="inline-flex items-center gap-1 text-t-accent hover:underline">{copiedValue === token.value ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}{copiedValue === token.value ? 'Copied' : 'Copy key'}</button>}
                    {token.type === 'sk' && <span>shown once when created</span>}
                    <span>Last used: {token.lastUsedAt ? formatDateTime(token.lastUsedAt) : 'never'}</span>
                    {expiresAt && <span>Expires: {formatDate(expiresAt)}</span>}
                  </div>
                </div>
                {!token.revokedAt && !expired && <button type="button" onClick={() => setRevoking(token)} className="shrink-0 rounded border border-t-danger/40 px-3 py-1.5 text-xs font-medium text-t-danger hover:bg-t-danger-dim">Revoke</button>}
              </article>
            );
          })}
        </section>
      </div>

      {revoking && (
        <ConfirmDialog
          title={`Revoke ${revoking.prefix}…?`}
          consequence={`Every request with this key gets 401 token_invalid from now on. ${app.type === 'static' ? 'Pages that fetch with it in the browser stop loading content.' : 'Builds that use it fail until you set a new key.'}`}
          confirmLabel="Revoke key"
          busy={revokeBusy}
          onConfirm={() => revoke(revoking)}
          onCancel={() => setRevoking(null)}
        />
      )}
    </Modal>
  );
}
