import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  User,
  Save,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  Terminal,
  Mail,
  Phone,
  Eye,
  Edit3,
} from 'lucide-react';

export default function ProfileEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeTab, setActiveTab] = useState('write'); // 'write' or 'preview'

  const [form, setForm] = useState({
    name: '',
    initials: '',
    headline: '',
    shortBio: '',
    aboutMarkdown: '',
    email: '',
    phone: '',
    location: {
      city: '',
      country: '',
      isRemoteAvailable: true,
    },
    statusText: '',
    isAvailableForHire: true,
    terminalUser: 'admin',
    terminalHost: 'portfolio',
    bootGreeting: '',
    metrics: [],
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await api.get('/profile');
        if (res.data) {
          setForm({
            name: res.data.name || '',
            initials: res.data.initials || '',
            headline: res.data.headline || '',
            shortBio: res.data.shortBio || '',
            aboutMarkdown: res.data.aboutMarkdown || '',
            email: res.data.email || '',
            phone: res.data.phone || '',
            location: {
              city: res.data.location?.city || '',
              country: res.data.location?.country || '',
              isRemoteAvailable: res.data.location?.isRemoteAvailable ?? true,
            },
            statusText: res.data.statusText || '',
            isAvailableForHire: res.data.isAvailableForHire ?? true,
            terminalUser: res.data.terminalUser || 'admin',
            terminalHost: res.data.terminalHost || 'portfolio',
            bootGreeting: res.data.bootGreeting || '',
            metrics: res.data.metrics || [],
          });
        }
      } catch (err) {
        setErrorMsg('Failed to load profile from database: ' + (err.response?.data?.message || err.message));
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleChange = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleLocationChange = (field, val) => {
    setForm((prev) => ({
      ...prev,
      location: { ...prev.location, [field]: val },
    }));
  };

  const handleMetricChange = (index, field, val) => {
    setForm((prev) => {
      const updated = [...prev.metrics];
      updated[index] = { ...updated[index], [field]: val };
      return { ...prev, metrics: updated };
    });
  };

  const addMetric = () => {
    setForm((prev) => ({
      ...prev,
      metrics: [...prev.metrics, { label: '', value: '', description: '' }],
    }));
  };

  const removeMetric = (index) => {
    setForm((prev) => ({
      ...prev,
      metrics: prev.metrics.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await api.put('/profile', form);
      setForm((prev) => ({ ...prev, ...res.data }));
      setSuccessMsg('Profile and email link saved.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm font-mono text-t-accent animate-pulse flex items-center gap-2">
          <span>Loading identity parameters...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-t-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-t-surface text-t-accent border border-t-border">
              <User size={20} />
            </div>
            <h1 className="text-xl font-bold text-t-text tracking-tight">Profile &amp; Identity Console</h1>
          </div>
          <p className="text-xs text-t-muted mt-1">
            Global personal bio, availability telemetry, contact points, and environment configuration.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded bg-t-accent2 hover:bg-t-accent2 text-t-on-accent2 font-semibold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
        >
          <Save size={15} />
          <span>{saving ? 'Saving...' : 'Save Profile'}</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 rounded bg-t-accent2-dim border border-t-accent2/50 text-t-accent2 text-xs flex items-center gap-2 font-mono">
          <CheckCircle size={15} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded bg-t-danger-dim border border-t-danger/50 text-t-danger text-xs flex items-center gap-2 font-mono">
          <AlertCircle size={15} />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Availability & Career Status */}
        <div className="p-5 rounded bg-t-surface border border-t-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-t-border">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-t-muted">
              Employment Status &amp; Availability
            </span>
            <span className="text-[11px] font-mono text-t-accent2">
              {form.isAvailableForHire ? '[STATUS: AVAILABLE]' : '[STATUS: ENGAGED]'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isAvailableForHire"
                checked={form.isAvailableForHire}
                onChange={(e) => handleChange('isAvailableForHire', e.target.checked)}
                className="w-4 h-4 rounded bg-t-bg border-t-border-hi text-t-accent2 focus:ring-t-accent2"
              />
              <label htmlFor="isAvailableForHire" className="text-xs text-t-text cursor-pointer">
                Actively Open for High-Impact Software Engineering Roles
              </label>
            </div>

            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">Status Text Display</label>
              <input
                type="text"
                value={form.statusText}
                onChange={(e) => handleChange('statusText', e.target.value)}
                placeholder="e.g. Open for high-impact software engineering roles"
                className="w-full px-3 py-1.5 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Personal Identity & Contact */}
        <div className="p-5 rounded bg-t-surface border border-t-border space-y-4">
          <div className="pb-3 border-b border-t-border">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-t-muted">
              Personal Identity &amp; Contact Coordinates
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">Full Legal Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">Initials / Monogram</label>
              <input
                type="text"
                value={form.initials}
                onChange={(e) => handleChange('initials', e.target.value)}
                placeholder="SS"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">Professional Title / Headline *</label>
              <input
                type="text"
                required
                value={form.headline}
                onChange={(e) => handleChange('headline', e.target.value)}
                placeholder="Full Stack Engineer · Systems Architect"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">Primary Email *</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-2.5 text-t-dim" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
                />
              </div>
              <p className="text-[11px] text-t-muted mt-1 font-mono">
                Syncs with public contact info &amp; Email social link. (Dashboard login email remains separate).
              </p>
            </div>
            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">Direct Phone Number</label>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-2.5 text-t-dim" />
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full pl-9 pr-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">City</label>
              <input
                type="text"
                value={form.location.city}
                onChange={(e) => handleLocationChange('city', e.target.value)}
                placeholder="San Francisco"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">Country</label>
              <input
                type="text"
                value={form.location.country}
                onChange={(e) => handleLocationChange('country', e.target.value)}
                placeholder="United States"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <input
                type="checkbox"
                id="isRemoteAvailable"
                checked={form.location.isRemoteAvailable}
                onChange={(e) => handleLocationChange('isRemoteAvailable', e.target.checked)}
                className="w-4 h-4 rounded bg-t-bg border-t-border-hi text-t-accent focus:ring-t-accent"
              />
              <label htmlFor="isRemoteAvailable" className="text-xs text-t-muted cursor-pointer">
                Remote Available
              </label>
            </div>
          </div>
        </div>

        {/* Section 3: Biography & Case Overview */}
        <div className="p-5 rounded bg-t-surface border border-t-border space-y-4">
          <div className="pb-3 border-b border-t-border">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-t-muted">
              Elevator Pitch &amp; Extended Markdown Bio
            </span>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-mono text-t-muted">Short Bio (Max 300 chars) *</label>
              <span className={`text-[11px] font-mono ${form.shortBio.length > 300 ? 'text-t-danger' : 'text-t-dim'}`}>
                {form.shortBio.length} / 300
              </span>
            </div>
            <textarea
              required
              maxLength={300}
              rows={2}
              value={form.shortBio}
              onChange={(e) => handleChange('shortBio', e.target.value)}
              placeholder="Building low-latency distributed web systems and high-throughput cloud architectures."
              className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none resize-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono text-t-muted">Extended About Markdown Bio</label>
              <div className="flex items-center bg-t-bg border border-t-border-hi rounded p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('write')}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded ${
                    activeTab === 'write' ? 'bg-t-accent text-t-on-accent font-bold' : 'text-t-muted hover:text-t-text'
                  }`}
                >
                  <span className="flex items-center gap-1.5"><Edit3 size={11} /> Write</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-2.5 py-1 text-[11px] font-mono rounded ${
                    activeTab === 'preview' ? 'bg-t-accent text-t-on-accent font-bold' : 'text-t-muted hover:text-t-text'
                  }`}
                >
                  <span className="flex items-center gap-1.5"><Eye size={11} /> Preview</span>
                </button>
              </div>
            </div>

            {activeTab === 'write' ? (
              <textarea
                rows={6}
                value={form.aboutMarkdown}
                onChange={(e) => handleChange('aboutMarkdown', e.target.value)}
                placeholder="Full-stack software engineer with deep expertise in distributed microservices..."
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
              />
            ) : (
              <div className="p-4 rounded bg-t-bg border border-t-border-hi min-h-[140px] preview-prose">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {form.aboutMarkdown || '*No extended bio written yet.*'}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Section 4: System / Shell Environment */}
        <div className="p-5 rounded bg-t-surface border border-t-border space-y-4">
          <div className="pb-3 border-b border-t-border flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-t-muted flex items-center gap-2">
              <Terminal size={14} className="text-t-accent2" />
              System Environment &amp; Shell Parameters
            </span>
            <span className="text-[11px] font-mono text-t-accent">
              {form.terminalUser}@{form.terminalHost}:~$
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">System / Prompt User</label>
              <input
                type="text"
                value={form.terminalUser}
                onChange={(e) => handleChange('terminalUser', e.target.value)}
                placeholder="admin"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">System / Host Identifier</label>
              <input
                type="text"
                value={form.terminalHost}
                onChange={(e) => handleChange('terminalHost', e.target.value)}
                placeholder="portfolio"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-t-muted mb-1">System Banner / Greeting</label>
              <input
                type="text"
                value={form.bootGreeting}
                onChange={(e) => handleChange('bootGreeting', e.target.value)}
                placeholder="PORTFOLIO_SYSTEM v2026.09 - POST INITIATED"
                className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 5: Key Highlight Metrics Repeater */}
        <div className="p-5 rounded bg-t-surface border border-t-border space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-t-border">
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-t-muted">
                Key Performance Metrics &amp; High-Water Marks
              </span>
              <p className="text-[11px] text-t-dim">
                Rendered on profile summary and showcase cards.
              </p>
            </div>
            <button
              type="button"
              onClick={addMetric}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent text-xs font-mono transition-all"
            >
              <Plus size={12} />
              <span>Add Metric</span>
            </button>
          </div>

          {form.metrics.length === 0 ? (
            <div className="text-center py-6 text-t-dim text-xs font-mono border border-dashed border-t-border-hi rounded">
              No performance metrics logged yet. Click "Add Metric" to define stats (e.g. "API Latency: &lt;15ms").
            </div>
          ) : (
            <div className="space-y-3">
              {form.metrics.map((metric, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center p-3 rounded bg-t-bg border border-t-border"
                >
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      placeholder="Label (e.g. API Latency)"
                      value={metric.label}
                      onChange={(e) => handleMetricChange(idx, 'label', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-t-surface border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <input
                      type="text"
                      placeholder="Value (e.g. <15ms)"
                      value={metric.value}
                      onChange={(e) => handleMetricChange(idx, 'value', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-t-surface border border-t-border-hi text-t-accent2 font-mono text-xs focus:border-t-accent outline-none"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      placeholder="Brief note (e.g. SMD reworks)"
                      value={metric.description}
                      onChange={(e) => handleMetricChange(idx, 'description', e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-t-surface border border-t-border-hi text-t-muted text-xs focus:border-t-accent outline-none"
                    />
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeMetric(idx)}
                      className="p-1.5 rounded text-t-danger hover:text-t-text hover:bg-t-danger-dim transition-all cursor-pointer"
                      title="Remove metric"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Save Action */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-t-accent2 hover:bg-t-accent2 text-t-on-accent2 font-bold text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
          >
            <Save size={15} />
            <span>{saving ? 'Saving...' : 'Save All Profile Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
