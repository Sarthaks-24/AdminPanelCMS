import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import AuthShell, { buttonClass, fieldClass } from './AuthShell';
import { TERMS_VERSION, PRIVACY_VERSION } from './LegalPreview';

const CONSENT_ERROR = 'Accept the Terms and Privacy Policy to continue';

const ERROR_COPY = {
  invite_invalid: 'That invite code is invalid or has expired.',
  invite_locked: 'Too many incorrect invite codes from your connection. Try again in an hour or ask for a new invite.',
  signup_unavailable: 'Registration is closed right now.',
  email_unavailable: 'Registration is temporarily unavailable. Please try again later.',
  mail_budget: 'We cannot send more email today. Please try again tomorrow.',
  rate_limited: 'Too many attempts from your connection. Try again in an hour.',
  validation_failed: 'Enter a valid email address.',
};

export default function Signup() {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({ email: '', inviteCode: '', acceptedTerms: false, acceptedPrivacy: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { api.get('/auth/config', { skipAuthRedirect: true }).then(({ data }) => setConfig(data)).catch(() => setConfig({ signupEnabled: false, unknown: true })); }, []);
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (!form.acceptedTerms || !form.acceptedPrivacy) { setError(CONSENT_ERROR); return; }
    setLoading(true);
    try {
      const email = form.email.trim();
      await api.post('/auth/signup', {
        email,
        inviteCode: config?.signupMode === 'invite' ? form.inviteCode.trim() : undefined,
        acceptedTerms: true,
        acceptedPrivacy: true,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
      });
      navigate('/admin/check-email', { replace: true, state: { email } });
    } catch (err) {
      const code = err.response?.data?.error;
      setError(ERROR_COPY[code] || err.response?.data?.message || 'We could not start your registration. Check your details and try again.');
    } finally { setLoading(false); }
  };

  const inviteMode = config?.signupMode === 'invite';
  const description = config === null
    ? 'Checking registration availability…'
    : !config.signupEnabled
      ? (config.unknown ? 'We could not reach the registration service. Try again in a moment.' : 'Registration is closed right now.')
      : inviteMode
        ? 'Registration is invite-only right now. Enter the code from your invite email.'
        : 'Free during the beta. You’ll verify your email next.';

  return (
    <AuthShell eyebrow="Get started" title="Create your account" description={description}>
      {config === null ? <p role="status" className="text-sm text-t-muted">One moment…</p> : !config.signupEnabled ? (
        <div role="status" className="rounded-xl border border-t-border bg-t-bg p-4 text-sm text-t-muted">
          {config.unknown ? 'Reload the page to try again.' : 'Check back later, or sign in if you already have an account.'}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          {error && <p role="alert" className="rounded-lg border border-t-danger/30 bg-t-danger-dim p-3 text-sm text-t-danger">{error}</p>}
          <label className="block text-sm font-medium">Email address<input className={fieldClass} type="email" autoComplete="email" required maxLength={254} value={form.email} onChange={update('email')} placeholder="you@example.com" /></label>
          {inviteMode && (
            <label className="block text-sm font-medium">Invite code
              <input className={`${fieldClass} font-mono uppercase tracking-wider`} type="text" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} required maxLength={128} value={form.inviteCode} onChange={update('inviteCode')} placeholder="ABCD-EFGH-JKLM" />
              <span className="mt-1 block text-xs font-normal text-t-muted">Dashes and spaces are ignored.</span>
            </label>
          )}
          <div className="space-y-3 rounded-xl border border-t-border bg-t-bg p-4 text-sm">
            <label className="flex items-start gap-3"><input className="mt-1 accent-t-accent" type="checkbox" checked={form.acceptedTerms} onChange={update('acceptedTerms')} /><span>I accept the <a className="text-t-accent underline" href="/legal/terms" target="_blank" rel="noopener noreferrer">Terms of Service<span className="sr-only"> (opens in a new tab)</span></a>.</span></label>
            <label className="flex items-start gap-3"><input className="mt-1 accent-t-accent" type="checkbox" checked={form.acceptedPrivacy} onChange={update('acceptedPrivacy')} /><span>I have read the <a className="text-t-accent underline" href="/legal/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy<span className="sr-only"> (opens in a new tab)</span></a>.</span></label>
          </div>
          <button className={buttonClass} disabled={loading}>{loading ? 'Sending your link…' : 'Create account'}</button>
          <p className="text-xs leading-5 text-t-muted">No password yet: we email you a link, and you choose your password when you open it.</p>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-t-muted">Already have an account? <Link className="font-medium text-t-accent hover:underline" to="/admin/login">Sign in</Link></p>
    </AuthShell>
  );
}
