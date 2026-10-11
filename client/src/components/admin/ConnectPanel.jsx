import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, KeyRound, Radio, RefreshCw, ShieldAlert } from 'lucide-react';
import { api } from '../../api/client';
import { describeApiError, ERROR_SECTION_LABELS, ERROR_SECTION_ROUTES } from '../../lib/apiErrors';

const POLL_MS = 10_000;
const POLL_WINDOW_MS = 5 * 60_000;

const SECTION_ORDER = ['profile', 'resume', 'socials', 'skills', 'projects', 'experience', 'education', 'certifications', 'fs'];
const SINGLETONS = new Set(['profile', 'resume']);

const isActive = (token, now = Date.now()) => !token.revokedAt && (!token.expiresAt || new Date(token.expiresAt).getTime() > now);

function formatTime(value) {
  try { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
  catch { return String(value); }
}

/* ───────────────────────── snippets ───────────────────────── */

function buildSnippets({ v1Base, type, key }) {
  const secret = key || 'sk_live_…';
  const publishable = key || 'pk_live_…';
  const astro = `---
// Runs at build time; the secret key never reaches a browser.
const res = await fetch(\`\${import.meta.env.CMS_API_URL}/projects\`, {
  headers: { Authorization: \`Bearer \${import.meta.env.CMS_SECRET_KEY}\` },
});
if (!res.ok) throw new Error(\`CMS \${res.status}: \${(await res.json()).error}\`);
const { data: projects } = await res.json();
---
<ul>{projects.map((p) => <li>{p.title}</li>)}</ul>`;
  const next = `// app/projects/page.jsx — runs on the server; the secret key never reaches a browser.
export default async function ProjectsPage() {
  const res = await fetch(\`\${process.env.CMS_API_URL}/projects\`, {
    headers: { Authorization: \`Bearer \${process.env.CMS_SECRET_KEY}\` },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(\`CMS \${res.status}: \${(await res.json()).error}\`);
  const { data: projects } = await res.json();
  return <ul>{projects.map((p) => <li key={p.slug}>{p.title}</li>)}</ul>;
}`;
  const node = `// fetch-content.mjs — run it in your build step: node fetch-content.mjs
// Lists are fetched once, one after another, and a busy answer is retried after Retry-After.
const base = process.env.CMS_API_URL ?? '${v1Base}';
const headers = { Authorization: \`Bearer \${process.env.CMS_SECRET_KEY}\` };

async function get(path) {
  const res = await fetch(base + path, { headers });
  if (res.status === 503 || res.status === 429) {
    const wait = Number(res.headers.get('retry-after') ?? 1) * 1000;
    await new Promise((r) => setTimeout(r, wait));
    return get(path);
  }
  if (!res.ok) throw new Error(\`CMS \${res.status}: \${(await res.json()).error}\`);
  return (await res.json()).data;
}

const content = {};
for (const section of ['profile', 'projects', 'skills', 'experience']) content[section] = await get('/' + section);
await import('node:fs/promises').then((fs) => fs.writeFile('content.json', JSON.stringify(content, null, 2)));`;
  const curl = `curl -H "Authorization: Bearer ${type === 'static' ? publishable : secret}" ${v1Base}/projects`;
  const browser = `// Browser (publishable key): 120 requests/min per visitor, 3,000/min for the key in total
const res = await fetch('${v1Base}/projects', {
  headers: { Authorization: 'Bearer ${publishable}' },
});
if (!res.ok) throw new Error('CMS ' + res.status);
const { data: projects } = await res.json();`;
  const env = `# .env (never committed; set the same two values in your host's build settings)
CMS_API_URL=${v1Base}
CMS_SECRET_KEY=${secret}`;

  return type === 'static'
    ? [{ id: 'browser', label: 'Browser', code: browser, lang: 'js' }, { id: 'curl', label: 'curl', code: curl, lang: 'bash' }]
    : [
      { id: 'astro', label: 'Astro', code: astro, lang: 'astro', env },
      { id: 'next', label: 'Next.js', code: next, lang: 'jsx', env },
      { id: 'node', label: 'Node script', code: node, lang: 'js', env },
      { id: 'curl', label: 'curl', code: curl, lang: 'bash' },
    ];
}

function CopyButton({ value, label = 'Copy', copiedLabel = 'Copied', className = '' }) {
  const [state, setState] = useState('idle');
  async function copy() {
    try { await navigator.clipboard.writeText(value); setState('done'); }
    catch { setState('failed'); }
    window.setTimeout(() => setState('idle'), 1800);
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={copy} className={`inline-flex min-h-9 items-center gap-1.5 rounded border border-t-border-hi px-3 text-xs font-medium text-t-text hover:border-t-accent hover:text-t-accent ${className}`}>
        {state === 'done' ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}{state === 'done' ? copiedLabel : label}
      </button>
      <span aria-live="polite" className="sr-only">{state === 'done' ? `${copiedLabel}.` : state === 'failed' ? 'Copy failed; select the text and copy it yourself.' : ''}</span>
      {state === 'failed' && <span className="text-xs text-t-warn">Select and copy it yourself.</span>}
    </span>
  );
}

function Snippets({ v1Base, type, keyValue, keyShownOnce }) {
  const snippets = useMemo(() => buildSnippets({ v1Base, type, key: keyValue }), [v1Base, type, keyValue]);
  const [active, setActive] = useState(snippets[0].id);
  const current = snippets.find((snippet) => snippet.id === active) || snippets[0];
  const tabsRef = useRef(null);

  function onTabKey(event) {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = snippets.findIndex((snippet) => snippet.id === current.id);
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? snippets.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + snippets.length) % snippets.length;
    setActive(snippets[nextIndex].id);
    tabsRef.current?.querySelectorAll('[role="tab"]')[nextIndex]?.focus();
  }

  return (
    <div>
      <div ref={tabsRef} role="tablist" aria-label="Snippet language" onKeyDown={onTabKey} className="flex flex-wrap gap-1 border-b border-t-border">
        {snippets.map((snippet) => (
          <button key={snippet.id} type="button" role="tab" id={`snippet-tab-${snippet.id}`} aria-selected={snippet.id === current.id} aria-controls={`snippet-panel-${snippet.id}`} tabIndex={snippet.id === current.id ? 0 : -1} onClick={() => setActive(snippet.id)}
            className={`-mb-px min-h-9 border-b-2 px-3 text-sm transition-colors ${snippet.id === current.id ? 'border-t-accent font-semibold text-t-text' : 'border-transparent text-t-muted hover:text-t-text'}`}>
            {snippet.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`snippet-panel-${current.id}`} aria-labelledby={`snippet-tab-${current.id}`} className="mt-3 space-y-3">
        {current.env && (
          <div>
            <pre className="overflow-x-auto rounded border border-t-border bg-t-code p-3 text-xs leading-relaxed text-t-text"><code translate="no">{current.env}</code></pre>
          </div>
        )}
        <pre className="overflow-x-auto rounded border border-t-border bg-t-code p-3 text-xs leading-relaxed text-t-text"><code translate="no">{current.code}</code></pre>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CopyButton value={current.env ? `${current.env}\n\n${current.code}` : current.code} label="Copy snippet" />
          {!keyValue && (
            <p className="text-xs text-t-muted">{type === 'static' ? 'Create a publishable key and it fills in here.' : <>A real <code translate="no">sk_live_…</code> is shown once when created; paste yours in place of the placeholder.</>}</p>
          )}
          {keyValue && keyShownOnce && <p className="text-xs text-t-warn">This key is shown once. Copy the snippet now.</p>}
        </div>
        {type === 'static' ? (
          <p role="note" className="rounded border border-t-warn/40 bg-t-warn/10 p-3 text-sm leading-6 text-t-text">
            Anyone can copy a publishable key from your page. The origin list stops other websites from using it in a browser, not scripts. For real traffic, fetch at build time.
          </p>
        ) : (
          <p role="note" className="rounded border border-t-warn/40 bg-t-warn/10 p-3 text-sm leading-6 text-t-text">
            Name the variable <code translate="no">CMS_SECRET_KEY</code>. Never prefix it with <code translate="no">PUBLIC_</code>, <code translate="no">NEXT_PUBLIC_</code> or <code translate="no">VITE_</code>; those are copied into the JavaScript visitors download. Import it only in build or server code. Pull requests from forks don’t get secrets. Fetch each list once and build pages from it: the account limit is 10 uncached requests/second, and a busy service answers 503 with <code translate="no">Retry-After</code>.
          </p>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── check ───────────────────────── */

function warningRow(code, { appId, onFix }) {
  const [kind, section] = code.split(':');
  const sectionLabel = ERROR_SECTION_LABELS[section] || section;
  const sectionTo = ERROR_SECTION_ROUTES[section];
  const editorLink = (label, target) => <button type="button" onClick={() => onFix?.(target)} className="font-medium text-t-accent underline underline-offset-4">{label}</button>;
  switch (kind) {
    case 'no_sections_enabled': return { text: '0 sections enabled: every request returns 403 until you turn one on.', fix: editorLink('Turn a section on', 'sections') };
    case 'all_drafts': return { text: `Every item in ${sectionLabel} is a draft, so this App gets an empty list.`, fix: <Link to={sectionTo || '/admin/dashboard'} className="font-medium text-t-accent underline underline-offset-4">Publish drafts</Link> };
    case 'no_published': return { text: `Nothing published in ${sectionLabel} yet.`, fix: <Link to={sectionTo || '/admin/dashboard'} className="font-medium text-t-accent underline underline-offset-4">Add one</Link> };
    case 'origin_star': return { text: 'Any website can use this App’s publishable key in a browser. List your site’s origins to stop that.', fix: editorLink('Allowed origins', 'settings') };
    case 'no_active_token': return { text: 'No active key. Nothing can read this App until you create one.', fix: editorLink('Create a key', 'keys') };
    case 'profile_missing': return { text: 'No profile saved yet, so /v1/profile answers 404 not_configured.', fix: <Link to="/admin/profile" className="font-medium text-t-accent underline underline-offset-4">Profile</Link> };
    case 'resume_missing': return { text: 'No résumé link saved, so /v1/resume answers 404 not_configured.', fix: <Link to="/admin/resume" className="font-medium text-t-accent underline underline-offset-4">Résumé</Link> };
    default: return { text: code, fix: appId ? editorLink('Open settings', 'settings') : null };
  }
}

function CheckBlock({ app, onFix }) {
  const [state, setState] = useState({ status: 'idle', result: null, error: null });

  async function run() {
    setState({ status: 'loading', result: null, error: null });
    try {
      const { data } = await api.post(`/apps/${app._id}/check`);
      setState({ status: 'done', result: data, error: null });
    } catch (err) {
      setState({ status: 'error', result: null, error: describeApiError(err, { appId: app._id, fallback: 'The check could not run.' }) });
    }
  }

  const result = state.result;
  const sections = useMemo(() => {
    if (!result?.sections) return [];
    return [...result.sections].sort((a, b) => SECTION_ORDER.indexOf(a.key) - SECTION_ORDER.indexOf(b.key));
  }, [result]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={run} disabled={state.status === 'loading'} className="inline-flex min-h-10 items-center gap-2 rounded bg-t-accent px-4 text-sm font-semibold text-t-on-accent hover:bg-t-accent-br disabled:opacity-60">
          <RefreshCw size={14} aria-hidden="true" className={state.status === 'loading' ? 'animate-spin' : ''} />{state.status === 'loading' ? 'Checking…' : 'Check this App'}
        </button>
        <p className="text-sm text-t-muted">Counts what each request would return, without spending any of your API budget.</p>
      </div>
      <div aria-live="polite" className="mt-3">
        {state.status === 'error' && (
          <p role="alert" className="rounded border border-t-danger/40 bg-t-danger-dim p-3 text-sm text-t-danger">
            {state.error.message}{state.error.fix && <> <Link to={state.error.fix.to} className="font-medium underline underline-offset-4">{state.error.fix.label}</Link></>}
          </p>
        )}
        {state.status === 'done' && result && (
          <div className="space-y-4">
            <ul className="divide-y divide-t-border rounded border border-t-border">
              {sections.map((row) => {
                const label = ERROR_SECTION_LABELS[row.key] || row.key;
                let detail;
                if (!row.enabled) detail = 'off · requests get 403 section_disabled';
                else if (row.key === 'fs') detail = 'on · built from the sections above';
                else if (SINGLETONS.has(row.key)) detail = row.published ? 'saved' : 'not saved · 404 not_configured';
                else detail = `${row.published} published${row.drafts ? ` · ${row.drafts} draft${row.drafts === 1 ? '' : 's'} (not served)` : ''}`;
                return (
                  <li key={row.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm">
                    <span className={row.enabled ? 'font-medium text-t-text' : 'text-t-muted'}><code translate="no">/v1/{row.key}</code> <span className="text-t-muted">{label}</span></span>
                    <span className={row.enabled ? 'text-t-text' : 'text-t-muted'}>{detail}</span>
                  </li>
                );
              })}
            </ul>
            {result.warnings?.length ? (
              <ul className="space-y-2">
                {result.warnings.map((code) => {
                  const row = warningRow(code, { appId: app._id, onFix });
                  return <li key={code} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded border border-t-warn/40 bg-t-warn/10 px-3 py-2 text-sm text-t-text"><ShieldAlert size={14} aria-hidden="true" className="relative top-0.5 shrink-0 text-t-warn" /><span>{row.text}</span>{row.fix}</li>;
                })}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-t-accent2"><Check size={15} aria-hidden="true" />Nothing in the way. A request with an active key returns data.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── first request ───────────────────────── */

function useFirstRequest(appId, enabled) {
  const [status, setStatus] = useState('idle'); // idle | waiting | hit | timeout | nokey
  const [hit, setHit] = useState(null);
  const baseline = useRef(new Map());
  const startedAt = useRef(0);
  const [round, setRound] = useState(0);

  const snapshot = useCallback(async () => {
    const { data } = await api.get(`/apps/${appId}/tokens`);
    const list = Array.isArray(data) ? data : [];
    return list.filter((token) => isActive(token));
  }, [appId]);

  useEffect(() => {
    if (!enabled) { setStatus('idle'); return undefined; }
    let cancelled = false;
    let timer = null;

    async function tick() {
      if (cancelled || document.visibilityState !== 'visible') return;
      try {
        const active = await snapshot();
        if (cancelled) return;
        if (active.length === 0) { setStatus('nokey'); return; }
        for (const token of active) {
          const before = baseline.current.get(token._id);
          const now = token.lastUsedAt ? new Date(token.lastUsedAt).getTime() : null;
          if (now && now !== before) {
            setHit({ at: token.lastUsedAt, prefix: token.prefix });
            setStatus('hit');
            return;
          }
        }
        if (Date.now() - startedAt.current >= POLL_WINDOW_MS) { setStatus('timeout'); return; }
        timer = window.setTimeout(tick, POLL_MS);
      } catch {
        if (!cancelled) timer = window.setTimeout(tick, POLL_MS);
      }
    }

    async function start() {
      try {
        const active = await snapshot();
        if (cancelled) return;
        if (active.length === 0) { setStatus('nokey'); return; }
        baseline.current = new Map(active.map((token) => [token._id, token.lastUsedAt ? new Date(token.lastUsedAt).getTime() : null]));
        startedAt.current = Date.now();
        setStatus('waiting');
        timer = window.setTimeout(tick, POLL_MS);
      } catch { if (!cancelled) setStatus('waiting'); }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') { window.clearTimeout(timer); tick(); }
      else window.clearTimeout(timer);
    }
    document.addEventListener('visibilitychange', onVisibility);
    start();
    return () => { cancelled = true; window.clearTimeout(timer); document.removeEventListener('visibilitychange', onVisibility); };
  }, [appId, enabled, snapshot, round]);

  return { status, hit, keepWaiting: () => setRound((value) => value + 1) };
}

function FirstRequest({ app, enabled, onOpenKeys }) {
  const { status, hit, keepWaiting } = useFirstRequest(app._id, enabled);
  return (
    <div>
      <div aria-live="polite" className="text-sm leading-6 text-t-text">
        {status === 'nokey' && <p>No active key yet. <button type="button" onClick={onOpenKeys} className="font-medium text-t-accent underline underline-offset-4">Create one</button> and this panel starts listening.</p>}
        {(status === 'idle' || status === 'waiting') && (
          <p className="flex items-start gap-2"><Radio size={16} aria-hidden="true" className="mt-1 shrink-0 animate-pulse text-t-accent" /><span>Waiting for your key to reach us… Run the request above from your terminal or build.</span></p>
        )}
        {status === 'hit' && hit && (
          <p className="flex items-start gap-2 text-t-accent2"><Check size={16} aria-hidden="true" className="mt-1 shrink-0" /><span>Your key reached us at {formatTime(hit.at)} (<code translate="no">{hit.prefix}</code>). The URL and key are right. If you got an error back, look it up below.</span></p>
        )}
        {status === 'timeout' && (
          <p>Nothing after 5 minutes. Check the URL ends in <code translate="no">/v1/…</code> and the header is exactly <code translate="no">Authorization: Bearer &lt;key&gt;</code>. <button type="button" onClick={keepWaiting} className="font-medium text-t-accent underline underline-offset-4">Keep waiting</button></p>
        )}
      </div>
      <p className="mt-2 text-xs text-t-muted">We record a key’s activity at most once a minute.</p>
      <details className="mt-3 rounded border border-t-border bg-t-bg/60 p-3 text-sm">
        <summary className="cursor-pointer font-medium text-t-text">Got an error back? Look it up</summary>
        <ul className="mt-3 space-y-2 text-t-muted">
          {[
            ['403 section_disabled', describeApiError({ status: 403, data: { error: 'section_disabled' } }, { appId: app._id })],
            ['403 origin_not_allowed or “Failed to fetch”', describeApiError({ status: 403, data: { error: 'origin_not_allowed' } }, { appId: app._id })],
            ['401 token_missing / token_invalid, 400 token_in_query', describeApiError({ status: 401, data: { error: 'token_invalid' } }, { appId: app._id })],
            ['403 token_type_mismatch', describeApiError({ status: 403, data: { error: 'token_type_mismatch' } }, { appId: app._id })],
            ['429 rate_limited (key)', describeApiError({ status: 429, data: { error: 'rate_limited', message: 'Token request limit exceeded' } }, { appId: app._id })],
            ['429 rate_limited (account)', describeApiError({ status: 429, data: { error: 'rate_limited', message: 'Account request limit exceeded' } }, { appId: app._id })],
            ['503 busy', describeApiError({ status: 503, data: { error: 'busy' } }, { appId: app._id })],
            ['404 not_configured', describeApiError({ status: 404, data: { error: 'not_configured' } }, { appId: app._id })],
            ['200 { data: [] }', { message: 'Nothing published in that section yet.', fix: { label: 'Publish drafts', to: '/admin/dashboard' } }],
          ].map(([signal, described]) => (
            <li key={signal} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
              <code translate="no" className="shrink-0 text-xs text-t-text sm:w-64">{signal}</code>
              <span>{described.message} {described.fix && <Link to={described.fix.to} className="font-medium text-t-accent underline underline-offset-4">{described.fix.label}</Link>}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/* ───────────────────────── panel ───────────────────────── */

/**
 * The four blocks that take an App from "configured" to "answered a request":
 * Base URL · Check this App · Snippets · First request.
 *
 * `variant="editor"` sits at the top of the App editor. `variant="post-mint"` is shown inside the key dialog
 * right after a key is created, with the real key filled into the snippets (an sk is only ever shown there).
 */
export default function ConnectPanel({ app, v1Base, variant = 'editor', mintedToken = null, tokens = null, onOpenKeys, onFix, headingLevel = 2 }) {
  const Heading = `h${headingLevel}`;
  const Sub = `h${Math.min(headingLevel + 1, 6)}`;
  const activeTokens = useMemo(() => (Array.isArray(tokens) ? tokens.filter((token) => isActive(token)) : null), [tokens]);
  const pkValue = useMemo(() => activeTokens?.find((token) => token.type === 'pk' && token.value)?.value || null, [activeTokens]);
  const keyValue = mintedToken?.token || (app.type === 'static' ? pkValue : null);
  const pollingEnabled = variant === 'post-mint' ? Boolean(mintedToken) : activeTokens === null ? true : activeTokens.length > 0;

  return (
    <section aria-label="Connect this App" className="space-y-8 rounded-lg border border-t-border bg-t-surface p-5 sm:p-6">
      {variant === 'editor' && (
        <div>
          <Heading className="text-base font-semibold text-t-text">Connect</Heading>
          <p className="mt-1 text-sm text-t-muted">Everything your site needs to read this App, in the order you’ll use it.</p>
        </div>
      )}

      <div>
        <Sub className="text-sm font-semibold text-t-text">Base URL</Sub>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <code translate="no" className="min-w-0 break-all rounded border border-t-border bg-t-code px-3 py-2 text-sm text-t-text">{v1Base}</code>
          <CopyButton value={v1Base} label="Copy" />
        </div>
        <p className="mt-2 text-xs text-t-muted">Every endpoint hangs off it: <code translate="no">{v1Base}/projects</code>, <code translate="no">{v1Base}/profile</code>, <code translate="no">{v1Base}/app</code>.</p>
      </div>

      <div>
        <Sub className="text-sm font-semibold text-t-text">Check this App</Sub>
        <div className="mt-2"><CheckBlock app={app} onFix={onFix} /></div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Sub className="text-sm font-semibold text-t-text">Snippets</Sub>
          {variant === 'editor' && onOpenKeys && (
            <button type="button" onClick={onOpenKeys} className="inline-flex min-h-9 items-center gap-2 rounded border border-t-border-hi px-3 text-sm font-medium text-t-text hover:border-t-accent hover:text-t-accent"><KeyRound size={14} aria-hidden="true" />{app.type === 'static' ? 'Create publishable key' : 'Create secret key'}</button>
          )}
        </div>
        <div className="mt-2"><Snippets v1Base={v1Base} type={app.type} keyValue={keyValue} keyShownOnce={Boolean(mintedToken?.shownOnce)} /></div>
      </div>

      <div>
        <Sub className="text-sm font-semibold text-t-text">First request</Sub>
        <div className="mt-2"><FirstRequest app={app} enabled={pollingEnabled} onOpenKeys={onOpenKeys} /></div>
      </div>
    </section>
  );
}
