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
  CheckCircle,
  AlertCircle,
  Save,
  MapPin,
  Award,
} from 'lucide-react';

const labelClass = 'block text-sm font-medium text-t-text mb-1';
const inputClass = 'w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-sm placeholder:text-t-dim focus:border-t-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-t-accent/30';
const hintClass = 'mt-1 block text-xs text-t-muted';
const iconButton = 'p-1.5 rounded cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent';

const EMPTY = {
  institution: '',
  degree: '',
  fieldOfStudy: '',
  period: '',
  startDate: '',
  endDate: '',
  grade: '',
  location: '',
  achievements: '',
  order: 0,
  featured: false,
};

// The server stores dates as Date; the date input wants YYYY-MM-DD.
const toDateInput = (value) => (value ? String(value).slice(0, 10) : '');

export default function EducationManager() {
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

  const fetchEducation = async () => {
    try {
      const res = await api.get('/education');
      setItems(res.data || []);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not load your education.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEducation();
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
      institution: item.institution || '',
      degree: item.degree || '',
      fieldOfStudy: item.fieldOfStudy || '',
      period: item.period || '',
      startDate: toDateInput(item.startDate),
      endDate: toDateInput(item.endDate),
      grade: item.grade || '',
      location: item.location || '',
      achievements: (item.achievements || []).join('\n'),
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

    // Enter keeps the entry's current visibility; only the two buttons change it.
    const visibility = chosenVisibility(e, editingId ? editingVisibility : 'draft');
    const payload = {
      ...form,
      visibility,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      achievements: form.achievements
        .split('\n')
        .map((a) => a.trim())
        .filter(Boolean),
    };

    try {
      if (editingId) {
        const res = await api.put(`/education/${editingId}`, payload);
        setItems((prev) => prev.map((item) => (item._id === editingId ? res.data : item)));
        setSuccessMsg(`Education entry saved${visibility === 'draft' ? ' as a draft' : ''}.`);
      } else {
        const res = await api.post('/education', payload);
        setItems((prev) => [...prev, res.data]);
        setSuccessMsg(`Education entry added${visibility === 'draft' ? ' as a draft' : ''}.`);
      }
      setShowModal(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not save the education entry.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, degree) => {
    const ok = await confirm({
      title: 'Delete this education entry?',
      consequence: `“${degree}” is removed from your education and from every App that serves it.`,
      confirmLabel: 'Delete entry',
    });
    if (!ok) return;
    try {
      await api.delete(`/education/${id}`);
      setItems((prev) => prev.filter((item) => item._id !== id));
      setSuccessMsg('Education entry deleted.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not delete the education entry.'));
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-t-border">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-3xl text-t-text">Education</h1>
            <span className="text-sm text-t-muted">
              {items.length} {items.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>
          <p className="text-sm text-t-muted mt-2 max-w-prose">
            Degrees, courses and where you studied. Apps only serve published entries.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-sm transition-all shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent focus-visible:ring-offset-2 focus-visible:ring-offset-t-bg"
        >
          <Plus size={15} aria-hidden="true" />
          <span>Add education</span>
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

      {/* Education cards */}
      {loading ? (
        <ListSkeleton label="Loading education" />
      ) : items.length === 0 ? (
        <EmptyState title="No education added" hint="Use “Add education” to record a degree or course." />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item._id}
              className="p-5 rounded bg-t-surface border border-t-border hover:border-t-accent transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-t-text">{item.degree}</h2>
                  <div className="text-sm text-t-accent font-medium mt-0.5">
                    {item.institution}
                  </div>
                  {item.fieldOfStudy && (
                    <div className="text-xs text-t-muted mt-0.5">
                      {item.fieldOfStudy}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <VisibilityToggle endpoint="/education" item={item} onChange={(updated) => setItems((prev) => prev.map((x) => x._id === updated._id ? updated : x))} />
                  <span className="px-2.5 py-1 rounded bg-t-bg border border-t-border-hi text-xs text-t-muted">
                    {item.period}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className={`${iconButton} text-t-muted hover:text-t-text hover:bg-t-surface-hi`}
                      aria-label={`Edit ${item.degree}`}
                    >
                      <Edit2 size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item._id, item.degree)}
                      className={`${iconButton} text-t-danger hover:text-t-text hover:bg-t-danger-dim`}
                      aria-label={`Delete ${item.degree}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>

              {(item.grade || item.location) && (
                <div className="flex flex-wrap items-center gap-4 text-xs text-t-muted pt-2 border-t border-t-border">
                  {item.grade && (
                    <div className="flex items-center gap-1 text-t-accent2">
                      <Award size={13} aria-hidden="true" />
                      <span>{item.grade}</span>
                    </div>
                  )}
                  {item.location && (
                    <div className="flex items-center gap-1 text-t-muted">
                      <MapPin size={13} aria-hidden="true" />
                      <span>{item.location}</span>
                    </div>
                  )}
                </div>
              )}

              {item.achievements && item.achievements.length > 0 && (
                <div className="pt-2">
                  <div className="text-xs text-t-dim mb-1">Highlights</div>
                  <ul className="list-disc list-inside text-sm text-t-muted space-y-0.5 pl-1">
                    {item.achievements.map((ach, i) => (
                      <li key={i}>{ach}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      {showModal && (
        <Modal
          title={editingId ? 'Edit education entry' : 'Add education'}
          description={editingId
            ? (editingVisibility === 'published' ? 'Published: Apps serve this entry now. Enter saves and keeps it published.' : 'Draft: no App can see it yet.')
            : 'A degree, diploma or course.'}
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
              <label htmlFor={fieldId('institution')} className={labelClass}>Institution *</label>
              <input
                id={fieldId('institution')}
                type="text"
                required
                maxLength={120}
                value={form.institution}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
                placeholder="e.g. University of California, Berkeley"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={fieldId('degree')} className={labelClass}>Degree *</label>
                <input
                  id={fieldId('degree')}
                  type="text"
                  required
                  maxLength={120}
                  value={form.degree}
                  onChange={(e) => setForm({ ...form, degree: e.target.value })}
                  placeholder="e.g. BSc"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor={fieldId('fieldOfStudy')} className={labelClass}>Field of study</label>
                <input
                  id={fieldId('fieldOfStudy')}
                  type="text"
                  maxLength={120}
                  value={form.fieldOfStudy}
                  onChange={(e) => setForm({ ...form, fieldOfStudy: e.target.value })}
                  placeholder="e.g. Computer science"
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={fieldId('period')} className={labelClass}>Period, as shown *</label>
                <input
                  id={fieldId('period')}
                  type="text"
                  required
                  maxLength={60}
                  value={form.period}
                  onChange={(e) => setForm({ ...form, period: e.target.value })}
                  placeholder="e.g. 2022 – 2026"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor={fieldId('grade')} className={labelClass}>Grade</label>
                <input
                  id={fieldId('grade')}
                  type="text"
                  maxLength={40}
                  value={form.grade}
                  onChange={(e) => setForm({ ...form, grade: e.target.value })}
                  placeholder="e.g. GPA 3.9 / 4.0"
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
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  aria-describedby={fieldId('dates-hint')}
                  className={inputClass}
                />
              </div>
              <span id={fieldId('dates-hint')} className={`${hintClass} sm:col-span-2 -mt-1`}>Optional. Served as ISO dates so your site can sort or format them; the period above is the text people read.</span>
            </div>

            <div>
              <label htmlFor={fieldId('location')} className={labelClass}>Location</label>
              <input
                id={fieldId('location')}
                type="text"
                maxLength={120}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Berkeley, CA"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor={fieldId('achievements')} className={labelClass}>Coursework and honours</label>
              <textarea
                id={fieldId('achievements')}
                rows={3}
                value={form.achievements}
                onChange={(e) => setForm({ ...form, achievements: e.target.value })}
                aria-describedby={fieldId('achievements-hint')}
                placeholder={'Distributed systems, data structures\nDean’s list'}
                className={inputClass}
              />
              <span id={fieldId('achievements-hint')} className={hintClass}>One per line, up to 15, 300 characters each.</span>
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
