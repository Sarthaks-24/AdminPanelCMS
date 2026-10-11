import React from 'react';
import { Link } from 'react-router-dom';
import PublicShell from '../../components/public/PublicShell';
import ScopeDemo from '../../components/public/ScopeDemo';
import { SITE, supportMailto } from '../../content/site';
import { PENDING_BASE, useApiBase } from '../../lib/apiBase';
import { useSignupMode } from '../../hooks/useSignupMode';

// The eight things the dashboard holds, named the way the API names them.
const CONTENT = [
  { key: 'profile', shape: 'one record', detail: 'Name, headline, bio, location, availability.' },
  { key: 'projects', shape: 'many', detail: 'Slug, summary, stack, links, highlights, a Markdown case study.' },
  { key: 'skills', shape: 'many', detail: 'Grouped by your own categories, with proficiency and years.' },
  { key: 'experience', shape: 'many', detail: 'Company, role, period, achievements, technologies.' },
  { key: 'education', shape: 'many', detail: 'Institution, degree, field, period, grade.' },
  { key: 'certifications', shape: 'many', detail: 'Issuer, dates, credential id and link.' },
  { key: 'socials', shape: 'many', detail: 'Platform, handle, URL, display order.' },
  { key: 'resume', shape: 'one record', detail: 'A link, a version and a summary line.' },
];

// Two Apps drawn from the same pool, compared row by row. The column of dashes is the point.
const COMPARED = [
  { section: 'profile', portfolio: 'everything but the email address', resume: 'name and headline' },
  { section: 'projects', portfolio: 'all published, with case studies', resume: 'the featured ones, no case studies' },
  { section: 'skills', portfolio: 'all, grouped by category', resume: null },
  { section: 'experience', portfolio: 'all', resume: null },
  { section: 'education', portfolio: 'all', resume: null },
  { section: 'certifications', portfolio: 'all', resume: null },
  { section: 'socials', portfolio: 'all', resume: null },
  { section: 'resume', portfolio: 'the link', resume: 'the link' },
];

// The portfolio builds with a secret key; the résumé microsite reads live from visitors' browsers.
const COLUMNS = [
  { key: 'portfolio', name: 'portfolio-site', token: 'sk_live_…', note: 'Secret. Read when your site builds; never shipped to a browser.' },
  { key: 'resume', name: 'resume-page', token: 'pk_live_…', note: 'Publishable. Read in visitors’ browsers, only from origins you allow; 120 requests/min per visitor.' },
];

// The beta limits, quoted from the same table the API enforces. Change them there first.
const LIMITS = [
  { what: 'Apps per account', value: '10' },
  { what: 'Items per section', value: '100' },
  { what: 'Live keys per App', value: '2' },
  { what: 'Secret key', value: '600 requests/min' },
  { what: 'Publishable key', value: '120 requests/min per visitor, 3,000/min per key' },
  { what: 'Uncached requests per account', value: '10 per second; a cache hit or 304 is free' },
  { what: 'Response cache', value: 'cleared on every edit; browsers may keep a copy for 60 s' },
  { what: 'Uptime', value: 'best effort during the beta, no SLA' },
];

const buttonPrimary = 'rounded-lg bg-t-accent px-5 py-2.5 text-[0.875rem] font-semibold text-t-on-accent transition hover:bg-t-accent-br';
const buttonSecondary = 'rounded-lg border border-t-border-hi px-5 py-2.5 text-[0.875rem] font-medium text-t-text transition hover:border-t-accent';

export default function Landing() {
  const { isInviteOnly, isClosed } = useSignupMode();
  const { apiOrigin, resolved } = useApiBase();
  // The account button renders in every mode. Invite-only: it leads to the signup form, which takes
  // the code and says how to ask for one. Closed: it asks support to tell you when registration opens.
  const signupLabel = isClosed ? 'Registration closed: get notified' : isInviteOnly ? 'Have an invite? Sign up' : 'Create a free account';
  const signupCta = (className) => (isClosed
    ? <a href={supportMailto(`Tell me when ${SITE.name} registration opens`)} className={className}>{signupLabel}</a>
    : <Link to="/signup" className={className}>{signupLabel}</Link>);

  const steps = [
    { title: 'Create an account and verify your email.', note: 'You choose a password from the verification link. About a minute.' },
    { title: 'Add your profile and a project.', note: 'Everything you save is published unless you keep it as a draft.' },
    { title: 'Create an App and choose what it can read.', note: 'The “Everything published” preset is the default; narrow it whenever you like. Then create a secret key.' },
    { title: 'Fetch it from your build.', command: `curl -H "Authorization: Bearer sk_live_…" ${resolved ? apiOrigin : PENDING_BASE}/v1/projects`, note: 'The dashboard tells you the moment your key reaches us.' },
  ];

  return (
    <PublicShell wide>
      {/* ── Hero: the claim, then immediately the evidence ─────────────── */}
      <section className="mx-auto max-w-[90rem] px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
        <div className="page-enter max-w-3xl">
          <p className="text-[0.9375rem] text-t-muted">{SITE.category}</p>
          <h1 className="mt-3 text-balance font-display text-[2.25rem] leading-[1.03] tracking-[-0.03em] text-t-text sm:text-[3.25rem]">
            {SITE.claim}
            <span className="block text-t-muted">{SITE.mechanism}</span>
          </h1>
          <p className="mt-5 max-w-xl text-[1.0625rem] leading-7 text-t-muted">
            Add your profile, projects and experience once. Each site you build gets its own key, and each key
            reads only the sections and fields you choose.
          </p>
          <p className="mt-4 text-[0.875rem] text-t-dim">{SITE.status}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {signupCta(buttonPrimary)}
            <Link to="/docs/quickstart" className={buttonSecondary}>Read the quickstart</Link>
          </div>
        </div>

        {/* Why scoping is worth having at all. The demo below is the answer in motion. */}
        <div className="mt-10 max-w-3xl border-l border-t-accent pl-5">
          <p className="text-[0.9375rem] leading-7 text-t-muted">
            A browser key ships inside your site, where anyone can read it; a secret key stays in your build.
            Either way a key fetches only what its App grants: your portfolio&rsquo;s key can hold your whole
            history, while a client microsite&rsquo;s reaches three projects and never your email.
          </p>
        </div>

        <div className="mt-10">
          <ScopeDemo />
        </div>
      </section>

      {/* ── The mechanism, shown as two real grants ────────────────────── */}
      <section aria-labelledby="apps-title" className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <h2 id="apps-title" className="text-balance font-display text-[1.75rem] leading-tight tracking-[-0.02em] sm:text-[2.125rem]">
            An App is a view, not a copy
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-7 text-t-muted">
            Nothing is duplicated and nothing is synced. Each App holds a grant, and the API applies it on the way
            out. Edit your bio once and every site allowed to read it picks the change up within about a minute if
            it reads live, or on its next build if it fetches at build time.
          </p>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <caption className="sr-only">What each of two Apps may read from the same content pool</caption>
            <thead>
              <tr>
                <th scope="col" className="w-40 pb-3 pr-6 align-bottom text-[0.875rem] font-medium text-t-dim">Section</th>
                {COLUMNS.map((column) => (
                  <th key={column.key} scope="col" className="pb-3 pr-6 align-bottom">
                    <span className="block font-mono-code text-[0.9375rem] font-medium text-t-text" translate="no">{column.name}</span>
                    <span className="mt-1 block font-mono-code text-[0.75rem] text-t-accent" translate="no">{column.token}</span>
                    <span className="mt-1.5 block max-w-[15rem] text-[0.75rem] font-normal leading-5 text-t-muted">{column.note}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARED.map((row) => (
                <tr key={row.section}>
                  <th scope="row" className="border-t border-t-border py-2.5 pr-6 font-mono-code text-[0.875rem] font-normal text-t-muted" translate="no">
                    {row.section}
                  </th>
                  {COLUMNS.map((column) => (
                    <td key={column.key} className="border-t border-t-border py-2.5 pr-6 text-[0.875rem] leading-6">
                      {row[column.key]
                        ? <span className="text-t-text">{row[column.key]}</span>
                        : <span className="text-t-dim">not granted</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── What the pool holds ────────────────────────────────────────── */}
      <section aria-labelledby="content-title" className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <h2 id="content-title" className="text-balance font-display text-[1.75rem] leading-tight tracking-[-0.02em] sm:text-[2.125rem]">
            Eight sections, published as you save
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-7 text-t-muted">
            Keep an item as a draft and no App will ever see it, however generous its grant. Everything else is
            readable the moment you save.
          </p>
        </div>

        <dl className="mt-8 max-w-4xl">
          {CONTENT.map((section) => (
            <div key={section.key} className="flex flex-col gap-1 border-t border-t-border py-3.5 sm:flex-row sm:gap-6">
              <dt className="flex w-56 shrink-0 items-baseline gap-2.5">
                <span className="font-mono-code text-[0.875rem] text-t-text" translate="no">{section.key}</span>
                <span className="text-[0.75rem] text-t-dim">{section.shape}</span>
              </dt>
              <dd className="text-[0.875rem] leading-6 text-t-muted">{section.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── The path to a first request: a genuine sequence, so numbering earns its place ── */}
      <section aria-labelledby="start-title" className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <h2 id="start-title" className="text-balance font-display text-[1.75rem] leading-tight tracking-[-0.02em] sm:text-[2.125rem]">
            From sign-up to your first request
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-7 text-t-muted">
            About ten minutes, no card. Your data stays yours: export everything as JSON or delete your account
            from <strong className="font-medium text-t-text">Account</strong> in the dashboard at any time.
          </p>
        </div>

        <ol className="mt-8 max-w-3xl">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-4 border-t border-t-border py-4">
              <span aria-hidden="true" className="mt-0.5 w-4 shrink-0 font-mono-code text-[0.875rem] text-t-dim">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.9375rem] font-medium text-t-text">{step.title}</p>
                {step.command && (
                  <code translate="no" className="mt-2 block overflow-x-auto whitespace-pre rounded-lg bg-t-code px-3 py-2 font-mono-code text-[0.875rem] text-t-accent2">
                    {step.command}
                  </code>
                )}
                <p className="mt-1.5 text-[0.875rem] leading-6 text-t-muted">{step.note}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-6 max-w-3xl text-[0.875rem] leading-7 text-t-muted">
          The walk-through is in the{' '}
          <Link to="/docs/quickstart" className="text-t-accent hover:underline">quickstart</Link>; every error code is in{' '}
          <Link to="/docs/limits" className="text-t-accent hover:underline">limits &amp; errors</Link>.
        </p>
      </section>

      {/* ── The limits, stated before anyone builds on them ───────────── */}
      <section aria-labelledby="limits-title" className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6">
        <div className="max-w-3xl border-t border-t-border pt-8">
          <h2 id="limits-title" className="text-balance font-display text-[1.5rem] leading-tight tracking-[-0.02em]">
            Limits during the beta
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-7 text-t-muted">
            Enough for a portfolio, a résumé page and a few microsites that fetch at build time. Each limit answers
            with a code and a <code className="font-mono-code text-[0.875rem]" translate="no">Retry-After</code> header
            rather than a silent failure.
          </p>

          <table className="mt-6 w-full border-collapse text-left">
            <caption className="sr-only">Limits that apply to every account during the beta</caption>
            <tbody>
              {LIMITS.map((row) => (
                <tr key={row.what}>
                  <th scope="row" className="border-t border-t-border py-2.5 pr-6 align-top text-[0.875rem] font-normal text-t-muted">{row.what}</th>
                  <td className="border-t border-t-border py-2.5 text-[0.875rem] leading-6 text-t-text tabular-nums">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-5 text-[0.9375rem] leading-7 text-t-muted">
            Free during the beta; any paid plan will be announced 30 days ahead.
          </p>
        </div>
      </section>

      {/* ── Who runs it ─────────────────────────────────────────────────── */}
      <section aria-labelledby="about-title" className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6">
        <div className="max-w-3xl border-t border-t-border pt-8">
          <h2 id="about-title" className="text-balance font-display text-[1.5rem] leading-tight tracking-[-0.02em]">
            Who runs {SITE.name}
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-7 text-t-muted">
            {SITE.name} is a hosted service operated by {SITE.legal.operator}, based in {SITE.legal.jurisdiction}. It
            is in beta and run on a best-effort basis: your content is backed up daily, you can export or delete it
            yourself at any time, and every change to the API, the limits or the Terms is posted in the{' '}
            <Link to="/docs/changelog" className="text-t-accent hover:underline">changelog</Link> first. Questions,
            problems and invite requests go to{' '}
            <a href={supportMailto()} className="text-t-accent hover:underline">{SITE.support.email}</a>.
          </p>
        </div>
      </section>

      {/* ── The last word is the first action ─────────────────────────── */}
      <section aria-labelledby="cta-title" className="mx-auto max-w-[90rem] px-4 pb-8 pt-4 sm:px-6">
        <div className="max-w-3xl">
          <h2 id="cta-title" className="text-balance font-display text-[1.5rem] leading-tight tracking-[-0.02em]">
            Write it once. Read it from everything you build.
          </h2>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {signupCta(buttonPrimary)}
            <Link to="/login" className={buttonSecondary}>Sign in</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
