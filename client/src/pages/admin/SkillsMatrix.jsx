import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import {
  Cpu,
  Plus,
  Trash2,
  Edit2,
  Star,
  CheckCircle,
  AlertCircle,
  X,
  Save,
  Tag,
  Search,
} from 'lucide-react';

const CATEGORIES = [
  'All',
  'Languages',
  'Frontend',
  'Backend & Systems',
  'Databases & Caching',
  'DevOps & Cloud',
  'Hardware & Electronics',
  'Tools & Frameworks',
];

const PROFICIENCIES = ['Beginner', 'Familiar', 'Proficient', 'Advanced', 'Expert'];

export default function SkillsMatrix() {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Quick Batch Entry State
  const [batchCategory, setBatchCategory] = useState('Backend & Systems');
  const [batchInput, setBatchInput] = useState('');
  const [batchSaving, setBatchSaving] = useState(false);

  // Modal / Form State
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'Backend & Systems',
    proficiency: 'Proficient',
    yearsOfExperience: 1,
    featured: false,
    order: 0,
  });

  const fetchSkills = async () => {
    try {
      const res = await api.get('/skills');
      const list = Array.isArray(res.data) ? res.data : res.data.skills || [];
      setSkills(list);
    } catch (err) {
      setErrorMsg('Failed to load skills matrix: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const openAddModal = (cat) => {
    setEditingId(null);
    setForm({
      name: '',
      category: cat && cat !== 'All' ? cat : 'Backend & Systems',
      proficiency: 'Proficient',
      yearsOfExperience: 1,
      featured: false,
      order: skills.length,
    });
    setShowModal(true);
  };

  const openEditModal = (skill) => {
    setEditingId(skill._id);
    setForm({
      name: skill.name,
      category: skill.category,
      proficiency: skill.proficiency || 'Proficient',
      yearsOfExperience: skill.yearsOfExperience ?? 1,
      featured: skill.featured ?? false,
      order: skill.order ?? 0,
    });
    setShowModal(true);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setModalSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (editingId) {
        const res = await api.put(`/skills/${editingId}`, form);
        setSkills((prev) => prev.map((s) => (s._id === editingId ? res.data : s)));
        setSuccessMsg(`Skill "${form.name}" updated.`);
      } else {
        const res = await api.post('/skills', form);
        setSkills((prev) => [...prev, res.data]);
        setSuccessMsg(`Skill "${form.name}" created.`);
      }
      setShowModal(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error saving skill');
    } finally {
      setModalSaving(false);
    }
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    if (!batchInput.trim()) return;
    setBatchSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const names = batchInput
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);

    if (names.length === 0) {
      setBatchSaving(false);
      return;
    }

    const payload = names.map((name, i) => ({
      name,
      category: batchCategory,
      proficiency: 'Proficient',
      yearsOfExperience: 1,
      featured: false,
      order: skills.length + i,
    }));

    try {
      const res = await api.post('/skills', payload);
      const added = Array.isArray(res.data) ? res.data : [res.data];
      setSkills((prev) => [...prev, ...added]);
      setBatchInput('');
      setSuccessMsg(`Batch created ${added.length} skills in category "${batchCategory}".`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error batch inserting skills');
    } finally {
      setBatchSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete skill "${name}" from the matrix?`)) return;
    try {
      await api.delete(`/skills/${id}`);
      setSkills((prev) => prev.filter((s) => s._id !== id));
      setSuccessMsg(`Skill "${name}" deleted.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error deleting skill');
    }
  };

  const handleToggleFeatured = async (skill) => {
    try {
      const updated = { ...skill, featured: !skill.featured };
      const res = await api.put(`/skills/${skill._id}`, updated);
      setSkills((prev) => prev.map((s) => (s._id === skill._id ? res.data : s)));
    } catch (err) {
      setErrorMsg('Error updating featured flag');
    }
  };

  // Filter skills
  const filteredSkills = skills.filter((s) => {
    const matchesCategory = activeCategory === 'All' || s.category === activeCategory;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredCount = skills.filter((s) => s.featured).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1a2333]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-[#090d15] text-[#0078d4] border border-[#1a2333]">
              <Cpu size={20} />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Independent Skills Matrix</h1>
            <span className="px-2 py-0.5 rounded bg-[#0f141f] text-[11px] font-mono text-slate-300 border border-[#1e293b]">
              {skills.length} Total · {featuredCount} Featured
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Categorized competencies, proficiencies, and highlighted stack entries served across client APIs.
          </p>
        </div>

        <button
          onClick={() => openAddModal(activeCategory)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#0078d4] hover:bg-[#1e90ff] text-white font-semibold text-xs transition-all shadow-sm cursor-pointer"
        >
          <Plus size={15} />
          <span>Add Single Skill</span>
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

      {/* Quick Batch Entry Strip */}
      <div className="p-4 rounded bg-[#070a10] border border-[#1a2333]">
        <div className="flex items-center gap-2 mb-2">
          <Tag size={14} className="text-[#10b981]" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
            Batch Quick Tag Entry
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            (Comma-separated list, instant creation)
          </span>
        </div>
        <form onSubmit={handleBatchSubmit} className="flex flex-col sm:flex-row gap-3">
          <select
            value={batchCategory}
            onChange={(e) => setBatchCategory(e.target.value)}
            className="px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none sm:w-56"
          >
            {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={batchInput}
            onChange={(e) => setBatchInput(e.target.value)}
            placeholder="e.g. Kubernetes, Ansible, Terraform, Nginx"
            className="flex-1 px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs font-mono focus:border-[#0078d4] outline-none"
          />
          <button
            type="submit"
            disabled={batchSaving || !batchInput.trim()}
            className="px-4 py-2 rounded bg-[#10b981] hover:bg-[#059669] text-black font-semibold text-xs shadow-sm disabled:opacity-40 cursor-pointer"
          >
            {batchSaving ? 'Adding...' : 'Batch Add'}
          </button>
        </form>
      </div>

      {/* Search & Category Filter Navigation */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1 bg-[#070a10] p-1 rounded border border-[#1a2333]">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded text-xs font-mono transition-all cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-[#0078d4] text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-[#111827]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search skill..."
              className="w-full pl-9 pr-3 py-1.5 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
            />
          </div>
        </div>
      </div>

      {/* Skills Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs font-mono text-[#0078d4] animate-pulse">
          Querying skills matrix...
        </div>
      ) : filteredSkills.length === 0 ? (
        <div className="p-12 text-center text-xs font-mono text-slate-500 border border-dashed border-[#1a2333] rounded">
          No skills matched the current filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSkills.map((skill) => (
            <div
              key={skill._id}
              className="p-3 rounded bg-[#070a10] border border-[#1a2333] hover:border-[#0078d4] transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-sm font-bold text-white block">{skill.name}</span>
                    <span className="text-[10px] font-mono text-slate-400">{skill.category}</span>
                  </div>
                  <button
                    onClick={() => handleToggleFeatured(skill)}
                    className={`p-1 rounded transition-colors cursor-pointer ${
                      skill.featured
                        ? 'text-[#10b981]'
                        : 'text-slate-600 hover:text-slate-300'
                    }`}
                    title={skill.featured ? 'Featured in spotlight stack' : 'Click to feature in spotlight'}
                  >
                    <Star size={15} className={skill.featured ? 'fill-current' : ''} />
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-2 text-[11px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-black border border-[#1e293b] text-[#1e90ff]">
                    {skill.proficiency}
                  </span>
                  <span className="text-slate-500">
                    {skill.yearsOfExperience} {skill.yearsOfExperience === 1 ? 'yr' : 'yrs'} exp
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[#1a2333] flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500">
                  {skill.featured ? '★ Featured Stack' : 'Matrix Only'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(skill)}
                    className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Edit"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(skill._id, skill.name)}
                    className="p-1 text-red-400 hover:text-white transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal for Add / Edit Single Skill */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded bg-[#090d15] border border-[#1a2333] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#1a2333] flex items-center justify-between bg-black">
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                {editingId ? 'Edit Skill Competency' : 'Add New Skill Competency'}
              </span>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Skill Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Docker, Redis, Kubernetes"
                  className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Proficiency Level</label>
                  <select
                    value={form.proficiency}
                    onChange={(e) => setForm({ ...form, proficiency: e.target.value })}
                    className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
                  >
                    {PROFICIENCIES.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Years of Exp</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.yearsOfExperience}
                    onChange={(e) => setForm({ ...form, yearsOfExperience: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs font-mono focus:border-[#0078d4] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="skillFeatured"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  className="w-4 h-4 rounded bg-black border-[#1e293b] text-[#10b981] focus:ring-[#10b981]"
                />
                <label htmlFor="skillFeatured" className="text-xs text-slate-300 cursor-pointer">
                  Feature in Spotlight summary and top highlight stack
                </label>
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
                  disabled={modalSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#10b981] hover:bg-[#059669] text-black font-semibold text-xs shadow cursor-pointer disabled:opacity-50"
                >
                  <Save size={13} />
                  <span>{modalSaving ? 'Saving...' : 'Save Skill'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
