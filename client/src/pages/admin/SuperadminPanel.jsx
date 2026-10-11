import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/admin/ui/Modal';
import { describeApiError } from '../../lib/apiErrors';
import useConfirm from '../../components/admin/ui/useConfirm';

function formatDate(value) { return value ? new Date(value).toLocaleString() : '—'; }
const groupCode = (code) => String(code || '').replace(/(.{4})(?=.)/g, '$1-');

const MODES = [
  ['closed', 'Closed', 'Nobody can register. Existing accounts keep working.'],
  ['invite', 'Invite only', 'New accounts need an invite code from the list below.'],
  ['open', 'Open to everyone', 'Anyone can sign up with an email address.'],
];
const STATUS_FILTERS = [['', 'All'], ['active', 'Active'], ['unverified', 'Unverified'], ['suspended', 'Suspended']];
const ACTION_COPY = {
  suspend: { title: 'Suspend this account?', body: 'Sign-in and every API key stop working within a minute (browsers may keep a copy for up to 60 s). Their apps will get 401 until you unsuspend.', button: 'Suspend' },
  unsuspend: { title: 'Restore this account?', body: 'Sign-in and API keys work again within a minute (browsers may keep a copy for up to 60 s).', button: 'Unsuspend' },
  delete: { title: 'Delete this account permanently?', body: 'All content, apps and keys are removed. This cannot be undone.', button: 'Delete account' },
  signupMode: { title: 'Change who can register?', body: 'Applies to new signups straight away. Existing accounts are not affected.', button: 'Change registration' },
  invite: { title: 'Create an invite?', body: 'A new code is shown once, right after you confirm.', button: 'Create invite' },
};
// 409 mail_not_ready: the server refuses to open signup while it cannot send verification mail, and
// says why. Show its reasons; anything else gets the generic line.
function signupModeError(err) {
  if (err.response?.data?.error === 'mail_not_ready') return describeApiError(err).message;
  return 'Could not update the registration setting.';
}
// Outside the component: a password confirmation lasts about ten minutes on the server.
const reauthExpired = (until) => Date.now() > until;
const MODE_LABEL = { closed: 'Closed', invite: 'Invite only', open: 'Open to everyone' };
const ERROR_COPY = {
  cannot_target_self: 'You cannot suspend or delete your own account from here.',
  last_superadmin: 'The last superadmin cannot be suspended or deleted. Grant the role to another account first.',
  not_found: 'That account no longer exists.',
  already_suspended: 'That account is already suspended.',
  not_suspended: 'That account is not suspended.',
  credentials_invalid: 'The password is incorrect.',
  reauth_required: 'Confirm your password to continue.',
  rate_limited: 'Too many attempts. Wait a few minutes.',
};

export default function SuperadminPanel() {
  const [confirm, confirmDialog] = useConfirm();
  const actionFormId = useId();
  const reauthRef = useRef(null);
  const { user: me } = useAuth();
  const [totals, setTotals] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [invites, setInvites] = useState([]);
  const [newCode, setNewCode] = useState('');
  const [inviteMaxUses, setInviteMaxUses] = useState('1');
  const [settings, setSettings] = useState(null);
  const [mailBudget, setMailBudget] = useState(null);
  const [savingMode, setSavingMode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [users, setUsers] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [pending, setPending] = useState(null); // { action, user }
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthUntil, setReauthUntil] = useState(0);
  const [acting, setActing] = useState(false);
  const [actionError, setActionError] = useState('');

  const refresh = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError('');
    try {
      const [overviewResult, inviteResult, settingsResult, budgetResult] = await Promise.all([api.get('/admin/overview'), api.get('/admin/invites'), api.get('/admin/settings'), api.get('/admin/mail-budget')]);
      setTotals(overviewResult.data.totals); setPerformance(overviewResult.data.performance); setInvites(inviteResult.data.invites); setSettings(settingsResult.data.settings); setMailBudget(budgetResult.data);
    } catch (err) {
      setError(err.response?.status === 403 ? 'This account does not have superadmin access.' : 'Could not load administration data.');
    } finally { setLoading(false); }
  }, []);

  const loadUsers = useCallback(async ({ append = false, cursor = null } = {}) => {
    setUsersLoading(true);
    try {
      const params = {};
      if (query.trim()) params.q = query.trim();
      if (statusFilter) params.status = statusFilter;
      if (cursor) params.cursor = cursor;
      const { data } = await api.get('/admin/users', { params });
      setUsers((current) => (append ? [...current, ...data.users] : data.users));
      setNextCursor(data.nextCursor);
    } catch { setError('Could not load the user list.'); }
    finally { setUsersLoading(false); }
  }, [query, statusFilter]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const timer = setTimeout(() => { loadUsers(); }, 250);
    return () => clearTimeout(timer);
  }, [loadUsers]);

  // Settings and invites, like suspend/delete, need a password confirmation in the last ten minutes.
  const doCreateInvite = async (maxUses) => {
    const { data } = await api.post('/admin/invites', { expiresInDays: 30, maxUses });
    setNewCode(data.invite.code);
    await refresh(false);
  };
  const doSetSignupMode = async (mode) => {
    const { data } = await api.put('/admin/settings', { signupMode: mode });
    setSettings(data.settings);
  };

  const createInvite = async () => {
    setError(''); setNewCode('');
    const maxUses = Number(inviteMaxUses);
    if (reauthExpired(reauthUntil)) { openAction('invite', null, { maxUses }); return; }
    try { await doCreateInvite(maxUses); }
    catch (err) {
      if (err.response?.data?.error === 'reauth_required') { setReauthUntil(0); openAction('invite', null, { maxUses }, true); }
      else setError('Could not create an invite.');
    }
  };

  const changeSignupMode = async (mode) => {
    if (!settings || mode === settings.signupMode) return;
    if (reauthExpired(reauthUntil)) { openAction('signupMode', null, { mode }, true); return; }
    if (mode === 'open' && !(await confirm({ title: 'Open registration to everyone?', consequence: 'Anyone with an email address can create an account without an invite.', confirmLabel: 'Open registration', danger: false, note: 'You can switch back to invite-only at any time.' }))) return;
    setError(''); setSavingMode(true);
    try { await doSetSignupMode(mode); }
    catch (err) {
      if (err.response?.data?.error === 'reauth_required') { setReauthUntil(0); openAction('signupMode', null, { mode }, true); }
      else setError(signupModeError(err));
    }
    finally { setSavingMode(false); }
  };

  const revokeInvite = async (id) => {
    setError('');
    try { await api.delete(`/admin/invites/${id}`); await refresh(false); }
    catch (err) { setError(err.response?.status === 404 ? 'That invite was already used or removed.' : 'Could not revoke that invite.'); }
  };

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(newCode); }
    catch { setError('Clipboard access failed. Select and copy the displayed code.'); }
  };

  const [needsReauth, setNeedsReauth] = useState(true);
  const openAction = (action, user, extra = {}, forceReauth = false) => { setNeedsReauth(forceReauth || Date.now() > reauthUntil); setPending({ action, user, ...extra }); setActionError(''); setReauthPassword(''); };
  const closeAction = () => { setPending(null); setActionError(''); setReauthPassword(''); };

  const runAction = async (event) => {
    event.preventDefault();
    if (!pending) return;
    setActing(true); setActionError('');
    try {
      if (needsReauth) {
        if (!reauthPassword) { setActionError('Enter your password to confirm.'); return; }
        await api.post('/admin/reauth', { password: reauthPassword });
        setReauthUntil(Date.now() + 9 * 60 * 1000);
      }
      const { action, user } = pending;
      if (action === 'invite') { await doCreateInvite(pending.maxUses); closeAction(); return; }
      if (action === 'signupMode') { await doSetSignupMode(pending.mode); closeAction(); return; }
      if (action === 'delete') await api.delete(`/admin/users/${user._id}`);
      else await api.post(`/admin/users/${user._id}/${action}`);
      closeAction();
      await Promise.all([loadUsers(), refresh(false)]);
    } catch (err) {
      const code = err.response?.data?.error;
      if (code === 'reauth_required') { setReauthUntil(0); setNeedsReauth(true); }
      setActionError(code === 'mail_not_ready' ? signupModeError(err) : (ERROR_COPY[code] || err.response?.data?.message || 'The action failed. Please try again.'));
    } finally { setActing(false); }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header><h1 className="text-3xl">Platform admin</h1><p className="mt-2 text-sm text-t-muted">Service health, registration, invites, and account suspension. Individual users’ content and app configuration are not shown.</p></header>
      {error && <p role="alert" className="rounded-lg border border-t-danger/30 bg-t-danger-dim p-3 text-sm text-t-danger">{error}</p>}

      <section className="rounded-xl border border-t-border bg-t-surface p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Service performance</h2><button type="button" onClick={() => refresh()} className="rounded-lg border border-t-border-hi px-3 py-2 text-xs font-medium">Refresh</button></div>
        {loading || !totals || !performance ? <p className="mt-3 text-sm text-t-muted">Loading…</p> : (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Database" value={performance.database} /><Stat label="Uptime" value={formatUptime(performance.uptimeSeconds)} /><Stat label="Memory (RSS)" value={`${performance.memory.rssMb} MB`} /><Stat label="Heap used / total" value={`${performance.memory.heapUsedMb} / ${performance.memory.heapTotalMb} MB`} /></div>
            <h3 className="mt-6 text-sm font-semibold">Aggregate usage</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Active accounts" value={totals.activeAccounts} /><Stat label="Suspended" value={totals.suspendedAccounts ?? 0} /><Stat label="Apps created" value={totals.apps} /><Stat label="API keys" value={totals.apiTokens} /></div>
            {mailBudget && (
              <p className="mt-4 text-sm text-t-muted">
                Mail budget today ({mailBudget.day}): <strong className="text-t-text tabular-nums">{mailBudget.sent} / {mailBudget.cap}</strong> sent, {mailBudget.reserve} of which are reserved for password resets.
                {mailBudget.sent >= mailBudget.cap - mailBudget.reserve && <span className="text-t-danger"> Signup and resend mail is paused until tomorrow.</span>}
              </p>
            )}
            <p className="mt-3 text-xs text-t-muted">Sampled {formatDate(performance.sampledAt)}.</p>
          </>
        )}
      </section>

      {settings && (
        <section className="rounded-xl border border-t-border bg-t-surface p-5 sm:p-6" aria-labelledby="registration-title">
          <h2 id="registration-title" className="font-semibold">Registration</h2>
          <p className="mt-1 text-sm text-t-muted">Choose who can create an account. Closed is the kill switch; it takes effect immediately.</p>
          <div role="radiogroup" aria-labelledby="registration-title" className="mt-4 grid gap-3 sm:grid-cols-3">
            {MODES.map(([value, label, hint]) => (
              <label key={value} className={`cursor-pointer rounded-lg border p-4 text-sm ${settings.signupMode === value ? 'border-t-accent bg-t-accent/10' : 'border-t-border bg-t-bg'}`}>
                <input type="radio" name="signupMode" value={value} checked={settings.signupMode === value} disabled={savingMode} onChange={() => changeSignupMode(value)} className="mr-2 accent-[var(--theme-accent)]" />
                <span className="font-semibold">{label}</span>
                <span className="mt-1 block text-xs text-t-muted">{hint}</span>
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-t-muted">
            Currently {settings.signupMode === 'closed' ? 'closed' : settings.signupMode === 'open' ? 'open to everyone' : 'invite only'} (set from the {settings.source === 'dashboard' ? 'dashboard' : `environment default, ${settings.environmentDefault}`}).
            {settings.blockedByLegalApproval && ' Signup is closed in production until LEGAL_POLICIES_APPROVED=true, whatever you choose here.'}
          </p>
        </section>
      )}

      <section className="rounded-xl border border-t-border bg-t-surface p-5 sm:p-6" aria-labelledby="users-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 id="users-title" className="font-semibold">Users</h2><p className="mt-1 text-sm text-t-muted">Suspending cuts sign-in and every API key within a minute (browsers may keep a copy for up to 60 s); deleting runs the full account cascade.</p></div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-t-muted">Search by email<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="name@example.com" className="mt-1 block w-56 rounded-lg border border-t-border-hi bg-t-bg px-3 py-2 text-sm text-t-text" /></label>
            <label className="text-xs text-t-muted">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 block rounded-lg border border-t-border-hi bg-t-bg px-3 py-2 text-sm text-t-text">{STATUS_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </div>
        </div>
        {usersLoading && users.length === 0 ? <p className="mt-5 text-sm text-t-muted">Loading…</p> : users.length === 0 ? <p className="mt-5 text-sm text-t-muted">No accounts match.</p> : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-t-muted"><tr><th className="py-2">Email</th><th>Created</th><th>Status</th><th>Apps</th><th>Last key use</th><th className="text-right">Actions</th></tr></thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = me && String(me.id) === String(user._id);
                  const status = user.status === 'suspended' ? 'suspended' : user.emailVerifiedAt ? 'active' : 'unverified';
                  return (
                    <tr key={user._id} className="border-t border-t-border">
                      <td className="py-3 pr-3"><span className="break-all">{user.email}</span>{user.role === 'superadmin' && <span className="ml-2 rounded bg-t-accent/15 px-1.5 py-0.5 text-[11px] font-semibold text-t-accent">superadmin</span>}{isSelf && <span className="ml-2 text-xs text-t-muted">(you)</span>}</td>
                      <td className="pr-3 whitespace-nowrap">{formatDate(user.createdAt)}</td>
                      <td className="pr-3"><StatusBadge status={status} /></td>
                      <td className="pr-3 tabular-nums">{user.appCount}</td>
                      <td className="pr-3 whitespace-nowrap">{formatDate(user.lastTokenUseAt)}</td>
                      <td className="whitespace-nowrap text-right">
                        {!isSelf && (
                          <>
                            {user.status === 'suspended'
                              ? <button type="button" onClick={() => openAction('unsuspend', user)} className="text-xs font-medium text-t-accent hover:underline">Unsuspend</button>
                              : <button type="button" onClick={() => openAction('suspend', user)} className="text-xs font-medium text-t-accent hover:underline">Suspend</button>}
                            <button type="button" onClick={() => openAction('delete', user)} className="ml-4 text-xs font-medium text-t-danger hover:underline">Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {nextCursor && <button type="button" onClick={() => loadUsers({ append: true, cursor: nextCursor })} disabled={usersLoading} className="mt-4 rounded-lg border border-t-border-hi px-3 py-2 text-xs font-medium disabled:opacity-60">{usersLoading ? 'Loading…' : 'Load more'}</button>}
          </div>
        )}
      </section>

      {pending && (
        <Modal
          title={ACTION_COPY[pending.action].title}
          description={ACTION_COPY[pending.action].body}
          onClose={closeAction}
          initialFocusRef={needsReauth ? reauthRef : undefined}
          size="sm"
          footer={(
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeAction} className="rounded-lg border border-t-border-hi px-4 py-2 text-sm font-medium">Cancel</button>
              <button type="submit" form={actionFormId} disabled={acting} className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${pending.action === 'delete' ? 'bg-t-danger text-t-bg' : 'bg-t-accent text-t-on-accent'}`}>{acting ? 'Working…' : ACTION_COPY[pending.action].button}</button>
            </div>
          )}
        >
          <form id={actionFormId} onSubmit={runAction}>
            {pending.user && <p className="break-all text-sm text-t-muted"><strong className="text-t-text">{pending.user.email}</strong></p>}
            {pending.action === 'signupMode' && <p className="text-sm text-t-muted">New setting: <strong className="text-t-text">{MODE_LABEL[pending.mode] || pending.mode}</strong>{pending.mode === 'open' ? '. Anyone with an email address can create an account without an invite.' : '.'}</p>}
            {pending.action === 'invite' && <p className="text-sm text-t-muted">Allows <strong className="text-t-text">{pending.maxUses}</strong> {pending.maxUses === 1 ? 'signup' : 'signups'}, valid 30 days.</p>}
            {actionError && <p role="alert" className="mt-3 rounded-lg border border-t-danger/30 bg-t-danger-dim p-3 text-sm text-t-danger">{actionError}</p>}
            {needsReauth && <label className="mt-4 block text-sm font-medium">Confirm with your password<input ref={reauthRef} type="password" autoComplete="current-password" value={reauthPassword} onChange={(event) => setReauthPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-t-border-hi bg-t-bg px-3 py-2.5 text-sm text-t-text" /><span className="mt-1 block text-xs font-normal text-t-muted">Required once every ten minutes for account, registration and invite changes.</span></label>}
          </form>
        </Modal>
      )}
      {confirmDialog}

      <section className="rounded-xl border border-t-border bg-t-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-semibold">Invitations</h2><p className="mt-1 text-sm text-t-muted">12-character codes, stored as keyed hashes and shown only once. Up to 50 signups each, valid 30 days.</p></div><div className="flex items-end gap-2"><label className="text-xs text-t-muted">Allowed signups<input type="number" min="1" max="50" step="1" value={inviteMaxUses} onChange={(event) => setInviteMaxUses(event.target.value)} className="mt-1 block w-28 rounded-lg border border-t-border-hi bg-t-bg px-3 py-2 text-sm text-t-text" /></label><button type="button" onClick={createInvite} disabled={!/^\d+$/.test(inviteMaxUses) || Number(inviteMaxUses) < 1 || Number(inviteMaxUses) > 50} className="rounded-lg bg-t-accent px-4 py-2.5 text-sm font-semibold text-t-on-accent disabled:opacity-50">Create 30-day invite</button></div></div>
        {newCode && <div className="mt-4 rounded-lg border border-t-accent/30 bg-t-accent/10 p-4"><p className="text-xs font-medium text-t-muted">Copy this invite now; it will not be shown again. Dashes are optional when entering it.</p><div className="mt-2 flex flex-wrap items-center gap-2"><code translate="no" className="min-w-0 flex-1 break-all rounded bg-t-bg p-2 font-mono text-sm tracking-wider">{groupCode(newCode)}</code><button type="button" onClick={copyCode} className="rounded border border-t-border-hi px-3 py-2 text-xs font-semibold">Copy</button></div></div>}
        {loading ? <p className="mt-5 text-sm text-t-muted">Loading…</p> : invites.length === 0 ? <p className="mt-5 text-sm text-t-muted">No invites found.</p> : <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="text-xs uppercase text-t-muted"><tr><th className="py-2">Created</th><th>Expires</th><th>Signups</th><th>Status</th><th className="text-right">Action</th></tr></thead><tbody>{invites.map((invite) => <tr key={invite._id} className="border-t border-t-border"><td className="py-3">{formatDate(invite.createdAt)}</td><td>{formatDate(invite.expiresAt)}</td><td>{invite.usedCount} / {invite.maxUses}</td><td>{invite.used ? 'Fully used' : new Date(invite.expiresAt) <= new Date() ? 'Expired' : 'Available'}</td><td className="text-right">{!invite.used && <button type="button" onClick={() => revokeInvite(invite._id)} className="text-xs font-medium text-t-danger hover:underline">Revoke</button>}</td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = { active: 'border-t-accent/30 bg-t-accent/10 text-t-accent', unverified: 'border-t-border bg-t-bg text-t-muted', suspended: 'border-t-danger/30 bg-t-danger-dim text-t-danger' };
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${styles[status] || styles.unverified}`}>{status}</span>;
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
