'use client';

import { useState, useEffect, useCallback } from 'react';

interface Announcement {
  id: number;
  message: string;
  type: 'info' | 'urgent' | 'celebration';
  expires: string | null;
  createdAt: string;
}

const TYPE_OPTIONS = [
  { value: 'info', label: 'Info', color: 'bg-amber-100 text-amber-800' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red/20 text-red' },
  { value: 'celebration', label: 'Celebration', color: 'bg-gold/30 text-navy' },
] as const;

function typeBadge(type: string) {
  const opt = TYPE_OPTIONS.find((t) => t.value === type) ?? TYPE_OPTIONS[0];
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${opt.color}`}>
      {opt.label}
    </span>
  );
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'urgent' | 'celebration'>('info');
  const [expires, setExpires] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/evillair/announcements');
      const data = await res.json();
      if (data.announcements) setAnnouncements(data.announcements);
    } catch {
      setError('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setEditingId(null);
    setMessage('');
    setType('info');
    setExpires('');
  }

  function startEdit(a: Announcement) {
    setEditingId(a.id);
    setMessage(a.message);
    setType(a.type);
    setExpires(a.expires ?? '');
  }

  async function handleSave() {
    if (!message.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await fetch('/api/evillair/announcements', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            message: message.trim(),
            type,
            expires: expires || null,
          }),
        });
      } else {
        await fetch('/api/evillair/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: message.trim(),
            type,
            expires: expires || null,
          }),
        });
      }
      resetForm();
      await load();
    } catch {
      setError('Failed to save announcement');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this announcement?')) return;
    try {
      await fetch('/api/evillair/announcements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (editingId === id) resetForm();
      await load();
    } catch {
      setError('Failed to delete announcement');
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-3xl">
      <h1 className="font-heading text-2xl text-navy mb-6">Announcements</h1>

      {/* Form */}
      <div className="bg-white rounded-lg border border-navy/10 p-5 mb-8">
        <h2 className="font-heading text-sm text-navy/60 uppercase tracking-wider mb-4">
          {editingId ? 'Edit Announcement' : 'New Announcement'}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block font-body text-sm text-navy/70 mb-1">Message</label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Snow makeup date scheduled for April 13th"
              className="w-full px-3 py-2 border border-navy/20 rounded-md font-body text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              maxLength={500}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block font-body text-sm text-navy/70 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className="w-full px-3 py-2 border border-navy/20 rounded-md font-body text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block font-body text-sm text-navy/70 mb-1">
                Expires (optional)
              </label>
              <input
                type="date"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
                className="w-full px-3 py-2 border border-navy/20 rounded-md font-body text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !message.trim()}
              className="px-4 py-2 bg-navy text-cream rounded-md font-body text-sm font-semibold hover:bg-navy/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update' : 'Add Announcement'}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className="px-4 py-2 border border-navy/20 rounded-md font-body text-sm text-navy/70 hover:bg-navy/5 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red/10 text-red rounded-md font-body text-sm">
          {error}
        </div>
      )}

      {/* List */}
      {loading ? (
        <p className="font-body text-sm text-navy/50">Loading...</p>
      ) : announcements.length === 0 ? (
        <p className="font-body text-sm text-navy/50">No announcements yet.</p>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => {
            const isExpired = a.expires && a.expires <= today;
            return (
              <div
                key={a.id}
                className={`flex items-start gap-4 p-4 bg-white rounded-lg border border-navy/10 ${
                  isExpired ? 'opacity-50' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {typeBadge(a.type)}
                    {isExpired && (
                      <span className="text-xs font-body text-navy/40">Expired</span>
                    )}
                  </div>
                  <p className="font-body text-sm text-navy">{a.message}</p>
                  <p className="font-body text-xs text-navy/40 mt-1">
                    {a.expires ? `Expires ${a.expires}` : 'No expiry'}
                    {' · '}
                    Created {new Date(a.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(a)}
                    className="px-3 py-1.5 text-xs font-body font-semibold text-navy/70 border border-navy/20 rounded hover:bg-navy/5 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className="px-3 py-1.5 text-xs font-body font-semibold text-red border border-red/20 rounded hover:bg-red/5 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
