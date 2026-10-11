import React, { useEffect, useId, useState } from 'react';
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
  CheckCircle,
  AlertCircle,
  Save,
  MapPin,
  ExternalLink,
} from 'lucide-react';

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance'];

const labelClass = 'block text-sm font-medium text-t-text mb-1';
const inputClass = 'w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-sm placeholder:text-t-dim focus:border-t-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-t-accent/30';
const hintClass = 'mt-1 block text-xs text-t-muted';
const iconButton = 'p-1.5 rounded cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent';

const EMPTY = {
  company: '',
  role: '',
  employmentType: 'Full-time',
  period: '',
  startDate: '',
  endDate: '',
  isCurrent: false,
  location: '',
  companyUrl: '',
  description: '',
  achievements: '',
  technologies: '',
  order: 0,
  featured: true,
};

// The server stores dates as Date; the date input wants YYYY-MM-DD.
const toDateInput = (value) => (value ? String(value).slice(0, 10) : '');

export default function ExperienceList() {
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

  const fetchExperience = async () => {
    try {
      const res = await api.get('/experience');
      setItems(res.data || []);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not load your work experience.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperience();
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
      company: item.company || '',
      role: item.role || '',
      employmentType: item.employmentType || 'Full-time',
      period: item.period || '',
      startDate: toDateInput(item.startDate),
      endDate: toDateInput(item.endDate),
      isCurrent: item.isCurrent ?? false,
      location: item.location || '',
      companyUrl: item.companyUrl || '',
      description: item.description || '',
      achievements: (item.achievements || []).join('\n'),
      technologies: (item.technologies || []).join(', '),
      order: item.order ?? 0,
      featured: item.featured ?? true,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // Enter keeps the item's current visibility; only the two buttons change it.
    const visibility = chosenVisibility(e, editingId ? editingVisibility : 'draft');
    const payload = {
      ...form,
      visibility,
      startDate: form.startDate || null,
      endDate: form.isCurrent ? null : form.endDate || null,
      achievements: form.achievements
        .split('\n')
        .map((a) => a.trim())
        .filter(Boolean),
      technologies: form.technologies
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    try {
      if (editingId) {
        const res = await api.put(`/experience/${editingId}`, payload);
        setItems((prev) => prev.map((item) => (item._id === editingId ? res.data : item)));
        setSuccessMsg(`Role at “${form.company}” saved${visibility === 'draft' ? ' as a draft' : ''}.`);
      } else {
        const res = await api.post('/experience', payload);
        setItems((prev) => [...prev, res.data]);
        setSuccessMsg(`Role at “${form.company}” added${visibility === 'draft' ? ' as a draft' : ''}.`);
      }
      setShowModal(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not save the role.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, roleName, compName) => {
    const ok = await confirm({
      title: 'Delete this role?',
      consequence: `“${roleName} at ${compName}” is removed from your work experience and from every App that serves it.`,
      confirmLabel: 'Delete role',
    });
    if (!ok) return;
    try {
      await api.delete(`/experience/${id}`);
      setItems((prev) => prev.filter((i) => i._id !== id));
      setSuccessMsg('Role deleted.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not delete the role.'));
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-t-border">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-3xl text-t-text">Work experience</h1>
            <span className="text-sm text-t-muted">
              {items.length} {items.length === 1 ? 'role' : 'roles'}
            </span>
          </div>
          <p className="text-sm text-t-muted mt-2 max-w-prose">
            Your roles and what you did in them. Apps only serve published roles.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-sm transition-all shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent focus-visible:ring-offset-2 focus-visible:ring-offset-t-bg"
        >
          <Plus size={15} aria-hidden="true" />
          <span>Add a role</span>
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

      {/* Experience list */}
      {loading ? (
        <ListSkeleton label="Loading experience" />
      ) : items.length === 0 ? (
        <EmptyState title="No roles yet" hint="Use “Add a role” to start your work experience." />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item._id}
              className="p-5 rounded bg-t-surface border border-t-border hover:border-t-accent transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-t-text">{item.role}</h2>
                    {item.isCurrent && (
                      <span className="px-2 rounded bg-t-accent2-dim text-t-accent2 border border-t-accent2/30 text-xs">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-t-accent font-medium mt-0.5 flex flex-wrap items-center gap-1.5">
                    <span>{item.company}</span>
                    {item.companyUrl && (
                      <a
                        href={item.companyUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${item.company} website (opens in a new tab)`}
                        className="rounded text-t-dim hover:text-t-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent"
                      >
                        <ExternalLink size={12} aria-hidden="true" />
                      </a>
                    )}
                    <span className="text-t-dim" aria-hidden="true">·</span>
                    <span className="text-t-muted text-xs">{item.employmentType || 'Full-time'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <VisibilityToggle endpoint="/experience" item={item} onChange={(updated) => setItems((prev) => prev.map((x) => x._id === updated._id ? updated : x))} />
                  <span className="px-2.5 py-1 rounded bg-t-bg border border-t-border-hi text-xs text-t-muted">
                    {item.period}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className={`${iconButton} text-t-muted hover:text-t-text hover:bg-t-surface-hi`}
                      aria-label={`Edit ${item.role} at ${item.company}`}
                    >
                      <Edit2 size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item._id, item.role, item.company)}
                      className={`${iconButton} text-t-danger hover:text-t-text hover:bg-t-danger-dim`}
                      aria-label={`Delete ${item.role} at ${item.company}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-sm text-t-muted leading-relaxed">
                {item.description}
              </p>

              {item.achievements && item.achievements.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs text-t-dim mb-1">What you did</div>
                  <ul className="list-disc list-inside text-sm text-t-muted space-y-1 pl-1">
                    {item.achievements.map((ach, i) => (
                      <li key={i}>{ach}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Technologies & Location */}
              <div className="pt-3 border-t border-t-border flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap gap-1.5">
                  {item.technologies &&
                    item.technologies.map((tech, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-t-bg border border-t-border-hi text-t-muted"
                      >
                        {tech}
                      </span>
                    ))}
                </div>

                {item.location ? (
                  <div className="flex items-center gap-1 text-t-muted">
                    <MapPin size={12} className="text-t-dim" aria-hidden="true" />
                    <span>{item.location}</span>
                  </div>
                ) : (
                  <span className="text-t-dim">Location not set</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      {showModal && (
        <Modal
          title={editingId ? 'Edit role' : 'Add a role'}
          description={editingId
            ? (editingVisibility === 'published' ? 'Published: Apps serve this role now. Enter saves and keeps it published.' : 'Draft: no App can see it yet.')
            : 'Where you worked and what you did there.'}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={fieldId('company')} className={labelClass}>Company *</label>
                <input
                  id={fieldId('company')}
                  type="text"
                  required
                  maxLength={120}
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="e.g. Acme Corp"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor={fieldId('role')} className={labelClass}>Job title *</label>
                <input
                  id={fieldId('role')}
                  type="text"
                  required
                  maxLength={120}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="e.g. Full-stack engineer"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={fieldId('employmentType')} className={labelClass}>Employment type</label>
                <select
                  id={fieldId('employmentType')}
                  value={form.employmentType}
                  onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                  className={inputClass}
                >
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={fieldId('period')} className={labelClass}>Period, as shown *</label>
                <input
                  id={fieldId('period')}
                  type="text"
                  required
                  maxLength={60}
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                  placeholder="e.g. June 2024 – present"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={fieldId('startDate')} className={labelClass}>Start date</label>
                <input
                  id={fieldId('startDate')}
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  aria-describedby={fieldId('dates-hint')}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor={fieldId('endDate')} className={labelClass}>End date</label>
                <input
                  id={fieldId('endDate')}
                  type="date"
                  value={form.isCurrent ? '' : form.endDate}
                  disabled={form.isCurrent}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  aria-describedby={fieldId('dates-hint')}
                  className={`${inputClass} disabled:opacity-50`}
                />
              </div>
              <span id={fieldId('dates-hint')} className={`${hintClass} sm:col-span-2 -mt-1`}>Optional. Served as ISO dates so your site can sort or format them; the period above is the text people read.</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:items-end">
              <div>
                <label htmlFor={fieldId('location')} className={labelClass}>Location</label>
                <input
                  id={fieldId('location')}
                  type="text"
                  maxLength={120}
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Remote, or Berlin"
                  className={inputClass}
                />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <input
                  type="checkbox"
                  id={fieldId('isCurrent')}
                  checked={form.isCurrent}
                  onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })}
                  className="w-4 h-4 rounded accent-t-accent"
                />
                <label htmlFor={fieldId('isCurrent')} className="text-sm text-t-text cursor-pointer">
                  I work here now
                </label>
              </div>
            </div>

            <div>
              <label htmlFor={fieldId('companyUrl')} className={labelClass}>Company website</label>
              <input
                id={fieldId('companyUrl')}
                type="url"
                value={form.companyUrl}
                onChange={(e) => setForm({ ...form, companyUrl: e.target.value })}
                placeholder="https://company.example.com"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor={fieldId('description')} className={labelClass}>Summary *</label>
              <textarea
                id={fieldId('description')}
                required
                rows={3}
                maxLength={2000}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What the role covered, in a sentence or two."
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor={fieldId('achievements')} className={labelClass}>Achievements</label>
              <textarea
                id={fieldId('achievements')}
                rows={3}
                value={form.achievements}
                onChange={(e) => setForm({ ...form, achievements: e.target.value })}
                aria-describedby={fieldId('achievements-hint')}
                placeholder={'Cut p99 latency from 180 ms to 24 ms\nBuilt the notification service'}
                className={inputClass}
              />
              <span id={fieldId('achievements-hint')} className={hintClass}>One per line, up to 15, 300 characters each.</span>
            </div>

            <div>
              <label htmlFor={fieldId('technologies')} className={labelClass}>Technologies</label>
              <input
                id={fieldId('technologies')}
                type="text"
                value={form.technologies}
                onChange={(e) => setForm({ ...form, technologies: e.target.value })}
                aria-describedby={fieldId('technologies-hint')}
                placeholder="e.g. Node.js, Docker, MongoDB"
                className={inputClass}
              />
              <span id={fieldId('technologies-hint')} className={hintClass}>Comma-separated, up to 30, 40 characters each.</span>
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
