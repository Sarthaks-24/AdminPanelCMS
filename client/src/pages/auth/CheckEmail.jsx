import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import AuthShell, { buttonClass, fieldClass } from './AuthShell';

export default function CheckEmail() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [status, setStatus] = useState({ kind: '', text: '' });
  const [sending, setSending] = useState(false);

  const resend = async (event) => {
    event.preventDefault();
    setStatus({ kind: '', text: '' });
    const address = email.trim();
    if (!address) { setStatus({ kind: 'error', text: 'Enter the email address you signed up with.' }); return; }
    setSending(true);
    try {
      await api.post('/auth/resend-verification', { email: address });
      setStatus({ kind: 'ok', text: 'If that address is waiting for verification, a new link is on its way.' });
    } catch (err) {
      const code = err.response?.data?.error;
      setStatus({ kind: 'error', text: code === 'rate_limited' ? 'Too many requests. Wait a while before asking for another link.' : code === 'mail_budget' ? 'We cannot send more email today. Please try again tomorrow.' : 'We could not send another link right now. Please try again shortly.' });
    } finally { setSending(false); }
  };

  return (
    <AuthShell eyebrow="One more step" title="Check your inbox">
      <p className="text-sm leading-6 text-t-muted">
        {location.state?.email
          ? <>We sent a link to <strong className="text-t-text">{location.state.email}</strong>. Open it to choose your password.</>
          : <>We sent a link to the address you entered. Open it to choose your password.</>}
      </p>
      <div className="mt-5 rounded-xl border border-t-border bg-t-bg p-4 text-sm leading-6 text-t-muted">The link expires after 24 hours. If you don’t see it within a few minutes, check your spam folder, or ask for another one below.</div>
      <form onSubmit={resend} className="mt-5 space-y-3">
        {status.text && <p role={status.kind === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${status.kind === 'error' ? 'border-t-danger/30 bg-t-danger-dim text-t-danger' : 'border-t-accent/30 bg-t-accent/10 text-t-text'}`}>{status.text}</p>}
        {!location.state?.email && <label className="block text-sm font-medium">Email address<input className={fieldClass} type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>}
        <button type="submit" className={buttonClass} disabled={sending}>{sending ? 'Sending…' : 'Resend the link'}</button>
      </form>
      <Link className="mt-6 block text-center text-sm font-medium text-t-accent hover:underline" to="/admin/login">Return to sign in</Link>
    </AuthShell>
  );
}
