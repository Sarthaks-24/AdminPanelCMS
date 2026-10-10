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

// Two apps drawn from the same pool. The contrast is the whole point of the product.
const APPS = [
  {
    name: 'portfolio-site',
    token: 'pk_live_…',
    tokenNote: 'publishable, locked to one origin, called from the browser',
    grants: ['profile — everything but email', 'projects — all published, with case studies', 'skills, experience, education, certifications', 'fs — the file tree'],
  },
  {
    name: 'resume-page',
    token: 'sk_live_…',
    tokenNote: 'secret, server-side only, never shipped to a browser',
    grants: ['profile — name and headline only', 'projects — three featured, no case studies', 'resume — the PDF link'],
    withheld: ['no email address', 'no socials', 'no fs'],
  },
];

const STEPS = [
  { command: 'git clone https://github.com/Sarthaks-24/AdminPanelCMS.git', note: 'Node 20.19+ and a MongoDB database are the only requirements.' },
  { command: 'cd server && npm install && cp .env.example .env', note: 'Fill in the DEV_ block at the top: database URI, JWT secret, your email.' },
  { command: 'npm run setup && npm run dev', note: 'Creates the indexes and your first account, then serves the API on :5000.' },
  { command: 'cd ../client && npm install && npm run dev', note: 'The dashboard comes up on :5173. Sign in and start writing.' },
];

function Eyebrow({ children }) {
  return <p className="text-[0.8125rem] font-medium text-t-accent">{children}</p>;
}

export default function Landing() {
  const { isOpen, isInviteOnly, isClosed } = useSignupMode();

  return (
    <PublicShell wide>
      {/* ── Hero: the claim, then immediately the evidence ─────────────── */}
      <section className="mx-auto max-w-[90rem] px-4 pb-10 pt-14 sm:px-6 sm:pt-20">
        <div className="page-enter max-w-3xl">
          <h1 className="font-display text-[2.5rem] leading-[1.03] tracking-[-0.03em] text-t-text sm:text-[3.5rem]">
            {SITE.claim}
            <span className="block text-t-muted">{SITE.mechanism}</span>
          </h1>
          <p className="mt-6 max-w-xl text-[1.0625rem] leading-7 text-t-muted">
            Write your profile, projects, skills and the rest once. Then give each website you build a read-only
            key that can see only the sections, items and fields you picked for it.
          </p>
          <p className="mt-5 text-[0.8125rem] text-t-dim">{SITE.status}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/docs/setup"
              className="rounded-xl bg-t-accent px-5 py-2.5 text-[0.875rem] font-semibold text-t-on-accent shadow-glow-accent transition hover:bg-t-accent-br"
            >
              Run it yourself
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-xl border border-t-border-hi px-5 py-2.5 text-[0.875rem] font-medium text-t-text transition hover:border-t-accent"
            >
              View the source
            </a>
            <Link to="/docs/api" className="px-2 py-2.5 text-[0.875rem] text-t-muted transition hover:text-t-text hover:underline">
              Read the API reference
            </Link>
          </div>
        </div>

        <div className="mt-12">
          <ScopeDemo />
        </div>
      </section>

      {/* ── The mechanism, shown as two real grants ────────────────────── */}
      <section aria-labelledby="apps-title" className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow>The same pool, read two ways</Eyebrow>
          <h2 id="apps-title" className="mt-2 font-display text-[1.75rem] leading-tight tracking-[-0.02em] sm:text-[2.125rem]">
            An App is a view, not a copy
          </h2>
          <p className="mt-4 text-[0.9375rem] leading-7 text-t-muted">
            Nothing is duplicated and nothing is synced. Each App holds a grant, and the API applies it on the way
            out. Change your bio once and every site that may read it is already current.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {APPS.map((app) => (
            <article key={app.name} className="rounded-xl border border-t-border bg-t-surface p-5">
              <h3 className="font-mono-code text-[0.9375rem] font-medium text-t-text">{app.name}</h3>
              <p className="mt-2 text-[0.8125rem] leading-5 text-t-muted">
                <span className="font-mono-code text-t-accent">{app.token}</span> — {app.tokenNote}
              </p>
              <ul className="mt-4 space-y-1.5">
                {app.grants.map((grant) => (
                  <li key={grant} className="flex gap-2.5 text-[0.8125rem] leading-6 text-t-muted">
                    <span aria-hidden="true" className="mt-[0.5625rem] h-1 w-1 shrink-0 rounded-full bg-t-accent2" />
                    {grant}
                  </li>
                ))}
                {app.withheld?.map((item) => (
                  <li key={item} className="flex gap-2.5 text-[0.8125rem] leading-6 text-t-dim">
                    <span aria-hidden="true" className="mt-[0.5625rem] h-1 w-1 shrink-0 rounded-full bg-t-dim" />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* ── What the pool holds ────────────────────────────────────────── */}
      <section aria-labelledby="content-title" className="mx-auto max-w-[90rem] px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow>What you write once</Eyebrow>
          <h2 id="content-title" className="mt-2 font-display text-[1.75rem] leading-tight tracking-[-0.02em] sm:text-[2.125rem]">
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
          <Eyebrow>Four commands</Eyebrow>
          <h2 id="run-title" className="mt-2 font-display text-[1.75rem] leading-tight tracking-[-0.02em] sm:text-[2.125rem]">
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
              <span aria-hidden="true" className="mt-0.5 w-4 shrink-0 font-mono-code text-[0.8125rem] text-t-dim">{index + 1}</span>
              <div className="min-w-0">
                <code className="block overflow-x-auto whitespace-pre rounded-lg bg-t-code px-3 py-2 font-mono-code text-[0.8125rem] text-t-accent2">
                  {step.command}
                </code>
                <p className="mt-2 text-[0.8125rem] leading-6 text-t-muted">{step.note}</p>
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
        <div className="max-w-3xl rounded-xl border border-t-border bg-t-surface p-6 sm:p-8">
          <Eyebrow>Where this actually is</Eyebrow>
          <h2 id="status-title" className="mt-2 font-display text-[1.5rem] leading-tight tracking-[-0.02em]">
            Built and tested, not yet deployed
          </h2>
          <div className="mt-5 space-y-3.5 text-[0.9375rem] leading-7 text-t-muted">
            <p>
              The server suite passes 146 tests against an in-memory database, and tenant isolation has a static
              check of its own. Nobody is running this in production yet, including the person who wrote it.
            </p>
            <p>
              {isClosed && 'Registration here is closed, so the dashboard is reachable only by accounts that already exist.'}
              {isInviteOnly && 'Registration here is invite-only: you need a code from whoever runs this instance.'}
              {isOpen && 'Registration here is open, with email verification.'}
              {' '}Either way, the usual answer is to run your own copy.
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
            <Link to="/docs" className="rounded-xl bg-t-accent px-5 py-2.5 text-[0.875rem] font-semibold text-t-on-accent transition hover:bg-t-accent-br">
              Read the docs
            </Link>
            <Link to="/admin/login" className="rounded-xl border border-t-border-hi px-5 py-2.5 text-[0.875rem] font-medium text-t-text transition hover:border-t-accent">
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
