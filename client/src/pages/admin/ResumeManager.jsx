import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { PENDING_BASE, useApiBase } from '../../lib/apiBase';
import { describeApiError } from '../../lib/apiErrors';
import {
  ExternalLink,
  Copy,
  Check,
  Save,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

const EMPTY = { resumeUrl: '', fileName: '', version: '', summaryText: '' };
const inputClass = 'w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-sm focus:border-t-accent outline-none';

export default function ResumeManager() {
  const { v1Base: resolvedBase, resolved: baseResolved } = useApiBase();
  // Show `…` until the server has said what the public base is, so nobody copies a guess.
  const v1Base = baseResolved ? resolvedBase : PENDING_BASE;
  const [resumeData, setResumeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const fetchResume = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('/resume');
      setResumeData(res.data);
      setForm({
        resumeUrl: res.data?.resumeUrl || '',
        fileName: res.data?.fileName || '',
        version: res.data?.version || '',
        summaryText: res.data?.summaryText || '',
      });
    } catch (err) {
      if (err.response?.status === 404) setResumeData(null);
      else setLoadError(describeApiError(err, { fallback: 'Could not load your résumé details.' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchResume(); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.resumeUrl.trim()) {
      setErrorMessage('Add the link to your résumé first.');
      return;
    }
    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const res = await api.put('/resume', form);
      setResumeData(res.data);
      setStatusMessage('Résumé saved. Apps serve it on the next request; sites that fetch in the browser show it within a minute.');
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err) {
      setErrorMessage(describeApiError(err, { fallback: 'Could not save the résumé.' }).message);
    } finally {
      setSaving(false);
    }
  };

  const copy = async (value, key) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setErrorMessage('Clipboard access failed. Select the text and copy it yourself.');
    }
  };

  const endpoint = `${v1Base}/resume`;

  if (loading) {
    return <p role="status" className="mx-auto max-w-4xl rounded border border-t-border bg-t-surface p-5 text-center text-sm text-t-muted">Loading résumé settings…</p>;
  }

  if (loadError) {
    return (
      <div role="alert" className="mx-auto max-w-4xl rounded border border-t-danger/40 bg-t-danger-dim p-5 text-sm text-t-text">
        {loadError.message} <button type="button" onClick={fetchResume} className="font-medium text-t-accent underline underline-offset-4">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-t-border">
        <div>
          <h1 className="text-3xl text-t-text">Résumé</h1>
          <p className="text-sm text-t-muted mt-2 max-w-prose">
            The link to the PDF visitors download from your site. Apps read it from <code translate="no">{endpoint}</code>.
          </p>
        </div>
        {form.resumeUrl && (
          <a href={form.resumeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-t-surface-hi text-t-text font-semibold text-sm border border-t-border transition-all">
            <ExternalLink size={14} aria-hidden="true" className="text-t-accent" />
            <span>Open résumé</span>
          </a>
        )}
      </div>

      {statusMessage && (
        <div role="status" className="p-3 rounded bg-t-accent2-dim border border-t-accent2/50 text-t-accent2 text-sm flex items-center gap-2">
          <CheckCircle size={15} aria-hidden="true" />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div role="alert" className="p-3 rounded bg-t-danger-dim border border-t-danger/50 text-t-danger text-sm flex items-center gap-2">
          <AlertCircle size={15} aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="rounded bg-t-surface border border-t-border p-5 sm:p-6 space-y-5">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="resume-url" className="block text-sm font-medium text-t-text mb-1">Résumé link</label>
            <div className="flex items-center gap-2">
              <input
                id="resume-url"
                type="url"
                required
                value={form.resumeUrl}
                onChange={(e) => setForm({ ...form, resumeUrl: e.target.value })}
                placeholder="https://drive.google.com/file/d/…/view"
                aria-describedby="resume-url-hint"
                autoComplete="off"
                spellCheck={false}
                className={`flex-1 ${inputClass}`}
              />
              <button type="button" onClick={() => copy(form.resumeUrl, 'url')} disabled={!form.resumeUrl} aria-label="Copy résumé link" className="px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-muted hover:text-t-text text-sm disabled:opacity-30">
                {copied === 'url' ? <Check size={14} aria-hidden="true" className="text-t-accent2" /> : <Copy size={14} aria-hidden="true" />}
              </button>
            </div>
            <p id="resume-url-hint" className="mt-1 text-xs text-t-muted">An https link anyone can open: Google Drive, Dropbox, S3, your own site.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="resume-filename" className="block text-sm font-medium text-t-text mb-1">File name</label>
              <input id="resume-filename" type="text" maxLength={120} value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} placeholder="e.g. jane-doe-resume.pdf" aria-describedby="resume-filename-hint" autoComplete="off" className={inputClass} />
              <p id="resume-filename-hint" className="mt-1 text-xs text-t-muted">Shown on the download button.</p>
            </div>
            <div>
              <label htmlFor="resume-version" className="block text-sm font-medium text-t-text mb-1">Version</label>
              <input id="resume-version" type="text" maxLength={40} value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="e.g. 2026-10" aria-describedby="resume-version-hint" autoComplete="off" className={inputClass} />
              <p id="resume-version-hint" className="mt-1 text-xs text-t-muted">Optional. A date or tag so you know which copy is live.</p>
            </div>
          </div>

          <div>
            <label htmlFor="resume-summary" className="block text-sm font-medium text-t-text mb-1">Summary</label>
            <textarea id="resume-summary" rows={3} value={form.summaryText} onChange={(e) => setForm({ ...form, summaryText: e.target.value })} placeholder="e.g. Two sentences on what you do and what you are looking for…" aria-describedby="resume-summary-hint" className={inputClass} />
            <p id="resume-summary-hint" className="mt-1 text-xs text-t-muted">Optional. Served next to the link for sites that show a short intro.</p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-t-border">
            <div className="text-xs text-t-dim">
              {resumeData?.lastUpdated && <span>Last updated {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(resumeData.lastUpdated))}</span>}
            </div>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-sm transition-all disabled:opacity-50">
              <Save size={14} aria-hidden="true" />
              <span>{saving ? 'Saving…' : 'Save and publish'}</span>
            </button>
          </div>
        </form>
      </div>

      <section aria-labelledby="resume-api-title" className="rounded bg-t-surface border border-t-border p-5 space-y-3">
        <h2 id="resume-api-title" className="text-sm font-semibold text-t-text">What Apps receive</h2>
        <p className="text-sm text-t-muted">
          <code translate="no" className="text-t-text">GET {endpoint}</code> answers with the fields below (an App can be granted fewer). Until a link is saved it answers <code translate="no">404 not_configured</code>.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code translate="no" className="break-all rounded border border-t-border bg-t-code px-3 py-2 text-xs text-t-text">{endpoint}</code>
          <button type="button" onClick={() => copy(endpoint, 'endpoint')} className="inline-flex min-h-9 items-center gap-1.5 rounded border border-t-border-hi px-3 text-xs font-medium text-t-text hover:border-t-accent hover:text-t-accent">{copied === 'endpoint' ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}{copied === 'endpoint' ? 'Copied' : 'Copy URL'}</button>
        </div>
        <pre className="p-4 rounded bg-t-code border border-t-border text-xs text-t-text overflow-x-auto"><code translate="no">{JSON.stringify({
          data: {
            resumeUrl: form.resumeUrl || 'https://…',
            fileName: form.fileName || '',
            version: form.version || '',
            summaryText: form.summaryText || '',
            lastUpdated: resumeData?.lastUpdated || new Date().toISOString(),
          },
        }, null, 2)}</code></pre>
      </section>
    </div>
  );
}
