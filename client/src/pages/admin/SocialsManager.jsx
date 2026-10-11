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
  Star,
  ChevronUp,
  ChevronDown,
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

const labelClass = 'block text-sm font-medium text-t-text mb-1';
const inputClass = 'w-full px-3 py-2 rounded bg-t-bg border border-t-border-hi text-t-text text-sm placeholder:text-t-dim focus:border-t-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-t-accent/30';
const hintClass = 'mt-1 block text-xs text-t-muted';
const iconButton = 'p-1.5 rounded transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent';

const EMPTY = {
  platform: 'GitHub',
  label: '',
  url: '',
  username: '',
  icon: 'github',
  order: 0,
  featured: true,
};

export default function SocialsManager() {
  const [socials, setSocials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingVisibility, setEditingVisibility] = useState('published');
  const [showModal, setShowModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [confirm, confirmDialog] = useConfirm();
  const uid = useId();
  const fieldId = (name) => `${uid}-${name}`;
  const formId = `${uid}-form`;

  const fetchSocials = async () => {
    try {
      const res = await api.get('/socials');
      setSocials(res.data || []);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not load your links.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSocials();
  }, []);

  const openAddModal = () => {
    setEditingId(null);
    setEditingVisibility('published');
    setForm({ ...EMPTY, order: socials.length });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingId(item._id);
    setEditingVisibility(currentVisibility(item));
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

    // Enter keeps the link's current visibility; only the two buttons change it.
    const visibility = chosenVisibility(e, editingId ? editingVisibility : 'draft');
    const payload = { ...form, visibility };
    if (payload.platform?.toLowerCase() === 'email') {
      if (payload.url && !payload.url.startsWith('mailto:') && !payload.url.startsWith('http')) {
        payload.url = `mailto:${payload.url.trim()}`;
      }
      if (!payload.username && payload.label) {
        payload.username = payload.label.split('@')[0];
      }
    }

    try {
      if (editingId) {
        const res = await api.put(`/socials/${editingId}`, payload);
        setSocials((prev) => prev.map((s) => (s._id === editingId ? res.data : s)));
        setSuccessMsg(`Link saved${visibility === 'draft' ? ' as a draft' : ''}.`);
      } else {
        const res = await api.post('/socials', payload);
        setSocials((prev) => [...prev, res.data].sort((a, b) => a.order - b.order));
        setSuccessMsg(`Link added${visibility === 'draft' ? ' as a draft' : ''}.`);
      }
      setShowModal(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not save the link.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    const ok = await confirm({
      title: 'Delete this link?',
      consequence: `Your ${name} link is removed from your links and from every App that serves it.`,
      confirmLabel: 'Delete link',
    });
    if (!ok) return;
    try {
      await api.delete(`/socials/${id}`);
      setSocials((prev) => prev.filter((s) => s._id !== id));
      setSuccessMsg('Link deleted.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not delete the link.'));
    }
  };

  const handleToggleFeatured = async (item) => {
    try {
      const updated = { ...item, featured: !item.featured };
      const res = await api.put(`/socials/${item._id}`, updated);
      setSocials((prev) => prev.map((s) => (s._id === item._id ? res.data : s)));
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not change whether the link is featured.'));
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
      setErrorMsg(apiErrorMessage(err, 'Could not save the new order.'));
      fetchSocials(); // Revert on error
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-t-border">
        <div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-3xl text-t-text">Links</h1>
            <span className="text-sm text-t-muted">
              {socials.length} {socials.length === 1 ? 'link' : 'links'}
            </span>
          </div>
          <p className="text-sm text-t-muted mt-2 max-w-prose">
            Where people can find you: profiles, handles and your contact email. Apps only serve published links.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded bg-t-accent hover:bg-t-accent-br text-t-on-accent font-semibold text-sm transition-all shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent focus-visible:ring-offset-2 focus-visible:ring-offset-t-bg"
        >
          <Plus size={15} aria-hidden="true" />
          <span>Add a link</span>
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

      {/* List */}
      <div className="rounded bg-t-surface border border-t-border overflow-hidden">
        <div className="p-3.5 border-b border-t-border flex flex-wrap items-center justify-between gap-2 bg-t-bg">
          <h2 className="text-sm font-semibold text-t-text">Your links</h2>
          <span className="text-xs text-t-muted">
            In the order Apps receive them
          </span>
        </div>

        {loading ? (
          <ListSkeleton label="Loading links" />
        ) : socials.length === 0 ? (
          <EmptyState title="No links yet" hint="Use “Add a link” to add your first profile." />
        ) : (
          <div className="divide-y divide-t-border">
            {socials.map((item, idx) => (
              <div
                key={item._id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-t-surface transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveOrder(idx, -1)}
                      disabled={idx === 0}
                      className="rounded text-t-dim hover:text-t-accent disabled:opacity-20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent"
                      aria-label={`Move ${item.platform} up`}
                    >
                      <ChevronUp size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveOrder(idx, 1)}
                      disabled={idx === socials.length - 1}
                      className="rounded text-t-dim hover:text-t-accent disabled:opacity-20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent"
                      aria-label={`Move ${item.platform} down`}
                    >
                      <ChevronDown size={15} aria-hidden="true" />
                    </button>
                  </div>

                  <div aria-hidden="true" className="w-8 h-8 shrink-0 rounded bg-t-bg border border-t-border-hi flex items-center justify-center font-bold text-xs text-t-accent">
                    {item.platform.substring(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-t-text">{item.platform}</span>
                      {item.featured && (
                        <span className="px-1.5 rounded bg-t-accent2-dim text-t-accent2 border border-t-accent2/30 text-xs">
                          Featured
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-t-muted mt-0.5">
                      <span className="break-all">{item.label}</span>
                      {item.username && <span className="text-t-dim">({item.username})</span>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 sm:justify-end pl-11 sm:pl-0">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded text-xs text-t-accent hover:text-t-accent-br flex items-center gap-1 truncate max-w-[200px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-t-accent"
                    title={item.url}
                  >
                    <span className="truncate">{item.url}</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                    <ExternalLink size={11} className="shrink-0" aria-hidden="true" />
                  </a>

                  <div className="flex items-center gap-1 border-l border-t-border pl-3">
                    <VisibilityToggle endpoint="/socials" item={item} onChange={(updated) => setSocials((prev) => prev.map((x) => x._id === updated._id ? updated : x))} />
                    <button
                      type="button"
                      onClick={() => handleToggleFeatured(item)}
                      aria-pressed={Boolean(item.featured)}
                      className={`${iconButton} ${
                        item.featured
                          ? 'text-t-accent2 hover:bg-t-accent2-dim'
                          : 'text-t-dim hover:text-t-muted hover:bg-t-surface-hi'
                      }`}
                      aria-label={`Featured: ${item.platform}`}
                      title={item.featured ? 'Unfeature' : 'Feature'}
                    >
                      <Star size={14} className={item.featured ? 'fill-current' : ''} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className={`${iconButton} text-t-muted hover:text-t-text hover:bg-t-surface-hi`}
                      aria-label={`Edit ${item.platform} link`}
                    >
                      <Edit2 size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item._id, item.platform)}
                      className={`${iconButton} text-t-danger hover:text-t-text hover:bg-t-danger-dim`}
                      aria-label={`Delete ${item.platform} link`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit dialog */}
      {showModal && (
        <Modal
          title={editingId ? 'Edit link' : 'Add a link'}
          description={editingId
            ? (editingVisibility === 'published' ? 'Published: Apps serve this link now. Enter saves and keeps it published.' : 'Draft: no App can see it yet.')
            : 'A profile, handle or contact address.'}
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
          <form id={formId} onSubmit={handleFormSubmit} onKeyDown={submitKeepingVisibility} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={fieldId('platform')} className={labelClass}>Platform *</label>
                <select
                  id={fieldId('platform')}
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
                  className={inputClass}
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={fieldId('icon')} className={labelClass}>Icon name</label>
                <input
                  id={fieldId('icon')}
                  type="text"
                  maxLength={40}
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  aria-describedby={fieldId('icon-hint')}
                  placeholder="e.g. github, linkedin, mail"
                  className={inputClass}
                />
                <span id={fieldId('icon-hint')} className={hintClass}>A name your site’s icon set can resolve.</span>
              </div>
            </div>

            <div>
              <label htmlFor={fieldId('label')} className={labelClass}>Label *</label>
              <input
                id={fieldId('label')}
                type="text"
                required
                maxLength={500}
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder={form.platform === 'Email' ? 'you@example.com' : 'e.g. github.com/username'}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor={fieldId('url')} className={labelClass}>
                {form.platform === 'Email' ? 'Email address or link *' : 'Link *'}
              </label>
              <input
                id={fieldId('url')}
                type={form.platform === 'Email' ? 'text' : 'url'}
                required
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder={form.platform === 'Email' ? 'mailto:you@example.com or you@example.com' : 'https://github.com/username'}
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={fieldId('username')} className={labelClass}>Username</label>
                <input
                  id={fieldId('username')}
                  type="text"
                  maxLength={80}
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="username"
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

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id={fieldId('featured')}
                checked={form.featured}
                onChange={(e) => setForm({ ...form, featured: e.target.checked })}
                className="w-4 h-4 rounded accent-t-accent"
              />
              <label htmlFor={fieldId('featured')} className="text-sm text-t-text cursor-pointer">
                Featured
              </label>
            </div>
          </form>
        </Modal>
      )}

      {confirmDialog}
    </div>
  );
}
