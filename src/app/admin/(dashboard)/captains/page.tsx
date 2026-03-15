'use client';

import { useState, useEffect, useCallback } from 'react';

interface Captain {
  teamID: number;
  teamName: string;
  bowlerID: number;
  bowlerName: string;
  email: string | null;
}

export default function CaptainsPage() {
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline edit state
  const [editingBowlerID, setEditingBowlerID] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/captains');
      const data = await res.json();
      if (data.captains) setCaptains(data.captains);
    } catch {
      setError('Failed to load captains');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(c: Captain) {
    setEditingBowlerID(c.bowlerID);
    setEditEmail(c.email ?? '');
  }

  function cancelEdit() {
    setEditingBowlerID(null);
    setEditEmail('');
  }

  async function handleSave(bowlerID: number) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/captains', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bowlerID, email: editEmail.trim() }),
      });
      if (!res.ok) throw new Error('Save failed');
      setEditingBowlerID(null);
      await load();
    } catch {
      setError('Failed to save email');
    } finally {
      setSaving(false);
    }
  }

  const withEmail = captains.filter((c) => c.email);
  const withoutEmail = captains.filter((c) => !c.email);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl text-navy">Captains</h1>
        <span className="font-body text-xs text-navy/50">
          {withEmail.length}/{captains.length} have email
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red/10 text-red rounded-md font-body text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="font-body text-sm text-navy/50">Loading...</p>
      ) : captains.length === 0 ? (
        <p className="font-body text-sm text-navy/50">
          No team captains assigned. Set captainBowlerID on teams first.
        </p>
      ) : (
        <div className="space-y-2">
          {/* Missing email first */}
          {withoutEmail.length > 0 && (
            <p className="font-body text-xs text-red/70 font-semibold uppercase tracking-wider pt-2 pb-1">
              Missing Email
            </p>
          )}
          {withoutEmail.map((c) => (
            <CaptainRow
              key={c.bowlerID}
              captain={c}
              editing={editingBowlerID === c.bowlerID}
              editEmail={editEmail}
              saving={saving}
              onStartEdit={() => startEdit(c)}
              onCancel={cancelEdit}
              onEmailChange={setEditEmail}
              onSave={() => handleSave(c.bowlerID)}
            />
          ))}

          {withoutEmail.length > 0 && withEmail.length > 0 && (
            <div className="border-t border-navy/10 my-3" />
          )}

          {withEmail.map((c) => (
            <CaptainRow
              key={c.bowlerID}
              captain={c}
              editing={editingBowlerID === c.bowlerID}
              editEmail={editEmail}
              saving={saving}
              onStartEdit={() => startEdit(c)}
              onCancel={cancelEdit}
              onEmailChange={setEditEmail}
              onSave={() => handleSave(c.bowlerID)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CaptainRow({
  captain,
  editing,
  editEmail,
  saving,
  onStartEdit,
  onCancel,
  onEmailChange,
  onSave,
}: {
  captain: Captain;
  editing: boolean;
  editEmail: string;
  saving: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onEmailChange: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-4 p-3 bg-white rounded-lg border border-navy/10">
      <div className="w-40 shrink-0">
        <p className="font-body text-sm font-semibold text-navy truncate">
          {captain.teamName}
        </p>
        <p className="font-body text-xs text-navy/50 truncate">{captain.bowlerName}</p>
      </div>

      {editing ? (
        <div className="flex-1 flex items-center gap-2">
          <input
            type="email"
            value={editEmail}
            onChange={(e) => onEmailChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSave()}
            className="flex-1 px-2 py-1.5 border border-navy/20 rounded font-body text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            autoFocus
          />
          <button
            onClick={onSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-body font-semibold bg-navy text-cream rounded hover:bg-navy/90 transition-colors disabled:opacity-50"
          >
            {saving ? '...' : 'Save'}
          </button>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-body text-navy/50 hover:text-navy transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-between min-w-0">
          <span
            className={`font-body text-sm truncate ${
              captain.email ? 'text-navy/70' : 'text-red/50 italic'
            }`}
          >
            {captain.email || 'No email'}
          </span>
          <button
            onClick={onStartEdit}
            className="shrink-0 px-3 py-1.5 text-xs font-body font-semibold text-navy/70 border border-navy/20 rounded hover:bg-navy/5 transition-colors ml-2"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
