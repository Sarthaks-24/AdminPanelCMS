import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import AuthShell, { buttonClass, fieldClass } from './AuthShell';

const MIN_LENGTH = 10;

// The link proves the inbox; this page is where its owner chooses the password and gets signed in.
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { applySession } = useAuth();
  const [token] = useState(() => params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    // Keep the single-use token out of the address bar, history and any referrer.
    if (!params.get('token')) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [params]);

  const longEnough = password.length >= MIN_LENGTH;
  const matches = confirm.length > 0 && confirm === password;

  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (!longEnough) return setError(`Use at least ${MIN_LENGTH} characters.`);
    if (password !== confirm) return setError('The passwords do not match.');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/verify-email', { token, password });
      applySession(data.user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const code = err.response?.data?.error;
      if (code === 'token_invalid') setExpired(true);
      else if (code === 'password_invalid') setError(`Use at least ${MIN_LENGTH} characters.`);
      else if (code === 'rate_limited') setError('Too many attempts from your connection. Try again in an hour.');
      else setError('We could not finish setting up your account. Please try again.');
    } finally { setLoading(false); }
  };

  if (!token || expired) {
    return (
      <AuthShell eyebrow="Email verification" title={token ? 'This link no longer works' : 'This link is missing its code'} description={token ? 'Verification links work once and expire after 24 hours. Ask for a fresh one with the email you signed up with.' : 'Open the link from your email again, or start the registration over.'}>
        <Link className={buttonClass} to="/check-email">Send me a new link</Link>
        <p className="mt-5 text-center text-sm text-t-muted">Already set a password? <Link className="font-medium text-t-accent hover:underline" to="/login">Sign in</Link></p>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="Email verification" title="Choose your password" description="Your email address is confirmed as soon as you set a password. You’ll be signed in right after.">
      <form onSubmit={submit} className="space-y-5">
        {error && <p role="alert" className="rounded-lg border border-t-danger/30 bg-t-danger-dim p-3 text-sm text-t-danger">{error}</p>}
        <label className="block text-sm font-medium">Password
          <input className={fieldClass} type="password" autoComplete="new-password" required minLength={MIN_LENGTH} maxLength={1024} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={`At least ${MIN_LENGTH} characters`} aria-describedby="password-hint" />
          <span id="password-hint" aria-live="polite" className={`mt-1 block text-xs font-normal ${longEnough ? 'text-t-accent' : 'text-t-muted'}`}>{longEnough ? '✓ Long enough' : `At least ${MIN_LENGTH} characters`}</span>
        </label>
        <label className="block text-sm font-medium">Confirm password
          <input className={fieldClass} type="password" autoComplete="new-password" required minLength={MIN_LENGTH} maxLength={1024} value={confirm} onChange={(event) => setConfirm(event.target.value)} aria-describedby="confirm-hint" />
          <span id="confirm-hint" aria-live="polite" className={`mt-1 block text-xs font-normal ${matches ? 'text-t-accent' : 'text-t-muted'}`}>{matches ? '✓ Passwords match' : 'Type it again'}</span>
        </label>
        <button className={buttonClass} disabled={loading}>{loading ? 'Setting your password…' : 'Set password and continue'}</button>
      </form>
    </AuthShell>
  );
}
