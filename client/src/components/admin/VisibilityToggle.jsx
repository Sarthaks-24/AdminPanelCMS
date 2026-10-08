import React, { useState } from 'react';
import { api } from '../../api/client';

export default function VisibilityToggle({ endpoint, item, onChange }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const visibility = item.visibility || 'draft';

  const toggle = async () => {
    setSaving(true);
    setError('');
    try {
      const next = visibility === 'published' ? 'draft' : 'published';
      const response = await api.put(`${endpoint}/${item._id}`, { visibility: next });
      onChange(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Visibility update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start">
      <button
        type="button"
        disabled={saving}
        onClick={toggle}
        className="px-2 py-1 rounded border border-t-border-hi text-[10px] uppercase font-mono text-t-muted hover:text-t-accent disabled:opacity-50"
        title={`Move to ${visibility === 'published' ? 'draft' : 'published'}`}
      >
        {saving ? 'Saving…' : visibility === 'published' ? 'Published' : 'Draft · Publish'}
      </button>
      {error && <span role="alert" className="text-[9px] text-t-danger">{error}</span>}
    </span>
  );
}
