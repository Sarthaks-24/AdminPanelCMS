import React, { useState, useEffect, useMemo, useId } from 'react';
import { api } from '../../api/client';
import { apiErrorMessage } from '../../lib/apiErrors';
import { ListSkeleton, EmptyState } from '../../components/admin/States';
import Modal from '../../components/admin/ui/Modal';
import useConfirm from '../../components/admin/ui/useConfirm';
import { submitKeepingVisibility, chosenVisibility, currentVisibility } from '../../lib/visibilitySubmit';
import {
  Plus,
  Trash2,
  Edit2,
  Star,
  CheckCircle,
  AlertCircle,
  X,
  Save,
  Minus,
  Tag,
  Search,
  CheckSquare,
  Square,
  SlidersHorizontal,
  ListChecks,
} from 'lucide-react';

// Suggestions only: categories are free text (≤60 chars). The server lists the owner's own.
const SUGGESTED_CATEGORIES = [
  'Languages',
  'Frontend',
  'Backend & Systems',
  'Databases & Caching',
  'DevOps & Cloud',
  'Hardware & Electronics',
  'Tools & Frameworks',
];

const PROFICIENCIES = ['Beginner', 'Familiar', 'Proficient', 'Advanced', 'Expert'];

// Server caps (docs/CONTENT_FIELDS.md): name 120, category 60.
const NAME_MAX = 120;
const CATEGORY_MAX = 60;

const fieldClass = 'w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-sm focus:border-t-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-t-accent/40';
const labelClass = 'block text-xs font-medium text-t-muted mb-1';
const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent';

const countSkills = (n) => `${n} ${n === 1 ? 'skill' : 'skills'}`;

export default function SkillsMatrix() {
  const [confirm, confirmDialog] = useConfirm();
  const uid = useId();
  const fid = (name) => `${uid}-${name}`;
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [knownCategories, setKnownCategories] = useState(SUGGESTED_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTab, setBulkTab] = useState('batch'); // 'batch' or 'table'
  const [bulkSaving, setBulkSaving] = useState(false);

  // Batch Override Form State
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkProficiency, setBulkProficiency] = useState('KEEP');
  const [bulkApplyExp, setBulkApplyExp] = useState(false);
  const [bulkExpValue, setBulkExpValue] = useState(1);
  const [bulkFeatured, setBulkFeatured] = useState('KEEP');

  // Inline Table Editor State
  const [editableSkills, setEditableSkills] = useState([]);

  // Quick Batch Entry State
  const [batchCategory, setBatchCategory] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [batchSaving, setBatchSaving] = useState(false);

  // Modal / Form State for Single Skill
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  // What Enter means in the edit form: the skill keeps the visibility it has (FX-38).
  const [editingVisibility, setEditingVisibility] = useState('published');
  const [modalSaving, setModalSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: '',
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
      setErrorMsg(apiErrorMessage(err, 'Could not load your skills.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
    api.get('/skills/categories')
      .then(({ data }) => { if (Array.isArray(data?.categories) && data.categories.length) setKnownCategories(data.categories); })
      .catch(() => {});
  }, []);

  // Tabs show the categories you actually use; the datalist also suggests ones you might.
  const CATEGORIES = useMemo(() => ['All', ...Array.from(new Set(skills.map((s) => s.category).filter(Boolean))).sort((a, b) => a.localeCompare(b))], [skills]);
  const categoryOptions = useMemo(() => Array.from(new Set([...knownCategories, ...skills.map((s) => s.category).filter(Boolean)])).sort((a, b) => a.localeCompare(b)), [knownCategories, skills]);

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
    setBulkCategory(''); // empty = keep each skill's own category
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
        if (bulkCategory.trim()) updates.category = bulkCategory.trim();
        if (bulkProficiency !== 'KEEP') updates.proficiency = bulkProficiency;
        if (bulkApplyExp) updates.yearsOfExperience = Number(bulkExpValue);
        if (bulkFeatured === 'FEATURE') updates.featured = true;
        if (bulkFeatured === 'UNFEATURE') updates.featured = false;

        if (Object.keys(updates).length === 0) {
          setErrorMsg('Nothing to change yet. Set at least one field, or switch to “Edit as a table”.');
          setBulkSaving(false);
          return;
        }

        const res = await api.patch('/skills/bulk', {
          ids: selectedIds,
          updates,
        });

        // The server answers { matchedCount } only, so re-read the list instead of patching it locally
        // (a stale grid saved later via "Edit as a table" would undo this change, CB-05).
        await fetchSkills();
        setSuccessMsg(`Updated ${countSkills(res.data?.matchedCount ?? selectedIds.length)}.`);
      } else {
        // Table / Grid Mode
        const res = await api.patch('/skills/bulk', {
          items: editableSkills,
        });

        await fetchSkills();
        setSuccessMsg(`Updated ${countSkills(res.data?.matchedCount ?? editableSkills.length)}.`);
      }

      setShowBulkModal(false);
      setSelectedIds([]);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not update the selected skills.'));
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
      await fetchSkills();
      setSuccessMsg(`${featured ? 'Featured' : 'Unfeatured'} ${countSkills(res.data?.matchedCount ?? selectedIds.length)}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not update the featured flag.'));
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkPublish = async () => {
    if (selectedIds.length === 0) return;
    setBulkSaving(true);
    setErrorMsg(null);
    try {
      const res = await api.patch('/skills/bulk', { ids: selectedIds, updates: { visibility: 'published' } });
      await fetchSkills();
      setSuccessMsg(`Published ${countSkills(res.data?.matchedCount ?? selectedIds.length)}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not publish the selected skills.'));
    } finally {
      setBulkSaving(false);
    }
  };

  const handleVisibilityToggle = async (skill) => {
    const visibility = skill.visibility === 'published' ? 'draft' : 'published';
    try {
      await api.put(`/skills/${skill._id}`, { visibility });
      setSkills((prev) => prev.map((item) => item._id === skill._id ? { ...item, visibility } : item));
      setSuccessMsg(`${skill.name} moved to ${visibility}.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not change the visibility.'));
    }
  };

  // Bulk Quick Action: Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const ok = await confirm({
      title: `Delete ${selectedIds.length} ${selectedIds.length === 1 ? 'skill' : 'skills'}?`,
      consequence: 'They disappear from every App that serves your skills.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;

    setBulkSaving(true);
    setErrorMsg(null);
    try {
      const res = await api.post('/skills/bulk-delete', { ids: selectedIds });
      setSkills((prev) => prev.filter((s) => !selectedIds.includes(s._id)));
      setSuccessMsg(`Deleted ${res.data.deletedCount || selectedIds.length} skills.`);
      setSelectedIds([]);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not delete the selected skills.'));
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
    setEditingVisibility('published');
    setForm({
      name: '',
      category: cat && cat !== 'All' ? cat : '',
      proficiency: 'Proficient',
      yearsOfExperience: 1,
      featured: false,
      order: skills.length,
    });
    setShowModal(true);
  };

  const openEditModal = (skill) => {
    setEditingId(skill._id);
    setEditingVisibility(currentVisibility(skill));
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
    // A click on either button is a choice; Enter keeps the skill's current visibility.
    const visibility = chosenVisibility(e, editingId ? editingVisibility : 'draft');
    setModalSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (editingId) {
        const res = await api.put(`/skills/${editingId}`, { ...form, visibility });
        setSkills((prev) => prev.map((s) => (s._id === editingId ? res.data : s)));
        setSuccessMsg(`Skill "${form.name}" updated${visibility === 'draft' ? ' as a draft' : ''}.`);
      } else {
        const res = await api.post('/skills', { ...form, visibility });
        setSkills((prev) => [...prev, res.data]);
        setSuccessMsg(`Skill "${form.name}" created${visibility === 'draft' ? ' as a draft' : ''}.`);
      }
      setShowModal(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not save the skill.'));
    } finally {
      setModalSaving(false);
    }
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    const visibility = chosenVisibility(e, 'draft');
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
      visibility,
      order: skills.length + i,
    }));

    try {
      const res = await api.post('/skills', payload);
      const added = Array.isArray(res.data) ? res.data : [res.data];
      setSkills((prev) => [...prev, ...added]);
      setBatchInput('');
      setSuccessMsg(`Added ${added.length} ${added.length === 1 ? 'skill' : 'skills'} to “${batchCategory}”${visibility === 'published' ? ', published' : added.length === 1 ? ' as a draft' : ' as drafts'}.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not add those skills.'));
    } finally {
      setBatchSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    const ok = await confirm({
      title: `Delete “${name}”?`,
      consequence: 'It disappears from every App that serves your skills.',
      confirmLabel: 'Delete skill',
    });
    if (!ok) return;
    try {
      await api.delete(`/skills/${id}`);
      setSkills((prev) => prev.filter((s) => s._id !== id));
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      setSuccessMsg(`Skill "${name}" deleted.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not delete the skill.'));
    }
  };

  const handleToggleFeatured = async (skill) => {
    try {
      const updated = { ...skill, featured: !skill.featured };
      const res = await api.put(`/skills/${skill._id}`, updated);
      setSkills((prev) => prev.map((s) => (s._id === skill._id ? res.data : s)));
    } catch {
      setErrorMsg('Could not update the featured flag.');
    }
  };

  const featuredCount = skills.filter((s) => s.featured).length;
  const selectedSkills = skills.filter((s) => selectedIds.includes(s._id));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-t-border">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-3xl text-t-text">Skills</h1>
            <span className="text-sm text-t-muted">
              {skills.length} {skills.length === 1 ? 'skill' : 'skills'}, {featuredCount} featured
            </span>
          </div>
          <p className="text-sm text-t-muted mt-2 max-w-prose">
            What you work with, grouped by category. Featured skills can be highlighted on your site.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={openBulkModal}
              className={`inline-flex min-h-9 items-center gap-1.5 px-3 py-2 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-xs transition-all shadow-sm cursor-pointer ${focusRing}`}
            >
              <Edit2 size={14} aria-hidden="true" />
              <span>Edit selected ({selectedIds.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => openAddModal(activeCategory)}
            className={`inline-flex min-h-9 items-center gap-2 px-3.5 py-2 rounded bg-t-accent2 hover:opacity-90 text-t-on-accent2 font-semibold text-xs transition-all shadow-sm cursor-pointer ${focusRing}`}
          >
            <Plus size={15} aria-hidden="true" />
            <span>Add a skill</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div role="status" className="p-3 rounded bg-t-accent2-dim border border-t-accent2/50 text-t-text text-sm flex items-center gap-2">
          <CheckCircle size={15} aria-hidden="true" className="shrink-0 text-t-accent2" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div role="alert" className="p-3 rounded bg-t-danger-dim border border-t-danger/50 text-t-danger text-sm flex items-center gap-2">
          <AlertCircle size={15} aria-hidden="true" className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <datalist id="skill-category-options">{categoryOptions.map((c) => <option key={c} value={c} />)}</datalist>

      {/* Quick batch entry */}
      <div className="p-4 rounded bg-t-surface border border-t-border">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Tag size={14} aria-hidden="true" className="text-t-accent2" />
          <h2 className="text-sm font-semibold text-t-text">Add several skills at once</h2>
          <span className="text-xs text-t-muted">(separate with commas)</span>
        </div>
        <form onSubmit={handleBatchSubmit} onKeyDown={submitKeepingVisibility} className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
          <div className="sm:w-56">
            <label htmlFor={fid('batch-category')} className="sr-only">Category</label>
            <input
              id={fid('batch-category')}
              list="skill-category-options"
              required
              maxLength={CATEGORY_MAX}
              value={batchCategory}
              onChange={(e) => setBatchCategory(e.target.value)}
              placeholder="Category, e.g. Frontend"
              autoComplete="off"
              className={fieldClass}
            />
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor={fid('batch-names')} className="sr-only">Skill names, separated by commas</label>
            <input
              id={fid('batch-names')}
              type="text"
              value={batchInput}
              onChange={(e) => setBatchInput(e.target.value)}
              placeholder="e.g. Kubernetes, Ansible, Terraform, Nginx"
              className={fieldClass}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              name="visibility"
              value="draft"
              disabled={batchSaving || !batchInput.trim()}
              className={`min-h-9 px-3 py-2 rounded border border-t-border-hi text-t-text font-semibold text-xs hover:bg-t-surface-hi disabled:opacity-40 ${focusRing}`}
            >
              Add as drafts
            </button>
            <button
              type="submit"
              name="visibility"
              value="published"
              disabled={batchSaving || !batchInput.trim()}
              className={`min-h-9 px-4 py-2 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-xs shadow-sm disabled:opacity-40 ${focusRing}`}
            >
              {batchSaving ? 'Adding…' : 'Add and publish'}
            </button>
          </div>
        </form>
      </div>

      {/* Search and category filter */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div role="group" aria-label="Filter by category" className="flex flex-wrap gap-1 bg-t-surface p-1 rounded border border-t-border">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                aria-pressed={activeCategory === cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded text-xs transition-all cursor-pointer ${focusRing} ${
                  activeCategory === cat
                    ? 'bg-t-accent text-t-on-accent font-semibold shadow-sm'
                    : 'text-t-muted hover:text-t-text hover:bg-t-surface-hi'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} aria-hidden="true" className="absolute left-3 top-2.5 text-t-dim" />
            <label htmlFor={fid('search')} className="sr-only">Search skills</label>
            <input
              id={fid('search')}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search skills…"
              className="w-full pl-9 pr-3 py-1.5 rounded bg-t-bg border border-t-border-hi text-t-text text-sm focus:border-t-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-t-accent/40"
            />
          </div>
        </div>

        {/* Selection bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 py-2 rounded bg-t-surface border border-t-border">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              aria-pressed={isAllFilteredSelected ? true : isSomeFilteredSelected ? 'mixed' : false}
              className={`flex items-center gap-2 rounded text-xs text-t-muted hover:text-t-text cursor-pointer select-none ${focusRing}`}
            >
              {isAllFilteredSelected ? (
                <CheckSquare size={16} aria-hidden="true" className="text-t-accent" />
              ) : isSomeFilteredSelected ? (
                <span aria-hidden="true" className="w-4 h-4 rounded bg-t-accent flex items-center justify-center text-t-on-accent"><Minus size={12} /></span>
              ) : (
                <Square size={16} aria-hidden="true" className="text-t-dim" />
              )}
              <span>
                {isAllFilteredSelected
                  ? 'Deselect all shown'
                  : `Select all shown (${filteredSkills.length})`}
              </span>
            </button>

            {selectedIds.length > 0 && (
              <span className="text-xs text-t-accent ml-2 pl-2 border-l border-t-border-hi">
                {selectedIds.length} {selectedIds.length === 1 ? 'skill' : 'skills'} selected
              </span>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={openBulkModal}
                disabled={bulkSaving}
                className={`inline-flex min-h-8 items-center gap-1.5 px-2.5 py-1 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent text-xs font-semibold shadow transition-all cursor-pointer ${focusRing}`}
              >
                <Edit2 size={12} aria-hidden="true" />
                <span>Edit selected ({selectedIds.length})</span>
              </button>

              <button
                type="button"
                onClick={() => handleBulkFeatureToggle(true)}
                disabled={bulkSaving}
                aria-label="Feature the selected skills"
                title="Feature the selected skills"
                className={`inline-flex min-h-8 items-center gap-1 px-2 py-1 rounded bg-t-accent2-dim text-t-text border border-t-accent2/30 text-xs transition-all cursor-pointer ${focusRing}`}
              >
                <Star size={12} aria-hidden="true" className="fill-current text-t-accent2" />
                <span className="hidden sm:inline">Feature</span>
              </button>

              <button
                type="button"
                onClick={() => handleBulkFeatureToggle(false)}
                disabled={bulkSaving}
                className={`inline-flex min-h-8 items-center gap-1 px-2 py-1 rounded bg-t-surface-hi text-t-muted border border-t-border-hi text-xs transition-all cursor-pointer ${focusRing}`}
              >
                <span>Unfeature</span>
              </button>

              <button
                type="button"
                onClick={handleBulkPublish}
                disabled={bulkSaving}
                className={`inline-flex min-h-8 items-center gap-1 px-2 py-1 rounded bg-t-accent2-dim text-t-text border border-t-accent2/30 text-xs transition-all cursor-pointer ${focusRing}`}
              >
                <span>Publish</span>
              </button>

              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkSaving}
                aria-label="Delete the selected skills"
                title="Delete the selected skills"
                className={`inline-flex min-h-8 items-center gap-1 px-2 py-1 rounded bg-t-danger-dim text-t-danger border border-t-danger/30 text-xs transition-all cursor-pointer ${focusRing}`}
              >
                <Trash2 size={12} aria-hidden="true" />
                <span className="hidden sm:inline">Delete</span>
              </button>

              <button
                type="button"
                onClick={clearSelection}
                aria-label="Clear selection"
                title="Clear selection"
                className={`p-1.5 rounded text-t-muted hover:text-t-text cursor-pointer ml-1 ${focusRing}`}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Skills grid */}
      {loading ? (
        <ListSkeleton label="Loading skills" />
      ) : skills.length === 0 ? (
        <EmptyState title="No skills yet" hint="Add a few above, separated by commas. “Add and publish” makes them visible to your Apps straight away." />
      ) : filteredSkills.length === 0 ? (
        <EmptyState title="No skills match" hint="Adjust the category or search filters to see more." />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSkills.map((skill) => {
            const isSelected = selectedIds.includes(skill._id);
            const checkboxId = fid(`select-${skill._id}`);
            return (
              <li
                key={skill._id}
                className={`p-3 rounded border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-t-surface-hi border-t-accent shadow-md shadow-t-accent/10'
                    : 'bg-t-surface border-t-border hover:border-t-accent/50'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectSkill(skill._id)}
                        className="mt-1 w-4 h-4 rounded accent-t-accent cursor-pointer"
                      />
                      <label htmlFor={checkboxId} className="flex-1 min-w-0 cursor-pointer select-none">
                        <span className="text-sm font-semibold text-t-text block truncate">{skill.name}</span>
                        <span className="text-xs text-t-muted">{skill.category}</span>
                      </label>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleFeatured(skill)}
                      aria-pressed={Boolean(skill.featured)}
                      aria-label={`Featured: ${skill.name}`}
                      title={skill.featured ? 'Featured. Click to unfeature' : 'Click to feature'}
                      className={`p-1.5 rounded transition-colors cursor-pointer ${focusRing} ${
                        skill.featured ? 'text-t-accent2' : 'text-t-dim hover:text-t-muted'
                      }`}
                    >
                      <Star size={15} aria-hidden="true" className={skill.featured ? 'fill-current' : ''} />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs pl-6">
                    <span className="px-2 py-0.5 rounded bg-t-bg border border-t-border-hi text-t-text">
                      {skill.proficiency}
                    </span>
                    <span className="text-t-muted">
                      {skill.yearsOfExperience} {skill.yearsOfExperience === 1 ? 'year' : 'years'}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-t-border flex flex-wrap items-center justify-between gap-2 pl-6">
                  <span className="text-xs text-t-muted">
                    {skill.featured ? 'Featured' : 'Not featured'} · {skill.visibility === 'published' ? 'Published' : 'Draft'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleVisibilityToggle(skill)}
                      aria-label={`${skill.visibility === 'published' ? 'Unpublish' : 'Publish'} ${skill.name}`}
                      className={`px-1.5 py-1 text-xs border border-t-border-hi rounded text-t-muted hover:text-t-accent cursor-pointer ${focusRing}`}
                    >
                      {skill.visibility === 'published' ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(skill)}
                      aria-label={`Edit ${skill.name}`}
                      title="Edit"
                      className={`p-1.5 rounded text-t-muted hover:text-t-text transition-colors cursor-pointer ${focusRing}`}
                    >
                      <Edit2 size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(skill._id, skill.name)}
                      aria-label={`Delete ${skill.name}`}
                      title="Delete"
                      className={`p-1.5 rounded text-t-danger hover:bg-t-danger-dim transition-colors cursor-pointer ${focusRing}`}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Edit several skills */}
      {showBulkModal && (
        <Modal
          title={`Edit ${selectedIds.length} selected ${selectedIds.length === 1 ? 'skill' : 'skills'}`}
          description="Change one field across all of them, or edit each one in a table."
          icon={Edit2}
          size="lg"
          onClose={() => setShowBulkModal(false)}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className={`min-h-9 px-3.5 py-1.5 rounded text-sm font-semibold text-t-muted hover:text-t-text hover:bg-t-surface-hi cursor-pointer ${focusRing}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                form={fid('bulk-form')}
                disabled={bulkSaving || selectedIds.length === 0}
                className={`inline-flex min-h-9 items-center gap-1.5 px-4 py-1.5 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-sm shadow cursor-pointer disabled:opacity-50 ${focusRing}`}
              >
                <Save size={13} aria-hidden="true" />
                <span>{bulkSaving ? 'Saving…' : `Save ${selectedIds.length} ${selectedIds.length === 1 ? 'skill' : 'skills'}`}</span>
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div role="group" aria-label="Editing mode" className="flex flex-wrap items-center border-b border-t-border">
              <button
                type="button"
                aria-pressed={bulkTab === 'batch'}
                onClick={() => setBulkTab('batch')}
                className={`-mb-px flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-all cursor-pointer ${focusRing} ${
                  bulkTab === 'batch' ? 'border-t-accent font-semibold text-t-text' : 'border-transparent text-t-muted hover:text-t-text'
                }`}
              >
                <SlidersHorizontal size={13} aria-hidden="true" />
                <span>Set a field for all</span>
              </button>
              <button
                type="button"
                aria-pressed={bulkTab === 'table'}
                onClick={() => setBulkTab('table')}
                className={`-mb-px flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-all cursor-pointer ${focusRing} ${
                  bulkTab === 'table' ? 'border-t-accent font-semibold text-t-text' : 'border-transparent text-t-muted hover:text-t-text'
                }`}
              >
                <ListChecks size={13} aria-hidden="true" />
                <span>Edit as a table</span>
              </button>
            </div>

            <div className="rounded border border-t-border bg-t-bg/60 p-3">
              <p className="text-xs text-t-muted mb-1.5">Selected skills</p>
              <ul className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                {selectedSkills.map((skill) => (
                  <li key={skill._id} className="inline-flex items-center gap-1 pl-2 rounded bg-t-surface-hi border border-t-border-hi text-t-text text-xs">
                    <span>{skill.name}</span>
                    <button
                      type="button"
                      onClick={() => removeSkillFromBulk(skill._id)}
                      aria-label={`Remove ${skill.name} from the selection`}
                      className={`px-1.5 py-0.5 rounded text-t-muted hover:text-t-danger cursor-pointer ${focusRing}`}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <form id={fid('bulk-form')} onSubmit={handleBulkSubmit} className="space-y-4">
              {bulkTab === 'batch' ? (
                <div className="space-y-4">
                  <p className="text-sm text-t-muted">
                    Only the fields you set change. Anything left on “Keep” stays as it is on each skill.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor={fid('bulk-category')} className={labelClass}>Category</label>
                      <input
                        id={fid('bulk-category')}
                        list="skill-category-options"
                        maxLength={CATEGORY_MAX}
                        value={bulkCategory}
                        onChange={(e) => setBulkCategory(e.target.value)}
                        placeholder="Keep each skill’s category"
                        autoComplete="off"
                        className={fieldClass}
                      />
                    </div>

                    <div>
                      <label htmlFor={fid('bulk-proficiency')} className={labelClass}>Proficiency</label>
                      <select
                        id={fid('bulk-proficiency')}
                        value={bulkProficiency}
                        onChange={(e) => setBulkProficiency(e.target.value)}
                        className={fieldClass}
                      >
                        <option value="KEEP">Keep each skill’s proficiency</option>
                        {PROFICIENCIES.map((lvl) => (
                          <option key={lvl} value={lvl}>Set to {lvl}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={fid('bulk-apply-years')}
                          checked={bulkApplyExp}
                          onChange={(e) => setBulkApplyExp(e.target.checked)}
                          className="w-4 h-4 rounded accent-t-accent cursor-pointer"
                        />
                        <label htmlFor={fid('bulk-apply-years')} className="text-xs font-medium text-t-muted cursor-pointer">
                          Set years of experience
                        </label>
                      </div>
                      <label htmlFor={fid('bulk-years')} className="sr-only">Years of experience</label>
                      <input
                        id={fid('bulk-years')}
                        type="number"
                        min="0"
                        step="0.5"
                        disabled={!bulkApplyExp}
                        value={bulkExpValue}
                        onChange={(e) => setBulkExpValue(parseFloat(e.target.value) || 0)}
                        placeholder="e.g. 2.5"
                        className={`${fieldClass} disabled:opacity-40 disabled:bg-t-surface-hi`}
                      />
                    </div>

                    <div>
                      <label htmlFor={fid('bulk-featured')} className={labelClass}>Featured</label>
                      <select
                        id={fid('bulk-featured')}
                        value={bulkFeatured}
                        onChange={(e) => setBulkFeatured(e.target.value)}
                        className={fieldClass}
                      >
                        <option value="KEEP">Keep each skill’s setting</option>
                        <option value="FEATURE">Feature all</option>
                        <option value="UNFEATURE">Unfeature all</option>
                      </select>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-t-muted">Edit each selected skill side by side.</p>

                  <ul className="space-y-2">
                    {editableSkills.map((item) => (
                      <li key={item._id} className="p-3 rounded bg-t-bg border border-t-border text-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                          <div className="sm:col-span-4">
                            <label htmlFor={fid(`row-name-${item._id}`)} className={labelClass}>Name</label>
                            <input
                              id={fid(`row-name-${item._id}`)}
                              type="text"
                              required
                              maxLength={NAME_MAX}
                              value={item.name}
                              onChange={(e) => handleEditableSkillChange(item._id, 'name', e.target.value)}
                              className={fieldClass}
                            />
                          </div>

                          <div className="sm:col-span-3">
                            <label htmlFor={fid(`row-category-${item._id}`)} className={labelClass}>Category</label>
                            <input
                              id={fid(`row-category-${item._id}`)}
                              list="skill-category-options"
                              required
                              maxLength={CATEGORY_MAX}
                              value={item.category}
                              onChange={(e) => handleEditableSkillChange(item._id, 'category', e.target.value)}
                              autoComplete="off"
                              className={fieldClass}
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label htmlFor={fid(`row-proficiency-${item._id}`)} className={labelClass}>Proficiency</label>
                            <select
                              id={fid(`row-proficiency-${item._id}`)}
                              value={item.proficiency}
                              onChange={(e) => handleEditableSkillChange(item._id, 'proficiency', e.target.value)}
                              className={fieldClass}
                            >
                              {PROFICIENCIES.map((lvl) => (
                                <option key={lvl} value={lvl}>{lvl}</option>
                              ))}
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <label htmlFor={fid(`row-years-${item._id}`)} className={labelClass}>Years</label>
                            <input
                              id={fid(`row-years-${item._id}`)}
                              type="number"
                              min="0"
                              step="0.5"
                              value={item.yearsOfExperience}
                              onChange={(e) => handleEditableSkillChange(item._id, 'yearsOfExperience', parseFloat(e.target.value) || 0)}
                              className={fieldClass}
                            />
                          </div>

                          <div className="sm:col-span-1 flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditableSkillChange(item._id, 'featured', !item.featured)}
                              aria-pressed={Boolean(item.featured)}
                              aria-label={`Featured: ${item.name}`}
                              title={item.featured ? 'Featured' : 'Not featured'}
                              className={`p-1.5 rounded transition-all cursor-pointer ${focusRing} ${
                                item.featured ? 'text-t-accent2 bg-t-accent2-dim' : 'text-t-dim hover:text-t-muted'
                              }`}
                            >
                              <Star size={14} aria-hidden="true" className={item.featured ? 'fill-current' : ''} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeSkillFromBulk(item._id)}
                              aria-label={`Remove ${item.name} from the selection`}
                              title="Remove from the selection"
                              className={`p-1.5 rounded text-t-dim hover:text-t-danger cursor-pointer ${focusRing}`}
                            >
                              <X size={13} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </form>
          </div>
        </Modal>
      )}

      {/* Add or edit one skill */}
      {showModal && (
        <Modal
          title={editingId ? 'Edit skill' : 'Add a skill'}
          description={editingId ? (editingVisibility === 'published' ? 'Published: Apps serve it now. Pressing Enter saves it and keeps it published.' : 'Draft: no App can see it yet.') : undefined}
          size="sm"
          onClose={() => setShowModal(false)}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className={`min-h-9 px-3.5 py-1.5 rounded text-sm font-semibold text-t-muted hover:text-t-text hover:bg-t-surface-hi cursor-pointer ${focusRing}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                form={fid('skill-form')}
                name="visibility"
                value="draft"
                disabled={modalSaving}
                className={`min-h-9 px-3.5 py-1.5 rounded border border-t-border-hi text-sm font-semibold text-t-text hover:bg-t-surface-hi disabled:opacity-50 ${focusRing}`}
              >
                Save as draft
              </button>
              <button
                type="submit"
                form={fid('skill-form')}
                name="visibility"
                value="published"
                disabled={modalSaving}
                className={`inline-flex min-h-9 items-center gap-1.5 px-4 py-1.5 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-sm shadow disabled:opacity-50 ${focusRing}`}
              >
                <Save size={13} aria-hidden="true" />
                <span>{modalSaving ? 'Saving…' : 'Save and publish'}</span>
              </button>
            </div>
          }
        >
          <form id={fid('skill-form')} onSubmit={handleModalSubmit} onKeyDown={submitKeepingVisibility} className="space-y-4">
            <div>
              <label htmlFor={fid('skill-name')} className={labelClass}>Name *</label>
              <input
                id={fid('skill-name')}
                type="text"
                required
                maxLength={NAME_MAX}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Docker"
                className={fieldClass}
              />
            </div>

            <div>
              <label htmlFor={fid('skill-category')} className={labelClass}>Category *</label>
              <input
                id={fid('skill-category')}
                list="skill-category-options"
                required
                maxLength={CATEGORY_MAX}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Frontend"
                autoComplete="off"
                className={fieldClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={fid('skill-proficiency')} className={labelClass}>Proficiency</label>
                <select
                  id={fid('skill-proficiency')}
                  value={form.proficiency}
                  onChange={(e) => setForm({ ...form, proficiency: e.target.value })}
                  className={fieldClass}
                >
                  {PROFICIENCIES.map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={fid('skill-years')} className={labelClass}>Years of experience</label>
                <input
                  id={fid('skill-years')}
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.yearsOfExperience}
                  onChange={(e) => setForm({ ...form, yearsOfExperience: parseFloat(e.target.value) || 0 })}
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id={fid('skill-featured')}
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                className="w-4 h-4 rounded accent-t-accent"
              />
              <label htmlFor={fid('skill-featured')} className="text-sm text-t-muted cursor-pointer">
                Featured (Apps can ask for featured skills only)
              </label>
            </div>
          </form>
        </Modal>
      )}

      {confirmDialog}
    </div>
  );
}

