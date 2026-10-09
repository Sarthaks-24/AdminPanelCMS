import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import AuthShell, { buttonClass, fieldClass } from './AuthShell';

export default function ResetPassword() {
  const [params] = useSearchParams(); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [done, setDone] = useState(false); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const token = params.get('token');
  const submit = async (event) => {
    event.preventDefault(); setError('');
    if (!token) return setError('This reset link is missing its token.');
    if (password !== confirm) return setError('The passwords do not match.');
    setLoading(true);
    try { await api.post('/auth/reset-password', { token, newPassword: password }); setDone(true); }
    catch (err) { setError(err.response?.data?.error === 'token_invalid' ? 'This reset link is invalid, expired, or already used.' : 'We could not reset the password. Please try again.'); }
    finally { setLoading(false); }
  };
  return <AuthShell eyebrow="Account recovery" title={done ? 'Password updated' : 'Choose a new password'} description={done ? 'Your password is updated. Sign in with the new password.' : 'Use at least 10 characters. This reset link can only be used once.'}>
    {!done && <form onSubmit={submit} className="space-y-5">{error && <p role="alert" className="text-sm text-t-danger">{error}</p>}<label className="block text-sm font-medium">New password<input className={fieldClass} type="password" required minLength={10} maxLength={1024} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="block text-sm font-medium">Confirm new password<input className={fieldClass} type="password" required minLength={10} maxLength={1024} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label><button className={buttonClass} disabled={loading}>{loading ? 'Updating…' : 'Update password'}</button></form>}
    {done && <Link className="mt-5 block text-center text-sm font-medium text-t-accent hover:underline" to="/admin/login">Continue to sign in</Link>}
  </AuthShell>;
}
