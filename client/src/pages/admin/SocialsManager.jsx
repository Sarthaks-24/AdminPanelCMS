import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import {
  Share2,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Star,
  ChevronUp,
  ChevronDown,
  X,
  Save,
} from 'lucide-react';

const PLATFORMS = [
  { name: 'GitHub', icon: 'github' },
  { name: 'LinkedIn', icon: 'linkedin' },
  { name: 'X / Twitter', icon: 'twitter' },
  { name: 'LeetCode', icon: 'code' },
  { name: 'Discord', icon: 'message-square' },
  { name: 'Email', icon: 'mail' },
  { name: 'Portfolio', icon: 'globe' },
  { name: 'Custom', icon: 'link' },
];

export default function SocialsManager() {
  const [socials, setSocials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const [form, setForm] = useState({
    platform: 'GitHub',
    label: '',
    url: '',
    username: '',
    icon: 'github',
    order: 0,
    featured: true,
  });

  const fetchSocials = async () => {
    try {
      const res = await api.get('/socials');
      setSocials(res.data || []);
    } catch (err) {
      setErrorMsg('Failed to load social profiles: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSocials();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setForm({
      platform: 'GitHub',
      label: '',
      url: '',
      username: '',
      icon: 'github',
      order: socials.length,
      featured: true,
    });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingId(item._id);
    setForm({
      platform: item.platform,
      label: item.label,
      url: item.url,
      username: item.username || '',
      icon: item.icon || 'link',
      order: item.order ?? 0,
      featured: item.featured ?? true,
    });
    setShowModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (editingId) {
        const res = await api.put(`/socials/${editingId}`, form);
        setSocials((prev) => prev.map((s) => (s._id === editingId ? res.data : s)));
        setSuccessMsg('Social link updated successfully.');
      } else {
        const res = await api.post('/socials', form);
        setSocials((prev) => [...prev, res.data].sort((a, b) => a.order - b.order));
        setSuccessMsg('New social link registered.');
      }
      setShowModal(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error saving social link');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Permanently remove social coordinate "${name}"?`)) return;
    try {
      await api.delete(`/socials/${id}`);
      setSocials((prev) => prev.filter((s) => s._id !== id));
      setSuccessMsg('Social coordinate removed.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error deleting social link');
    }
  };

  const handleToggleFeatured = async (item) => {
    try {
      const updated = { ...item, featured: !item.featured };
      const res = await api.put(`/socials/${item._id}`, updated);
      setSocials((prev) => prev.map((s) => (s._id === item._id ? res.data : s)));
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error updating featured flag');
    }
  };

  const moveOrder = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= socials.length) return;

    const copy = [...socials];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;

    // Update orders
    const payload = copy.map((item, i) => ({ id: item._id, order: i }));
    setSocials(copy.map((item, i) => ({ ...item, order: i })));

    try {
      await api.patch('/socials/reorder', { items: payload });
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Reorder failed');
      fetchSocials(); // Revert on error
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1a2333]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-[#090d15] text-[#0078d4] border border-[#1a2333]">
              <Share2 size={20} />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Social Media &amp; Developer Coordinates</h1>
            <span className="px-2 py-0.5 rounded bg-[#0f141f] text-[11px] font-mono text-slate-300 border border-[#1e293b]">
              {socials.length}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            External platform links, developer handles, and spotlight contact coordinates.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded bg-[#0078d4] hover:bg-[#1e90ff] text-white font-semibold text-xs transition-all shadow-sm cursor-pointer"
        >
          <Plus size={15} />
          <span>Add Social Link</span>
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

      {/* Table / Card List */}
      <div className="rounded bg-[#070a10] border border-[#1a2333] overflow-hidden">
        <div className="p-3.5 border-b border-[#1a2333] flex items-center justify-between bg-black">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
            Registered Coordinates
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Sorted by Execution Order
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-[#0078d4] animate-pulse">
            Querying social link graph...
          </div>
        ) : socials.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-slate-500">
            No social coordinates defined. Click "Add Social Link" to initialize.
          </div>
        ) : (
          <div className="divide-y divide-[#1a2333]">
            {socials.map((item, idx) => (
              <div
                key={item._id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#0c1018] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => moveOrder(idx, -1)}
                      disabled={idx === 0}
                      className="text-slate-500 hover:text-[#0078d4] disabled:opacity-20 cursor-pointer"
                      title="Move up"
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      onClick={() => moveOrder(idx, 1)}
                      disabled={idx === socials.length - 1}
                      className="text-slate-500 hover:text-[#0078d4] disabled:opacity-20 cursor-pointer"
                      title="Move down"
                    >
                      <ChevronDown size={13} />
                    </button>
                  </div>

                  <div className="w-8 h-8 rounded bg-black border border-[#1e293b] flex items-center justify-center font-mono font-bold text-xs text-[#0078d4]">
                    {item.platform.substring(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{item.platform}</span>
                      {item.featured && (
                        <span className="px-1.5 py-0.2 rounded bg-[#0d2a1d] text-[#10b981] border border-[#10b981]/30 text-[10px] font-mono">
                          ★ spotlight
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                      <span>{item.label}</span>
                      {item.username && <span className="text-slate-500">({item.username})</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 sm:justify-end pl-11 sm:pl-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-mono text-[#0078d4] hover:text-[#1e90ff] flex items-center gap-1 truncate max-w-[200px]"
                    title={item.url}
                  >
                    <span className="truncate">{item.url}</span>
                    <ExternalLink size={11} className="shrink-0" />
                  </a>

                  <div className="flex items-center gap-1 border-l border-[#1a2333] pl-3">
                    <button
                      onClick={() => handleToggleFeatured(item)}
                      className={`p-1.5 rounded transition-all cursor-pointer ${
                        item.featured
                          ? 'text-[#10b981] hover:bg-[#062419]'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-[#111827]'
                      }`}
                      title={item.featured ? 'Remove from spotlight' : 'Add to spotlight'}
                    >
                      <Star size={14} className={item.featured ? 'fill-current' : ''} />
                    </button>
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#111827] transition-all cursor-pointer"
                      title="Edit"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(item._id, item.platform)}
                      className="p-1.5 rounded text-red-400 hover:text-white hover:bg-red-950 transition-all cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded bg-[#090d15] border border-[#1a2333] shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-[#1a2333] flex items-center justify-between bg-black">
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                {editingId ? 'Edit Social Coordinate' : 'Register New Social Coordinate'}
              </span>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Platform *</label>
                  <select
                    value={form.platform}
                    onChange={(e) => {
                      const plat = e.target.value;
                      const match = PLATFORMS.find((p) => p.name === plat);
                      setForm((prev) => ({
                        ...prev,
                        platform: plat,
                        icon: match?.icon || 'link',
                      }));
                    }}
                    className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Icon Key</label>
                  <input
                    type="text"
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    placeholder="e.g. github, linkedin, mail"
                    className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs font-mono focus:border-[#0078d4] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Display Label *</label>
                <input
                  type="text"
                  required
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g. github.com/username"
                  className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">Destination URL *</label>
                <input
                  type="url"
                  required
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://github.com/username"
                  className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs font-mono focus:border-[#0078d4] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Username / Handle</label>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="username"
                    className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs focus:border-[#0078d4] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">Display Order</label>
                  <input
                    type="number"
                    value={form.order}
                    onChange={(e) => setForm({ ...form, order: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 rounded bg-black border border-[#1e293b] text-white text-xs font-mono focus:border-[#0078d4] outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="featuredToggle"
                  checked={form.featured}
                  onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                  className="w-4 h-4 rounded bg-black border-[#1e293b] text-[#10b981] focus:ring-[#10b981]"
                />
                <label htmlFor="featuredToggle" className="text-xs text-slate-300 cursor-pointer">
                  Feature in spotlight and top-tier contact coordinates
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
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#10b981] hover:bg-[#059669] text-black font-semibold text-xs shadow cursor-pointer disabled:opacity-50"
                >
                  <Save size={13} />
                  <span>{saving ? 'Saving...' : 'Save Coordinate'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
