'use client';

import { useState, useEffect, useCallback } from 'react';

interface TeamCaptain {
  teamID: number;
  teamName: string;
  captainBowlerID: number | null;
  captainName: string | null;
  captainEmail: string | null;
}

interface Bowler {
  bowlerID: number;
  bowlerName: string;
}

export default function CaptainsPage() {
  const [teams, setTeams] = useState<TeamCaptain[]>([]);
  const [bowlers, setBowlers] = useState<Bowler[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline edit state
  const [editingTeamID, setEditingTeamID] = useState<number | null>(null);
  const [editBowlerID, setEditBowlerID] = useState<number | ''>('');
  const [editEmail, setEditEmail] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/captains');
      const data = await res.json();
      if (data.teams) setTeams(data.teams);
      if (data.bowlers) setBowlers(data.bowlers);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(t: TeamCaptain) {
    setEditingTeamID(t.teamID);
    setEditBowlerID(t.captainBowlerID ?? '');
    setEditEmail(t.captainEmail ?? '');
  }

  function cancelEdit() {
    setEditingTeamID(null);
    setEditBowlerID('');
    setEditEmail('');
  }

  // When bowler selection changes, auto-fill their email if they have one
  function handleBowlerChange(bowlerID: number | '') {
    setEditBowlerID(bowlerID);
    if (bowlerID) {
      // Check if this bowler already has an email from another team's captain entry
      const existing = teams.find(
        (t) => t.captainBowlerID === bowlerID && t.captainEmail,
      );
      if (existing) {
        setEditEmail(existing.captainEmail!);
      }
    }
  }

  async function handleSave(teamID: number) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/captains', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamID,
          bowlerID: editBowlerID || null,
          email: editEmail.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      cancelEdit();
      await load();
    } catch {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const withCaptain = teams.filter((t) => t.captainBowlerID);
  const withoutCaptain = teams.filter((t) => !t.captainBowlerID);
  const withEmail = withCaptain.filter((t) => t.captainEmail);

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl text-navy">Captains</h1>
        <span className="font-body text-xs text-navy/50">
          {withCaptain.length}/{teams.length} assigned, {withEmail.length} with email
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red/10 text-red rounded-md font-body text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="font-body text-sm text-navy/50">Loading...</p>
      ) : (
        <div className="space-y-2">
          {/* Teams without captains first */}
          {withoutCaptain.length > 0 && (
            <p className="font-body text-xs text-red/70 font-semibold uppercase tracking-wider pt-2 pb-1">
              No Captain Assigned
            </p>
          )}
          {withoutCaptain.map((t) => (
            <CaptainRow
              key={t.teamID}
              team={t}
              bowlers={bowlers}
              editing={editingTeamID === t.teamID}
              editBowlerID={editBowlerID}
              editEmail={editEmail}
              saving={saving}
              onStartEdit={() => startEdit(t)}
              onCancel={cancelEdit}
              onBowlerChange={handleBowlerChange}
              onEmailChange={setEditEmail}
              onSave={() => handleSave(t.teamID)}
            />
          ))}

          {withoutCaptain.length > 0 && withCaptain.length > 0 && (
            <div className="border-t border-navy/10 my-3" />
          )}

          {withCaptain.map((t) => (
            <CaptainRow
              key={t.teamID}
              team={t}
              bowlers={bowlers}
              editing={editingTeamID === t.teamID}
              editBowlerID={editBowlerID}
              editEmail={editEmail}
              saving={saving}
              onStartEdit={() => startEdit(t)}
              onCancel={cancelEdit}
              onBowlerChange={handleBowlerChange}
              onEmailChange={setEditEmail}
              onSave={() => handleSave(t.teamID)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CaptainRow({
  team,
  bowlers,
  editing,
  editBowlerID,
  editEmail,
  saving,
  onStartEdit,
  onCancel,
  onBowlerChange,
  onEmailChange,
  onSave,
}: {
  team: TeamCaptain;
  bowlers: Bowler[];
  editing: boolean;
  editBowlerID: number | '';
  editEmail: string;
  saving: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onBowlerChange: (id: number | '') => void;
  onEmailChange: (v: string) => void;
  onSave: () => void;
}) {
  if (editing) {
    return (
      <div className="p-4 bg-white rounded-lg border border-navy/20">
        <p className="font-body text-sm font-semibold text-navy mb-3">
          {team.teamName}
        </p>
        <div className="space-y-3">
          <div>
            <label className="block font-body text-xs text-navy/50 mb-1">Captain</label>
            <select
              value={editBowlerID}
              onChange={(e) =>
                onBowlerChange(e.target.value ? Number(e.target.value) : '')
              }
              className="w-full px-2 py-1.5 border border-navy/20 rounded font-body text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            >
              <option value="">None</option>
              {bowlers.map((b) => (
                <option key={b.bowlerID} value={b.bowlerID}>
                  {b.bowlerName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-body text-xs text-navy/50 mb-1">Email</label>
            <input
              type="email"
              value={editEmail}
              onChange={(e) => onEmailChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSave()}
              placeholder="captain@email.com"
              className="w-full px-2 py-1.5 border border-navy/20 rounded font-body text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>
          <div className="flex gap-2">
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
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 p-3 bg-white rounded-lg border border-navy/10">
      <div className="w-36 shrink-0">
        <p className="font-body text-sm font-semibold text-navy truncate">
          {team.teamName}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        {team.captainName ? (
          <p className="font-body text-sm text-navy/70 truncate">
            {team.captainName}
            {team.captainEmail && (
              <span className="text-navy/40"> &middot; {team.captainEmail}</span>
            )}
            {!team.captainEmail && (
              <span className="text-red/50 italic"> &middot; no email</span>
            )}
          </p>
        ) : (
          <p className="font-body text-sm text-red/50 italic">No captain</p>
        )}
      </div>
      <button
        onClick={onStartEdit}
        className="shrink-0 px-3 py-1.5 text-xs font-body font-semibold text-navy/70 border border-navy/20 rounded hover:bg-navy/5 transition-colors"
      >
        Edit
      </button>
    </div>
  );
}
