'use client';

import { useState, useEffect, useCallback } from 'react';

interface SiteUpdate {
  id: number;
  date: string;
  text: string;
  tag: 'fix' | 'feat';
  href?: string;
}

interface Suggestion {
  date: string;
  text: string;
  tag: string;
  sha: string;
  selected?: boolean;
}

export default function AdminUpdatesPage() {
  const [updates, setUpdates] = useState<SiteUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  // New entry form
  const [showAdd, setShowAdd] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newText, setNewText] = useState('');
  const [newTag, setNewTag] = useState<'feat' | 'fix'>('feat');
  const [newHref, setNewHref] = useState('');
  const [adding, setAdding] = useState(false);

  // Suggestions
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [addingSuggestions, setAddingSuggestions] = useState(false);

  // Inline editing
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTag, setEditTag] = useState<'feat' | 'fix'>('feat');
  const [editHref, setEditHref] = useState('');

  const loadUpdates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/updates');
      if (!res.ok) throw new Error('Failed to load updates');
      const data = await res.json();
      setUpdates(data.updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUpdates();
  }, [loadUpdates]);

  async function handleAdd() {
    if (!newText.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newDate, text: newText.trim(), tag: newTag, ...(newHref.trim() ? { href: newHref.trim() } : {}) }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to add');
      }
      setNewText('');
      setNewHref('');
      setShowAdd(false);
      await loadUpdates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/updates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setUpdates((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  }

  function startEdit(u: SiteUpdate) {
    setEditingId(u.id);
    setEditText(u.text);
    setEditDate(u.date);
    setEditTag(u.tag);
    setEditHref(u.href ?? '');
  }

  async function saveEdit() {
    if (editingId === null) return;
    setSaving(editingId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/updates/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: editDate, text: editText.trim(), tag: editTag, href: editHref.trim() || null }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setEditingId(null);
      await loadUpdates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(null);
    }
  }

  async function loadSuggestions() {
    setSuggestLoading(true);
    setError(null);
    try {
      const since = updates[0]?.date || '';
      const res = await fetch(`/api/admin/updates/suggest?since=${since}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to load suggestions');
      }
      const data = await res.json();
      setSuggestions(data.suggestions.map((s: Suggestion) => ({ ...s, selected: false })));
      setShowSuggestions(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suggestions');
    } finally {
      setSuggestLoading(false);
    }
  }

  function toggleSuggestion(idx: number) {
    setSuggestions((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, selected: !s.selected } : s)),
    );
  }

  function selectAllSuggestions() {
    const allSelected = suggestions.every((s) => s.selected);
    setSuggestions((prev) => prev.map((s) => ({ ...s, selected: !allSelected })));
  }

  async function addSelectedSuggestions() {
    const selected = suggestions.filter((s) => s.selected);
    if (selected.length === 0) return;
    setAddingSuggestions(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: selected.map((s) => ({ date: s.date, text: s.text, tag: s.tag })),
        }),
      });
      if (!res.ok) throw new Error('Failed to add suggestions');
      // Remove added suggestions from the list
      setSuggestions((prev) => prev.filter((s) => !s.selected));
      await loadUpdates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAddingSuggestions(false);
    }
  }

  // Group updates by date for display
  const groupedUpdates: Array<{ date: string; items: SiteUpdate[] }> = [];
  for (const u of updates) {
    const last = groupedUpdates[groupedUpdates.length - 1];
    if (last && last.date === u.date) {
      last.items.push(u);
    } else {
      groupedUpdates.push({ date: u.date, items: [u] });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="font-body text-navy/50">Loading updates...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl text-navy">Site Updates</h1>
          <p className="font-body text-sm text-navy/50 mt-1">
            {updates.length} entries
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadSuggestions}
            disabled={suggestLoading}
            className="px-4 py-2 rounded-lg font-body text-sm bg-navy/10 text-navy hover:bg-navy/20 transition-colors disabled:opacity-50"
          >
            {suggestLoading ? 'Loading...' : 'Suggest from Commits'}
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="px-4 py-2 rounded-lg font-body text-sm bg-red text-white hover:bg-red/90 transition-colors"
          >
            Add Update
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red/10 text-red font-body text-sm">
          {error}
        </div>
      )}

      {/* Suggestions Panel */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="mb-6 rounded-lg border border-navy/10 bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-navy/10 flex items-center justify-between">
            <div>
              <h2 className="font-heading text-sm text-navy">
                Commit Suggestions
              </h2>
              <p className="font-body text-xs text-navy/50 mt-0.5">
                {suggestions.filter((s) => s.selected).length} of {suggestions.length} selected
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={selectAllSuggestions}
                className="px-3 py-1.5 rounded-md font-body text-xs bg-navy/5 text-navy/70 hover:bg-navy/10 transition-colors"
              >
                {suggestions.every((s) => s.selected) ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={addSelectedSuggestions}
                disabled={addingSuggestions || suggestions.filter((s) => s.selected).length === 0}
                className="px-3 py-1.5 rounded-md font-body text-xs bg-navy text-cream hover:bg-navy/90 transition-colors disabled:opacity-50"
              >
                {addingSuggestions ? 'Adding...' : 'Add Selected'}
              </button>
              <button
                onClick={() => setShowSuggestions(false)}
                className="px-3 py-1.5 rounded-md font-body text-xs text-navy/50 hover:text-navy transition-colors"
              >
                Close
              </button>
            </div>
          </div>
          <div className="divide-y divide-navy/5 max-h-96 overflow-y-auto">
            {suggestions.map((s, idx) => (
              <label
                key={idx}
                className={`flex items-start gap-3 px-5 py-3 cursor-pointer hover:bg-navy/[0.02] transition-colors ${
                  s.selected ? 'bg-navy/[0.04]' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={s.selected || false}
                  onChange={() => toggleSuggestion(idx)}
                  className="mt-1 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className={`font-body text-xs font-medium uppercase tracking-wide shrink-0 ${
                      s.tag === 'fix' ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {s.tag}
                    </span>
                    <span className="font-body text-xs text-navy/40 shrink-0">{s.date}</span>
                    <span className="font-mono text-xs text-navy/30 shrink-0">{s.sha}</span>
                  </div>
                  <p className="font-body text-sm text-navy mt-0.5">{s.text}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {showSuggestions && suggestions.length === 0 && !suggestLoading && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-navy/5 font-body text-sm text-navy/60">
          No new commits found since the last update ({updates[0]?.date || 'unknown'}).
        </div>
      )}

      {/* Add Form */}
      {showAdd && (
        <div className="mb-6 p-4 rounded-lg border border-navy/10 bg-white shadow-sm">
          <h3 className="font-heading text-sm text-navy mb-3">New Update</h3>
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="block font-body text-xs text-navy/60 mb-1">Date</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="px-3 py-2 rounded-md border border-navy/20 font-body text-sm"
              />
            </div>
            <div>
              <label className="block font-body text-xs text-navy/60 mb-1">Tag</label>
              <select
                value={newTag}
                onChange={(e) => setNewTag(e.target.value as 'feat' | 'fix')}
                className="px-3 py-2 rounded-md border border-navy/20 font-body text-sm"
              >
                <option value="feat">feat</option>
                <option value="fix">fix</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block font-body text-xs text-navy/60 mb-1">Description</label>
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="What changed?"
                className="w-full px-3 py-2 rounded-md border border-navy/20 font-body text-sm focus:outline-none focus:border-navy/40"
              />
            </div>
            <div className="w-[140px]">
              <label className="block font-body text-xs text-navy/60 mb-1">Link (optional)</label>
              <input
                type="text"
                value={newHref}
                onChange={(e) => setNewHref(e.target.value)}
                placeholder="/bowlers"
                className="w-full px-3 py-2 rounded-md border border-navy/20 font-body text-sm focus:outline-none focus:border-navy/40"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={adding || !newText.trim()}
              className="px-4 py-2 rounded-lg font-body text-sm bg-navy text-cream hover:bg-navy/90 transition-colors disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Add'}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 rounded-lg font-body text-sm text-navy/50 hover:text-navy transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Updates List */}
      {groupedUpdates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-navy/10">
          <p className="font-body text-navy/50 mb-4">No updates yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedUpdates.map((group) => (
            <div
              key={group.date}
              className="rounded-lg border border-navy/10 bg-white overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-navy/5 bg-navy/[0.02]">
                <span className="font-body text-sm font-medium text-navy">
                  {new Date(group.date + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span className="font-body text-xs text-navy/40 ml-2">
                  {group.items.length} {group.items.length === 1 ? 'entry' : 'entries'}
                </span>
              </div>
              <div className="divide-y divide-navy/5">
                {group.items.map((u) =>
                  editingId === u.id ? (
                    <div key={u.id} className="px-5 py-3 bg-navy/[0.02]">
                      <div className="flex gap-3 items-end flex-wrap">
                        <div>
                          <label className="block font-body text-xs text-navy/60 mb-1">Date</label>
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="px-2 py-1.5 rounded-md border border-navy/20 font-body text-sm"
                          />
                        </div>
                        <div>
                          <label className="block font-body text-xs text-navy/60 mb-1">Tag</label>
                          <select
                            value={editTag}
                            onChange={(e) => setEditTag(e.target.value as 'feat' | 'fix')}
                            className="px-2 py-1.5 rounded-md border border-navy/20 font-body text-sm"
                          >
                            <option value="feat">feat</option>
                            <option value="fix">fix</option>
                          </select>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                          <label className="block font-body text-xs text-navy/60 mb-1">Text</label>
                          <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                            className="w-full px-2 py-1.5 rounded-md border border-navy/20 font-body text-sm focus:outline-none focus:border-navy/40"
                          />
                        </div>
                        <div className="w-[140px]">
                          <label className="block font-body text-xs text-navy/60 mb-1">Link</label>
                          <input
                            type="text"
                            value={editHref}
                            onChange={(e) => setEditHref(e.target.value)}
                            placeholder="/bowlers"
                            className="w-full px-2 py-1.5 rounded-md border border-navy/20 font-body text-sm focus:outline-none focus:border-navy/40"
                          />
                        </div>
                        <button
                          onClick={saveEdit}
                          disabled={saving === u.id}
                          className="px-3 py-1.5 rounded-md font-body text-xs bg-navy text-cream hover:bg-navy/90 transition-colors disabled:opacity-50"
                        >
                          {saving === u.id ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-md font-body text-xs text-navy/50 hover:text-navy transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={u.id}
                      className="flex items-center gap-3 px-5 py-3 group hover:bg-navy/[0.02] transition-colors"
                    >
                      <span
                        className={`font-body text-xs font-medium uppercase tracking-wide shrink-0 w-8 ${
                          u.tag === 'fix' ? 'text-amber-600' : 'text-green-600'
                        }`}
                      >
                        {u.tag}
                      </span>
                      <span className="font-body text-sm text-navy flex-1">
                        {u.text}
                        {u.href && <span className="text-navy/30 ml-1.5 text-xs">{u.href}</span>}
                      </span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => startEdit(u)}
                          className="px-2 py-1 rounded font-body text-xs text-navy/50 hover:text-navy hover:bg-navy/5 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(u.id)}
                          disabled={deleting === u.id}
                          className="px-2 py-1 rounded font-body text-xs text-red/50 hover:text-red hover:bg-red/5 transition-colors disabled:opacity-50"
                        >
                          {deleting === u.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
