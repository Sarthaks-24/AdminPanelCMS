import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import {
  ExternalLink,
  Copy,
  Check,
  Save,
  Terminal,
  FileText,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

export default function ResumeManager() {
  const [resumeData, setResumeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const [form, setForm] = useState({
    resumeUrl: '',
    fileName: 'Resume_Master.pdf',
    version: 'v2026.09',
    summaryText: 'Full Stack Engineer with expertise in real-time WebSockets, microservices, and electronics debugging.',
  });

  const fetchResume = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.get('/resume');
      setResumeData(res.data);
      setForm({
        resumeUrl: res.data?.resumeUrl || '',
        fileName: res.data?.fileName || 'Resume_Master.pdf',
        version: res.data?.version || 'v2026.09',
        summaryText: res.data?.summaryText || '',
      });
    } catch (err) {
      if (err.response?.status === 404) {
        setResumeData(null);
      } else {
        setErrorMessage('Failed to load resume link from server.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResume();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.resumeUrl.trim()) {
      setErrorMessage('Resume URL cannot be empty.');
      return;
    }

    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const res = await api.put('/resume', form);
      setResumeData(res.data);
      setStatusMessage('Resume document metadata successfully updated in MongoDB!');
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || 'Error updating resume link in database.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (form.resumeUrl) {
      navigator.clipboard.writeText(form.resumeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return <main className="mx-auto max-w-4xl p-6"><p role="status" className="rounded border border-t-border bg-t-surface p-5 text-center text-xs text-t-muted">Loading resume settings…</p></main>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-t-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-t-surface text-t-accent2 border border-t-border">
              <FileText size={20} />
            </div>
            <h1 className="text-xl font-bold text-t-text tracking-tight">Resume Hub &amp; PDF Asset Manager</h1>
          </div>
          <p className="text-xs text-t-muted mt-1">
            Single source of truth cloud PDF link served dynamically to web visitors and client applications.
          </p>
        </div>

        {form.resumeUrl && (
          <a
            href={form.resumeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-t-surface-hi hover:bg-t-surface-hi text-t-text font-semibold text-xs border border-t-border transition-all cursor-pointer"
          >
            <ExternalLink size={14} className="text-t-accent" />
            <span>Open &amp; Test Link</span>
          </a>
        )}
      </div>

      {/* Notifications */}
      {statusMessage && (
        <div className="p-3 rounded bg-t-accent2-dim border border-t-accent2/50 text-t-accent2 text-xs flex items-center gap-2 font-mono">
          <CheckCircle size={15} />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3 rounded bg-t-danger-dim border border-t-danger/50 text-t-danger text-xs flex items-center gap-2 font-mono">
          <AlertCircle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Master Form Card */}
      <div className="rounded bg-t-surface border border-t-border p-5 sm:p-6 space-y-5">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-t-muted mb-1">
              Cloud Resume PDF URL * (Google Drive, AWS S3, Cloudinary)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                required
                value={form.resumeUrl}
                onChange={(e) => setForm({ ...form, resumeUrl: e.target.value })}
                placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                className="flex-1 px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                disabled={!form.resumeUrl}
                className="px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-muted hover:text-t-text text-xs disabled:opacity-30 cursor-pointer"
                title="Copy URL"
              >
                {copied ? <Check size={14} className="text-t-accent2" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">
                Display File Name *
              </label>
              <input
                type="text"
                required
                value={form.fileName}
                onChange={(e) => setForm({ ...form, fileName: e.target.value })}
                placeholder="Resume_Master.pdf"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">
                Version Tag *
              </label>
              <input
                type="text"
                required
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                placeholder="v2026.09"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-t-muted mb-1">
              Resume Executive Summary / Objective
            </label>
            <textarea
              rows={3}
              value={form.summaryText}
              onChange={(e) => setForm({ ...form, summaryText: e.target.value })}
              placeholder="Full Stack Engineer with expertise in real-time WebSockets, microservices, and electronics debugging..."
              className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
            />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-t-border">
            <div className="text-[11px] font-mono text-t-dim">
              {resumeData?.lastUpdated && (
                <span>Last Updated: {new Date(resumeData.lastUpdated).toLocaleString()}</span>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded bg-t-accent2 hover:bg-t-accent2 text-t-on-accent2 font-semibold text-xs transition-all shadow cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              <span>{saving ? 'Updating...' : 'Save Resume Metadata'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Public API Preview Card */}
      <div className="rounded bg-t-surface border border-t-border p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Terminal size={15} className="text-t-accent2" />
          <span className="text-xs font-mono font-bold text-t-text uppercase tracking-wider">
            Public API Payload Telemetry
          </span>
        </div>
        <p className="text-xs text-t-muted">
          When client applications request <code className="text-t-accent-br">GET /api/resume</code>, the backend responds with this payload:
        </p>

        <pre className="p-4 rounded bg-t-bg border border-t-border-hi text-xs font-mono text-t-accent2 overflow-x-auto">
{JSON.stringify(
  {
    fileName: form.fileName,
    version: form.version,
    resumeUrl: form.resumeUrl || 'https://drive.google.com/...',
    driveUrl: form.resumeUrl || 'https://drive.google.com/...',
    summaryText: form.summaryText,
    lastUpdated: resumeData?.lastUpdated || new Date().toISOString(),
  },
  null,
  2
)}
        </pre>
      </div>
    </div>
  );
}
