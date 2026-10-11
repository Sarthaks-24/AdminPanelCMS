import React from 'react';
import { Link } from 'react-router-dom';
import Wordmark from '../../components/Wordmark';
import { SITE } from '../../content/site';

export default function AuthShell({ eyebrow = SITE.name, title, description, children, wide = false }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-t-bg px-4 py-12 text-t-text antialiased">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-t-accent/10 via-transparent to-transparent" />
      <section className={`page-enter relative w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-3xl border border-t-border bg-t-surface p-6 shadow-card sm:p-10`} aria-labelledby="auth-title">
        <Wordmark className="mb-8" label={`${SITE.name} home`} />
        <p className="text-sm font-medium text-t-accent">{eyebrow}</p>
        <h1 id="auth-title" className="mt-2 text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-2 text-sm leading-6 text-t-muted">{description}</p>}
        <div className="mt-7">{children}</div>
        <nav aria-label="Legal" className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-t-border pt-5 text-xs text-t-dim">
          <Link to="/legal/terms" className="hover:text-t-text hover:underline">Terms of Service</Link>
          <Link to="/legal/privacy" className="hover:text-t-text hover:underline">Privacy Policy</Link>
        </nav>
      </section>
    </main>
  );
}

export const fieldClass = 'mt-2 w-full rounded-xl border border-t-border-hi bg-t-bg px-4 py-3 text-sm text-t-text placeholder:text-t-dim focus:border-t-accent focus:outline-none focus:ring-2 focus:ring-t-accent/20';
export const buttonClass = 'flex w-full items-center justify-center rounded-xl bg-t-accent px-4 py-3 text-sm font-semibold text-t-on-accent transition hover:bg-t-accent-br disabled:cursor-wait disabled:opacity-60';
