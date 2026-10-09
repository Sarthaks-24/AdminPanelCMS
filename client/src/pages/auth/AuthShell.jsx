import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export default function AuthShell({ eyebrow = 'Portfolio Control', title, description, children }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-t-bg px-4 py-12 text-t-text antialiased">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-t-accent/10 via-transparent to-transparent" />
      <section className="relative w-full max-w-lg rounded-2xl border border-t-border bg-t-surface p-6 shadow-2xl shadow-black/10 sm:p-10" aria-labelledby="auth-title">
        <Link to="/admin/login" className="mb-8 inline-flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-t-accent text-t-on-accent"><ShieldCheck size={20} /></span>
          <span className="text-sm font-semibold tracking-tight">Portfolio Control</span>
        </Link>
        <p className="text-sm font-medium text-t-accent">{eyebrow}</p>
        <h1 id="auth-title" className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-2 text-sm leading-6 text-t-muted">{description}</p>}
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}

export const fieldClass = 'mt-2 w-full rounded-xl border border-t-border-hi bg-t-bg px-4 py-3 text-sm text-t-text placeholder:text-t-dim focus:border-t-accent focus:outline-none focus:ring-2 focus:ring-t-accent/20';
export const buttonClass = 'flex w-full items-center justify-center rounded-xl bg-t-accent px-4 py-3 text-sm font-semibold text-t-on-accent transition hover:bg-t-accent-br disabled:cursor-wait disabled:opacity-60';
