import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { apiErrorMessage } from '../../lib/apiErrors';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Save,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Mail,
  Phone,
  Eye,
  Edit3,
} from 'lucide-react';

// Blank, like the server's defaults. Examples live in placeholders, never in values.
const EMPTY = {
  name: '',
  initials: '',
  headline: '',
  shortBio: '',
  aboutMarkdown: '',
  email: '',
  phone: '',
  location: { city: '', country: '', isRemoteAvailable: false },
  statusText: '',
  isAvailableForHire: false,
  terminalUser: '',
  terminalHost: '',
  bootGreeting: '',
  metrics: [],
};

const fromServer = (data) => ({
  name: data?.name || '',
  initials: data?.initials || '',
  headline: data?.headline || '',
  shortBio: data?.shortBio || '',
  aboutMarkdown: data?.aboutMarkdown || '',
  email: data?.email || '',
  phone: data?.phone || '',
  location: {
    city: data?.location?.city || '',
    country: data?.location?.country || '',
    isRemoteAvailable: Boolean(data?.location?.isRemoteAvailable),
  },
  statusText: data?.statusText || '',
  isAvailableForHire: Boolean(data?.isAvailableForHire),
  terminalUser: data?.terminalUser || '',
  terminalHost: data?.terminalHost || '',
  bootGreeting: data?.bootGreeting || '',
  metrics: Array.isArray(data?.metrics) ? data.metrics : [],
});

const input = 'w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-sm focus:border-t-accent outline-none';
const labelClass = 'block text-sm font-medium text-t-text mb-1';
const hintClass = 'text-xs text-t-muted mt-1';

function Section({ title, hint, aside, children }) {
  return (
    <section className="p-5 rounded bg-t-surface border border-t-border space-y-4">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-t-border">
        <div>
          <h2 className="text-sm font-semibold text-t-text">{title}</h2>
          {hint && <p className="text-xs text-t-muted mt-0.5">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export default function ProfileEditor() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('write'); // 'write' or 'preview'
  const [configured, setConfigured] = useState(true);
  const [form, setForm] = useState(EMPTY);

  const loadProfile = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/profile');
      if (res.data) {
        setForm(fromServer(res.data));
        setConfigured(res.data.configured !== false);
      }
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load your profile.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProfile(); }, []);

  const handleChange = (field, val) => setForm((prev) => ({ ...prev, [field]: val }));
  const handleLocationChange = (field, val) => setForm((prev) => ({ ...prev, location: { ...prev.location, [field]: val } }));
  const handleMetricChange = (index, field, val) => {
    setForm((prev) => {
      const updated = [...prev.metrics];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, metrics: updated };
    });
  };
  const addMetric = () => setForm((prev) => ({ ...prev, metrics: [...prev.metrics, { label: '', value: '', description: '' }] }));
  const removeMetric = (index) => setForm((prev) => ({ ...prev, metrics: prev.metrics.filter((_, i) => i !== index) }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res = await api.put('/profile', form);
      setForm(fromServer(res.data));
      setConfigured(true);
      setSuccessMsg('Profile saved. Apps that serve it pick it up within about a minute.');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not save your profile.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p role="status" className="text-sm text-t-muted">Loading your profile…</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="mx-auto max-w-5xl rounded border border-t-danger/40 bg-t-danger-dim p-5 text-sm text-t-text">
        {loadError} <button type="button" onClick={loadProfile} className="font-medium text-t-accent underline underline-offset-4">Retry</button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-t-border">
        <div>
          <h1 className="text-3xl text-t-text">Your profile</h1>
          <p className="text-sm text-t-muted mt-2 max-w-prose">
            {configured ? 'The name, headline and bio at the top of your portfolio, and how people can reach you.' : 'Not saved yet. Until it is, /v1/profile answers 404 not_configured to every App.'}
          </p>
        </div>
        <button
          type="submit"
          form="profile-form"
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-sm transition-all disabled:opacity-50"
        >
          <Save size={15} aria-hidden="true" />
          <span>{saving ? 'Saving…' : 'Save profile'}</span>
        </button>
      </div>

      {successMsg && (
        <div role="status" className="p-3 rounded bg-t-accent2-dim border border-t-accent2/50 text-t-accent2 text-sm flex items-center gap-2">
          <CheckCircle size={15} aria-hidden="true" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div role="alert" className="p-3 rounded bg-t-danger-dim border border-t-danger/50 text-t-danger text-sm flex items-center gap-2">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form id="profile-form" onSubmit={handleSubmit} className="space-y-6">
        <Section title="Availability" aside={<span aria-live="polite" className="text-xs text-t-accent2">{form.isAvailableForHire ? 'Open to new roles' : 'Not looking right now'}</span>}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isAvailableForHire"
                checked={form.isAvailableForHire}
                onChange={(e) => handleChange('isAvailableForHire', e.target.checked)}
                className="w-4 h-4 rounded accent-[var(--theme-accent)]"
              />
              <label htmlFor="isAvailableForHire" className="text-sm text-t-text cursor-pointer">
                I’m open to new roles
              </label>
            </div>
            <div>
              <label htmlFor="statusText" className={labelClass}>Status line</label>
              <input
                id="statusText"
                type="text"
                maxLength={200}
                value={form.statusText}
                onChange={(e) => handleChange('statusText', e.target.value)}
                placeholder="e.g. Taking on freelance work from November"
                aria-describedby="statusText-hint"
                autoComplete="off"
                className={input}
              />
              <p id="statusText-hint" className={hintClass}>Shown on your site in your own words. The switch on the Overview page never rewrites it.</p>
            </div>
          </div>
        </Section>

        <Section title="About you and how to reach you">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="name" className={labelClass}>Name</label>
              <input id="name" type="text" required maxLength={120} value={form.name} onChange={(e) => handleChange('name', e.target.value)} autoComplete="name" className={input} />
            </div>
            <div>
              <label htmlFor="initials" className={labelClass}>Initials</label>
              <input id="initials" type="text" maxLength={4} value={form.initials} onChange={(e) => handleChange('initials', e.target.value)} placeholder="e.g. AE" aria-describedby="initials-hint" autoComplete="off" className={input} />
              <p id="initials-hint" className={hintClass}>Up to 4 letters, for avatars.</p>
            </div>
            <div>
              <label htmlFor="headline" className={labelClass}>Headline</label>
              <input id="headline" type="text" required maxLength={160} value={form.headline} onChange={(e) => handleChange('headline', e.target.value)} placeholder="e.g. Frontend engineer, open-source maintainer" autoComplete="organization-title" className={input} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="email" className={labelClass}>Public email</label>
              <div className="relative">
                <Mail size={14} aria-hidden="true" className="absolute left-3 top-3 text-t-dim" />
                <input id="email" type="email" required maxLength={254} value={form.email} onChange={(e) => handleChange('email', e.target.value)} aria-describedby="email-hint" autoComplete="email" spellCheck={false} className={`${input} pl-9`} />
              </div>
              <p id="email-hint" className={hintClass}>The contact address on your site. Served only to Apps that opt in to it. Your sign-in email stays separate.</p>
            </div>
            <div>
              <label htmlFor="phone" className={labelClass}>Phone</label>
              <div className="relative">
                <Phone size={14} aria-hidden="true" className="absolute left-3 top-3 text-t-dim" />
                <input id="phone" type="tel" maxLength={40} value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="e.g. +1 555 123 4567" aria-describedby="phone-hint" autoComplete="tel" className={`${input} pl-9`} />
              </div>
              <p id="phone-hint" className={hintClass}>Kept for you. Never served to any App.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label htmlFor="city" className={labelClass}>City</label>
              <input id="city" type="text" maxLength={80} value={form.location.city} onChange={(e) => handleLocationChange('city', e.target.value)} placeholder="e.g. Lisbon" autoComplete="address-level2" className={input} />
            </div>
            <div>
              <label htmlFor="country" className={labelClass}>Country</label>
              <input id="country" type="text" maxLength={80} value={form.location.country} onChange={(e) => handleLocationChange('country', e.target.value)} placeholder="e.g. Portugal" autoComplete="country-name" className={input} />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <input type="checkbox" id="isRemoteAvailable" checked={form.location.isRemoteAvailable} onChange={(e) => handleLocationChange('isRemoteAvailable', e.target.checked)} className="w-4 h-4 rounded accent-[var(--theme-accent)]" />
              <label htmlFor="isRemoteAvailable" className="text-sm text-t-text cursor-pointer">Open to remote work</label>
            </div>
          </div>
        </Section>

        <Section title="Your bio">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="shortBio" className="text-sm font-medium text-t-text">Short bio</label>
              <span aria-live="polite" className={`text-xs ${form.shortBio.length > 300 ? 'text-t-danger' : 'text-t-dim'}`}>{form.shortBio.length} / 300</span>
            </div>
            <textarea id="shortBio" required maxLength={300} rows={2} value={form.shortBio} onChange={(e) => handleChange('shortBio', e.target.value)} placeholder="One or two sentences on what you do and care about…" aria-describedby="shortBio-hint" className={`${input} resize-none`} />
            <p id="shortBio-hint" className={hintClass}>Up to 300 characters. The first thing most sites show under your name.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="aboutMarkdown" className="text-sm font-medium text-t-text">About (Markdown, optional)</label>
              <div role="group" aria-label="Editor view" className="flex items-center bg-t-bg border border-t-border-hi rounded p-0.5">
                <button type="button" onClick={() => setActiveTab('write')} aria-pressed={activeTab === 'write'} className={`px-2.5 py-1 text-xs rounded ${activeTab === 'write' ? 'bg-t-accent text-t-on-accent font-bold' : 'text-t-muted hover:text-t-text'}`}>
                  <span className="flex items-center gap-1.5"><Edit3 size={11} aria-hidden="true" /> Write</span>
                </button>
                <button type="button" onClick={() => setActiveTab('preview')} aria-pressed={activeTab === 'preview'} className={`px-2.5 py-1 text-xs rounded ${activeTab === 'preview' ? 'bg-t-accent text-t-on-accent font-bold' : 'text-t-muted hover:text-t-text'}`}>
                  <span className="flex items-center gap-1.5"><Eye size={11} aria-hidden="true" /> Preview</span>
                </button>
              </div>
            </div>
            {activeTab === 'write' ? (
              <textarea id="aboutMarkdown" rows={6} value={form.aboutMarkdown} onChange={(e) => handleChange('aboutMarkdown', e.target.value)} placeholder="A longer story: where you started, what you work on now, what you are looking for…" className={`${input} font-mono`} />
            ) : (
              <div className="p-4 rounded bg-t-bg border border-t-border-hi min-h-[140px] preview-prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.aboutMarkdown || '*Nothing written yet.*'}</ReactMarkdown>
              </div>
            )}
          </div>
        </Section>

        <Section
          title="Terminal prompt"
          hint="Optional. Only terminal-style sites use these."
          aside={<span className="text-xs font-mono text-t-accent" translate="no">{form.terminalUser || 'user'}@{form.terminalHost || 'host'}:~$</span>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="terminalUser" className={labelClass}>Prompt user</label>
              <input id="terminalUser" type="text" maxLength={32} value={form.terminalUser} onChange={(e) => handleChange('terminalUser', e.target.value)} placeholder="e.g. ada" autoComplete="off" spellCheck={false} className={`${input} font-mono`} />
            </div>
            <div>
              <label htmlFor="terminalHost" className={labelClass}>Prompt host</label>
              <input id="terminalHost" type="text" maxLength={32} value={form.terminalHost} onChange={(e) => handleChange('terminalHost', e.target.value)} placeholder="e.g. portfolio" autoComplete="off" spellCheck={false} className={`${input} font-mono`} />
            </div>
            <div>
              <label htmlFor="bootGreeting" className={labelClass}>Greeting line</label>
              <input id="bootGreeting" type="text" maxLength={500} value={form.bootGreeting} onChange={(e) => handleChange('bootGreeting', e.target.value)} placeholder="e.g. Welcome. Type help to begin." autoComplete="off" className={`${input} font-mono`} />
            </div>
          </div>
        </Section>

        <Section
          title="Highlights"
          hint="Up to 8 numbers or facts worth leading with."
          aside={<button type="button" onClick={addMetric} disabled={form.metrics.length >= 8} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent text-xs font-semibold disabled:opacity-50"><Plus size={12} aria-hidden="true" /><span>Add highlight</span></button>}
        >
          {form.metrics.length === 0 ? (
            <p className="text-center py-6 text-t-muted text-sm border border-dashed border-t-border-hi rounded">
              No highlights yet. A label and a value, like “Years shipping” and “8”.
            </p>
          ) : (
            <ul className="space-y-3">
              {form.metrics.map((metric, idx) => (
                <li key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end p-3 rounded bg-t-bg border border-t-border">
                  <div className="sm:col-span-4">
                    <label htmlFor={`metric-label-${idx}`} className={labelClass}>Label</label>
                    <input id={`metric-label-${idx}`} type="text" maxLength={40} placeholder="e.g. Years shipping" value={metric.label} onChange={(e) => handleMetricChange(idx, 'label', e.target.value)} autoComplete="off" className={`${input} bg-t-surface`} />
                  </div>
                  <div className="sm:col-span-3">
                    <label htmlFor={`metric-value-${idx}`} className={labelClass}>Value</label>
                    <input id={`metric-value-${idx}`} type="text" maxLength={40} placeholder="e.g. 8" value={metric.value} onChange={(e) => handleMetricChange(idx, 'value', e.target.value)} autoComplete="off" className={`${input} bg-t-surface font-mono`} />
                  </div>
                  <div className="sm:col-span-4">
                    <label htmlFor={`metric-note-${idx}`} className={labelClass}>Note</label>
                    <input id={`metric-note-${idx}`} type="text" maxLength={200} placeholder="e.g. across three companies" value={metric.description} onChange={(e) => handleMetricChange(idx, 'description', e.target.value)} autoComplete="off" className={`${input} bg-t-surface`} />
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    <button type="button" onClick={() => removeMetric(idx)} aria-label={`Remove highlight ${idx + 1}`} className="p-2 rounded text-t-danger hover:bg-t-danger-dim transition-all">
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-bold text-sm transition-all disabled:opacity-50">
            <Save size={15} aria-hidden="true" />
            <span>{saving ? 'Saving…' : 'Save profile'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
