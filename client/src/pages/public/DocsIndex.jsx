import React from 'react';
import { Link } from 'react-router-dom';
import PublicShell from '../../components/public/PublicShell';
import { DOCS, DOC_GROUPS, EXTRA_PAGES } from '../../content/docs';
import { REPO_URL } from '../../content/site';

export default function DocsIndex() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-14 sm:px-6">
        <div className="page-enter max-w-2xl">
          <h1 className="font-display text-[2.25rem] leading-[1.05] tracking-[-0.03em] sm:text-[2.75rem]">Documentation</h1>
          <p className="mt-4 text-[1.0625rem] leading-7 text-t-muted">
            These pages are the repository's own Markdown files, rendered here. What you read is what the
            repository ships, so it cannot drift from the code.
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
                  <Link
                    key={doc.slug}
                    to={`/docs/${doc.slug}`}
                    className="block border-t border-t-border py-4 transition hover:bg-t-surface/60"
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-[1rem] font-semibold text-t-text">{doc.title}</h3>
                      <span className="font-mono-code text-[0.75rem] text-t-dim">{doc.source}</span>
                    </div>
                    <p className="mt-1.5 max-w-2xl text-[0.875rem] leading-6 text-t-muted">{doc.blurb}</p>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

        <section aria-labelledby="group-other" className="mt-12">
          <h2 id="group-other" className="text-[0.8125rem] font-medium text-t-accent">Also in the repository</h2>
          <div className="mt-3">
            {EXTRA_PAGES.map((page) => (
              <Link key={page.slug} to={`/docs/${page.slug}`} className="block border-t border-t-border py-4 transition hover:bg-t-surface/60">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-[1rem] font-semibold text-t-text">{page.title}</h3>
                  <span className="font-mono-code text-[0.75rem] text-t-dim">{page.source}</span>
                </div>
              </Link>
            ))}
            <Link to="/license" className="block border-t border-t-border py-4 transition hover:bg-t-surface/60">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-[1rem] font-semibold text-t-text">License</h3>
                <span className="font-mono-code text-[0.75rem] text-t-dim">LICENSE</span>
              </div>
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="block border-t border-t-border py-4 transition hover:bg-t-surface/60"
            >
              <h3 className="text-[1rem] font-semibold text-t-text">Source on GitHub</h3>
              <p className="mt-1.5 text-[0.875rem] leading-6 text-t-muted">Issues, history, and the files these pages are rendered from.</p>
            </a>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
