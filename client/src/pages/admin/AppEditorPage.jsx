import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';

const SECTIONS = {
  profile: { label: 'Profile', fields: ['name', 'initials', 'headline', 'shortBio', 'aboutMarkdown', 'email', 'location.city', 'location.country', 'location.isRemoteAvailable', 'statusText', 'isAvailableForHire', 'terminalUser', 'terminalHost', 'bootGreeting', 'metrics'] },
  resume: { label: 'Resume', fields: ['resumeUrl', 'driveUrl', 'fileName', 'version', 'lastUpdated', 'summaryText'] },
  socials: { label: 'Social links', fields: ['platform', 'label', 'url', 'username', 'icon', 'order', 'featured'] },
  skills: { label: 'Skills', fields: ['name', 'category', 'proficiency', 'yearsOfExperience', 'featured', 'order'] },
  projects: { label: 'Projects', fields: ['title', 'slug', 'mode', 'role', 'shortDescription', 'keyMetric', 'highlights', 'caseStudyBody', 'stack', 'teammates', 'thumbnail', 'links.github', 'links.live', 'links.demo', 'order', 'featured', 'lastUpdated'] },
  experience: { label: 'Experience', fields: ['company', 'role', 'employmentType', 'period', 'startDate', 'endDate', 'isCurrent', 'location', 'companyUrl', 'description', 'achievements', 'technologies', 'order', 'featured'] },
  education: { label: 'Education', fields: ['institution', 'degree', 'fieldOfStudy', 'period', 'startDate', 'endDate', 'grade', 'location', 'achievements', 'order', 'featured'] },
  certifications: { label: 'Certifications', fields: ['title', 'issuer', 'issueDate', 'expirationDate', 'credentialId', 'credentialUrl', 'skills', 'order', 'featured'] },
};
const ENDPOINT = { socials: '/socials', skills: '/skills', projects: '/projects', experience: '/experience', education: '/education', certifications: '/certifications' };
const SKILL_CATEGORIES = ['Languages', 'Frontend', 'Backend & Systems', 'Databases & Caching', 'DevOps & Cloud', 'Hardware & Electronics', 'Tools & Frameworks'];
const DEFAULTS = {
  profile: ['name', 'initials', 'headline', 'shortBio', 'aboutMarkdown', 'location.city', 'location.country', 'location.isRemoteAvailable', 'statusText', 'isAvailableForHire', 'terminalUser', 'terminalHost', 'bootGreeting', 'metrics'],
  resume: ['resumeUrl', 'fileName', 'version', 'lastUpdated', 'summaryText'],
  ...Object.fromEntries(Object.entries(SECTIONS).filter(([key]) => !['profile', 'resume'].includes(key)).map(([key, section]) => [key, section.fields])),
};

function moveId(ids, index, offset) {
  const target = index + offset;
  if (target < 0 || target >= ids.length) return ids;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export default function AppEditorPage() {
  const { id } = useParams();
  const [app, setApp] = useState(null);
  const [records, setRecords] = useState({});
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    api.get('/apps').then(({ data }) => { if (active) { const found = data.find((item) => item._id === id); setApp(found || null); if (!found) setError('App not found.'); } }).catch(() => { if (active) setError('Could not load app settings.'); });
    Promise.all(Object.entries(ENDPOINT).map(async ([section, path]) => {
      try { const { data } = await api.get(path); return [section, Array.isArray(data) ? data : data.items || []]; }
      catch { return [section, []]; }
    })).then((entries) => { if (active) setRecords(Object.fromEntries(entries)); });
    return () => { active = false; };
  }, [id]);

  const enabledCount = useMemo(() => Object.values(app?.include || {}).filter((config) => config?.enabled).length, [app]);
  function updateSection(key, patch) {
    setApp((current) => ({ ...current, include: { ...current.include, [key]: { ...(current.include?.[key] || {}), ...patch } } }));
    setSaved(false); setPreview(null);
  }
  function toggleField(key, field) {
    const current = app.include?.[key]?.fields?.length ? app.include[key].fields : DEFAULTS[key];
    const next = current.includes(field) ? current.filter((value) => value !== field) : [...current, field];
    updateSection(key, { fields: next });
  }
  async function save() {
    setError('');
    try { const { data } = await api.put(`/apps/${id}`, { name: app.name, type: app.type, allowedOrigins: app.allowedOrigins, include: app.include }); setApp(data); setSaved(true); }
    catch (err) { setError(err.response?.data?.details?.join(', ') || err.response?.data?.message || 'Could not save app.'); }
  }
  async function loadPreview() {
    setError('');
    try { const { data } = await api.get(`/apps/${id}/preview`); setPreview(data); }
    catch (err) { setError(err.response?.data?.message || 'Could not load preview.'); }
  }

  if (!app) return <div className="max-w-5xl mx-auto"><Link to="/admin/apps">← Apps</Link><p className="mt-6 opacity-70">{error || 'Loading app…'}</p></div>;
  return <div className="max-w-5xl mx-auto space-y-6">
    <header className="flex justify-between items-end gap-4"><div><Link to="/admin/apps" className="text-sm opacity-60">← Apps</Link><h1 className="text-3xl font-bold mt-2">{app.name}</h1><p className="opacity-70 mt-1">Choose the sections, records, and fields this app can expose. {enabledCount} sections enabled.</p></div><button onClick={save} className="rounded-lg px-4 py-2 bg-t-accent text-t-on-accent">{saved ? 'Saved' : 'Save changes'}</button></header>
    {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
    <section className="grid md:grid-cols-3 gap-3 p-5 rounded-xl border border-t-border bg-t-surface"><label className="text-sm">App name<input maxLength={80} value={app.name} onChange={(event) => { setApp({ ...app, name: event.target.value }); setSaved(false); }} className="block mt-1 w-full rounded-lg border border-t-border bg-t-bg px-3 py-2" /></label><label className="text-sm">App type<select value={app.type} onChange={(event) => { setApp({ ...app, type: event.target.value }); setSaved(false); }} className="block mt-1 w-full rounded-lg border border-t-border bg-t-bg px-3 py-2"><option value="static">Static</option><option value="protected">Protected</option></select></label><label className="text-sm">Allowed origins<input value={(app.allowedOrigins || []).join(', ')} onChange={(event) => { setApp({ ...app, allowedOrigins: event.target.value.split(/[\s,]+/).filter(Boolean) }); setSaved(false); }} placeholder="https://example.com" className="block mt-1 w-full rounded-lg border border-t-border bg-t-bg px-3 py-2" /><span className="text-xs opacity-60">Comma separated HTTPS origins. Local HTTP is accepted in development.</span></label></section>
    <div className="grid md:grid-cols-2 gap-4">
      {Object.entries(SECTIONS).map(([key, section]) => {
        const config = app.include?.[key] || {};
        const selectedIds = (config.ids || []).map(String);
        return <section key={key} className="p-5 rounded-xl border border-t-border bg-t-surface space-y-4">
          <div className="flex justify-between items-center"><h2 className="font-semibold">{section.label}</h2><label className="flex gap-2 items-center text-sm"><input type="checkbox" checked={Boolean(config.enabled)} onChange={(event) => updateSection(key, { enabled: event.target.checked })} />Enabled</label></div>
          {!['profile', 'resume'].includes(key) && <>
            <label className="block text-sm">Exposure mode<select value={config.mode || 'all'} onChange={(event) => updateSection(key, { mode: event.target.value })} className="block mt-1 w-full rounded-lg border border-t-border bg-t-bg px-3 py-2"><option value="all">All published</option><option value="featured">Featured only</option><option value="selected">Selected records</option></select></label>
            {config.mode === 'selected' && <div className="max-h-48 overflow-auto space-y-1">{(records[key] || []).map((record) => {
              const itemId = String(record._id);
              const index = selectedIds.indexOf(itemId);
              const label = record.title || record.name || record.company || record.institution || record.platform || itemId.slice(-6);
              return <div key={itemId} className="flex items-center gap-2 text-sm"><input aria-label={`Select ${label}`} type="checkbox" checked={index !== -1} onChange={() => updateSection(key, { ids: index !== -1 ? selectedIds.filter((value) => value !== itemId) : [...selectedIds, itemId] })} /><span className="flex-1">{label}</span>{index !== -1 && <><button type="button" aria-label="Move selected item up" disabled={index === 0} onClick={() => updateSection(key, { ids: moveId(selectedIds, index, -1) })}>↑</button><button type="button" aria-label="Move selected item down" disabled={index === selectedIds.length - 1} onClick={() => updateSection(key, { ids: moveId(selectedIds, index, 1) })}>↓</button></>}</div>;
            })}{!records[key]?.length && <p className="text-xs opacity-60">No records available.</p>}</div>}
            {key === 'skills' && <fieldset><legend className="text-xs font-semibold opacity-70 mb-1">Limit to categories</legend><div className="grid grid-cols-2 gap-2">{SKILL_CATEGORIES.map((category) => <label key={category} className="flex gap-2 items-center text-xs"><input type="checkbox" checked={(config.categories || []).includes(category)} onChange={() => { const categories = config.categories || []; updateSection(key, { categories: categories.includes(category) ? categories.filter((value) => value !== category) : [...categories, category] }); }} />{category}</label>)}</div><p className="text-xs opacity-60 mt-1">No categories selected includes every category.</p></fieldset>}
          </>}
          <details><summary className="cursor-pointer text-sm">Public fields</summary><div className="mt-3 space-y-3">{Object.entries(section.fields.reduce((groups, field) => { const parent = field.split('.')[0]; (groups[parent] ||= []).push(field); return groups; }, {})).map(([parent, fields]) => <fieldset key={parent}><legend className="text-xs font-semibold opacity-70 mb-1">{parent}</legend><div className="grid grid-cols-2 gap-2">{fields.map((field) => <label key={field} className="flex gap-2 items-center text-xs"><input type="checkbox" checked={(config.fields?.length ? config.fields : DEFAULTS[key]).includes(field)} onChange={() => toggleField(key, field)} />{field.includes('.') ? field.slice(parent.length + 1) : field}</label>)}</div></fieldset>)}</div><p className="text-xs opacity-60 mt-2">Only public fields can be exposed.</p></details>
        </section>;
      })}
    </div>
    <section className="p-5 rounded-xl border border-t-border bg-t-surface space-y-3"><label className="flex gap-2 items-center font-semibold"><input type="checkbox" checked={Boolean(app.include?.fs?.enabled)} onChange={(event) => { setApp((current) => ({ ...current, include: { ...current.include, fs: { enabled: event.target.checked } } })); setSaved(false); setPreview(null); }} />Enable virtual filesystem view</label><div className="flex items-center gap-3"><button onClick={loadPreview} className="rounded-lg border border-t-border px-3 py-2 text-sm">Load preview</button>{preview && <span className="text-xs opacity-60">Preview reflects the saved configuration.</span>}</div>{preview && <pre className="max-h-[32rem] overflow-auto rounded-lg bg-t-bg p-4 text-xs">{JSON.stringify(preview, null, 2)}</pre>}</section>
  </div>;
}
