import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import AuthShell, { buttonClass, fieldClass } from './AuthShell';

export default function ForgotPassword() {
  const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async (event) => {
    event.preventDefault(); setLoading(true); setError('');
    try { await api.post('/auth/forgot-password', { email }); setSent(true); }
    catch { setError('We could not process that request. Please try again shortly.'); }
    finally { setLoading(false); }
  };
  return <AuthShell eyebrow="Account recovery" title={sent ? 'Check your inbox' : 'Forgot your password?'} description={sent ? 'If an account exists for that address, password reset instructions will be sent.' : 'Enter your account email and we’ll send reset instructions if an account matches.'}>
    {!sent && <form onSubmit={submit} className="space-y-5">{error && <p role="alert" className="text-sm text-t-danger">{error}</p>}<label className="block text-sm font-medium">Email address<input className={fieldClass} type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><button className={buttonClass} disabled={loading}>{loading ? 'Sending…' : 'Send reset link'}</button></form>}
    <Link className="mt-6 block text-center text-sm font-medium text-t-accent hover:underline" to="/admin/login">Return to sign in</Link>
  </AuthShell>;
}
