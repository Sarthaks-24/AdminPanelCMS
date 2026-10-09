import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const inputClass = 'mt-2 w-full rounded-lg border border-t-border-hi bg-t-bg px-3 py-2.5 text-sm text-t-text focus:border-t-accent focus:outline-none focus:ring-2 focus:ring-t-accent/20';

export default function AccountSettings() {
  const { user, updateSessionToken, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [deleteForm, setDeleteForm] = useState({ password: '', confirmation: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.get('/auth/me').then(({ data }) => setProfile(data.user)).catch(() => setError('Could not load account details.')); }, []);

  const changePassword = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    if (passwords.newPassword !== passwords.confirm) return setError('The new passwords do not match.');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/change-password', { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
      updateSessionToken(data.token);
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      setMessage('Password updated. Other signed-in sessions have been revoked.');
    } catch (err) { setError(err.response?.data?.error === 'credentials_invalid' ? 'Your current password is incorrect.' : 'Could not update the password.'); }
    finally { setBusy(false); }
  };

  const exportData = async () => {
    setError(''); setMessage(''); setBusy(true);
    try {
      const { data } = await api.get('/account/export', { responseType: 'blob' });
      const url = URL.createObjectURL(data); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = 'account-export.json'; anchor.click(); URL.revokeObjectURL(url);
      setMessage('Your export has downloaded.');
    } catch { setError('Could not export account data.'); }
    finally { setBusy(false); }
  };

  const deleteAccount = async (event) => {
    event.preventDefault(); setError(''); setMessage('');
    if (deleteForm.confirmation !== 'DELETE') return setError('Type DELETE to confirm account deletion.');
    setBusy(true);
    try {
      const { data } = await api.delete('/account', { data: { password: deleteForm.password } });
      logout(); navigate('/admin/login', { replace: true });
      if (!data.deleted) setError('Account access has been disabled; cleanup is pending.');
    } catch (err) { setError(err.response?.data?.error === 'credentials_invalid' ? 'The password is incorrect.' : 'Could not delete the account.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header><p className="font-mono text-xs uppercase tracking-widest text-t-accent">Your account</p><h1 className="mt-2 text-2xl font-semibold">Account settings</h1><p className="mt-2 text-sm text-t-muted">Manage your sign-in and account data.</p></header>
      {(error || message) && <p role={error ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${error ? 'border-t-danger/30 bg-t-danger-dim text-t-danger' : 'border-t-accent/30 bg-t-accent/10 text-t-text'}`}>{error || message}</p>}
      <section className="rounded-xl border border-t-border bg-t-surface p-5 sm:p-6">
        <h2 className="text-base font-semibold">Account</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-t-muted">Email</dt><dd className="mt-1 break-all">{profile?.email || user?.email || 'Loading…'}</dd></div><div><dt className="text-t-muted">Email status</dt><dd className="mt-1">{profile?.emailVerified ? 'Verified' : 'Not verified'}</dd></div><div><dt className="text-t-muted">Terms accepted</dt><dd className="mt-1">{profile?.acceptedTermsAt ? new Date(profile.acceptedTermsAt).toLocaleDateString() : 'Not recorded'}</dd></div></dl>
        {!profile?.emailVerified && <button type="button" onClick={async () => { try { await api.post('/auth/resend-verification'); setMessage('If verification is needed, a message will be sent.'); } catch { setError('Could not request a verification email.'); } }} className="mt-4 text-sm font-medium text-t-accent hover:underline">Resend verification email</button>}
      </section>
      <section className="rounded-xl border border-t-border bg-t-surface p-5 sm:p-6">
        <h2 className="text-base font-semibold">Change password</h2>
        <form onSubmit={changePassword} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">Current password<input className={inputClass} type="password" autoComplete="current-password" minLength={10} required value={passwords.currentPassword} onChange={(event) => setPasswords((p) => ({ ...p, currentPassword: event.target.value }))} /></label>
          <label className="text-sm">New password<input className={inputClass} type="password" autoComplete="new-password" minLength={10} maxLength={1024} required value={passwords.newPassword} onChange={(event) => setPasswords((p) => ({ ...p, newPassword: event.target.value }))} /></label>
          <label className="text-sm">Confirm new password<input className={inputClass} type="password" autoComplete="new-password" minLength={10} maxLength={1024} required value={passwords.confirm} onChange={(event) => setPasswords((p) => ({ ...p, confirm: event.target.value }))} /></label>
          <button className="rounded-lg bg-t-accent px-4 py-2.5 text-sm font-semibold text-t-on-accent disabled:opacity-60 sm:col-span-2 sm:w-fit" disabled={busy}>Update password</button>
        </form>
      </section>
      <section className="rounded-xl border border-t-border bg-t-surface p-5 sm:p-6">
        <h2 className="text-base font-semibold">Export your data</h2><p className="mt-2 text-sm text-t-muted">Download your profile, content, app configuration, and safe token metadata.</p>
        <button type="button" onClick={exportData} disabled={busy} className="mt-4 rounded-lg border border-t-border-hi px-4 py-2.5 text-sm font-medium hover:bg-t-bg disabled:opacity-60">Download account export</button>
      </section>
      <section className="rounded-xl border border-red-500/30 bg-red-500/5 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-red-400">Delete account</h2><p className="mt-2 text-sm text-t-muted">Deletion immediately disables sign-in and removes your account data. This cannot be undone.</p>
        <form onSubmit={deleteAccount} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Current password<input className={inputClass} type="password" autoComplete="current-password" required value={deleteForm.password} onChange={(event) => setDeleteForm((p) => ({ ...p, password: event.target.value }))} /></label>
          <label className="text-sm">Type DELETE to confirm<input className={inputClass} type="text" autoComplete="off" required value={deleteForm.confirmation} onChange={(event) => setDeleteForm((p) => ({ ...p, confirmation: event.target.value }))} /></label>
          <button className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60 sm:col-span-2 sm:w-fit" disabled={busy}>Delete account</button>
        </form>
      </section>
    </div>
  );
}
