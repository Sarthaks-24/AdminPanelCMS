import React from 'react';
import { Link } from 'react-router-dom';
import PublicShell from '../../components/public/PublicShell';
import { LICENSE } from '../../content/docs';
import { REPO_URL } from '../../content/site';

// Plain-language notes beside the text. The licence itself is the authority; these are a reading aid.
const PERMITS = [
  'Use it for anything, including commercially.',
  'Change it, fork it, rename it, keep your changes private.',
  'Bundle it into something you sell.',
];
const REQUIRES = ['Keep the copyright line and this licence text in copies you distribute.'];
const WITHHOLDS = ['Any warranty. If it loses your data, that is on you.', 'Any liability on the author.'];

function Column({ title, items, tone }) {
  return (
    <div>
      <h3 className={`text-[0.8125rem] font-medium ${tone}`}>{title}</h3>
      <ul className="mt-2.5 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-[0.875rem] leading-6 text-t-muted">{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function LicensePage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl px-4 pb-8 pt-14 sm:px-6">
        <div className="page-enter">
          <h1 className="font-display text-[2.25rem] leading-[1.05] tracking-[-0.03em] sm:text-[2.75rem]">{LICENSE.name}</h1>
          <p className="mt-4 max-w-2xl text-[1.0625rem] leading-7 text-t-muted">
            The whole project is under one permissive licence. You may run it, change it and ship it; you keep the
            notice, and you get no warranty.
          </p>

          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            <Column title="You may" items={PERMITS} tone="text-t-accent2" />
            <Column title="You must" items={REQUIRES} tone="text-t-accent" />
            <Column title="You are not given" items={WITHHOLDS} tone="text-t-dim" />
          </div>

          <h2 className="mt-14 text-[0.8125rem] font-medium text-t-muted">The licence, in full</h2>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-t-border bg-t-code p-5 font-mono-code text-[0.8125rem] leading-[1.75] text-t-muted">
            <code>{LICENSE.body}</code>
          </pre>

          <p className="mt-6 text-[0.875rem] leading-7 text-t-muted">
            This page renders{' '}
            <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer noopener" className="text-t-accent hover:underline">
              the LICENSE file
            </a>{' '}
            itself, so it cannot disagree with the repository. The{' '}
            <Link to="/readme" className="text-t-accent hover:underline">readme</Link> covers what the project does.
          </p>
        </div>
      </div>
    </PublicShell>
  );
}
