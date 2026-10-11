import React, { useState, useEffect, useId } from 'react';
import { api } from '../../api/client';
import { apiErrorMessage } from '../../lib/apiErrors';
import { submitKeepingVisibility, chosenVisibility, currentVisibility } from '../../lib/visibilitySubmit';
import { ListSkeleton, EmptyState } from '../../components/admin/States';
import VisibilityToggle from '../../components/admin/VisibilityToggle';
import Modal from '../../components/admin/ui/Modal';
import useConfirm from '../../components/admin/ui/useConfirm';
import {
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Save,
  Calendar,
} from 'lucide-react';

const labelClass = 'block text-sm font-medium text-t-text mb-1';
const inputClass = 'w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-sm placeholder:text-t-dim focus:border-t-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-t-accent/30';
const hintClass = 'mt-1 block text-xs text-t-muted';
const iconButton = 'p-1.5 rounded cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent';

const EMPTY = {
  title: '',
  issuer: '',
  issueDate: '',
  expirationDate: '',
  credentialId: '',
  credentialUrl: '',
  skills: '',
  order: 0,
  featured: false,
};

export default function CertificationsManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingVisibility, setEditingVisibility] = useState('published');
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [confirm, confirmDialog] = useConfirm();
  const uid = useId();
  const fieldId = (name) => `${uid}-${name}`;
  const formId = `${uid}-form`;

  const fetchCertifications = async () => {
    try {
      const res = await api.get('/certifications');
      setItems(res.data || []);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not load your certifications.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCertifications();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setEditingVisibility('published');
    setForm({ ...EMPTY, order: items.length });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingId(item._id);
    setEditingVisibility(currentVisibility(item));
    setForm({
      title: item.title || '',
      issuer: item.issuer || '',
      issueDate: item.issueDate || '',
      // Blank means "does not expire". Never write display text into the data.
      expirationDate: item.expirationDate || '',
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

    // Enter keeps the certification's current visibility; only the two buttons change it.
    const visibility = chosenVisibility(e, editingId ? editingVisibility : 'published');
    const payload = {
      ...form,
      visibility,
      skills: form.skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };

    try {
      if (editingId) {
        const res = await api.put(`/certifications/${editingId}`, payload);
        setItems((prev) => prev.map((item) => (item._id === editingId ? res.data : item)));
        setSuccessMsg(`Certification saved${visibility === 'draft' ? ' as a draft' : ''}.`);
      } else {
        const res = await api.post('/certifications', payload);
        setItems((prev) => [...prev, res.data]);
        setSuccessMsg(`Certification added${visibility === 'draft' ? ' as a draft' : ''}.`);
      }
      setShowModal(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not save the certification.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, title) => {
    const ok = await confirm({
      title: 'Delete this certification?',
      consequence: `“${title}” is removed from your certifications and from every App that serves it.`,
      confirmLabel: 'Delete certification',
    });
    if (!ok) return;
    try {
      await api.delete(`/certifications/${id}`);
      setItems((prev) => prev.filter((item) => item._id !== id));
      setSuccessMsg('Certification deleted.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not delete the certification.'));
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-t-border">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-3xl text-t-text">Certifications</h1>
            <span className="text-sm text-t-muted">
              {items.length} {items.length === 1 ? 'certification' : 'certifications'}
            </span>
          </div>
          <p className="text-sm text-t-muted mt-2 max-w-prose">
            Credentials you have earned, with links so visitors can verify them. Apps only serve published ones.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-sm transition-all shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent focus-visible:ring-offset-2 focus-visible:ring-offset-t-bg"
        >
          <Plus size={15} aria-hidden="true" />
          <span>Add a certification</span>
        </button>
      </div>

      {/* Notifications */}
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

      {/* Cards List */}
      {loading ? (
        <ListSkeleton label="Loading certifications" />
      ) : items.length === 0 ? (
        <EmptyState title="No certifications yet" hint="Use “Add a certification” to list a credential." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {items.map((item) => (
            <div
              key={item._id}
              className="p-5 rounded bg-t-surface border border-t-border hover:border-t-accent transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-t-text">{item.title}</h2>
                    <span className="text-sm text-t-accent font-medium block mt-0.5">{item.issuer}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <VisibilityToggle endpoint="/certifications" item={item} onChange={(updated) => setItems((prev) => prev.map((x) => x._id === updated._id ? updated : x))} />
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className={`${iconButton} text-t-muted hover:text-t-text hover:bg-t-surface-hi`}
                      aria-label={`Edit ${item.title}`}
                    >
                      <Edit2 size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item._id, item.title)}
                      className={`${iconButton} text-t-danger hover:text-t-text hover:bg-t-danger-dim`}
                      aria-label={`Delete ${item.title}`}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-t-muted">
                  <span className="flex items-center gap-1 text-t-muted">
                    <Calendar size={12} className="text-t-dim" aria-hidden="true" />
                    Issued {item.issueDate}
                  </span>
                  <span className="text-t-dim" aria-hidden="true">·</span>
                  <span className="text-t-muted">{item.expirationDate ? `Expires ${item.expirationDate}` : 'Does not expire'}</span>
                </div>

                {item.credentialId && (
                  <div className="mt-2 text-xs text-t-muted">
                    Credential ID <span className="font-mono-code text-t-text">{item.credentialId}</span>
                  </div>
                )}

                {item.skills && item.skills.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.skills.map((s, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded bg-t-bg border border-t-border-hi text-xs text-t-accent2"
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
                    className="rounded text-sm text-t-accent hover:text-t-accent-br flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent"
                  >
                    <span>Verify credential<span className="sr-only"> for {item.title} (opens in a new tab)</span></span>
                    <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      {showModal && (
        <Modal
          title={editingId ? 'Edit certification' : 'Add a certification'}
          description={editingId
            ? (editingVisibility === 'published' ? 'Published: Apps serve this certification now. Enter saves and keeps it published.' : 'Draft: no App can see it yet.')
            : 'A credential, who issued it, and where to verify it.'}
          onClose={() => setShowModal(false)}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-3.5 py-1.5 rounded text-sm font-semibold text-t-muted hover:text-t-text hover:bg-t-surface-hi cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form={formId}
                name="visibility"
                value="draft"
                disabled={saving}
                className="px-3.5 py-1.5 rounded border border-t-border-hi text-sm font-semibold text-t-text hover:bg-t-surface-hi disabled:opacity-50"
              >
                Save as draft
              </button>
              <button
                type="submit"
                form={formId}
                name="visibility"
                value="published"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-sm shadow disabled:opacity-50"
              >
                <Save size={13} aria-hidden="true" />
                <span>{saving ? 'Saving…' : 'Save and publish'}</span>
              </button>
            </div>
          }
        >
          <form id={formId} onSubmit={handleSubmit} onKeyDown={submitKeepingVisibility} className="space-y-4">
            <div>
              <label htmlFor={fieldId('title')} className={labelClass}>Title *</label>
              <input
                id={fieldId('title')}
                type="text"
                required
                maxLength={120}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. AWS Certified Cloud Practitioner"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor={fieldId('issuer')} className={labelClass}>Issued by *</label>
              <input
                id={fieldId('issuer')}
                type="text"
                required
                maxLength={120}
                value={form.issuer}
                onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                placeholder="e.g. Amazon Web Services"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={fieldId('issueDate')} className={labelClass}>Issue date *</label>
                <input
                  id={fieldId('issueDate')}
                  type="text"
                  required
                  maxLength={32}
                  value={form.issueDate}
                  onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
                  aria-describedby={fieldId('issueDate-hint')}
                  placeholder="e.g. 2024-10"
                  className={inputClass}
                />
                <span id={fieldId('issueDate-hint')} className={hintClass}>Lists are sorted by this text, newest first, so YYYY-MM sorts best.</span>
              </div>
              <div>
                <label htmlFor={fieldId('expirationDate')} className={labelClass}>Expiry date</label>
                <input
                  id={fieldId('expirationDate')}
                  type="text"
                  maxLength={32}
                  value={form.expirationDate}
                  onChange={(e) => setForm({ ...form, expirationDate: e.target.value })}
                  aria-describedby={fieldId('expirationDate-hint')}
                  placeholder="e.g. 2027-10"
                  className={inputClass}
                />
                <span id={fieldId('expirationDate-hint')} className={hintClass}>Leave blank if it doesn’t expire.</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={fieldId('credentialId')} className={labelClass}>Credential ID</label>
                <input
                  id={fieldId('credentialId')}
                  type="text"
                  maxLength={120}
                  value={form.credentialId}
                  onChange={(e) => setForm({ ...form, credentialId: e.target.value })}
                  placeholder="e.g. ABC-123456"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor={fieldId('order')} className={labelClass}>Order</label>
                <input
                  id={fieldId('order')}
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm({ ...form, order: parseInt(e.target.value, 10) || 0 })}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor={fieldId('credentialUrl')} className={labelClass}>Verification link</label>
              <input
                id={fieldId('credentialUrl')}
                type="url"
                value={form.credentialUrl}
                onChange={(e) => setForm({ ...form, credentialUrl: e.target.value })}
                placeholder="https://www.credly.com/badges/…"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor={fieldId('skills')} className={labelClass}>Skills</label>
              <input
                id={fieldId('skills')}
                type="text"
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
                aria-describedby={fieldId('skills-hint')}
                placeholder="e.g. AWS, EC2, S3"
                className={inputClass}
              />
              <span id={fieldId('skills-hint')} className={hintClass}>Comma-separated, up to 30, 40 characters each.</span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id={fieldId('featured')}
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                className="w-4 h-4 rounded accent-t-accent"
              />
              <label htmlFor={fieldId('featured')} className="text-sm text-t-text cursor-pointer">Featured</label>
            </div>
          </form>
        </Modal>
      )}

      {confirmDialog}
    </div>
  );
}
