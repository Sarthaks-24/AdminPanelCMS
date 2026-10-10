import React, { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import PublicShell from '../../components/public/PublicShell';
import Markdown, { outlineOf } from '../../components/public/Markdown';
import { DOCS, EXTRA_PAGES, getDoc } from '../../content/docs';
import { REPO_URL } from '../../content/site';

const ALL = [...DOCS, ...EXTRA_PAGES];

// The readme has a route of its own; everything else is served under /docs.
const routeFor = (page) => (page.slug === 'readme' ? '/readme' : `/docs/${page.slug}`);

/** `slug` is passed directly for the pages that have their own route, such as /readme. */
export default function DocPage({ slug: fixedSlug }) {
  const params = useParams();
  const { hash } = useLocation();
  const slug = fixedSlug || params.slug;
  const doc = getDoc(slug);

  // A link carrying a #fragment has to wait for the Markdown to mount before it can scroll. The hash
  // is in the deps because a router Link to another section of the same page does not remount this.
  useEffect(() => {
    if (!doc) return;
    if (!hash) { window.scrollTo(0, 0); return; }
    let id = hash.slice(1);
    // A hand-edited or truncated escape sequence would otherwise throw and blank the page.
    try { id = decodeURIComponent(id); } catch { /* use the raw fragment */ }
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [doc, slug, hash]);

  if (!doc) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
          <h1 className="font-display text-[1.75rem] tracking-tight">No such page</h1>
          <p className="mt-3 text-[0.9375rem] leading-7 text-t-muted">
            That document isn't part of this build. The index lists everything that is.
          </p>
          <Link to="/docs" className="mt-7 inline-block rounded-xl bg-t-accent px-5 py-2.5 text-[0.875rem] font-semibold text-t-on-accent transition hover:bg-t-accent-br">
            Back to the index
          </Link>
        </div>
      </PublicShell>
    );
  }

  const outline = outlineOf(doc.body);
  const position = ALL.findIndex((item) => item.slug === doc.slug);
  const previous = position > 0 ? ALL[position - 1] : null;
  const next = position >= 0 && position < ALL.length - 1 ? ALL[position + 1] : null;

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_15rem]">
          <article className="page-enter min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem]">
              <Link to="/docs" className="text-t-accent hover:underline">Docs</Link>
              <span className="text-t-dim" aria-hidden="true">/</span>
              <span className="text-t-muted">{doc.title}</span>
            </div>
            <Markdown source={doc.source}>{doc.body}</Markdown>

            <nav aria-label="Nearby documents" className="mt-14 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3 border-t border-t-border pt-5">
              {previous ? (
                <Link to={routeFor(previous)} className="text-[0.9375rem] text-t-muted transition hover:text-t-text">
                  <span className="text-t-dim">Previous</span> &nbsp;{previous.title}
                </Link>
              ) : <span />}
              {next && (
                <Link to={routeFor(next)} className="ml-auto text-[0.9375rem] text-t-muted transition hover:text-t-text">
                  <span className="text-t-dim">Next</span> &nbsp;{next.title}
                </Link>
              )}
            </nav>
          </article>

          <aside className="order-first lg:order-none">
            <div className="lg:sticky lg:top-20">
              <p className="font-mono-code text-[0.75rem] text-t-dim">{doc.source}</p>
              <a
                href={`${REPO_URL}/blob/main/${doc.source}`}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1.5 inline-block text-[0.8125rem] text-t-accent hover:underline"
              >
                Edit on GitHub
              </a>
              {outline.length > 1 && (
                <nav aria-label="On this page" className="mt-6 border-t border-t-border pt-4">
                  <p className="text-[0.75rem] font-medium text-t-muted">On this page</p>
                  <ul className="mt-2 space-y-1">
                    {outline.map((item) => (
                      <li key={item.id} style={{ paddingLeft: item.depth === 3 ? '0.75rem' : 0 }}>
                        <a href={`#${item.id}`} className="block py-0.5 text-[0.8125rem] leading-5 text-t-muted transition hover:text-t-text">
                          {item.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </div>
          </aside>
        </div>
      </div>
    </PublicShell>
  );
}
