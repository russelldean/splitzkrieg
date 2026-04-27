'use client';

import { useState, useEffect, useCallback } from 'react';

interface Bowler {
  bowlerID: number;
  bowlerName: string;
  isActive: boolean;
  establishedAvg: number | null;
  currentAvg: number | null;
  handicap: number | null;
}

export default function BowlersPage() {
  const [bowlers, setBowlers] = useState<Bowler[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // New bowler form
  const [newName, setNewName] = useState('');
  const [newGender, setNewGender] = useState('');
  const [newAvg, setNewAvg] = useState('');
  const [saving, setSaving] = useState(false);

  // Inline edit state
  const [editingID, setEditingID] = useState<number | null>(null);
  const [editAvg, setEditAvg] = useState('');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadBowlers = useCallback(async () => {
    try {
      const res = await fetch('/api/evillair/bowlers?all=1');
      const data = await res.json();
      if (data.bowlers) setBowlers(data.bowlers);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBowlers();
  }, [loadBowlers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch('/api/evillair/bowlers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bowlerName: name,
          gender: newGender || undefined,
          establishedAvg: newAvg ? parseInt(newAvg, 10) : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ text: data.error || 'Failed to create bowler', type: 'error' });
      } else {
        setMessage({ text: `Created ${data.bowlerName} (ID: ${data.bowlerID})`, type: 'success' });
        setNewName('');
        setNewGender('');
        setNewAvg('');
        loadBowlers();
      }
    } catch {
      setMessage({ text: 'Network error', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAvg(bowlerID: number) {
    const val = editAvg.trim() === '' ? null : parseInt(editAvg, 10);
    try {
      const res = await fetch('/api/evillair/bowlers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bowlerID, establishedAvg: val }),
      });
      if (res.ok) {
        setEditingID(null);
        loadBowlers();
      } else {
        const data = await res.json();
        setMessage({ text: data.error || 'Failed to update', type: 'error' });
      }
    } catch {
      setMessage({ text: 'Network error', type: 'error' });
    }
  }

  const filtered = search.trim()
    ? bowlers.filter((b) => b.bowlerName.toLowerCase().includes(search.toLowerCase()))
    : bowlers;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="font-heading text-2xl text-navy mb-6">Bowlers</h1>

      {/* Add New Bowler */}
      <div className="bg-white rounded-lg shadow-sm border border-navy/10 p-5 mb-6">
        <h2 className="font-heading text-sm text-navy mb-3">Add New Bowler</h2>
        <form onSubmit={handleCreate} className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block font-body text-xs text-navy/60 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="First Last"
              required
              className="w-full px-3 py-2 font-body text-sm border border-navy/20 rounded bg-white text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
          </div>
          <div>
            <label className="block font-body text-xs text-navy/60 mb-1">
              Gender
            </label>
            <select
              value={newGender}
              onChange={(e) => setNewGender(e.target.value)}
              className="px-3 py-2 font-body text-sm border border-navy/20 rounded bg-white text-navy"
            >
              <option value="">--</option>
              <option value="M">M</option>
              <option value="F">F</option>
            </select>
          </div>
          <div>
            <label className="block font-body text-xs text-navy/60 mb-1">
              Avg (optional)
            </label>
            <input
              type="number"
              value={newAvg}
              onChange={(e) => setNewAvg(e.target.value)}
              placeholder="--"
              min={0}
              max={300}
              className="w-20 px-3 py-2 font-body text-sm border border-navy/20 rounded bg-white text-navy text-center placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-navy/20"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !newName.trim()}
            className="px-4 py-2 bg-navy text-cream font-body text-sm rounded hover:bg-navy/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </form>

        {message && (
          <p className={`mt-3 font-body text-sm ${message.type === 'success' ? 'text-green-700' : 'text-red'}`}>
            {message.text}
          </p>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search bowlers..."
          className="w-full px-3 py-2 font-body text-sm border border-navy/20 rounded bg-white text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-navy/20"
        />
      </div>

      {/* Bowler List */}
      {loading ? (
        <div className="flex items-center gap-2 py-10 justify-center">
          <div className="w-4 h-4 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
          <span className="font-body text-sm text-navy/60">Loading...</span>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-navy/10 overflow-hidden">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-navy/40 border-b border-navy/10 bg-navy/5">
                <th className="text-left py-2 px-4">Name</th>
                <th className="text-center py-2 px-4 w-20">ID</th>
                <th className="text-center py-2 px-4 w-20">Avg</th>
                <th className="text-center py-2 px-4 w-20">HCP</th>
                <th className="text-center py-2 px-4 w-24">Est. Avg</th>
                <th className="text-center py-2 px-4 w-20">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.bowlerID} className="border-b border-navy/5">
                  <td className="py-2 px-4 text-navy">{b.bowlerName}</td>
                  <td className="py-2 px-4 text-center text-navy/40">{b.bowlerID}</td>
                  <td className="py-2 px-4 text-center text-navy font-medium">
                    {b.currentAvg != null ? b.currentAvg : <span className="text-navy/30">--</span>}
                  </td>
                  <td className="py-2 px-4 text-center text-navy font-medium">
                    {b.handicap != null ? b.handicap : <span className="text-navy/30">--</span>}
                  </td>
                  <td className="py-2 px-4 text-center">
                    {editingID === b.bowlerID ? (
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          value={editAvg}
                          onChange={(e) => setEditAvg(e.target.value)}
                          min={0}
                          max={300}
                          className="w-16 px-1 py-0.5 text-xs text-center border border-navy/20 rounded focus:outline-none focus:ring-1 focus:ring-navy/30"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveAvg(b.bowlerID);
                            if (e.key === 'Escape') setEditingID(null);
                          }}
                        />
                        <button
                          onClick={() => handleSaveAvg(b.bowlerID)}
                          className="px-1.5 py-0.5 text-[10px] font-semibold bg-navy text-cream rounded hover:bg-navy/90 transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingID(null)}
                          className="px-1.5 py-0.5 text-[10px] text-navy/40 hover:text-navy transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingID(b.bowlerID);
                          setEditAvg(b.establishedAvg != null ? String(b.establishedAvg) : '');
                        }}
                        className="text-navy/60 hover:text-navy transition-colors"
                        title="Click to edit average"
                      >
                        {b.establishedAvg != null ? b.establishedAvg : '--'}
                      </button>
                    )}
                  </td>
                  <td className="py-2 px-4 text-center">
                    <span className={`text-xs font-semibold ${b.isActive ? 'text-green-700' : 'text-navy/30'}`}>
                      {b.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-navy/40">
                    No bowlers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-navy/5 border-t border-navy/10">
            <p className="font-body text-xs text-navy/40">
              {filtered.length} bowler{filtered.length !== 1 ? 's' : ''}
              {search && ` matching "${search}"`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
