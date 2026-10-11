import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import PublicShell from '../../components/public/PublicShell';
import Markdown, { outlineOf } from '../../components/public/Markdown';
import { API_BASE_PLACEHOLDER, DOCS, EXTRA_PAGES, SUPPORT_EMAIL_PLACEHOLDER, getDoc } from '../../content/docs';
import { SITE, supportMailto } from '../../content/site';
import { PENDING_BASE, useApiBase } from '../../lib/apiBase';

const ALL = [...DOCS, ...EXTRA_PAGES];

const routeFor = (page) => `/docs/${page.slug}`;

/** Copies the base URL. Disabled until the server has said what the base URL is. */
function CopyBase({ value, disabled }) {
  const [state, setState] = useState('idle');
  async function copy() {
    try { await navigator.clipboard.writeText(value); setState('done'); }
    catch { setState('failed'); }
    window.setTimeout(() => setState('idle'), 1800);
  }
  return (
    <>
      <button type="button" onClick={copy} disabled={disabled} className="ml-2 rounded border border-t-border px-1.5 py-0.5 text-[0.6875rem] text-t-muted transition hover:border-t-accent hover:text-t-text disabled:cursor-not-allowed disabled:opacity-50">
        {state === 'done' ? 'Copied' : 'Copy'}
      </button>
      <span aria-live="polite" className="sr-only">{state === 'done' ? 'Copied.' : state === 'failed' ? 'Copy failed; select the text and copy it yourself.' : ''}</span>
    </>
  );
}

/** `slug` is passed directly for pages that have their own route; otherwise it comes from the URL. */
export default function DocPage({ slug: fixedSlug }) {
  const params = useParams();
  const { hash } = useLocation();
  const slug = fixedSlug || params.slug;
  const doc = getDoc(slug);
  // The docs are written against `{{API_BASE}}` (the bare origin; every path in them starts with
  // /v1). The public base URL replaces it before rendering, so every snippet is copy-ready. Until the
  // server has answered, the snippets show `…` rather than a guess someone could copy.
  const { apiOrigin, resolved, configured } = useApiBase();
  const shownBase = resolved ? apiOrigin : PENDING_BASE;
  const body = useMemo(() => (doc
    ? doc.body.split(API_BASE_PLACEHOLDER).join(shownBase).split(SUPPORT_EMAIL_PLACEHOLDER).join(SITE.support.email)
    : ''), [doc, shownBase]);

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
          <h1 className="text-balance font-display text-[1.75rem] tracking-tight">No such page</h1>
          <p className="mt-3 text-[0.9375rem] leading-7 text-t-muted">
            That document isn&rsquo;t published here. The index lists everything that is.
          </p>
          <Link to="/docs" className="mt-7 inline-block rounded-xl bg-t-accent px-5 py-2.5 text-[0.875rem] font-semibold text-t-on-accent transition hover:bg-t-accent-br">
            Back to the index
          </Link>
        </div>
      </PublicShell>
    );
  }

  const outline = outlineOf(body);
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
            <Markdown source={doc.source}>{body}</Markdown>

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
              <p className="text-[0.75rem] text-t-dim">
                Base URL <code className="font-mono-code text-t-muted" translate="no">{shownBase}</code>
                <CopyBase value={apiOrigin} disabled={!resolved} />
              </p>
              {resolved && !configured && (
                <p className="mt-1.5 text-[0.75rem] leading-5 text-t-warn">
                  The service has not published its API address, so this one is a guess. If it answers with a web page instead of JSON, email{' '}
                  <a href={supportMailto('API base URL')} className="underline">{SITE.support.email}</a>.
                </p>
              )}
              <a
                href={supportMailto(`Docs: ${doc.title}`)}
                className="mt-1.5 inline-block text-[0.8125rem] text-t-accent hover:underline"
              >
                Something wrong on this page? Tell us
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
