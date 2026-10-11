import React from 'react';
import { Link } from 'react-router-dom';
import PublicShell from '../../components/public/PublicShell';
import { DOCS, DOC_GROUPS, EXTRA_PAGES } from '../../content/docs';

function DocRow({ to, title, blurb }) {
  return (
    <Link to={to} className="block border-t border-t-border py-4 transition hover:bg-t-surface/60">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-[1rem] font-semibold text-t-text">{title}</h3>
      </div>
      {blurb && <p className="mt-1.5 max-w-2xl text-[0.875rem] leading-6 text-t-muted">{blurb}</p>}
    </Link>
  );
}

export default function DocsIndex() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-14 sm:px-6">
        <div className="page-enter max-w-2xl">
          <h1 className="text-balance font-display text-[2.25rem] leading-[1.05] tracking-[-0.03em] sm:text-[2.75rem]">Documentation</h1>
          <p className="mt-4 text-[1.0625rem] leading-7 text-t-muted">
            How to get to your first request, and the reference for everything after it. Every snippet
            already contains your base URL, so it can be pasted as is.
          </p>
        </div>

        {DOC_GROUPS.map((group) => {
          const pages = DOCS.filter((doc) => doc.group === group);
          if (!pages.length) return null;
          return (
            <section key={group} aria-labelledby={`group-${group}`} className="mt-12">
              <h2 id={`group-${group}`} className="text-[0.8125rem] font-medium text-t-accent">{group}</h2>
              <div className="mt-3">
                {pages.map((doc) => (
                  <DocRow key={doc.slug} to={`/docs/${doc.slug}`} title={doc.title} blurb={doc.blurb} />
                ))}
              </div>
            </section>
          );
        })}

        <section aria-labelledby="group-other" className="mt-12">
          <h2 id="group-other" className="text-[0.8125rem] font-medium text-t-accent">Also</h2>
          <div className="mt-3">
            {EXTRA_PAGES.map((page) => (
              <DocRow key={page.slug} to={`/docs/${page.slug}`} title={page.title} />
            ))}
            <DocRow to="/legal/terms" title="Terms of service" />
            <DocRow to="/legal/privacy" title="Privacy policy" />
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
