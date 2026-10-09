import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';

function formatDate(value) { return value ? new Date(value).toLocaleString() : '—'; }

export default function SuperadminPanel() {
  const [totals, setTotals] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [invites, setInvites] = useState([]);
  const [newCode, setNewCode] = useState('');
  const [inviteMaxUses, setInviteMaxUses] = useState('1');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError('');
    try {
      const [overviewResult, inviteResult] = await Promise.all([api.get('/admin/overview'), api.get('/admin/invites')]);
      setTotals(overviewResult.data.totals); setPerformance(overviewResult.data.performance); setInvites(inviteResult.data.invites);
    } catch (err) {
      setError(err.response?.status === 403 ? 'This account does not have superadmin access.' : 'Could not load administration data.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([api.get('/admin/overview'), api.get('/admin/invites')])
      .then(([overviewResult, inviteResult]) => {
        if (!active) return;
        setTotals(overviewResult.data.totals);
        setPerformance(overviewResult.data.performance);
        setInvites(inviteResult.data.invites);
      })
      .catch((err) => {
        if (active) setError(err.response?.status === 403 ? 'This account does not have superadmin access.' : 'Could not load administration data.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const createInvite = async () => {
    setError(''); setNewCode('');
    try {
      const { data } = await api.post('/admin/invites', { expiresInDays: 30, maxUses: Number(inviteMaxUses) });
      setNewCode(data.invite.code);
      await refresh();
    } catch { setError('Could not create an invite.'); }
  };

  const revokeInvite = async (id) => {
    setError('');
    try { await api.delete(`/admin/invites/${id}`); await refresh(); }
    catch (err) { setError(err.response?.status === 404 ? 'That invite was already used or removed.' : 'Could not revoke that invite.'); }
  };

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(newCode); }
    catch { setError('Clipboard access failed. Select and copy the displayed code.'); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header><p className="font-mono text-xs uppercase tracking-widest text-t-accent">Platform overview</p><h1 className="mt-2 text-2xl font-semibold">Superadmin dashboard</h1><p className="mt-2 text-sm text-t-muted">Monitor aggregate service health and manage invite codes. Individual users’ API apps, settings, and portfolio data are not shown.</p></header>
      {error && <p role="alert" className="rounded-lg border border-t-danger/30 bg-t-danger-dim p-3 text-sm text-t-danger">{error}</p>}
      <section className="rounded-xl border border-t-border bg-t-surface p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Service performance</h2><button type="button" onClick={refresh} className="rounded-lg border border-t-border-hi px-3 py-2 text-xs font-medium">Refresh</button></div>{loading || !totals || !performance ? <p className="mt-3 text-sm text-t-muted">Loading…</p> : <><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Database" value={performance.database} /><Stat label="Uptime" value={formatUptime(performance.uptimeSeconds)} /><Stat label="Memory (RSS)" value={`${performance.memory.rssMb} MB`} /><Stat label="Heap used / total" value={`${performance.memory.heapUsedMb} / ${performance.memory.heapTotalMb} MB`} /></div><h3 className="mt-6 text-sm font-semibold">Aggregate usage</h3><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Active accounts" value={totals.activeAccounts} /><Stat label="Apps created" value={totals.apps} /><Stat label="API tokens" value={totals.apiTokens} /><Stat label="Available invites" value={totals.unusedInvites} /></div><p className="mt-3 text-xs text-t-muted">Sampled {formatDate(performance.sampledAt)}. No individual API app details are included.</p></>}</section>
      <section className="rounded-xl border border-t-border bg-t-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-semibold">Invitations</h2><p className="mt-1 text-sm text-t-muted">Six-digit codes are stored as keyed hashes and shown only once.</p></div><div className="flex items-end gap-2"><label className="text-xs text-t-muted">Allowed signups<input type="number" min="1" max="1000" step="1" value={inviteMaxUses} onChange={(event) => setInviteMaxUses(event.target.value)} className="mt-1 block w-28 rounded-lg border border-t-border-hi bg-t-bg px-3 py-2 text-sm text-t-text" /></label><button type="button" onClick={createInvite} disabled={!/^\d+$/.test(inviteMaxUses) || Number(inviteMaxUses) < 1 || Number(inviteMaxUses) > 1000} className="rounded-lg bg-t-accent px-4 py-2.5 text-sm font-semibold text-t-on-accent disabled:opacity-50">Create 30-day invite</button></div></div>
        {newCode && <div className="mt-4 rounded-lg border border-t-accent/30 bg-t-accent/10 p-4"><p className="text-xs font-medium text-t-muted">Copy this invite now; it will not be shown again.</p><div className="mt-2 flex flex-wrap items-center gap-2"><code className="min-w-0 flex-1 break-all rounded bg-t-bg p-2 text-xs">{newCode}</code><button type="button" onClick={copyCode} className="rounded border border-t-border-hi px-3 py-2 text-xs font-semibold">Copy</button></div></div>}
        {loading ? <p className="mt-5 text-sm text-t-muted">Loading…</p> : invites.length === 0 ? <p className="mt-5 text-sm text-t-muted">No invites found.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="text-xs uppercase text-t-muted"><tr><th className="py-2">Created</th><th>Expires</th><th>Signups</th><th>Status</th><th className="text-right">Action</th></tr></thead><tbody>{invites.map((invite) => <tr key={invite._id} className="border-t border-t-border"><td className="py-3">{formatDate(invite.createdAt)}</td><td>{formatDate(invite.expiresAt)}</td><td>{invite.usedCount} / {invite.maxUses}</td><td>{invite.used ? 'Fully used' : new Date(invite.expiresAt) <= new Date() ? 'Expired' : 'Available'}</td><td className="text-right">{!invite.used && <button type="button" onClick={() => revokeInvite(invite._id)} className="text-xs font-medium text-t-danger hover:underline">Revoke</button>}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return <div className="rounded-lg border border-t-border bg-t-bg p-3"><p className="text-xs capitalize text-t-muted">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>;
}

function formatUptime(seconds = 0) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}
