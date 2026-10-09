import React from 'react';
import { Link } from 'react-router-dom';
import AuthShell from './AuthShell';

export default function CheckEmail() {
  return (
    <AuthShell eyebrow="One more step" title="Check your inbox" description="If registration completed, a verification link is on its way. Follow it to verify your email, then sign in to your workspace.">
      <div className="rounded-xl border border-t-border bg-t-bg p-4 text-sm leading-6 text-t-muted">The link expires after 24 hours. If you don’t see it, check your spam folder. You can sign in and request another verification email.</div>
      <Link className="mt-6 block text-center text-sm font-medium text-t-accent hover:underline" to="/admin/login">Return to sign in</Link>
    </AuthShell>
  );
}
