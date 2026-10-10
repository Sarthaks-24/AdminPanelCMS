import React from 'react';
import { Link } from 'react-router-dom';
import PublicShell from '../../components/public/PublicShell';
import ScopeDemo from '../../components/public/ScopeDemo';
import { REPO_URL, SITE } from '../../content/site';
import { useSignupMode } from '../../hooks/useSignupMode';

// The eight things the dashboard holds, named the way the API names them.
const CONTENT = [
  { key: 'profile', shape: 'one record', detail: 'Name, headline, bio, location, availability.' },
  { key: 'projects', shape: 'many', detail: 'Slug, summary, stack, links, highlights, a Markdown case study.' },
  { key: 'skills', shape: 'many', detail: 'Grouped by category, with proficiency and years.' },
  { key: 'experience', shape: 'many', detail: 'Company, role, period, achievements, technologies.' },
  { key: 'education', shape: 'many', detail: 'Institution, degree, field, period, grade.' },
  { key: 'certifications', shape: 'many', detail: 'Issuer, dates, credential id and link.' },
  { key: 'socials', shape: 'many', detail: 'Platform, handle, URL, display order.' },
  { key: 'resume', shape: 'one record', detail: 'A link, a version and a summary line.' },
];

// Two apps drawn from the same pool, compared row by row. The column of dashes is the point.
const COMPARED = [
  { section: 'profile', portfolio: 'everything but the email address', resume: 'name and headline' },
  { section: 'projects', portfolio: 'all published, with case studies', resume: 'the featured ones, no case studies' },
  { section: 'skills', portfolio: 'all, grouped by category', resume: null },
  { section: 'experience', portfolio: 'all', resume: null },
  { section: 'education', portfolio: 'all', resume: null },
  { section: 'certifications', portfolio: 'all', resume: null },
  { section: 'socials', portfolio: 'all', resume: null },
  { section: 'resume', portfolio: 'the link', resume: 'the link' },
  { section: 'fs', portfolio: 'enabled', resume: null },
];

const COLUMNS = [
  { key: 'portfolio', name: 'portfolio-site', token: 'pk_live_…', note: 'Publishable. Read from the browser, and only from the origins you allow.' },
  { key: 'resume', name: 'resume-page', token: 'sk_live_…', note: 'Secret. Read from your server, never shipped to a browser.' },
];

const STEPS = [
  { command: 'git clone https://github.com/Sarthaks-24/AdminPanelCMS.git', note: 'Node 20.19+ and a MongoDB database are the only requirements.' },
  { command: 'cd server && npm install && cp .env.example .env', note: 'Fill in the DEV_ block at the top: database URI, JWT secret, your email.' },
  { command: 'npm run setup && npm run dev', note: 'Creates the indexes and your first account, then serves the API on :5000.' },
  { command: 'cd ../client && npm install && npm run dev', note: 'The dashboard comes up on :5173. Sign in and start writing.' },
];

export default function Landing() {
  const { isOpen, isInviteOnly, isClosed, resolved } = useSignupMode();

  return (
    <PublicShell wide>
      {/* ── Hero: the claim, then immediately the evidence ─────────────── */}
      <section className="mx-auto max-w-[90rem] px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
        <div className="page-enter max-w-3xl">
          <p className="text-[0.9375rem] text-t-muted">{SITE.category}</p>
          <h1 className="mt-3 font-display text-[2.25rem] leading-[1.03] tracking-[-0.03em] text-t-text sm:text-[3.25rem]">
            {SITE.claim}
            <span className="block text-t-muted">{SITE.mechanism}</span>
          </h1>
          <p className="mt-5 max-w-xl text-[1.0625rem] leading-7 text-t-muted">
            Write your profile, projects and skills once. Each site you build then gets its own read-only key,
            and a key can only ever read the fields you granted it.
          </p>
          <p className="mt-4 text-[0.875rem] text-t-dim">{SITE.status}</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/docs/setup"
              className="rounded-lg bg-t-accent px-5 py-2.5 text-[0.875rem] font-semibold text-t-on-accent transition hover:bg-t-accent-br"
            >
              Run it yourself
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-lg border border-t-border-hi px-5 py-2.5 text-[0.875rem] font-medium text-t-text transition hover:border-t-accent"
            >
              View the source
            </a>
          </div>
        </div>

        {/* Why scoping is worth having at all. The demo below is the answer in motion. */}
        <div className="mt-10 max-w-3xl border-l-2 border-t-accent pl-5">
          <p className="text-[0.9375rem] leading-7 text-t-muted">
            A key that your website reads content with ships inside that website, where anyone can read it back
            out. So whatever a key may fetch is, in practice, public. That is the problem this solves: your
            portfolio's key can hold your whole history, while the key on a client microsite reaches three
            projects and never your email address.
          </p>
        </div>

        <div className="mt-10">
          <ScopeDemo />
        </div>
      </section>

      {/* ── The mechanism, shown as two real grants ────────────────────── */}
      <section aria-labelledby="apps-title" className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <h2 id="apps-title" className="font-display text-[1.75rem] leading-tight tracking-[-0.02em] sm:text-[2.125rem]">
            An App is a view, not a copy
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-7 text-t-muted">
            Nothing is duplicated and nothing is synced. Each App holds a grant, and the API applies it on the way
            out. Edit your bio once and every site allowed to read it picks the change up within the minute its
            response is cached for.
          </p>
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <caption className="sr-only">What each of two apps may read from the same content pool</caption>
            <thead>
              <tr>
                <th scope="col" className="w-40 pb-3 pr-6 align-bottom text-[0.875rem] font-medium text-t-dim">Section</th>
                {COLUMNS.map((column) => (
                  <th key={column.key} scope="col" className="pb-3 pr-6 align-bottom">
                    <span className="block font-mono-code text-[0.9375rem] font-medium text-t-text">{column.name}</span>
                    <span className="mt-1 block font-mono-code text-[0.75rem] text-t-accent">{column.token}</span>
                    <span className="mt-1.5 block max-w-[15rem] text-[0.75rem] font-normal leading-5 text-t-muted">{column.note}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARED.map((row) => (
                <tr key={row.section}>
                  <th scope="row" className="border-t border-t-border py-2.5 pr-6 font-mono-code text-[0.875rem] font-normal text-t-muted">
                    {row.section}
                  </th>
                  {COLUMNS.map((column) => (
                    <td key={column.key} className="border-t border-t-border py-2.5 pr-6 text-[0.875rem] leading-6">
                      {row[column.key]
                        ? <span className="text-t-text">{row[column.key]}</span>
                        : <span className="text-t-dim" title="not granted">not granted</span>}
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
          <h2 id="content-title" className="font-display text-[1.75rem] leading-tight tracking-[-0.02em] sm:text-[2.125rem]">
            Eight sections, each item a draft or published
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-7 text-t-muted">
            A draft is invisible to every App, however generous its grant. Publishing is the only thing that makes
            an item readable, and it is one toggle per item.
          </p>
        </div>

        <dl className="mt-8 max-w-4xl">
          {CONTENT.map((section) => (
            <div key={section.key} className="flex flex-col gap-1 border-t border-t-border py-3.5 sm:flex-row sm:gap-6">
              <dt className="flex w-56 shrink-0 items-baseline gap-2.5">
                <span className="font-mono-code text-[0.875rem] text-t-text">{section.key}</span>
                <span className="text-[0.75rem] text-t-dim">{section.shape}</span>
              </dt>
              <dd className="text-[0.875rem] leading-6 text-t-muted">{section.detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── Running it: a genuine sequence, so numbering earns its place ── */}
      <section aria-labelledby="run-title" className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <h2 id="run-title" className="font-display text-[1.75rem] leading-tight tracking-[-0.02em] sm:text-[2.125rem]">
            You host it, so you keep the database
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-7 text-t-muted">
            There is no account to sign up for here. You clone the repository and point it at your own MongoDB,
            on your machine or on a host you choose.
          </p>
        </div>

        <ol className="mt-8 max-w-3xl">
          {STEPS.map((step, index) => (
            <li key={step.command} className="flex gap-4 border-t border-t-border py-4">
              <span aria-hidden="true" className="mt-0.5 w-4 shrink-0 font-mono-code text-[0.875rem] text-t-dim">{index + 1}</span>
              <div className="min-w-0">
                <code className="block overflow-x-auto whitespace-pre rounded-lg bg-t-code px-3 py-2 font-mono-code text-[0.875rem] text-t-accent2">
                  {step.command}
                </code>
                <p className="mt-2 text-[0.875rem] leading-6 text-t-muted">{step.note}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-6 max-w-3xl text-[0.875rem] leading-7 text-t-muted">
          The long version, including the production checklist, is in the{' '}
          <Link to="/docs/setup" className="text-t-accent hover:underline">setup guide</Link> and{' '}
          <Link to="/docs/deployment" className="text-t-accent hover:underline">deployment</Link>.
        </p>
      </section>

      {/* ── Honest state of the project ────────────────────────────────── */}
      <section aria-labelledby="status-title" className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6">
        <div className="max-w-3xl border-t border-t-border pt-8">
          <h2 id="status-title" className="font-display text-[1.5rem] leading-tight tracking-[-0.02em]">
            Built and tested, not yet deployed
          </h2>
          <div className="mt-5 space-y-3.5 text-[0.9375rem] leading-7 text-t-muted">
            <p>
              The server suite passes 146 tests against an in-memory database, and tenant isolation has a static
              check of its own. Nobody is running this in production yet, including the person who wrote it.
            </p>
            <p>
              {/* Only stated once the server has actually answered: an unreachable API is not a closed one. */}
              {isClosed && 'Registration on this instance is closed, so the dashboard is reachable only by accounts that already exist. '}
              {isInviteOnly && 'Registration on this instance is invite-only: you need a code from whoever runs it. '}
              {isOpen && 'Registration on this instance is open, with email verification. '}
              {!resolved && 'Whether this instance accepts registrations is something only its own server can answer. '}
              The usual answer is to run your own copy.
            </p>
            <p>
              Read{' '}
              <Link to="/docs/deployment#known-limits-before-real-traffic" className="text-t-accent hover:underline">
                known limits
              </Link>{' '}
              before you open registration to anyone else.
            </p>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/docs" className="rounded-lg bg-t-accent px-5 py-2.5 text-[0.875rem] font-semibold text-t-on-accent transition hover:bg-t-accent-br">
              Read the docs
            </Link>
            <Link to="/admin/login" className="rounded-lg border border-t-border-hi px-5 py-2.5 text-[0.875rem] font-medium text-t-text transition hover:border-t-accent">
              Sign in to this instance
            </Link>
            {isInviteOnly && (
              <Link to="/admin/signup" className="px-2 py-2.5 text-[0.875rem] text-t-muted transition hover:text-t-text hover:underline">
                I have an invite code
              </Link>
            )}
            {isOpen && (
              <Link to="/admin/signup" className="px-2 py-2.5 text-[0.875rem] text-t-muted transition hover:text-t-text hover:underline">
                Create an account
              </Link>
            )}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
