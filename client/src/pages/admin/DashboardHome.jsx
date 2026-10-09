import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../components/admin/Toast';

const asList = (value) => (Array.isArray(value) ? value : value?.skills || []);
const isPublished = (item) => item?.visibility === 'published';

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
    <div role="status" aria-label="Loading your portfolio" className="mx-auto max-w-6xl space-y-6">
      <div className="skeleton h-14 w-80 max-w-full" />
      <div className="skeleton h-5 w-96 max-w-full" />
      <div className="grid gap-12 pt-8 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-3">{Array.from({ length: 7 }, (_, index) => <div key={index} className="skeleton h-14 w-full" />)}</div>
        <div className="space-y-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="skeleton h-16 w-full" />)}</div>
      </div>
    </div>
  );
}

export default function DashboardHome() {
  const { notify } = useToast();
  const [data, setData] = useState(null);
  const [sites, setSites] = useState([]);
  const [savingStatus, setSavingStatus] = useState(false);

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      api.get('/profile'), api.get('/projects'), api.get('/skills'), api.get('/experience'),
      api.get('/education'), api.get('/certifications'), api.get('/socials'), api.get('/resume'), api.get('/apps'),
    ]);
    const value = (index, fallback) => (results[index].status === 'fulfilled' ? results[index].value.data ?? fallback : fallback);
    const apps = asList(value(8, []));
    setData({
      profile: value(0, null), projects: asList(value(1, [])), skills: asList(value(2, [])), experience: asList(value(3, [])),
      education: asList(value(4, [])), certifications: asList(value(5, [])), socials: asList(value(6, [])), resume: value(7, null),
    });
    // Each connected website's last request time comes from its access keys.
    const withActivity = await Promise.all(apps.map(async (app) => {
      try {
        const { data: tokens } = await api.get(`/apps/${app._id}/tokens`);
        const active = (Array.isArray(tokens) ? tokens : []).filter((token) => !token.revokedAt);
        const used = active.map((token) => token.lastUsedAt).filter(Boolean).sort().pop() || null;
        return { app, activeKeys: active.length, lastUsedAt: used };
      } catch { return { app, activeKeys: null, lastUsedAt: null }; }
    }));
    setSites(withActivity);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleAvailability = async () => {
    if (!data?.profile) return;
    setSavingStatus(true);
    try {
      const open = !data.profile.isAvailableForHire;
      const { data: profile } = await api.patch('/profile/availability', {
        isAvailableForHire: open,
        statusText: open ? 'Open to new roles' : 'Not looking right now',
      });
      setData((current) => ({ ...current, profile }));
    } catch (err) {
      notify(`Could not update your status. ${err.response?.data?.message || err.message}`);
    } finally { setSavingStatus(false); }
  };

  const outline = useMemo(() => {
    if (!data) return [];
    const { profile, resume } = data;
    const missing = [!profile?.name && 'name', !profile?.headline && 'headline', !profile?.shortBio && 'short bio', !profile?.email && 'email'].filter(Boolean);
    const collection = (key, to, label, noun, nounPlural) => {
      const t = tally(data[key]);
      const detail = t.total === 0 ? `No ${nounPlural} yet` : `${t.published} published${t.drafts ? `, ${plural(t.drafts, 'draft')}` : ''}`;
      return { key, to, label, detail, state: t.total === 0 ? 'empty' : t.drafts ? 'drafts' : 'ready', stateText: t.total === 0 ? 'Empty' : t.drafts ? 'Has drafts' : 'Ready', ...t, noun };
    };
    return [
      { key: 'profile', to: '/admin/profile', label: 'Your profile', detail: missing.length ? `Still needed: ${missing.join(', ')}` : 'Name, headline, bio and email are set', state: missing.length ? 'empty' : 'ready', stateText: missing.length ? 'Incomplete' : 'Ready' },
      collection('projects', '/admin/projects', 'Projects', 'project', 'projects'),
      collection('skills', '/admin/skills', 'Skills', 'skill', 'skills'),
      collection('experience', '/admin/experience', 'Work experience', 'role', 'roles'),
      collection('education', '/admin/education', 'Education', 'entry', 'entries'),
      collection('certifications', '/admin/certifications', 'Certifications', 'certification', 'certifications'),
      collection('socials', '/admin/socials', 'Links', 'link', 'links'),
      { key: 'resume', to: '/admin/resume', label: 'Resume', detail: resume?.resumeUrl ? 'A resume link is set' : 'No resume link yet', state: resume?.resumeUrl ? 'ready' : 'empty', stateText: resume?.resumeUrl ? 'Ready' : 'Empty' },
    ];
  }, [data]);

  const nextUp = useMemo(() => {
    if (!data) return [];
    const row = (key) => outline.find((item) => item.key === key);
    const steps = [];
    if (row('profile').state !== 'ready') steps.push({ to: '/admin/profile', title: 'Finish your profile', why: row('profile').detail });
    if (row('projects').total === 0) steps.push({ to: '/admin/projects/new', title: 'Add your first project', why: 'Projects are the first thing most visitors look for.' });
    else if (row('projects').drafts) steps.push({ to: '/admin/projects', title: `Publish ${plural(row('projects').drafts, 'draft project')}`, why: 'Drafts are hidden from your connected websites.' });
    if (!data.resume?.resumeUrl) steps.push({ to: '/admin/resume', title: 'Add your resume link', why: 'Visitors can download it straight from your site.' });
    if (sites.length === 0) steps.push({ to: '/admin/apps', title: 'Connect a website', why: 'Your content only shows up on sites you connect.' });
    if (row('experience').total === 0) steps.push({ to: '/admin/experience', title: 'Add your work experience', why: 'A short history of roles builds trust.' });
    if (row('skills').total === 0) steps.push({ to: '/admin/skills', title: 'Add your skills', why: 'You can add several at once, separated by commas.' });
    if (row('socials').total === 0) steps.push({ to: '/admin/socials', title: 'Add your links', why: 'Tell people where else to find you.' });
    return steps.slice(0, 4);
  }, [data, outline, sites.length]);

  if (!data) return <Skeleton />;

  const { profile } = data;
  const open = Boolean(profile?.isAvailableForHire);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6 border-b border-t-border pb-8">
        <div className="min-w-0">
          <p className="text-sm text-t-muted">Your portfolio</p>
          <h1 className="mt-1 text-5xl text-t-text sm:text-6xl">{profile?.name || 'Welcome'}</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-t-muted">
            {profile?.headline || 'Add a headline so visitors know who you are and what you do.'}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-t-border bg-t-surface px-4 py-3">
          <button
            type="button" role="switch" aria-checked={open} aria-label="Open to new roles" aria-disabled={savingStatus || !profile}
            onClick={() => { if (!savingStatus) toggleAvailability(); }}
            className="-m-2 shrink-0 rounded-full p-2 aria-disabled:opacity-60"
          >
            <span className={`relative block h-6 w-11 rounded-full border transition-colors ${open ? 'border-t-accent2 bg-t-accent2' : 'border-t-border-hi bg-t-bg'}`}>
              <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition-transform ${open ? 'translate-x-5 bg-t-on-accent2' : 'translate-x-0 bg-t-muted'}`} />
            </span>
          </button>
          <div>
            <p aria-live="polite" className="text-sm font-medium text-t-text">{open ? 'Open to new roles' : 'Not looking right now'}</p>
            <p className="text-xs text-t-muted">Shown on your site</p>
          </div>
        </div>
      </header>

      <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-[1.35fr_1fr]">
        <section aria-labelledby="outline-title">
          <h2 id="outline-title" className="text-xl font-semibold text-t-text">What’s on your portfolio</h2>
          <p className="mt-1 text-sm text-t-muted">Connected websites only show items you have published.</p>
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

        <div className="space-y-12">
          <section aria-labelledby="next-title">
            <h2 id="next-title" className="text-xl font-semibold text-t-text">Next up</h2>
            {nextUp.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-t-muted">Everything is filled in. Keep your projects current and your connected websites will stay current too.</p>
            ) : (
              <ol className="mt-4 divide-y divide-t-border border-y border-t-border">
                {nextUp.map((step) => (
                  <li key={step.title}>
                    <Link to={step.to} className="group -mx-3 block rounded-md px-3 py-3.5 transition-colors hover:bg-t-surface">
                      <span className="block font-medium text-t-text group-hover:underline group-hover:underline-offset-4">{step.title}</span>
                      <span className="mt-0.5 block text-sm text-t-muted">{step.why}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="sites-title">
            <h2 id="sites-title" className="text-xl font-semibold text-t-text">Connected websites</h2>
            {sites.length === 0 ? (
              <p className="mt-3 text-sm leading-6 text-t-muted">
                No websites yet. <Link to="/admin/apps" className="font-medium text-t-accent underline underline-offset-4">Connect one</Link> and it can start showing your published content.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-t-border border-y border-t-border">
                {sites.map(({ app, activeKeys, lastUsedAt }) => (
                  <li key={app._id}>
                    <Link to={`/admin/apps/${app._id}`} className="group -mx-3 block rounded-md px-3 py-3.5 transition-colors hover:bg-t-surface">
                      <span className="block font-medium text-t-text group-hover:underline group-hover:underline-offset-4">{app.name}</span>
                      <span className="mt-0.5 block text-sm text-t-muted">
                        {activeKeys === 0 ? 'No active access key' : lastUsedAt ? `Last asked for your content ${timeAgo(lastUsedAt)}` : 'Hasn’t asked for your content yet'}
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
