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
  CheckSquare,
  Square,
  SlidersHorizontal,
  ListChecks,
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

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTab, setBulkTab] = useState('batch'); // 'batch' or 'table'
  const [bulkSaving, setBulkSaving] = useState(false);

  // Batch Override Form State
  const [bulkCategory, setBulkCategory] = useState('KEEP');
  const [bulkProficiency, setBulkProficiency] = useState('KEEP');
  const [bulkApplyExp, setBulkApplyExp] = useState(false);
  const [bulkExpValue, setBulkExpValue] = useState(1);
  const [bulkFeatured, setBulkFeatured] = useState('KEEP');

  // Inline Table Editor State
  const [editableSkills, setEditableSkills] = useState([]);

  // Quick Batch Entry State
  const [batchCategory, setBatchCategory] = useState('Backend & Systems');
  const [batchInput, setBatchInput] = useState('');
  const [batchSaving, setBatchSaving] = useState(false);

  // Modal / Form State for Single Skill
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

  // Multi-Selection Handlers
  const toggleSelectSkill = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filteredSkills = skills.filter((s) => {
    const matchesCategory = activeCategory === 'All' || s.category === activeCategory;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const isAllFilteredSelected =
    filteredSkills.length > 0 &&
    filteredSkills.every((s) => selectedIds.includes(s._id));

  const isSomeFilteredSelected =
    filteredSkills.some((s) => selectedIds.includes(s._id));

  const toggleSelectAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredSkills.map((s) => s._id));
      setSelectedIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const filteredIdList = filteredSkills.map((s) => s._id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filteredIdList])));
    }
  };

  const clearSelection = () => setSelectedIds([]);

  // Open Bulk Edit Modal
  const openBulkModal = () => {
    if (selectedIds.length === 0) return;
    setBulkCategory('KEEP');
    setBulkProficiency('KEEP');
    setBulkApplyExp(false);
    setBulkExpValue(1);
    setBulkFeatured('KEEP');

    // Populate editable items for table mode
    const selectedList = skills.filter((s) => selectedIds.includes(s._id));
    setEditableSkills(selectedList.map((s) => ({ ...s })));
    setShowBulkModal(true);
  };

  // Submit Bulk Changes
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setBulkSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (bulkTab === 'batch') {
        const updates = {};
        if (bulkCategory !== 'KEEP') updates.category = bulkCategory;
        if (bulkProficiency !== 'KEEP') updates.proficiency = bulkProficiency;
        if (bulkApplyExp) updates.yearsOfExperience = Number(bulkExpValue);
        if (bulkFeatured === 'FEATURE') updates.featured = true;
        if (bulkFeatured === 'UNFEATURE') updates.featured = false;

        if (Object.keys(updates).length === 0) {
          setErrorMsg('No changes selected to apply. Please modify at least one field or switch to Grid mode.');
          setBulkSaving(false);
          return;
        }

        const res = await api.patch('/skills/bulk', {
          ids: selectedIds,
          updates,
        });

        const updatedList = res.data.skills || [];
        const updatedMap = new Map(updatedList.map((s) => [s._id, s]));
        setSkills((prev) => prev.map((s) => (updatedMap.has(s._id) ? updatedMap.get(s._id) : s)));
        setSuccessMsg(`Successfully updated ${res.data.count || selectedIds.length} skills.`);
      } else {
        // Table / Grid Mode
        const res = await api.patch('/skills/bulk', {
          items: editableSkills,
        });

        const updatedList = res.data.skills || [];
        const updatedMap = new Map(updatedList.map((s) => [s._id, s]));
        setSkills((prev) => prev.map((s) => (updatedMap.has(s._id) ? updatedMap.get(s._id) : s)));
        setSuccessMsg(`Successfully updated ${updatedList.length} skills.`);
      }

      setShowBulkModal(false);
      setSelectedIds([]);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error updating selected skills');
    } finally {
      setBulkSaving(false);
    }
  };

  // Bulk Quick Action: Toggle Featured
  const handleBulkFeatureToggle = async (featured) => {
    if (selectedIds.length === 0) return;
    setBulkSaving(true);
    setErrorMsg(null);
    try {
      const res = await api.patch('/skills/bulk', {
        ids: selectedIds,
        updates: { featured },
      });
      const updatedList = res.data.skills || [];
      const updatedMap = new Map(updatedList.map((s) => [s._id, s]));
      setSkills((prev) => prev.map((s) => (updatedMap.has(s._id) ? updatedMap.get(s._id) : s)));
      setSuccessMsg(`${featured ? 'Featured' : 'Unfeatured'} ${updatedList.length} skills.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error updating featured status');
    } finally {
      setBulkSaving(false);
    }
  };

  // Bulk Quick Action: Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Permanently delete all ${selectedIds.length} selected skills from the matrix?`)) return;

    setBulkSaving(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/skills/bulk-delete', { ids: selectedIds });
      setSkills((prev) => prev.filter((s) => !selectedIds.includes(s._id)));
      setSuccessMsg(`Deleted ${res.data.deletedCount || selectedIds.length} skills successfully.`);
      setSelectedIds([]);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error deleting selected skills');
    } finally {
      setBulkSaving(false);
    }
  };

  // Remove skill from bulk selection inside modal
  const removeSkillFromBulk = (id) => {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setEditableSkills((prev) => prev.filter((s) => s._id !== id));
  };

  // Update inline item in table mode
  const handleEditableSkillChange = (id, field, value) => {
    setEditableSkills((prev) =>
      prev.map((s) => (s._id === id ? { ...s, [field]: value } : s))
    );
  };

  // Single Skill Modal
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
      setSelectedIds((prev) => prev.filter((x) => x !== id));
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

        <div className="flex items-center gap-2.5">
          {selectedIds.length > 0 && (
            <button
              onClick={openBulkModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-[#0078d4] hover:bg-[#1e90ff] text-white font-semibold text-xs transition-all shadow-sm cursor-pointer"
            >
              <Edit2 size={14} />
              <span>Edit Selected ({selectedIds.length})</span>
            </button>
          )}

          <button
            onClick={() => openAddModal(activeCategory)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#10b981] hover:bg-[#059669] text-black font-semibold text-xs transition-all shadow-sm cursor-pointer"
          >
            <Plus size={15} />
            <span>Add Single Skill</span>
          </button>
        </div>
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

        {/* Multi-Selection Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 py-2 rounded bg-[#090d15] border border-[#1a2333]">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAllFiltered}
              className="flex items-center gap-2 text-xs font-mono text-slate-300 hover:text-white cursor-pointer select-none"
            >
              {isAllFilteredSelected ? (
                <CheckSquare size={16} className="text-[#0078d4]" />
              ) : isSomeFilteredSelected ? (
                <div className="w-4 h-4 rounded bg-[#0078d4] flex items-center justify-center text-white text-[10px] font-bold leading-none">
                  -
                </div>
              ) : (
                <Square size={16} className="text-slate-500 hover:text-slate-400" />
              )}
              <span>
                {isAllFilteredSelected
                  ? 'Deselect All Visible'
                  : `Select All Visible (${filteredSkills.length})`}
              </span>
            </button>

            {selectedIds.length > 0 && (
              <span className="text-[11px] font-mono text-[#0078d4] ml-2 pl-2 border-l border-[#1e293b]">
                {selectedIds.length} skill{selectedIds.length > 1 ? 's' : ''} selected
              </span>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={openBulkModal}
                disabled={bulkSaving}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0078d4] hover:bg-[#1e90ff] text-white text-xs font-semibold shadow transition-all cursor-pointer"
              >
                <Edit2 size={12} />
                <span>Edit Selected ({selectedIds.length})</span>
              </button>

              <button
                onClick={() => handleBulkFeatureToggle(true)}
                disabled={bulkSaving}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#0f1d16] hover:bg-[#163325] text-[#10b981] border border-[#10b981]/30 text-xs font-mono transition-all cursor-pointer"
                title="Mark all selected as featured in spotlight"
              >
                <Star size={12} className="fill-current" />
                <span className="hidden sm:inline">Feature</span>
              </button>

              <button
                onClick={() => handleBulkFeatureToggle(false)}
                disabled={bulkSaving}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#111827] hover:bg-[#1f293d] text-slate-300 border border-[#1e293b] text-xs font-mono transition-all cursor-pointer"
                title="Remove spotlight from selected"
              >
                <span className="hidden sm:inline">Unfeature</span>
              </button>

              <button
                onClick={handleBulkDelete}
                disabled={bulkSaving}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#200b10] hover:bg-red-950 text-red-400 border border-red-900/50 text-xs font-mono transition-all cursor-pointer"
                title="Delete all selected skills"
              >
                <Trash2 size={12} />
                <span className="hidden sm:inline">Delete</span>
              </button>

              <button
                onClick={clearSelection}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer ml-1"
                title="Clear selection"
              >
                <X size={14} />
              </button>
            </div>
          )}
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
          {filteredSkills.map((skill) => {
            const isSelected = selectedIds.includes(skill._id);
            return (
              <div
                key={skill._id}
                onClick={() => toggleSelectSkill(skill._id)}
                className={`p-3 rounded border transition-all flex flex-col justify-between cursor-pointer select-none group ${
                  isSelected
                    ? 'bg-[#09152b] border-[#0078d4] shadow-md shadow-[#0078d4]/10'
                    : 'bg-[#070a10] border-[#1a2333] hover:border-[#0078d4]/50'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelectSkill(skill._id, e)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-0.5 w-4 h-4 rounded bg-black border-[#1e293b] text-[#0078d4] focus:ring-[#0078d4] cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold text-white block truncate">
                          {skill.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {skill.category}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFeatured(skill);
                      }}
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

                  <div className="mt-3 flex items-center gap-2 text-[11px] font-mono pl-6">
                    <span className="px-2 py-0.5 rounded bg-black border border-[#1e293b] text-[#1e90ff]">
                      {skill.proficiency}
                    </span>
                    <span className="text-slate-500">
                      {skill.yearsOfExperience} {skill.yearsOfExperience === 1 ? 'yr' : 'yrs'} exp
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#1a2333] flex items-center justify-between pl-6">
                  <span className="text-[10px] font-mono text-slate-500">
                    {skill.featured ? '★ Featured Stack' : 'Matrix Only'}
                  </span>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => openEditModal(skill)}
                      className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                      title="Edit single skill"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(skill._id, skill.name)}
                      className="p-1 text-red-400 hover:text-white transition-colors cursor-pointer"
                      title="Delete single skill"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk Edit Modal for Multiple Skills */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded bg-[#090d15] border border-[#1a2333] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#1a2333] flex items-center justify-between bg-black">
              <div className="flex items-center gap-2">
                <Edit2 size={16} className="text-[#0078d4]" />
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  Bulk Edit ({selectedIds.length} Skills Selected)
                </span>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center border-b border-[#1a2333] bg-[#070a10] px-4 pt-2">
              <button
                type="button"
                onClick={() => setBulkTab('batch')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono border-b-2 font-semibold transition-all cursor-pointer ${
                  bulkTab === 'batch'
                    ? 'border-[#0078d4] text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <SlidersHorizontal size={13} />
                <span>Batch Property Override</span>
              </button>
              <button
                type="button"
                onClick={() => setBulkTab('table')}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono border-b-2 font-semibold transition-all cursor-pointer ${
                  bulkTab === 'table'
                    ? 'border-[#0078d4] text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ListChecks size={13} />
                <span>Matrix Grid Editor</span>
              </button>
            </div>

            {/* Selected Skills Chips */}
            <div className="p-3 bg-black/60 border-b border-[#1a2333]">
              <div className="text-[11px] font-mono text-slate-400 mb-1.5 flex items-center justify-between">
                <span>Selected Skills in Batch:</span>
                <span className="text-slate-500">Click &times; to deselect</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {skills
                  .filter((s) => selectedIds.includes(s._id))
                  .map((skill) => (
                    <span
                      key={skill._id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#101726] border border-[#1e293b] text-slate-200 text-[11px] font-mono"
                    >
                      <span>{skill.name}</span>
                      <button
                        type="button"
                        onClick={() => removeSkillFromBulk(skill._id)}
                        className="text-slate-400 hover:text-red-400 cursor-pointer"
                        title="Remove from batch"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
              </div>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleBulkSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
              {bulkTab === 'batch' ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-400">
                    Choose which fields to overwrite across all {selectedIds.length} selected skills. Fields set to "Keep Existing" will remain unchanged on each individual skill.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">
                        Category
                      </label>
                      <select
                        value={bulkCategory}
                        onChange={(e) => setBulkCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
                      >
                        <option value="KEEP">[ Keep Existing Category ]</option>
                        {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                          <option key={cat} value={cat}>
                            Set to: {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">
                        Proficiency Level
                      </label>
                      <select
                        value={bulkProficiency}
                        onChange={(e) => setBulkProficiency(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
                      >
                        <option value="KEEP">[ Keep Existing Proficiency ]</option>
                        {PROFICIENCIES.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            Set to: {lvl}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="bulkApplyExpCheckbox"
                          checked={bulkApplyExp}
                          onChange={(e) => setBulkApplyExp(e.target.checked)}
                          className="w-4 h-4 rounded bg-black border-[#1e293b] text-[#0078d4] focus:ring-[#0078d4] cursor-pointer"
                        />
                        <label
                          htmlFor="bulkApplyExpCheckbox"
                          className="text-xs font-mono text-slate-300 cursor-pointer"
                        >
                          Update Years of Experience
                        </label>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        disabled={!bulkApplyExp}
                        value={bulkExpValue}
                        onChange={(e) => setBulkExpValue(parseFloat(e.target.value) || 0)}
                        placeholder="e.g. 2.5"
                        className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs font-mono focus:border-[#0078d4] outline-none disabled:opacity-30 disabled:bg-[#111]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">
                        Spotlight Featured Status
                      </label>
                      <select
                        value={bulkFeatured}
                        onChange={(e) => setBulkFeatured(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
                      >
                        <option value="KEEP">[ Keep Existing Featured Status ]</option>
                        <option value="FEATURE">Set All as Featured (★ Spotlight)</option>
                        <option value="UNFEATURE">Set All as Not Featured (Matrix Only)</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 mb-2">
                    Review and edit individual properties for each selected skill side by side.
                  </p>

                  <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                    {editableSkills.map((item) => (
                      <div
                        key={item._id}
                        className="p-3 rounded bg-black border border-[#1a2333] space-y-2 text-xs font-mono"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                          <div className="sm:col-span-4">
                            <label className="text-[10px] text-slate-500 block mb-0.5">Skill Name</label>
                            <input
                              type="text"
                              value={item.name}
                              onChange={(e) =>
                                handleEditableSkillChange(item._id, 'name', e.target.value)
                              }
                              className="w-full px-2 py-1.5 rounded bg-[#090d15] border border-[#1e293b] text-white text-xs outline-none focus:border-[#0078d4]"
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label className="text-[10px] text-slate-500 block mb-0.5">Category</label>
                            <select
                              value={item.category}
                              onChange={(e) =>
                                handleEditableSkillChange(item._id, 'category', e.target.value)
                              }
                              className="w-full px-2 py-1.5 rounded bg-[#090d15] border border-[#1e293b] text-white text-xs outline-none focus:border-[#0078d4]"
                            >
                              {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-slate-500 block mb-0.5">Proficiency</label>
                            <select
                              value={item.proficiency}
                              onChange={(e) =>
                                handleEditableSkillChange(item._id, 'proficiency', e.target.value)
                              }
                              className="w-full px-2 py-1.5 rounded bg-[#090d15] border border-[#1e293b] text-white text-xs outline-none focus:border-[#0078d4]"
                            >
                              {PROFICIENCIES.map((lvl) => (
                                <option key={lvl} value={lvl}>
                                  {lvl}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <label className="text-[10px] text-slate-500 block mb-0.5">Exp (Yrs)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={item.yearsOfExperience}
                              onChange={(e) =>
                                handleEditableSkillChange(
                                  item._id,
                                  'yearsOfExperience',
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-2 py-1.5 rounded bg-[#090d15] border border-[#1e293b] text-white text-xs outline-none focus:border-[#0078d4]"
                            />
                          </div>

                          <div className="sm:col-span-1 flex items-center justify-end gap-1 pt-3 sm:pt-0">
                            <button
                              type="button"
                              onClick={() =>
                                handleEditableSkillChange(item._id, 'featured', !item.featured)
                              }
                              className={`p-1.5 rounded transition-all cursor-pointer ${
                                item.featured
                                  ? 'text-[#10b981] bg-[#062419]'
                                  : 'text-slate-600 hover:text-slate-400'
                              }`}
                              title={item.featured ? 'Featured' : 'Not Featured'}
                            >
                              <Star size={14} className={item.featured ? 'fill-current' : ''} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSkillFromBulk(item._id)}
                              className="p-1.5 text-slate-500 hover:text-red-400 cursor-pointer"
                              title="Remove from batch"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t border-[#1a2333]">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-3.5 py-1.5 rounded text-xs font-semibold text-slate-400 hover:text-white hover:bg-[#111827] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bulkSaving || selectedIds.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#0078d4] hover:bg-[#1e90ff] text-white font-semibold text-xs shadow cursor-pointer disabled:opacity-50"
                >
                  <Save size={13} />
                  <span>
                    {bulkSaving
                      ? 'Applying Changes...'
                      : `Apply Changes to ${selectedIds.length} Skills`}
                  </span>
                </button>
              </div>
            </form>
          </div>
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
