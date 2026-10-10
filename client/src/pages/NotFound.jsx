import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-t-bg px-4 py-16 text-t-text">
      <div className="page-enter max-w-md text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-t-border-hi bg-t-surface text-t-accent"><Compass size={22} aria-hidden="true" /></span>
        <p className="mt-6 font-mono text-xs uppercase tracking-widest text-t-accent">Error 404</p>
        <h1 className="mt-2 text-3xl font-semibold">This page doesn’t exist</h1>
        <p className="mt-3 text-sm leading-6 text-t-muted">The link may be out of date, or the page may have moved. The docs index lists every page that exists.</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="inline-flex items-center gap-2 rounded-xl bg-t-accent px-5 py-2.5 text-sm font-semibold text-t-on-accent transition hover:bg-t-accent-br"><ArrowLeft size={16} aria-hidden="true" />Home</Link>
          <Link to="/docs" className="rounded-xl border border-t-border-hi px-5 py-2.5 text-sm font-medium text-t-text transition hover:border-t-accent">Docs</Link>
        </div>
      </div>
    </main>
  );
}
