import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import {
  GraduationCap,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  X,
  Save,
  MapPin,
  Award,
} from 'lucide-react';

export default function EducationManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const [form, setForm] = useState({
    institution: '',
    degree: '',
    fieldOfStudy: 'Computer Science & Engineering',
    period: '',
    grade: '',
    location: '',
    achievements: '',
    order: 0,
  });

  const fetchEducation = async () => {
    try {
      const res = await api.get('/education');
      setItems(res.data || []);
    } catch (err) {
      setErrorMsg('Failed to load education history: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEducation();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      institution: '',
      degree: '',
      fieldOfStudy: 'Computer Science & Engineering',
      period: '',
      grade: '',
      location: '',
      achievements: '',
      order: items.length,
    });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingId(item._id);
    setForm({
      institution: item.institution,
      degree: item.degree,
      fieldOfStudy: item.fieldOfStudy || '',
      period: item.period,
      grade: item.grade || '',
      location: item.location || '',
      achievements: (item.achievements || []).join('\n'),
      order: item.order ?? 0,
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
      achievements: form.achievements
        .split('\n')
        .map((a) => a.trim())
        .filter(Boolean),
    };

    try {
      if (editingId) {
        const res = await api.put(`/education/${editingId}`, payload);
        setItems((prev) => prev.map((item) => (item._id === editingId ? res.data : item)));
        setSuccessMsg('Academic credential updated.');
      } else {
        const res = await api.post('/education', payload);
        setItems((prev) => [...prev, res.data]);
        setSuccessMsg('New academic credential added.');
      }
      setShowModal(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error saving academic credential');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, degree) => {
    if (!window.confirm(`Permanently remove credential "${degree}"?`)) return;
    try {
      await api.delete(`/education/${id}`);
      setItems((prev) => prev.filter((item) => item._id !== id));
      setSuccessMsg('Academic record deleted.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error deleting record');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-t-border">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-t-surface text-t-accent border border-t-border">
              <GraduationCap size={20} />
            </div>
            <h1 className="text-xl font-bold text-t-text tracking-tight">Academic History &amp; Education</h1>
            <span className="px-2 py-0.5 rounded bg-t-surface-hi text-[11px] font-mono text-t-muted border border-t-border-hi">
              {items.length} Credentials
            </span>
          </div>
          <p className="text-xs text-t-muted mt-1">
            University degrees, relevant coursework, and academic milestones served across client applications.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-xs transition-all shadow-sm cursor-pointer"
        >
          <Plus size={15} />
          <span>Add Education</span>
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

      {/* Education Cards */}
      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-t-accent animate-pulse">
          Querying academic credentials...
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center text-xs font-mono text-t-dim rounded bg-t-surface border border-dashed border-t-border">
          No education credentials recorded yet. Click "Add Education" to register your degree.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item._id}
              className="p-5 rounded bg-t-surface border border-t-border hover:border-t-accent transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-t-text">{item.degree}</h2>
                  <div className="text-xs text-t-accent font-medium mt-0.5">
                    {item.institution}
                  </div>
                  <div className="text-[11px] text-t-muted font-mono mt-0.5">
                    Field: {item.fieldOfStudy}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-t-bg border border-t-border-hi text-xs font-mono text-t-muted">
                    {item.period}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 rounded text-t-muted hover:text-t-text hover:bg-t-surface-hi cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(item._id, item.degree)}
                      className="p-1.5 rounded text-t-danger hover:text-t-text hover:bg-red-950 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-t-muted pt-2 border-t border-t-border">
                {item.grade && (
                  <div className="flex items-center gap-1 text-t-accent2">
                    <Award size={13} />
                    <span>{item.grade}</span>
                  </div>
                )}
                {item.location && (
                  <div className="flex items-center gap-1 text-t-muted">
                    <MapPin size={13} />
                    <span>{item.location}</span>
                  </div>
                )}
              </div>

              {item.achievements && item.achievements.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] font-mono text-t-dim mb-1">Highlights &amp; Coursework:</div>
                  <ul className="list-disc list-inside text-xs text-t-muted space-y-0.5 pl-1">
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

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-t-bg/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded bg-t-surface border border-t-border shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-t-border flex items-center justify-between bg-t-bg">
              <span className="text-xs font-mono font-bold text-t-text uppercase tracking-wider">
                {editingId ? 'Edit Academic Credential' : 'Add Academic Credential'}
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
                <label className="block text-xs font-mono text-t-muted mb-1">Institution / University *</label>
                <input
                  type="text"
                  required
                  value={form.institution}
                  onChange={(e) => setForm({ ...form, institution: e.target.value })}
                  placeholder="e.g. University of California, Berkeley"
                  className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-t-muted mb-1">Degree *</label>
                  <input
                    type="text"
                    required
                    value={form.degree}
                    onChange={(e) => setForm({ ...form, degree: e.target.value })}
                    placeholder="e.g. B.Tech in CSE"
                    className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-t-muted mb-1">Field of Study</label>
                  <input
                    type="text"
                    value={form.fieldOfStudy}
                    onChange={(e) => setForm({ ...form, fieldOfStudy: e.target.value })}
                    placeholder="Computer Science & Engineering"
                    className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-t-muted mb-1">Display Period *</label>
                  <input
                    type="text"
                    required
                    value={form.period}
                    onChange={(e) => setForm({ ...form, period: e.target.value })}
                    placeholder="e.g. 2022 - 2026"
                    className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-t-muted mb-1">Grade / CGPA</label>
                  <input
                    type="text"
                    value={form.grade}
                    onChange={(e) => setForm({ ...form, grade: e.target.value })}
                    placeholder="e.g. GPA: 3.9 / 4.0"
                    className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs font-mono focus:border-t-accent outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-t-muted mb-1">Campus Location</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Berkeley, CA"
                  className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-t-muted mb-1">
                  Key Coursework &amp; Academic Honors (One per line)
                </label>
                <textarea
                  rows={3}
                  value={form.achievements}
                  onChange={(e) => setForm({ ...form, achievements: e.target.value })}
                  placeholder="Distributed Systems, Data Structures, Computer Networks&#10;Dean's Honor Roll"
                  className="w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-xs focus:border-t-accent outline-none"
                />
              </div>

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
                  <span>{saving ? 'Saving...' : 'Save Credential'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
