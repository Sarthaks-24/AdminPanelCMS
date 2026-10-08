import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import VisibilityToggle from '../../components/admin/VisibilityToggle';
import {
  Award,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  X,
  Save,
  Calendar,
} from 'lucide-react';

export default function CertificationsManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const [form, setForm] = useState({
    title: '',
    issuer: '',
    issueDate: '',
    expirationDate: 'No Expiration',
    credentialId: '',
    credentialUrl: '',
    skills: '',
    order: 0,
    featured: false,
  });

  const fetchCertifications = async () => {
    try {
      const res = await api.get('/certifications');
      setItems(res.data || []);
    } catch (err) {
      setErrorMsg('Failed to load certifications: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertifications();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      title: '',
      issuer: '',
      issueDate: '',
      expirationDate: 'No Expiration',
      credentialId: '',
      credentialUrl: '',
      skills: '',
      order: items.length,
      featured: false,
    });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingId(item._id);
    setForm({
      title: item.title,
      issuer: item.issuer,
      issueDate: item.issueDate,
      expirationDate: item.expirationDate || 'No Expiration',
      credentialId: item.credentialId || '',
      credentialUrl: item.credentialUrl || '',
      skills: (item.skills || []).join(', '),
      order: item.order ?? 0,
      featured: item.featured ?? false,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = {
      ...form,
      skills: form.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      if (editingId) {
        const res = await api.put(`/certifications/${editingId}`, payload);
        setItems((prev) => prev.map((item) => (item._id === editingId ? res.data : item)));
        setSuccessMsg('Certification updated.');
      } else {
        const res = await api.post('/certifications', payload);
        setItems((prev) => [...prev, res.data]);
        setSuccessMsg('New certification logged.');
      }
      setShowModal(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error saving certification');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Permanently delete certification "${title}"?`)) return;
    try {
      await api.delete(`/certifications/${id}`);
      setItems((prev) => prev.filter((item) => item._id !== id));
      setSuccessMsg('Certification record removed.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error deleting certification');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-t-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-t-surface text-t-accent border border-t-border">
              <Award size={20} />
            </div>
            <h1 className="text-xl font-bold text-t-text tracking-tight">Certifications &amp; Professional Licenses</h1>
            <span className="px-2 py-0.5 rounded bg-t-surface-hi text-[11px] font-mono text-t-muted border border-t-border-hi">
              {items.length} Credentials
            </span>
          </div>
          <p className="text-xs text-t-muted mt-1">
            Verified vendor certifications, cloud badges, and technical licenses served across client applications.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-xs transition-all shadow-sm cursor-pointer"
        >
          <Plus size={15} />
          <span>Add Certification</span>
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

      {/* Cards List */}
      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-t-accent animate-pulse">
          Querying certifications...
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center text-xs font-mono text-t-dim rounded bg-t-surface border border-dashed border-t-border">
          No certifications logged. Click "Add Certification" to register a credential.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((item) => (
            <div
              key={item._id}
              className="p-5 rounded bg-t-surface border border-t-border hover:border-t-accent transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-t-text">{item.title}</h2>
                    <span className="text-xs text-t-accent font-medium block mt-0.5">{item.issuer}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <VisibilityToggle endpoint="/certifications" item={item} onChange={(updated) => setItems((prev) => prev.map((x) => x._id === updated._id ? updated : x))} />
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 rounded text-t-muted hover:text-t-text hover:bg-t-surface-hi cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(item._id, item.title)}
                      className="p-1.5 rounded text-t-danger hover:text-t-text hover:bg-red-950 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-mono text-t-muted">
                  <span className="flex items-center gap-1 text-t-muted">
                    <Calendar size={12} className="text-t-dim" />
                    Issued: {item.issueDate}
                  </span>
                  <span className="text-t-dim">|</span>
                  <span className="text-t-muted">Expires: {item.expirationDate}</span>
                </div>

                {item.credentialId && (
                  <div className="mt-2 text-[11px] font-mono text-t-muted">
                    ID: <span className="text-t-text">{item.credentialId}</span>
                  </div>
                )}

                {item.skills && item.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.skills.map((s, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-t-bg border border-t-border-hi text-[10px] font-mono text-t-accent2"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {item.credentialUrl && (
                <div className="mt-4 pt-3 border-t border-t-border flex justify-end">
                  <a
                    href={item.credentialUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono text-t-accent hover:text-t-accent-br flex items-center gap-1"
                  >
                    <span>Verify Credential</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-t-bg/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded bg-t-surface border border-t-border shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-t-border flex items-center justify-between bg-t-bg">
              <span className="text-xs font-mono font-bold text-t-text uppercase tracking-wider">
                {editingId ? 'Edit Certification' : 'Log New Certification'}
              </span>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded text-t-muted hover:text-t-text cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-mono text-t-muted mb-1">Certification Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. AWS Certified Cloud Practitioner"
                  className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-t-muted mb-1">Issuing Organization *</label>
                <input
                  type="text"
                  required
                  value={form.issuer}
                  onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                  placeholder="e.g. Amazon Web Services, Meta, Coursera"
                  className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-t-muted mb-1">Issue Date *</label>
                  <input
                    type="text"
                    required
                    value={form.issueDate}
                    onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                    placeholder="e.g. October 2024"
                    className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-t-muted mb-1">Expiration Date</label>
                  <input
                    type="text"
                    value={form.expirationDate}
                    onChange={(e) => setForm({ ...form, expirationDate: e.target.value })}
                    placeholder="No Expiration"
                    className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-t-muted mb-1">Credential ID</label>
                  <input
                    type="text"
                    value={form.credentialId}
                    onChange={(e) => setForm({ ...form, credentialId: e.target.value })}
                    placeholder="AWS-CCP-998811"
                    className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-t-muted mb-1">Display Order</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-t-muted mb-1">Verification URL</label>
                <input
                  type="url"
                  value={form.credentialUrl}
                  onChange={(e) => setForm({ ...form, credentialUrl: e.target.value })}
                  placeholder="https://aws.amazon.com/verification"
                  className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-t-muted mb-1">
                  Validated Skills (Comma-separated)
                </label>
                <input
                  type="text"
                  value={form.skills}
                  onChange={(e) => setForm({ ...form, skills: e.target.value })}
                  placeholder="AWS, Cloud Architecture, EC2, S3"
                  className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-mono text-t-muted"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />Featured certification</label>

              <div className="flex justify-end gap-2 pt-4 border-t border-t-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-1.5 rounded text-xs font-semibold text-t-muted hover:text-t-text hover:bg-t-surface-hi cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-t-accent2 hover:bg-t-accent2 text-t-on-accent2 font-semibold text-xs shadow cursor-pointer disabled:opacity-50"
                >
                  <Save size={13} />
                  <span>{saving ? 'Saving...' : 'Save Certification'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
