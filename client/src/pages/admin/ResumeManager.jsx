import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import {
  ExternalLink,
  Copy,
  Check,
  Save,
  Terminal,
  FileText,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Link2,
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1a2333]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-[#090d15] text-[#10b981] border border-[#1a2333]">
              <FileText size={20} />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Resume Hub &amp; PDF Asset Manager</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Single source of truth cloud PDF link served dynamically to web visitors and client applications.
          </p>
        </div>

        {form.resumeUrl && (
          <a
            href={form.resumeUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#0f141f] hover:bg-[#151c2c] text-white font-semibold text-xs border border-[#1a2333] transition-all cursor-pointer"
          >
            <ExternalLink size={14} className="text-[#0078d4]" />
            <span>Open &amp; Test Link</span>
          </a>
        )}
      </div>

      {/* Notifications */}
      {statusMessage && (
        <div className="p-3 rounded bg-[#062419] border border-[#10b981]/50 text-[#10b981] text-xs flex items-center gap-2 font-mono">
          <CheckCircle size={15} />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3 rounded bg-[#2a0b12] border border-red-500/50 text-red-300 text-xs flex items-center gap-2 font-mono">
          <AlertCircle size={15} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Master Form Card */}
      <div className="rounded bg-[#070a10] border border-[#1a2333] p-5 sm:p-6 space-y-5">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              Cloud Resume PDF URL * (Google Drive, AWS S3, Cloudinary)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                required
                value={form.resumeUrl}
                onChange={(e) => setForm({ ...form, resumeUrl: e.target.value })}
                placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                className="flex-1 px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs font-mono focus:border-[#0078d4] outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                disabled={!form.resumeUrl}
                className="px-3 py-2 rounded bg-black border border-[#1e293b] text-slate-400 hover:text-white text-xs disabled:opacity-30 cursor-pointer"
                title="Copy URL"
              >
                {copied ? <Check size={14} className="text-[#10b981]" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Display File Name *
              </label>
              <input
                type="text"
                required
                value={form.fileName}
                onChange={(e) => setForm({ ...form, fileName: e.target.value })}
                placeholder="Resume_Master.pdf"
                className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs font-mono focus:border-[#0078d4] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">
                Version Tag *
              </label>
              <input
                type="text"
                required
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                placeholder="v2026.09"
                className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs font-mono focus:border-[#0078d4] outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              Resume Executive Summary / Objective
            </label>
            <textarea
              rows={3}
              value={form.summaryText}
              onChange={(e) => setForm({ ...form, summaryText: e.target.value })}
              placeholder="Full Stack Engineer with expertise in real-time WebSockets, microservices, and electronics debugging..."
              className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
            />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-[#1a2333]">
            <div className="text-[11px] font-mono text-slate-500">
              {resumeData?.lastUpdated && (
                <span>Last Updated: {new Date(resumeData.lastUpdated).toLocaleString()}</span>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded bg-[#10b981] hover:bg-[#059669] text-black font-semibold text-xs transition-all shadow cursor-pointer disabled:opacity-50"
            >
              <Save size={14} />
              <span>{saving ? 'Updating...' : 'Save Resume Metadata'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Public API Preview Card */}
      <div className="rounded bg-[#070a10] border border-[#1a2333] p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Terminal size={15} className="text-[#10b981]" />
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            Public API Payload Telemetry
          </span>
        </div>
        <p className="text-xs text-slate-400">
          When client applications request <code className="text-[#1e90ff]">GET /api/resume</code>, the backend responds with this payload:
        </p>

        <pre className="p-4 rounded bg-black border border-[#1e293b] text-xs font-mono text-[#10b981] overflow-x-auto">
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
