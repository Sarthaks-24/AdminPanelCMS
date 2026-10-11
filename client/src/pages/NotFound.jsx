import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { fallbackApiOrigin } from '../lib/apiBase';

// A /v1 or /api request that reaches the dashboard's host was sent to the wrong host (the static host
// serves index.html for every path), so say where the API is instead of a generic 404.
const API_PATH = /^\/(v1|api)(\/|$)/;

export default function NotFound() {
  const { pathname } = useLocation();
  const wrongHost = API_PATH.test(pathname);
  const apiOrigin = wrongHost ? fallbackApiOrigin() : '';
  return (
    <main className="flex min-h-dvh items-center justify-center bg-t-bg px-4 py-16 text-t-text">
      <div className="page-enter max-w-md text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-t-border-hi bg-t-surface text-t-accent"><Compass size={22} aria-hidden="true" /></span>
        <p className="mt-6 font-mono text-xs uppercase tracking-widest text-t-accent">Error 404</p>
        {wrongHost ? (
          <>
            <h1 className="mt-2 text-balance text-3xl font-semibold">This is the dashboard, not the API</h1>
            <p className="mt-3 text-sm leading-6 text-t-muted">
              API requests go to the API host{apiOrigin && <>, <code translate="no" className="break-all text-t-text">{apiOrigin}{pathname}</code></>}, not this website. The API reference lists every endpoint.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-2 text-balance text-3xl font-semibold">This page doesn’t exist</h1>
            <p className="mt-3 text-sm leading-6 text-t-muted">The link may be out of date, or the page may have moved. The docs index lists every page that exists.</p>
          </>
        )}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="inline-flex items-center gap-2 rounded-xl bg-t-accent px-5 py-2.5 text-sm font-semibold text-t-on-accent transition hover:bg-t-accent-br"><ArrowLeft size={16} aria-hidden="true" />Home</Link>
          <Link to={wrongHost ? '/docs/api' : '/docs'} className="rounded-xl border border-t-border-hi px-5 py-2.5 text-sm font-medium text-t-text transition hover:border-t-accent">{wrongHost ? 'API reference' : 'Docs'}</Link>
          <Link to="/signup" className="px-2 py-2.5 text-sm text-t-muted transition hover:text-t-text hover:underline">Create a free account</Link>
        </div>
      </div>
    </main>
  );
}
