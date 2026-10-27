import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { describeApiError } from '../../lib/apiErrors';
import { DASHBOARD } from '../../lib/routes';

const asList = (value) => (Array.isArray(value) ? value : value?.skills || []);
const isPublished = (item) => item?.visibility === 'published';
const isActiveToken = (token) => !token.revokedAt && (!token.expiresAt || new Date(token.expiresAt).getTime() > Date.now());

function tally(items) {
  const published = items.filter(isPublished).length;
  return { total: items.length, published, drafts: items.length - published };
}

function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function timeAgo(value) {
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, size] of units) {
    if (seconds >= size) return `${plural(Math.floor(seconds / size), name)} ago`;
  }
  return 'just now';
}

// Shape plus words carry the state, so it never depends on colour alone.
function StateMark({ kind }) {
  const common = { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': true, className: 'shrink-0' };
  if (kind === 'ready') return <svg {...common}><circle cx="6" cy="6" r="5" fill="currentColor" /></svg>;
  if (kind === 'drafts') return <svg {...common}><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M6 1.5a4.5 4.5 0 0 1 0 9z" fill="currentColor" /></svg>;
  return <svg {...common}><circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" /></svg>;
}

function Skeleton() {
  return (
    <div role="status" aria-label="Loading your dashboard" className="mx-auto max-w-6xl space-y-6">
      <div className="skeleton h-14 w-80 max-w-full" />
      <div className="skeleton h-5 w-96 max-w-full" />
      <div className="grid gap-12 pt-8 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-3">{Array.from({ length: 7 }, (_, index) => <div key={index} className="skeleton h-14 w-full" />)}</div>
        <div className="space-y-3">{Array.from({ length: 5 }, (_, index) => <div key={index} className="skeleton h-16 w-full" />)}</div>
      </div>
    </div>
  );
}

const SOURCES = [
  ['profile', '/profile'], ['projects', '/projects'], ['skills', '/skills'], ['experience', '/experience'],
  ['education', '/education'], ['certifications', '/certifications'], ['socials', '/socials'], ['resume', '/resume'], ['apps', '/apps'],
];

export default function DashboardHome() {
  const [data, setData] = useState(null);
  const [apps, setApps] = useState([]);
  const [failed, setFailed] = useState([]);
  const [fatal, setFatal] = useState(null);

  const load = useCallback(async () => {
    setFatal(null);
    const results = await Promise.allSettled(SOURCES.map(([, path]) => api.get(path)));
    // /resume answers 404 until a resume exists, unlike the list sections, which answer 200 with []. That is
    // the ordinary state of a new account, not a section that failed to load, so it must not raise the banner.
    const missing = (index) => results[index].status === 'rejected' && results[index].reason?.response?.status === 404;
    const rejected = SOURCES.filter((_, index) => results[index].status === 'rejected' && !missing(index));
    if (rejected.length === SOURCES.length) {
      setFatal(describeApiError(results[0].reason, { fallback: 'Your dashboard could not load.' }));
      setData(null);
      return;
    }
    const value = (index, fallback) => (results[index].status === 'fulfilled' ? results[index].value.data ?? fallback : fallback);
    setFailed(rejected.map(([key]) => key));
    setData({
      profile: value(0, null), projects: asList(value(1, [])), skills: asList(value(2, [])), experience: asList(value(3, [])),
      education: asList(value(4, [])), certifications: asList(value(5, [])), socials: asList(value(6, [])), resume: value(7, null),
    });
    // Each App's keys carry the evidence: how many are active, and when one last reached us.
    // One request per App (at most 10): the server has no batched token summary yet.
    const withActivity = await Promise.all(asList(value(8, [])).map(async (app) => {
      try {
        const { data: tokens } = await api.get(`/apps/${app._id}/tokens`);
        const active = (Array.isArray(tokens) ? tokens : []).filter(isActiveToken);
        const used = active.map((token) => token.lastUsedAt).filter(Boolean).sort().pop() || null;
        return { app, activeKeys: active.length, lastUsedAt: used, enabledSections: Object.values(app.include || {}).filter((config) => config?.enabled).length };
      } catch { return { app, activeKeys: null, lastUsedAt: null, enabledSections: Object.values(app.include || {}).filter((config) => config?.enabled).length }; }
    }));
    setApps(withActivity);
  }, []);

  useEffect(() => { load(); }, [load]);

  const outline = useMemo(() => {
    if (!data) return [];
    const { profile, resume } = data;
    const configured = profile?.configured === undefined ? Boolean(profile?.name && profile?.headline) : Boolean(profile?.configured);
    const missing = [!profile?.name && 'name', !profile?.headline && 'headline', !profile?.shortBio && 'short bio', !profile?.email && 'email'].filter(Boolean);
    const collection = (key, to, label, noun, nounPlural) => {
      const t = tally(data[key]);
      const detail = t.total === 0 ? `No ${nounPlural} yet` : `${t.published} published${t.drafts ? `, ${plural(t.drafts, 'draft')}` : ''}`;
      return { key, to, label, detail, state: t.total === 0 ? 'empty' : t.drafts ? 'drafts' : 'ready', stateText: t.total === 0 ? 'Empty' : t.drafts ? 'Has drafts' : 'Ready', ...t, noun, nounPlural };
    };
    return [
      { key: 'profile', to: `${DASHBOARD}/profile`, label: 'Your profile', detail: !configured ? 'Not saved yet' : missing.length ? `Still needed: ${missing.join(', ')}` : 'Name, headline, bio and email are set', state: !configured || missing.length ? 'empty' : 'ready', stateText: !configured ? 'Not saved' : missing.length ? 'Incomplete' : 'Ready', configured },
      collection('projects', `${DASHBOARD}/projects`, 'Projects', 'project', 'projects'),
      collection('skills', `${DASHBOARD}/skills`, 'Skills', 'skill', 'skills'),
      collection('experience', `${DASHBOARD}/experience`, 'Work experience', 'role', 'roles'),
      collection('education', `${DASHBOARD}/education`, 'Education', 'entry', 'entries'),
      collection('certifications', `${DASHBOARD}/certifications`, 'Certifications', 'certification', 'certifications'),
      collection('socials', `${DASHBOARD}/socials`, 'Links', 'link', 'links'),
      { key: 'resume', to: `${DASHBOARD}/resume`, label: 'Résumé', detail: resume?.resumeUrl ? 'A résumé link is set' : 'No résumé link yet', state: resume?.resumeUrl ? 'ready' : 'empty', stateText: resume?.resumeUrl ? 'Ready' : 'Empty' },
    ];
  }, [data]);

  // Five pieces of evidence, each one a screen away. Nothing is hidden: the list always shows all five.
  const checklist = useMemo(() => {
    if (!data) return [];
    const profile = outline.find((item) => item.key === 'profile');
    const publishedCount = outline.filter((item) => item.published).reduce((sum, item) => sum + item.published, 0);
    const appWithSections = apps.find((entry) => entry.enabledSections > 0);
    const appWithKey = apps.find((entry) => entry.activeKeys > 0);
    const appReached = apps.find((entry) => entry.lastUsedAt);
    const firstApp = apps[0];
    return [
      { key: 'profile', done: Boolean(profile?.configured), title: 'Save your profile', detail: profile?.configured ? 'Saved' : 'Name, headline and a short bio. Until it is saved, /v1/profile answers 404.', to: `${DASHBOARD}/profile` },
      { key: 'published', done: publishedCount > 0, title: 'Publish at least one item', detail: publishedCount > 0 ? `${plural(publishedCount, 'item')} published` : 'A project is the usual first one. Drafts are never served.', to: `${DASHBOARD}/projects/new` },
      { key: 'app', done: Boolean(appWithSections), title: 'Create an App that reads something', detail: appWithSections ? `${appWithSections.app.name} serves ${plural(appWithSections.enabledSections, 'section')}` : apps.length ? 'Your App has 0 sections enabled, so every request gets 403.' : 'The default preset returns everything you have published.', to: appWithSections ? `${DASHBOARD}/apps/${appWithSections.app._id}` : apps.length ? `${DASHBOARD}/apps/${firstApp.app._id}` : `${DASHBOARD}/apps` },
      { key: 'key', done: Boolean(appWithKey), title: 'Create a key', detail: appWithKey ? `${appWithKey.app.name} has ${plural(appWithKey.activeKeys, 'active key')}` : 'A secret key for builds, or a publishable key for browsers.', to: (appWithSections || firstApp) ? `${DASHBOARD}/apps/${(appWithSections || firstApp).app._id}` : `${DASHBOARD}/apps` },
      { key: 'reached', done: Boolean(appReached), title: 'Your key reached us', detail: appReached ? `${appReached.app.name} last reached us ${timeAgo(appReached.lastUsedAt)}` : 'Run the curl or build snippet from the App. The App page notices within about a minute.', to: (appReached || appWithKey || firstApp) ? `${DASHBOARD}/apps/${(appReached || appWithKey || firstApp).app._id}` : `${DASHBOARD}/apps` },
    ];
  }, [data, outline, apps]);

  const draftNudges = useMemo(() => outline.filter((item) => item.drafts > 0).map((item) => ({ key: item.key, to: item.to, title: `Publish ${plural(item.drafts, `draft ${item.noun}`, `draft ${item.nounPlural}`)}`, why: `Drafts in ${item.label.toLowerCase()} are hidden from every App.` })), [outline]);

  if (fatal) {
    return (
      <div role="alert" className="mx-auto max-w-xl rounded-lg border border-t-danger/40 bg-t-danger-dim p-6">
        <h1 className="text-xl font-semibold text-t-text">Your dashboard didn’t load</h1>
        <p className="mt-2 text-sm leading-6 text-t-text">{fatal.message}</p>
        <button type="button" onClick={load} className="mt-4 inline-flex min-h-10 items-center rounded bg-t-accent px-4 text-sm font-semibold text-t-on-accent hover:bg-t-accent-br">Retry</button>
      </div>
    );
  }
  if (!data) return <Skeleton />;

  const { profile } = data;
  const doneCount = checklist.filter((step) => step.done).length;

  return (
    <div className="mx-auto max-w-6xl">
      {failed.length > 0 && (
        <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-t-danger/40 bg-t-danger-dim p-4 text-sm text-t-text">
          <span>Some sections didn’t load ({failed.join(', ')}), so their counts below may be wrong.</span>
          <button type="button" onClick={load} className="font-semibold text-t-accent underline underline-offset-4">Retry</button>
        </div>
      )}

      <header className="border-b border-t-border pb-6">
        <h1 className="text-3xl text-t-text">Overview</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-t-muted">
          {profile?.name ? `Signed in as ${profile.name}. ` : ''}Your content, the Apps that read it, and what is left before your first request.
        </p>
      </header>

      <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-12">
          <section aria-labelledby="checklist-title">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="checklist-title" className="text-xl font-semibold text-t-text">From sign-up to your first request</h2>
              <span className="text-sm text-t-muted">{doneCount} of {checklist.length} done</span>
            </div>
            <p className="mt-1 text-sm text-t-muted">Each step is evidence, not a tick box: it turns green when the data says so.</p>
            <ol className="mt-5 divide-y divide-t-border border-y border-t-border">
              {checklist.map((step, index) => (
                <li key={step.key}>
                  <Link to={step.to} className="group -mx-3 flex items-start gap-4 rounded-md px-3 py-4 transition-colors hover:bg-t-surface">
                    <span aria-hidden="true" className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${step.done ? 'border-t-accent2 bg-t-accent2 text-t-on-accent2' : 'border-t-border-hi text-t-muted'}`}>{step.done ? '✓' : index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className={`block font-medium group-hover:underline group-hover:underline-offset-4 ${step.done ? 'text-t-muted line-through decoration-t-border-hi' : 'text-t-text'}`}>{step.title}</span>
                      <span className="mt-0.5 block text-sm text-t-muted">{step.detail}</span>
                    </span>
                    <span className="sr-only">{step.done ? 'Done' : 'Not yet'}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="outline-title">
            <h2 id="outline-title" className="text-xl font-semibold text-t-text">Your content</h2>
            <p className="mt-1 text-sm text-t-muted">Apps only serve items you have published.</p>
            <ul className="mt-5 divide-y divide-t-border border-y border-t-border">
              {outline.map((item) => (
                <li key={item.key}>
                  <Link to={item.to} className="group -mx-3 flex items-baseline justify-between gap-4 rounded-md px-3 py-4 transition-colors hover:bg-t-surface">
                    <span className="min-w-0">
                      <span className="block font-medium text-t-text group-hover:underline group-hover:underline-offset-4">{item.label}</span>
                      <span className="mt-0.5 block text-sm text-t-muted">{item.detail}</span>
                    </span>
                    <span className={`inline-flex shrink-0 items-center gap-2 text-sm ${item.state === 'ready' ? 'text-t-accent2' : item.state === 'drafts' ? 'text-t-text' : 'text-t-muted'}`}>
                      <StateMark kind={item.state} />{item.stateText}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-12">
          <section aria-labelledby="drafts-title">
            <h2 id="drafts-title" className="text-xl font-semibold text-t-text">Drafts</h2>
            {draftNudges.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-t-muted">No drafts. Everything you have added is being served.</p>
            ) : (
              <ol className="mt-4 divide-y divide-t-border border-y border-t-border">
                {draftNudges.map((step) => (
                  <li key={step.key}>
                    <Link to={step.to} className="group -mx-3 block rounded-md px-3 py-3.5 transition-colors hover:bg-t-surface">
                      <span className="block font-medium text-t-text group-hover:underline group-hover:underline-offset-4">{step.title}</span>
                      <span className="mt-0.5 block text-sm text-t-muted">{step.why}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="apps-title">
            <h2 id="apps-title" className="text-xl font-semibold text-t-text">Apps</h2>
            {apps.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-t-muted">
                No Apps yet. <Link to={`${DASHBOARD}/apps`} className="font-medium text-t-accent underline underline-offset-4">Create one</Link> and it can start serving your published content.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-t-border border-y border-t-border">
                {apps.map(({ app, activeKeys, lastUsedAt, enabledSections }) => (
                  <li key={app._id}>
                    <Link to={`${DASHBOARD}/apps/${app._id}`} className="group -mx-3 block rounded-md px-3 py-3.5 transition-colors hover:bg-t-surface">
                      <span className="block font-medium text-t-text group-hover:underline group-hover:underline-offset-4">{app.name}</span>
                      <span className="mt-0.5 block text-sm text-t-muted">
                        {enabledSections === 0 ? '0 sections enabled: every request gets 403' : activeKeys === 0 ? 'No active key' : activeKeys === null ? 'Keys could not be checked' : lastUsedAt ? `Key last reached us ${timeAgo(lastUsedAt)}` : 'Key not used yet'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
