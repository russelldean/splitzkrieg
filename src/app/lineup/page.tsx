'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';

interface Team {
  teamID: number;
  teamName: string;
  submitted: boolean;
}

interface Bowler {
  bowlerID: number;
  firstName: string;
  lastName: string;
}

interface LineupSlot {
  position: number;
  bowlerID: number | null;
  bowlerName: string;
  isNew: boolean;
  newBowlerName: string;
}

interface SeasonInfo {
  seasonID: number;
  seasonName: string;
  week: number;
  teams: Team[];
}

interface LineupContext {
  teamID: number;
  seasonID: number;
  seasonName: string;
  week: number;
  bowlers: Bowler[];
  recentRoster: number[];
  lastWeekLineup: Array<{
    position: number;
    bowlerID: number | null;
    bowlerName?: string;
    newBowlerName: string | null;
  }>;
}

export default function LineupPage() {
  // Step 1: Team selection
  const [seasonInfo, setSeasonInfo] = useState<SeasonInfo | null>(null);
  const [selectedTeamID, setSelectedTeamID] = useState<number | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(true);

  // Step 2: Lineup form
  const [context, setContext] = useState<LineupContext | null>(null);
  const [slots, setSlots] = useState<LineupSlot[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  // Step 1: Load teams
  useEffect(() => {
    async function loadTeams() {
      try {
        const res = await fetch('/api/lineup/submit');
        if (!res.ok) throw new Error('Failed to load season info');
        const data: SeasonInfo = await res.json();
        setSeasonInfo(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoadingTeams(false);
      }
    }
    loadTeams();
  }, []);

  // Step 2: Load lineup context when team is selected
  const loadTeamContext = useCallback(async (teamID: number) => {
    setLoadingContext(true);
    setError(null);
    try {
      const res = await fetch(`/api/lineup/submit?teamID=${teamID}`);
      if (!res.ok) throw new Error('Failed to load lineup');
      const data: LineupContext = await res.json();
      setContext(data);

      // Pre-fill from last week's lineup or start with 4 empty slots
      if (data.lastWeekLineup.length > 0) {
        setSlots(
          data.lastWeekLineup.map((entry) => ({
            position: entry.position,
            bowlerID: entry.bowlerID,
            bowlerName: entry.bowlerName || entry.newBowlerName || '',
            isNew: !entry.bowlerID && !!entry.newBowlerName,
            newBowlerName: entry.newBowlerName || '',
          })),
        );
      } else {
        setSlots(
          Array.from({ length: 4 }, (_, i) => ({
            position: i + 1,
            bowlerID: null,
            bowlerName: '',
            isNew: false,
            newBowlerName: '',
          })),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load lineup');
    } finally {
      setLoadingContext(false);
    }
  }, []);

  function handleTeamSelect(teamID: number) {
    setSelectedTeamID(teamID);
    loadTeamContext(teamID);
  }

  function handleBackToTeams() {
    setSelectedTeamID(null);
    setContext(null);
    setSlots([]);
    setSubmitted(false);
    setError(null);
  }

  // Sort bowlers: recent roster first, then alphabetical
  const sortedBowlers = useMemo(() => {
    if (!context) return [];
    const recentSet = new Set(context.recentRoster);
    return [...context.bowlers].sort((a, b) => {
      const aRecent = recentSet.has(a.bowlerID);
      const bRecent = recentSet.has(b.bowlerID);
      if (aRecent && !bRecent) return -1;
      if (!aRecent && bRecent) return 1;
      return `${a.lastName} ${a.firstName}`.localeCompare(
        `${b.lastName} ${b.firstName}`,
      );
    });
  }, [context]);

  // Filter bowlers by search query, exclude already-selected
  const filteredBowlers = useMemo(() => {
    const selectedIDs = new Set(
      slots.filter((s) => s.bowlerID).map((s) => s.bowlerID),
    );
    let filtered = sortedBowlers.filter((b) => !selectedIDs.has(b.bowlerID));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          `${b.firstName} ${b.lastName}`.toLowerCase().includes(q) ||
          `${b.lastName} ${b.firstName}`.toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [sortedBowlers, searchQuery, slots]);

  const selectBowler = useCallback(
    (slotIndex: number, bowler: Bowler) => {
      setSlots((prev) =>
        prev.map((s, i) =>
          i === slotIndex
            ? {
                ...s,
                bowlerID: bowler.bowlerID,
                bowlerName: `${bowler.firstName} ${bowler.lastName}`,
                isNew: false,
                newBowlerName: '',
              }
            : s,
        ),
      );
      setActiveSlot(null);
      setSearchQuery('');
    },
    [],
  );

  const clearSlot = useCallback((slotIndex: number) => {
    setSlots((prev) =>
      prev.map((s, i) =>
        i === slotIndex
          ? { ...s, bowlerID: null, bowlerName: '', isNew: false, newBowlerName: '' }
          : s,
      ),
    );
  }, []);

  const toggleNewBowler = useCallback((slotIndex: number) => {
    setSlots((prev) =>
      prev.map((s, i) =>
        i === slotIndex
          ? { ...s, isNew: !s.isNew, bowlerID: null, bowlerName: '' }
          : s,
      ),
    );
    setActiveSlot(null);
  }, []);

  const updateNewBowlerName = useCallback(
    (slotIndex: number, name: string) => {
      setSlots((prev) =>
        prev.map((s, i) =>
          i === slotIndex ? { ...s, newBowlerName: name } : s,
        ),
      );
    },
    [],
  );

  const moveSlot = useCallback((fromIndex: number, direction: -1 | 1) => {
    setSlots((prev) => {
      const toIndex = fromIndex + direction;
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
      return next.map((s, i) => ({ ...s, position: i + 1 }));
    });
  }, []);

  const addSlot = useCallback(() => {
    setSlots((prev) => [
      ...prev,
      {
        position: prev.length + 1,
        bowlerID: null,
        bowlerName: '',
        isNew: false,
        newBowlerName: '',
      },
    ]);
  }, []);

  const removeSlot = useCallback((index: number) => {
    setSlots((prev) => {
      if (prev.length <= 1) return prev;
      return prev
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, position: i + 1 }));
    });
  }, []);

  const handleSubmit = async () => {
    if (!context) return;

    const validSlots = slots.filter(
      (s) => s.bowlerID || (s.isNew && s.newBowlerName.trim()),
    );

    if (validSlots.length === 0) {
      setError('Please add at least one bowler to your lineup.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const teamName = seasonInfo?.teams.find((t) => t.teamID === selectedTeamID)?.teamName;
      const entries = validSlots.map((s) => ({
        position: s.position,
        bowlerID: s.bowlerID,
        newBowlerName: s.isNew ? s.newBowlerName.trim() : null,
      }));

      const res = await fetch('/api/lineup/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamID: context.teamID,
          seasonID: context.seasonID,
          week: context.week,
          entries,
          submittedBy: teamName || 'Captain',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit lineup');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit lineup');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading state ──
  if (loadingTeams) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-3 border-navy/20 border-t-navy rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !seasonInfo) {
    return (
      <div className="text-center py-16">
        <p className="font-body text-red-600">{error}</p>
      </div>
    );
  }

  if (!seasonInfo) return null;

  // ── Step 1: Team selection ──
  if (!selectedTeamID) {
    const submittedCount = seasonInfo.teams.filter((t) => t.submitted).length;
    const totalCount = seasonInfo.teams.length;

    return (
      <div>
        <div className="mb-6">
          <h2 className="font-heading text-xl text-navy">
            Week {seasonInfo.week} Lineups
          </h2>
          <p className="font-body text-sm text-navy/60">{seasonInfo.seasonName}</p>
        </div>
        <div className="flex items-center justify-between mb-4">
          <p className="font-body text-sm text-navy/70">
            Select your team to submit or update your lineup.
          </p>
          <span className="font-body text-xs text-navy/40 shrink-0 ml-3">
            {submittedCount}/{totalCount} submitted
          </span>
        </div>
        <div className="space-y-2">
          {seasonInfo.teams.map((team) => (
            <button
              key={team.teamID}
              onClick={() => handleTeamSelect(team.teamID)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center justify-between ${
                team.submitted
                  ? 'bg-navy/[0.02] border-navy/5 text-navy/40'
                  : 'bg-white border-navy/10 hover:border-navy/20 hover:shadow-sm text-navy'
              }`}
            >
              <span className="font-body">{team.teamName}</span>
              {team.submitted && (
                <span className="flex items-center gap-1.5 font-body text-xs text-green-600/70">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  submitted
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Loading lineup context ──
  if (loadingContext) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-3 border-navy/20 border-t-navy rounded-full animate-spin" />
      </div>
    );
  }

  // ── Submitted confirmation ──
  if (submitted) {
    const teamName = seasonInfo.teams.find((t) => t.teamID === selectedTeamID)?.teamName;
    return (
      <div className="text-center py-16">
        <div className="bg-green-50 rounded-lg p-8 max-w-md mx-auto">
          <h2 className="font-heading text-2xl text-navy mb-3">
            Lineup Submitted!
          </h2>
          <p className="font-body text-navy/70 mb-1">
            {teamName} - Week {context?.week}
          </p>
          <p className="font-body text-sm text-navy/50 mb-6">
            You can update it any time before league night.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => setSubmitted(false)}
              className="font-body text-sm text-navy/60 underline hover:text-navy"
            >
              Edit lineup
            </button>
            <button
              onClick={handleBackToTeams}
              className="font-body text-sm text-navy/60 underline hover:text-navy"
            >
              View all teams
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!context) return null;

  // ── Step 2: Lineup form ──
  const teamName = seasonInfo.teams.find((t) => t.teamID === selectedTeamID)?.teamName;

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={handleBackToTeams}
          className="font-body text-xs text-navy/40 hover:text-navy mb-2 flex items-center gap-1"
        >
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Back to teams
        </button>
        <h2 className="font-heading text-xl text-navy">{teamName}</h2>
        <p className="font-body text-sm text-navy/60">
          Week {context.week} - {context.seasonName}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 rounded-md px-4 py-3 mb-4 font-body text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3 mb-6">
        {slots.map((slot, index) => (
          <div
            key={index}
            className="bg-white rounded-lg border border-navy/10 p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-body text-xs text-navy/40 uppercase tracking-wide">
                Position {slot.position}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveSlot(index, -1)}
                  disabled={index === 0}
                  className="p-1 text-navy/30 hover:text-navy disabled:opacity-30"
                  title="Move up"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => moveSlot(index, 1)}
                  disabled={index === slots.length - 1}
                  className="p-1 text-navy/30 hover:text-navy disabled:opacity-30"
                  title="Move down"
                >
                  <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {slots.length > 1 && (
                  <button
                    onClick={() => removeSlot(index)}
                    className="p-1 text-red-400 hover:text-red-600 ml-1"
                    title="Remove slot"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {slot.isNew ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={slot.newBowlerName}
                  onChange={(e) => updateNewBowlerName(index, e.target.value)}
                  placeholder="Enter new bowler name"
                  className="flex-1 font-body text-sm border border-navy/20 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-navy/20"
                />
                <button
                  onClick={() => toggleNewBowler(index)}
                  className="font-body text-xs text-navy/50 hover:text-navy whitespace-nowrap"
                >
                  Pick existing
                </button>
              </div>
            ) : slot.bowlerID ? (
              <div className="flex items-center justify-between">
                <span className="font-body text-navy font-medium">
                  {slot.bowlerName}
                </span>
                <button
                  onClick={() => clearSlot(index)}
                  className="font-body text-xs text-navy/40 hover:text-navy"
                >
                  Change
                </button>
              </div>
            ) : (
              <div>
                {activeSlot === index ? (
                  <div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search bowlers..."
                      className="w-full font-body text-sm border border-navy/20 rounded-md px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-navy/20"
                      autoFocus
                    />
                    <div className="max-h-48 overflow-y-auto border border-navy/10 rounded-md">
                      {filteredBowlers.slice(0, 50).map((bowler) => {
                        const isRecent = context.recentRoster.includes(bowler.bowlerID);
                        return (
                          <button
                            key={bowler.bowlerID}
                            onClick={() => selectBowler(index, bowler)}
                            className="w-full text-left px-3 py-2 font-body text-sm hover:bg-navy/5 border-b border-navy/5 last:border-0 flex items-center justify-between"
                          >
                            <span>{bowler.firstName} {bowler.lastName}</span>
                            {isRecent && (
                              <span className="text-xs text-navy/40">recent</span>
                            )}
                          </button>
                        );
                      })}
                      {filteredBowlers.length === 0 && (
                        <p className="px-3 py-2 font-body text-sm text-navy/40">
                          No bowlers found
                        </p>
                      )}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => { setActiveSlot(null); setSearchQuery(''); }}
                        className="font-body text-xs text-navy/40 hover:text-navy"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => toggleNewBowler(index)}
                        className="font-body text-xs text-navy/50 hover:text-navy"
                      >
                        New bowler instead
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveSlot(index)}
                      className="font-body text-sm text-navy/50 hover:text-navy border border-dashed border-navy/20 rounded-md px-3 py-2 flex-1 text-left"
                    >
                      Select bowler...
                    </button>
                    <button
                      onClick={() => toggleNewBowler(index)}
                      className="font-body text-xs text-navy/50 hover:text-navy whitespace-nowrap px-2"
                    >
                      New bowler
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={addSlot}
          className="font-body text-sm text-navy/50 hover:text-navy border border-dashed border-navy/20 rounded-md px-4 py-2"
        >
          + Add Slot
        </button>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full bg-navy text-cream font-body font-semibold py-3 rounded-lg hover:bg-navy/90 disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Submitting...' : 'Submit Lineup'}
      </button>
    </div>
  );
}
