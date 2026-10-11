import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { LockKeyhole, Mail, Eye, EyeOff, ShieldCheck, ArrowRight } from 'lucide-react';

const ERROR_COPY = {
  credentials_invalid: 'Invalid credentials or unverified email.',
  account_suspended: 'This account is suspended. Contact support if you think this is a mistake.',
  rate_limited: 'Too many sign-in attempts for this address from your connection. Try again in 15 minutes.',
};

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupMode, setSignupMode] = useState('closed');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { api.get('/auth/config', { skipAuthRedirect: true }).then(({ data }) => setSignupMode(data.signupEnabled ? data.signupMode : 'closed')).catch(() => setSignupMode('unknown')); }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/admin/dashboard');
    } catch (err) {
      const data = err.response?.data;
      setError(data?.message || ERROR_COPY[data?.error] || 'Sign in failed. Check your email and password, then try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-t-bg px-4 py-12 text-t-text antialiased">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-t-accent/10 via-transparent to-transparent" />
      <div className="page-enter relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-t-border bg-t-surface shadow-card lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden flex-col justify-between bg-t-accent/5 p-10 lg:flex xl:p-14">
          <Link to="/" className="flex w-fit items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent" aria-label="Portfolio Control home">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-t-accent text-t-on-accent shadow-md shadow-t-accent/20">
              <ShieldCheck size={22} />
            </div>
            <p className="font-semibold tracking-tight">Portfolio Control</p>
          </Link>
          <div className="max-w-md py-10">
            <p className="font-display text-5xl font-semibold leading-[1.02] tracking-tight text-t-text">Your work, shown the way you want it seen.</p>
            <p className="mt-6 max-w-sm text-base leading-7 text-t-muted">Sign in to edit your projects and profile, and choose what each of your apps can show.</p>
          </div>
          <p className="text-xs text-t-muted" aria-hidden="true" />
        </section>

        <section className="p-6 sm:p-10 xl:p-14" aria-labelledby="login-title">
          <div className="mb-8 lg:hidden">
            <Link to="/" className="inline-flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent" aria-label="Portfolio Control home">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-t-accent text-t-on-accent shadow-md shadow-t-accent/20"><ShieldCheck size={22} /></div>
              <p className="text-sm font-semibold">Portfolio Control</p>
            </Link>
          </div>
          <div className="mb-8">
            <h1 id="login-title" className="font-display text-3xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-2 text-sm text-t-muted">Welcome back. Use the email and password for your account.</p>
          </div>

          {error && (
            <div role="alert" className="mb-5 flex items-start gap-3 rounded-xl border border-t-danger/30 bg-t-danger-dim p-3.5 text-sm text-t-danger">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-t-danger" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="admin-email" className="mb-2 block text-sm font-medium">Email address</label>
              <div className="relative">
                <Mail aria-hidden="true" size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-t-dim" />
                <input id="admin-email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="w-full rounded-xl border border-t-border-hi bg-t-bg py-3 pl-10 pr-4 text-sm text-t-text placeholder:text-t-dim" />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="admin-password" className="text-sm font-medium">Password</label>
              </div>
              <div className="relative">
                <LockKeyhole aria-hidden="true" size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-t-dim" />
                <input id="admin-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className="w-full rounded-xl border border-t-border-hi bg-t-bg py-3 pl-10 pr-12 text-sm text-t-text placeholder:text-t-dim" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-t-dim hover:text-t-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent">
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-t-accent px-4 py-3 text-sm font-semibold text-t-on-accent shadow-sm transition hover:bg-t-accent-br disabled:cursor-wait disabled:opacity-60">
              {loading ? 'Signing in…' : <>Sign in <ArrowRight size={16} /></>}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
            <Link to="/admin/forgot-password" className="text-t-accent underline-offset-4 hover:underline">Forgot your password?</Link>
            {signupMode !== 'closed' && <Link to="/admin/signup" className="font-medium text-t-accent hover:underline">{signupMode === 'invite' ? 'Redeem an invite' : 'Create an account'}</Link>}
          </div>
          <p className="mt-4 text-center text-xs text-t-muted">Signed up but never set a password? <Link to="/admin/check-email" className="text-t-accent hover:underline">Resend your link</Link>.</p>

          <div className="mt-8 flex items-center gap-2 border-t border-t-border pt-5 text-xs text-t-muted">
            <ShieldCheck size={15} className="text-t-accent2" />
            <span>Your session is stored securely and expires after seven days.</span>
          </div>
        </section>
      </div>
    </main>
  );
}
