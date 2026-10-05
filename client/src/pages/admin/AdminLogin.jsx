import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, ArrowRight, Terminal } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Check your admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-t-bg text-t-text flex items-center justify-center p-4 relative antialiased font-sans">
      {/* Console Login Card */}
      <div className="relative z-10 w-full max-w-md bg-t-surface border border-t-border p-8 sm:p-9 rounded shadow-2xl space-y-6">
        {/* Terminal Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded bg-t-accent text-t-on-accent flex items-center justify-center font-mono font-bold text-base shadow-md shadow-t-accent/30 border border-t-accent-br/40 mx-auto">
            PS
          </div>
          <h1 className="text-xl font-bold text-t-text tracking-tight pt-1">Admin Command Console</h1>
          <p className="text-xs text-t-muted font-mono">
            PS C:\&gt; Enter credentials to access content management authority.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded bg-t-danger-dim border border-t-danger/40 text-t-danger text-xs flex items-center gap-2 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0"></span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-t-muted mb-1">Admin Email Address</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-t-dim" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full pl-10 pr-4 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-t-muted mb-1">Security Key / Password</label>
            <div className="relative">
              <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-t-dim" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-11 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-t-dim hover:text-t-muted cursor-pointer"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-xs transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer font-mono"
          >
            {loading ? (
              <span>Authenticating Session...</span>
            ) : (
              <>
                <span>Execute Sign In</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-t-border flex items-center justify-between text-[11px] font-mono text-t-dim">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-t-accent2" />
            <span>Encrypted JWT Access</span>
          </div>
          <span className="text-t-accent">Node.js Express</span>
        </div>
      </div>
    </div>
  );
}
