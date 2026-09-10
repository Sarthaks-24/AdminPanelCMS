import React, { useEffect, useState } from 'react';
import { api } from '../../api/client';
import {
  Briefcase,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  X,
  Save,
  MapPin,
  ExternalLink,
} from 'lucide-react';

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance'];

export default function ExperienceList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const [form, setForm] = useState({
    company: '',
    role: '',
    employmentType: 'Full-time',
    period: '',
    isCurrent: false,
    location: 'Remote',
    companyUrl: '',
    description: '',
    achievements: '',
    technologies: '',
    order: 0,
    featured: true,
  });

  const fetchExperience = async () => {
    try {
      const res = await api.get('/experience');
      setItems(res.data || []);
    } catch (err) {
      setErrorMsg('Error fetching career timeline: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExperience();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      company: '',
      role: '',
      employmentType: 'Full-time',
      period: '',
      isCurrent: false,
      location: 'Remote',
      companyUrl: '',
      description: '',
      achievements: '',
      technologies: '',
      order: items.length,
      featured: true,
    });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingId(item._id);
    setForm({
      company: item.company,
      role: item.role,
      employmentType: item.employmentType || 'Full-time',
      period: item.period,
      isCurrent: item.isCurrent ?? false,
      location: item.location || 'Remote',
      companyUrl: item.companyUrl || '',
      description: item.description,
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

    const payload = {
      ...form,
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
        setSuccessMsg(`Milestone "${form.company}" updated.`);
      } else {
        const res = await api.post('/experience', payload);
        setItems((prev) => [...prev, res.data]);
        setSuccessMsg(`New milestone at "${form.company}" registered.`);
      }
      setShowModal(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error saving experience record');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, roleName, compName) => {
    if (!window.confirm(`Permanently remove "${roleName} at ${compName}" from your career timeline?`)) return;
    try {
      await api.delete(`/experience/${id}`);
      setItems((prev) => prev.filter((i) => i._id !== id));
      setSuccessMsg('Career milestone removed.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error deleting milestone');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1a2333]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-[#090d15] text-[#10b981] border border-[#1a2333]">
              <Briefcase size={20} />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Career Milestones &amp; Experience</h1>
            <span className="px-2 py-0.5 rounded bg-[#0f141f] text-[11px] font-mono text-slate-300 border border-[#1e293b]">
              {items.length} Positions
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Engineering positions, contracts, and roles rendered across career timeline views.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded bg-[#0078d4] hover:bg-[#1e90ff] text-white font-semibold text-xs transition-all shadow-sm cursor-pointer"
        >
          <Plus size={15} />
          <span>Add Position</span>
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 rounded bg-[#062419] border border-[#10b981]/50 text-[#10b981] text-xs flex items-center gap-2 font-mono">
          <CheckCircle size={15} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded bg-[#2a0b12] border border-red-500/50 text-red-300 text-xs flex items-center gap-2 font-mono">
          <AlertCircle size={15} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Experience Timeline */}
      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-[#0078d4] animate-pulse">
          Querying career timeline...
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center text-xs font-mono text-slate-500 rounded bg-[#070a10] border border-dashed border-[#1a2333]">
          No career milestones recorded yet. Click "Add Position" to register your work history.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item._id}
              className="p-5 rounded bg-[#070a10] border border-[#1a2333] hover:border-[#0078d4] transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-white">{item.role}</h2>
                    {item.isCurrent && (
                      <span className="px-2 py-0.2 rounded bg-[#0d2a1d] text-[#10b981] border border-[#10b981]/30 text-[10px] font-mono">
                        CURRENT
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#0078d4] font-medium mt-0.5 flex items-center gap-1.5">
                    <span>{item.company}</span>
                    {item.companyUrl && (
                      <a
                        href={item.companyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-500 hover:text-slate-300"
                      >
                        <ExternalLink size={11} />
                      </a>
                    )}
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-400 font-mono text-[11px]">{item.employmentType || 'Full-time'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-black border border-[#1e293b] text-xs font-mono text-slate-300">
                    {item.period}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#111827] cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(item._id, item.role, item.company)}
                      className="p-1.5 rounded text-red-400 hover:text-white hover:bg-red-950 cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {item.description}
              </p>

              {item.achievements && item.achievements.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] font-mono text-slate-500 mb-1">Key Deliverables &amp; Outcomes:</div>
                  <ul className="list-disc list-inside text-xs text-slate-300 space-y-1 pl-1">
                    {item.achievements.map((ach, i) => (
                      <li key={i}>{ach}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Technologies & Location */}
              <div className="pt-3 border-t border-[#1a2333] flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono">
                <div className="flex flex-wrap gap-1.5">
                  {item.technologies &&
                    item.technologies.map((tech, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-black border border-[#1e293b] text-slate-300"
                      >
                        {tech}
                      </span>
                    ))}
                </div>

                <div className="flex items-center gap-1 text-slate-400">
                  <MapPin size={12} className="text-slate-500" />
                  <span>{item.location || 'Remote'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded bg-[#090d15] border border-[#1a2333] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-[#1a2333] flex items-center justify-between bg-black">
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                {editingId ? 'Edit Career Milestone' : 'Add Career Milestone'}
              </span>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="Tech Innovations Corp"
                    className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Role / Job Title *</label>
                  <input
                    type="text"
                    required
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="Full Stack Engineer"
                    className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Employment Type</label>
                  <select
                    value={form.employmentType}
                    onChange={(e) => setForm({ ...form, employmentType: e.target.value })}
                    className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
                  >
                    {EMPLOYMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Display Period *</label>
                  <input
                    type="text"
                    required
                    value={form.period}
                    onChange={(e) => setForm({ ...form, period: e.target.value })}
                    placeholder="e.g. June 2024 - Present"
                    className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    placeholder="Remote / San Francisco, CA"
                    className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
                  />
                </div>
                <div className="pt-4 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isCurrentPos"
                    checked={form.isCurrent}
                    onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })}
                    className="w-4 h-4 rounded bg-black border-[#1e293b] text-[#10b981] focus:ring-[#10b981]"
                  />
                  <label htmlFor="isCurrentPos" className="text-xs text-slate-300 cursor-pointer">
                    Currently Working Here
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Company Website URL</label>
                <input
                  type="url"
                  value={form.companyUrl}
                  onChange={(e) => setForm({ ...form, companyUrl: e.target.value })}
                  placeholder="https://company.example.com"
                  className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs font-mono focus:border-[#0078d4] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">High-Level Role Overview *</label>
                <textarea
                  required
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Core backend architecture, WebSocket microservices, latency optimization..."
                  className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Key Accomplishments (One per line)
                </label>
                <textarea
                  rows={3}
                  value={form.achievements}
                  onChange={(e) => setForm({ ...form, achievements: e.target.value })}
                  placeholder="Reduced p99 latency from 180ms to 24ms&#10;Architected real-time notification engine serving 50k sessions"
                  className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Technologies Used (Comma-separated)
                </label>
                <input
                  type="text"
                  value={form.technologies}
                  onChange={(e) => setForm({ ...form, technologies: e.target.value })}
                  placeholder="Node.js, Docker, MongoDB, Redis, WebSockets"
                  className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs font-mono focus:border-[#0078d4] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-[#1a2333]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#111827] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#10b981] hover:bg-[#059669] text-black font-semibold text-xs shadow cursor-pointer disabled:opacity-50"
                >
                  <Save size={13} />
                  <span>{saving ? 'Saving...' : 'Save Milestone'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
