'use client';

import { useEffect, useState, useCallback } from 'react';
import type { LineupSubmission, LineupEntry } from '@/lib/admin/types';

interface Team {
  teamID: number;
  teamName: string;
}

interface LineupData {
  lineups: LineupSubmission[];
  teams: Team[];
}

interface EditEntry {
  position: number;
  bowlerID: number | null;
  newBowlerName: string | null;
}

export default function AdminLineupsPage() {
  const [seasonID, setSeasonID] = useState<number>(0);
  const [week, setWeek] = useState<number>(1);
  const [data, setData] = useState<LineupData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [editingSubmission, setEditingSubmission] =
    useState<LineupSubmission | null>(null);
  const [editEntries, setEditEntries] = useState<EditEntry[]>([]);
  const [magicLinkModal, setMagicLinkModal] = useState<Team | null>(null);
  const [magicLinkForm, setMagicLinkForm] = useState({
    captainName: '',
    captainEmail: '',
  });
  const [pushModal, setPushModal] = useState(false);
  const [lpCookie, setLpCookie] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Load initial context
  useEffect(() => {
    async function loadContext() {
      try {
        const res = await fetch('/api/admin/lineups?seasonID=0&week=0');
        if (res.status === 401) {
          window.location.href = '/admin/login';
          return;
        }
        // We need the season ID. Grab from a separate endpoint or default.
        // For now, load from context - the GET will return empty data
        // but we can extract team info.
      } catch {
        // ignore initial load error
      }
    }
    loadContext();
  }, []);

  const loadLineups = useCallback(async () => {
    if (!seasonID || !week) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/lineups?seasonID=${seasonID}&week=${week}`,
      );
      if (!res.ok) throw new Error('Failed to load lineups');
      const result: LineupData = await res.json();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load lineups',
      );
    } finally {
      setLoading(false);
    }
  }, [seasonID, week]);

  useEffect(() => {
    if (seasonID && week) loadLineups();
  }, [seasonID, week, loadLineups]);

  const getTeamSubmission = (teamID: number): LineupSubmission | undefined => {
    return data?.lineups.find((l) => l.teamID === teamID);
  };

  const statusColor = (status: string | undefined) => {
    switch (status) {
      case 'submitted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'edited':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pushed':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  const handleEdit = (submission: LineupSubmission) => {
    setEditingSubmission(submission);
    setEditEntries(
      submission.entries.map((e) => ({
        position: e.position,
        bowlerID: e.bowlerID,
        newBowlerName: e.newBowlerName,
      })),
    );
  };

  const saveEdit = async () => {
    if (!editingSubmission) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/lineups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionID: editingSubmission.id,
          entries: editEntries,
        }),
      });
      if (!res.ok) throw new Error('Failed to save edit');
      setEditingSubmission(null);
      await loadLineups();
      setActionMessage('Lineup updated successfully');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setActionLoading(false);
    }
  };

  const sendMagicLink = async () => {
    if (!magicLinkModal) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamID: magicLinkModal.teamID,
          captainName: magicLinkForm.captainName,
          captainEmail: magicLinkForm.captainEmail,
        }),
      });
      if (!res.ok) throw new Error('Failed to send magic link');
      setMagicLinkModal(null);
      setMagicLinkForm({ captainName: '', captainEmail: '' });
      setActionMessage('Magic link sent!');
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send magic link',
      );
    } finally {
      setActionLoading(false);
    }
  };

  const pushToLP = async () => {
    if (!lpCookie.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/lineups/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookie: lpCookie,
          seasonID,
          week,
        }),
      });
      if (!res.ok) throw new Error('Failed to push lineups');
      const result = await res.json();
      setPushModal(false);
      setLpCookie('');
      await loadLineups();
      const msg =
        result.errors.length > 0
          ? `Pushed ${result.pushed} lineups. Errors: ${result.errors.join(', ')}`
          : `Pushed ${result.pushed} lineups to LeaguePals!`;
      setActionMessage(msg);
      setTimeout(() => setActionMessage(null), 8000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to push lineups',
      );
    } finally {
      setActionLoading(false);
    }
  };

  const submittedCount = data?.lineups.length || 0;
  const totalTeams = data?.teams.length || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl text-navy">Lineups</h1>
        {data && (
          <button
            onClick={() => setPushModal(true)}
            disabled={submittedCount === 0}
            className="bg-navy text-cream font-body text-sm px-4 py-2 rounded-md hover:bg-navy/90 disabled:opacity-40 transition-colors"
          >
            Push to LeaguePals
          </button>
        )}
      </div>

      {/* Season/Week Selectors */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="font-body text-xs text-navy/50 block mb-1">
            Season ID
          </label>
          <input
            type="number"
            value={seasonID || ''}
            onChange={(e) => setSeasonID(parseInt(e.target.value, 10) || 0)}
            placeholder="e.g. 35"
            className="font-body text-sm border border-navy/20 rounded-md px-3 py-2 w-28 focus:outline-none focus:ring-2 focus:ring-navy/20"
          />
        </div>
        <div>
          <label className="font-body text-xs text-navy/50 block mb-1">
            Week
          </label>
          <input
            type="number"
            value={week || ''}
            onChange={(e) => setWeek(parseInt(e.target.value, 10) || 0)}
            min={1}
            className="font-body text-sm border border-navy/20 rounded-md px-3 py-2 w-20 focus:outline-none focus:ring-2 focus:ring-navy/20"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={loadLineups}
            disabled={loading || !seasonID || !week}
            className="bg-navy/10 text-navy font-body text-sm px-4 py-2 rounded-md hover:bg-navy/20 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Loading...' : 'Load'}
          </button>
        </div>
      </div>

      {/* Action messages */}
      {actionMessage && (
        <div className="bg-green-50 text-green-700 rounded-md px-4 py-3 mb-4 font-body text-sm">
          {actionMessage}
        </div>
      )}
      {error && (
        <div className="bg-red-50 text-red-700 rounded-md px-4 py-3 mb-4 font-body text-sm">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline text-xs"
          >
            dismiss
          </button>
        </div>
      )}

      {/* Summary */}
      {data && (
        <p className="font-body text-sm text-navy/60 mb-4">
          {submittedCount} of {totalTeams} teams submitted
        </p>
      )}

      {/* Team Grid */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.teams.map((team) => {
            const submission = getTeamSubmission(team.teamID);
            return (
              <div
                key={team.teamID}
                className={`rounded-lg border p-4 ${statusColor(submission?.status)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-body font-semibold text-sm">
                    {team.teamName}
                  </h3>
                  <span className="font-body text-xs uppercase tracking-wide">
                    {submission?.status || 'pending'}
                  </span>
                </div>

                {submission ? (
                  <div>
                    <p className="font-body text-xs mb-2">
                      by {submission.submittedBy || 'Unknown'} at{' '}
                      {new Date(submission.submittedAt).toLocaleString()}
                    </p>
                    <ul className="font-body text-xs space-y-0.5 mb-3">
                      {submission.entries.map((entry: LineupEntry) => (
                        <li key={entry.id}>
                          {entry.position}.{' '}
                          {entry.bowlerName || entry.newBowlerName || 'TBD'}
                        </li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(submission)}
                        className="font-body text-xs underline hover:no-underline"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="font-body text-xs mb-2">No lineup yet</p>
                    <button
                      onClick={() => setMagicLinkModal(team)}
                      className="font-body text-xs underline hover:no-underline"
                    >
                      Send Magic Link
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            <h2 className="font-heading text-lg text-navy mb-4">
              Edit Lineup: {editingSubmission.teamName}
            </h2>
            <div className="space-y-3 mb-4">
              {editEntries.map((entry, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-body text-sm text-navy/50 w-6">
                    {entry.position}.
                  </span>
                  <input
                    type="text"
                    value={
                      entry.newBowlerName ||
                      editingSubmission.entries[i]?.bowlerName ||
                      ''
                    }
                    onChange={(e) => {
                      const next = [...editEntries];
                      next[i] = {
                        ...next[i],
                        newBowlerName: e.target.value,
                        bowlerID: null,
                      };
                      setEditEntries(next);
                    }}
                    className="flex-1 font-body text-sm border border-navy/20 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy/20"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditingSubmission(null)}
                className="font-body text-sm text-navy/50 px-4 py-2 rounded-md hover:bg-navy/5"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={actionLoading}
                className="font-body text-sm bg-navy text-cream px-4 py-2 rounded-md hover:bg-navy/90 disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Magic Link Modal */}
      {magicLinkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="font-heading text-lg text-navy mb-4">
              Send Magic Link: {magicLinkModal.teamName}
            </h2>
            <div className="space-y-3 mb-4">
              <div>
                <label className="font-body text-xs text-navy/50 block mb-1">
                  Captain Name
                </label>
                <input
                  type="text"
                  value={magicLinkForm.captainName}
                  onChange={(e) =>
                    setMagicLinkForm((f) => ({
                      ...f,
                      captainName: e.target.value,
                    }))
                  }
                  placeholder="Captain's name"
                  className="w-full font-body text-sm border border-navy/20 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy/20"
                />
              </div>
              <div>
                <label className="font-body text-xs text-navy/50 block mb-1">
                  Captain Email
                </label>
                <input
                  type="email"
                  value={magicLinkForm.captainEmail}
                  onChange={(e) =>
                    setMagicLinkForm((f) => ({
                      ...f,
                      captainEmail: e.target.value,
                    }))
                  }
                  placeholder="captain@email.com"
                  className="w-full font-body text-sm border border-navy/20 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy/20"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setMagicLinkModal(null);
                  setMagicLinkForm({ captainName: '', captainEmail: '' });
                }}
                className="font-body text-sm text-navy/50 px-4 py-2 rounded-md hover:bg-navy/5"
              >
                Cancel
              </button>
              <button
                onClick={sendMagicLink}
                disabled={
                  actionLoading ||
                  !magicLinkForm.captainName ||
                  !magicLinkForm.captainEmail
                }
                className="font-body text-sm bg-navy text-cream px-4 py-2 rounded-md hover:bg-navy/90 disabled:opacity-50"
              >
                {actionLoading ? 'Sending...' : 'Send Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LP Push Modal */}
      {pushModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="font-heading text-lg text-navy mb-2">
              Push to LeaguePals
            </h2>
            <p className="font-body text-xs text-navy/60 mb-4">
              Paste your LeaguePals connect.sid cookie value. Grab it from
              Chrome DevTools: Application &gt; Cookies &gt; connect.sid
            </p>
            <textarea
              value={lpCookie}
              onChange={(e) => setLpCookie(e.target.value)}
              placeholder="connect.sid=s%3A..."
              rows={3}
              className="w-full font-body text-xs border border-navy/20 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-navy/20 font-mono"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setPushModal(false);
                  setLpCookie('');
                }}
                className="font-body text-sm text-navy/50 px-4 py-2 rounded-md hover:bg-navy/5"
              >
                Cancel
              </button>
              <button
                onClick={pushToLP}
                disabled={actionLoading || !lpCookie.trim()}
                className="font-body text-sm bg-navy text-cream px-4 py-2 rounded-md hover:bg-navy/90 disabled:opacity-50"
              >
                {actionLoading ? 'Pushing...' : 'Push Lineups'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
