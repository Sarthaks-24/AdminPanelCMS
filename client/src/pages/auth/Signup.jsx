import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import AuthShell, { buttonClass, fieldClass } from './AuthShell';

export default function Signup() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ email: '', password: '', inviteCode: '', acceptedTerms: false, acceptedPrivacy: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { api.get('/auth/config').then(({ data }) => setConfig(data)).catch(() => setConfig({ signupEnabled: false })); }, []);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  const submit = async (event) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      await api.post('/auth/signup', form);
      navigate('/admin/check-email', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || (err.response?.data?.error === 'invite_invalid' ? 'That invite code is invalid or has expired.' : 'We could not create the account. Check your details and try again.'));
    } finally { setLoading(false); }
  };

  return (
    <AuthShell eyebrow="Create your account" title="Set up your workspace" description="An invite is required while registration is invite-only.">
      {config === null ? <p role="status" className="text-sm text-t-muted">Checking registration availability…</p> : !config.signupEnabled ? (
        <div role="status" className="rounded-xl border border-t-border bg-t-bg p-4 text-sm text-t-muted">Registration is currently closed. Please contact the workspace administrator.</div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          {error && <p role="alert" className="rounded-lg border border-t-danger/30 bg-t-danger-dim p-3 text-sm text-t-danger">{error}</p>}
          <label className="block text-sm font-medium">Email address<input className={fieldClass} type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={update('email')} placeholder="you@example.com" /></label>
          <label className="block text-sm font-medium">Password<input className={fieldClass} type="password" autoComplete="new-password" required minLength={10} maxLength={1024} value={form.password} onChange={update('password')} placeholder="At least 10 characters" /><span className="mt-1 block text-xs font-normal text-t-muted">{form.password.length}/10 minimum characters</span></label>
          {config.signupMode === 'invite' && <label className="block text-sm font-medium">6-digit invite code<input className={fieldClass} type="text" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={128} value={form.inviteCode} onChange={update('inviteCode')} /></label>}
          <div className="space-y-3 rounded-xl border border-t-border bg-t-bg p-4 text-sm">
            <label className="flex items-start gap-3"><input className="mt-1 accent-t-accent" type="checkbox" checked={form.acceptedTerms} onChange={update('acceptedTerms')} required /><span>I accept the <Link className="text-t-accent underline" to="/legal/terms">Terms of Service</Link>.</span></label>
            <label className="flex items-start gap-3"><input className="mt-1 accent-t-accent" type="checkbox" checked={form.acceptedPrivacy} onChange={update('acceptedPrivacy')} required /><span>I have read the <Link className="text-t-accent underline" to="/legal/privacy">Privacy Policy</Link>.</span></label>
            <p className="text-xs leading-5 text-t-muted">These policy pages are internal previews and require approval before public registration.</p>
          </div>
          <button className={buttonClass} disabled={loading || !form.acceptedTerms || !form.acceptedPrivacy}>{loading ? 'Creating account…' : 'Create account'}</button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-t-muted">Already have an account? <Link className="font-medium text-t-accent hover:underline" to="/admin/login">Sign in</Link></p>
    </AuthShell>
  );
}
