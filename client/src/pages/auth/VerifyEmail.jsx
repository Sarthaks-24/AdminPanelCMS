import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import AuthShell from './AuthShell';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [state, setState] = useState({ loading: true, success: false, message: '' });
  const token = params.get('token');
  const requestRef = useRef(null);
  useEffect(() => {
    let current = true;
    if (!token) return () => { current = false; };
    const url = new URL(window.location.href);
    url.searchParams.delete('token');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);

    if (!requestRef.current || requestRef.current.token !== token) {
      requestRef.current = { token, promise: api.post('/auth/verify-email', { token }) };
    }
    requestRef.current.promise.then(() => { if (current) setState({ loading: false, success: true, message: 'Your email is verified. You can now sign in.' }); })
      .catch(() => { if (current) setState({ loading: false, success: false, message: 'This link is invalid, expired, or already used. Sign in to request a new one.' }); });
    return () => { current = false; };
  }, [token]);
  const current = token ? state : { loading: false, success: false, message: 'This verification link is missing its token.' };
  return <AuthShell eyebrow="Email verification" title={current.loading ? 'Verifying your email…' : current.success ? 'Email verified' : 'Could not verify email'} description={current.message || 'Please wait while we verify your link.'}>
    {!current.loading && <Link className="mt-5 block text-center text-sm font-medium text-t-accent hover:underline" to="/admin/login">Continue to sign in</Link>}
  </AuthShell>;
}
