'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type {
  StagedMatch,
  StagedBowler,
  ValidationWarning,
  PersonalBest,
} from '@/lib/admin/types';

// ---- Validation logic (shared with server, inlined for client use) ----

function validateScoresClient(matches: StagedMatch[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const match of matches) {
    const seenBowlerIDs = new Set<number>();

    for (const bowler of match.bowlers) {
      if (bowler.isPenalty) continue;

      const games = [bowler.game1, bowler.game2, bowler.game3];
      for (let i = 0; i < games.length; i++) {
        const score = games[i];
        if (score == null) continue;

        const gameLabel = `game${i + 1}`;

        if (score > 280) {
          warnings.push({
            bowlerID: bowler.bowlerID,
            bowlerName: bowler.bowlerName,
            field: gameLabel,
            message: `${bowler.bowlerName} has a ${score} in Game ${i + 1} (unusually high)`,
            severity: 'warning',
          });
        }

        if (score < 50 && score > 0) {
          warnings.push({
            bowlerID: bowler.bowlerID,
            bowlerName: bowler.bowlerName,
            field: gameLabel,
            message: `${bowler.bowlerName} has a ${score} in Game ${i + 1} (unusually low)`,
            severity: 'warning',
          });
        }

        if (bowler.incomingAvg != null && bowler.incomingAvg > 0) {
          const deviation = Math.abs(score - bowler.incomingAvg);
          if (deviation > 80) {
            const direction =
              score > bowler.incomingAvg ? 'above' : 'below';
            warnings.push({
              bowlerID: bowler.bowlerID,
              bowlerName: bowler.bowlerName,
              field: gameLabel,
              message: `${bowler.bowlerName} Game ${i + 1} (${score}) is ${deviation} pins ${direction} average (${bowler.incomingAvg})`,
              severity: 'info',
            });
          }
        }
      }

      if (bowler.bowlerID != null) {
        if (seenBowlerIDs.has(bowler.bowlerID)) {
          warnings.push({
            bowlerID: bowler.bowlerID,
            bowlerName: bowler.bowlerName,
            field: 'bowlerID',
            message: `${bowler.bowlerName} appears multiple times in this match`,
            severity: 'warning',
          });
        }
        seenBowlerIDs.add(bowler.bowlerID);
      }
    }
  }

  return warnings;
}

// ---- Types for confirm response ----

interface ConfirmResult {
  deleted: number;
  inserted: number;
  personalBests: PersonalBest[];
  matchResultCount: number;
  patches: string[];
}

// ---- Main Page Component ----

type Step = 'idle' | 'loading' | 'reviewing' | 'confirming' | 'done';

export default function ScoresPage() {
  // Season auto-detected from DB, week selector
  const [seasonID, setSeasonID] = useState<number | null>(null);
  const [seasonName, setSeasonName] = useState('');
  const [week, setWeek] = useState(1);

  // All bowlers for picker dropdown
  const [allBowlers, setAllBowlers] = useState<
    Array<{ bowlerID: number; bowlerName: string }>
  >([]);

  // Load current season and bowler list on mount
  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((data) => {
        if (data.season) {
          setSeasonID(data.season.seasonID);
          setSeasonName(data.season.displayName || `Season ${data.season.seasonID}`);
          if (data.publishedWeek != null) {
            setWeek(data.publishedWeek + 1);
          }
        }
      })
      .catch(() => {});

    fetch('/api/admin/bowlers')
      .then((r) => r.json())
      .then((data) => {
        if (data.bowlers) setAllBowlers(data.bowlers);
      })
      .catch(() => {});
  }, []);

  // Pipeline state
  const [step, setStep] = useState<Step>('idle');
  const [matches, setMatches] = useState<StagedMatch[]>([]);
  const [apiWarnings, setApiWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(
    null,
  );
  const [loadingMessage, setLoadingMessage] = useState('');

  // LP cookie modal
  const [showCookieModal, setShowCookieModal] = useState(false);
  const [cookieValue, setCookieValue] = useState('');

  // Client-side validation warnings
  const validationWarnings = useMemo(
    () => (matches.length > 0 ? validateScoresClient(matches) : []),
    [matches],
  );

  // Check if any match has scores entered
  const hasScores = useMemo(
    () =>
      matches.some((m) =>
        m.bowlers.some(
          (b) =>
            !b.isPenalty &&
            (b.game1 != null || b.game2 != null || b.game3 != null),
        ),
      ),
    [matches],
  );

  // Check for unmatched bowlers
  const hasUnmatched = useMemo(
    () => matches.some((m) => m.bowlers.some((b) => b.isUnmatched)),
    [matches],
  );

  // ---- Pull from LP ----

  const handlePull = useCallback(async () => {
    if (!cookieValue.trim()) return;
    setShowCookieModal(false);
    setStep('loading');
    setLoadingMessage('Pulling scores from LeaguePals...');
    setError(null);

    try {
      const res = await fetch('/api/admin/scores/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: cookieValue.trim(), seasonID, week }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to pull scores');
        setStep('idle');
        return;
      }

      setMatches(data.matches);
      setApiWarnings(data.warnings || []);
      setStep('reviewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setStep('idle');
    }
  }, [cookieValue, seasonID, week]);

  // ---- Manual Entry ----

  const handleManualEntry = useCallback(async () => {
    setStep('loading');
    setLoadingMessage('Loading schedule...');
    setError(null);

    try {
      const res = await fetch('/api/admin/scores/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonID, week }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load schedule');
        setStep('idle');
        return;
      }

      setMatches(data.matches);
      setApiWarnings(data.warnings || []);
      setStep('reviewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setStep('idle');
    }
  }, [seasonID, week]);

  // ---- Confirm ----

  const handleConfirm = useCallback(async () => {
    setStep('confirming');
    setLoadingMessage('Inserting scores...');
    setError(null);

    try {
      setLoadingMessage('Inserting scores...');
      await new Promise((r) => setTimeout(r, 100)); // Let UI update

      const res = await fetch('/api/admin/scores/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonID, week, matches }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to confirm scores');
        setStep('reviewing');
        return;
      }

      setConfirmResult(data);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
      setStep('reviewing');
    }
  }, [seasonID, week, matches]);

  // ---- Score Editing ----

  const updateBowler = useCallback(
    (
      matchIdx: number,
      bowlerIdx: number,
      field: keyof StagedBowler,
      value: unknown,
    ) => {
      setMatches((prev) => {
        const next = [...prev];
        const match = { ...next[matchIdx] };
        const bowlers = [...match.bowlers];
        bowlers[bowlerIdx] = { ...bowlers[bowlerIdx], [field]: value };
        match.bowlers = bowlers;
        next[matchIdx] = match;
        return next;
      });
    },
    [],
  );

  const togglePenalty = useCallback(
    (matchIdx: number, bowlerIdx: number) => {
      setMatches((prev) => {
        const next = [...prev];
        const match = { ...next[matchIdx] };
        const bowlers = [...match.bowlers];
        const b = { ...bowlers[bowlerIdx] };
        b.isPenalty = !b.isPenalty;
        if (b.isPenalty) {
          b.game1 = null;
          b.game2 = null;
          b.game3 = null;
        }
        bowlers[bowlerIdx] = b;
        match.bowlers = bowlers;
        next[matchIdx] = match;
        return next;
      });
    },
    [],
  );

  const addBowler = useCallback(
    (matchIdx: number, teamID: number, teamName: string) => {
      setMatches((prev) => {
        const next = [...prev];
        const match = { ...next[matchIdx] };
        match.bowlers = [
          ...match.bowlers,
          {
            bowlerID: null,
            bowlerName: '',
            teamID,
            teamName,
            game1: null,
            game2: null,
            game3: null,
            turkeys: 0,
            incomingAvg: null,
            isPenalty: false,
            isUnmatched: false,
          },
        ];
        next[matchIdx] = match;
        return next;
      });
    },
    [],
  );

  const resolveBowler = useCallback(
    (
      matchIdx: number,
      bowlerIdx: number,
      bowlerID: number,
      bowlerName: string,
    ) => {
      setMatches((prev) => {
        const next = [...prev];
        const match = { ...next[matchIdx] };
        const bowlers = [...match.bowlers];
        bowlers[bowlerIdx] = {
          ...bowlers[bowlerIdx],
          bowlerID,
          bowlerName,
          isUnmatched: false,
          matchedSuggestions: undefined,
        };
        match.bowlers = bowlers;
        next[matchIdx] = match;
        return next;
      });
    },
    [],
  );

  const removeBowler = useCallback(
    (matchIdx: number, bowlerIdx: number) => {
      setMatches((prev) => {
        const next = [...prev];
        const match = { ...next[matchIdx] };
        match.bowlers = match.bowlers.filter((_, i) => i !== bowlerIdx);
        next[matchIdx] = match;
        return next;
      });
    },
    [],
  );

  // ---- Render ----

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="font-heading text-2xl text-navy mb-6">Score Pipeline</h1>

      {/* Season/Week Selectors */}
      {seasonID == null ? (
        <div className="flex items-center gap-2 mb-6">
          <div className="w-4 h-4 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
          <span className="font-body text-sm text-navy/60">Loading season...</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div>
            <label className="block font-body text-xs text-navy/60 mb-1">
              Season
            </label>
            <p className="font-body text-sm text-navy px-3 py-2">
              {seasonName}
            </p>
          </div>

          <div>
            <label className="block font-body text-xs text-navy/60 mb-1">
              Week
            </label>
            <select
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              disabled={step !== 'idle'}
              className="font-body text-sm border border-navy/20 rounded px-3 py-2 bg-white text-navy"
            >
              {Array.from({ length: 20 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2">
            <button
              onClick={() => setShowCookieModal(true)}
              disabled={step !== 'idle'}
              className="px-4 py-2 bg-navy text-cream font-body text-sm rounded hover:bg-navy/90 disabled:opacity-50 transition-colors"
            >
              Pull from LP
            </button>

            <button
              onClick={handleManualEntry}
              disabled={step !== 'idle'}
              className="px-4 py-2 bg-white text-navy border border-navy/20 font-body text-sm rounded hover:bg-navy/5 disabled:opacity-50 transition-colors"
            >
              Manual Entry
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red/10 border border-red/30 rounded-md">
          <p className="font-body text-sm text-red">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {(step === 'loading' || step === 'confirming') && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-2 border-navy/20 border-t-navy rounded-full animate-spin mb-4" />
            <p className="font-body text-sm text-navy/60">{loadingMessage}</p>
          </div>
        </div>
      )}

      {/* API Warnings Banner */}
      {apiWarnings.length > 0 && step === 'reviewing' && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-md">
          <p className="font-body text-sm font-semibold text-amber-800 mb-2">
            Warnings
          </p>
          <ul className="font-body text-xs text-amber-700 space-y-1">
            {apiWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Review Step */}
      {step === 'reviewing' && (
        <>
          {/* Match Cards */}
          {matches.map((match, matchIdx) => (
            <MatchCard
              key={matchIdx}
              match={match}
              matchIdx={matchIdx}
              allBowlers={allBowlers}
              warnings={validationWarnings.filter(
                (w) =>
                  match.bowlers.some(
                    (b) =>
                      b.bowlerID === w.bowlerID ||
                      b.bowlerName === w.bowlerName,
                  ),
              )}
              onUpdateBowler={updateBowler}
              onTogglePenalty={togglePenalty}
              onAddBowler={addBowler}
              onResolveBowler={resolveBowler}
              onRemoveBowler={removeBowler}
            />
          ))}

          {/* Confirm Button */}
          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={handleConfirm}
              disabled={!hasScores || hasUnmatched}
              className="px-6 py-3 bg-navy text-cream font-body text-sm rounded-md hover:bg-navy/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Confirm & Process
            </button>

            <button
              onClick={() => {
                setStep('idle');
                setMatches([]);
                setApiWarnings([]);
              }}
              className="px-4 py-2 text-navy/60 font-body text-sm hover:text-navy transition-colors"
            >
              Cancel
            </button>

            {hasUnmatched && (
              <p className="font-body text-xs text-amber-600">
                Resolve all unmatched bowlers before confirming
              </p>
            )}
          </div>
        </>
      )}

      {/* Done Step - Summary */}
      {step === 'done' && confirmResult && (
        <div className="bg-white rounded-lg shadow-sm border border-navy/10 p-6">
          <h2 className="font-heading text-lg text-navy mb-4">
            Scores Confirmed
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-3 bg-cream rounded">
              <p className="font-heading text-2xl text-navy">
                {confirmResult.inserted}
              </p>
              <p className="font-body text-xs text-navy/60">Scores Inserted</p>
            </div>
            <div className="text-center p-3 bg-cream rounded">
              <p className="font-heading text-2xl text-navy">
                {confirmResult.matchResultCount}
              </p>
              <p className="font-body text-xs text-navy/60">Match Results</p>
            </div>
            <div className="text-center p-3 bg-cream rounded">
              <p className="font-heading text-2xl text-navy">
                {confirmResult.patches.length}
              </p>
              <p className="font-body text-xs text-navy/60">Patches Awarded</p>
            </div>
            <div className="text-center p-3 bg-cream rounded">
              <p className="font-heading text-2xl text-navy">
                {confirmResult.personalBests.length}
              </p>
              <p className="font-body text-xs text-navy/60">Personal Bests</p>
            </div>
          </div>

          {/* Personal Bests */}
          {confirmResult.personalBests.length > 0 && (
            <div className="mb-4">
              <h3 className="font-body text-sm font-semibold text-navy mb-2">
                Personal Bests
              </h3>
              <ul className="font-body text-xs text-navy/80 space-y-1">
                {confirmResult.personalBests.map((pb, i) => (
                  <li key={i}>
                    {pb.bowlerName}: New{' '}
                    {pb.type === 'highGame' ? 'High Game' : 'High Series'}{' '}
                    of {pb.value}
                    {pb.previousBest != null && (
                      <span className="text-navy/50">
                        {' '}
                        (previous: {pb.previousBest})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Patches */}
          {confirmResult.patches.length > 0 && (
            <div className="mb-4">
              <h3 className="font-body text-sm font-semibold text-navy mb-2">
                Patches Awarded
              </h3>
              <ul className="font-body text-xs text-navy/80 space-y-1">
                {confirmResult.patches.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => {
              setStep('idle');
              setMatches([]);
              setConfirmResult(null);
              setApiWarnings([]);
            }}
            className="mt-4 px-4 py-2 bg-navy text-cream font-body text-sm rounded hover:bg-navy/90 transition-colors"
          >
            Back to Scores
          </button>
        </div>
      )}

      {/* Cookie Modal */}
      {showCookieModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <h2 className="font-heading text-lg text-navy mb-3">
              LeaguePals Cookie
            </h2>
            <p className="font-body text-xs text-navy/60 mb-4">
              Paste the connect.sid cookie value from LeaguePals. Open LP in
              your browser, go to Developer Tools, Application tab, Cookies,
              and copy the connect.sid value.
            </p>
            <textarea
              value={cookieValue}
              onChange={(e) => setCookieValue(e.target.value)}
              placeholder="connect.sid=s%3A..."
              rows={3}
              className="w-full font-mono text-xs border border-navy/20 rounded p-3 mb-4 bg-cream text-navy"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCookieModal(false)}
                className="px-4 py-2 font-body text-sm text-navy/60 hover:text-navy transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePull}
                disabled={!cookieValue.trim()}
                className="px-4 py-2 bg-navy text-cream font-body text-sm rounded hover:bg-navy/90 disabled:opacity-50 transition-colors"
              >
                Pull Scores
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Idle state hint */}
      {step === 'idle' && matches.length === 0 && !error && (
        <div className="text-center py-20">
          <p className="font-body text-sm text-navy/40">
            Select a season and week, then pull from LP or enter manually.
          </p>
        </div>
      )}
    </div>
  );
}

// ---- Handicap helpers ----

function calcHcp(incomingAvg: number | null): number {
  if (incomingAvg == null || incomingAvg <= 0) return 0;
  return Math.min(147, Math.floor((225 - Math.floor(incomingAvg)) * 0.95));
}

function calcHcpGame(bowler: StagedBowler, game: number | null): number | null {
  if (game == null) return null;
  if (bowler.isPenalty) return 199;
  if (bowler.incomingAvg == null || bowler.incomingAvg <= 0) return 219;
  return game + calcHcp(bowler.incomingAvg);
}

function teamHcpTotals(bowlers: Array<{ bowler: StagedBowler }>): {
  g1: number | null;
  g2: number | null;
  g3: number | null;
} {
  let g1: number | null = null;
  let g2: number | null = null;
  let g3: number | null = null;

  for (const { bowler } of bowlers) {
    const h1 = calcHcpGame(bowler, bowler.game1);
    const h2 = calcHcpGame(bowler, bowler.game2);
    const h3 = calcHcpGame(bowler, bowler.game3);
    if (h1 != null) g1 = (g1 ?? 0) + h1;
    if (h2 != null) g2 = (g2 ?? 0) + h2;
    if (h3 != null) g3 = (g3 ?? 0) + h3;
  }

  return { g1, g2, g3 };
}

// ---- Match Card Component ----

interface MatchCardProps {
  match: StagedMatch;
  matchIdx: number;
  allBowlers: Array<{ bowlerID: number; bowlerName: string }>;
  warnings: ValidationWarning[];
  onUpdateBowler: (
    matchIdx: number,
    bowlerIdx: number,
    field: keyof StagedBowler,
    value: unknown,
  ) => void;
  onTogglePenalty: (matchIdx: number, bowlerIdx: number) => void;
  onAddBowler: (
    matchIdx: number,
    teamID: number,
    teamName: string,
  ) => void;
  onResolveBowler: (
    matchIdx: number,
    bowlerIdx: number,
    bowlerID: number,
    bowlerName: string,
  ) => void;
  onRemoveBowler: (matchIdx: number, bowlerIdx: number) => void;
}

function MatchCard({
  match,
  matchIdx,
  allBowlers,
  warnings,
  onUpdateBowler,
  onTogglePenalty,
  onAddBowler,
  onResolveBowler,
  onRemoveBowler,
}: MatchCardProps) {
  const homeBowlers = match.bowlers
    .map((b, i) => ({ bowler: b, idx: i }))
    .filter((x) => x.bowler.teamID === match.homeTeamID);
  const awayBowlers = match.bowlers
    .map((b, i) => ({ bowler: b, idx: i }))
    .filter((x) => x.bowler.teamID === match.awayTeamID);

  const homeHcp = teamHcpTotals(homeBowlers);
  const awayHcp = teamHcpTotals(awayBowlers);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-navy/10 mb-4 overflow-hidden">
      {/* Match Header */}
      <div className="bg-navy/5 px-4 py-3 border-b border-navy/10">
        <h3 className="font-heading text-sm text-navy">
          {match.homeTeamName} vs {match.awayTeamName}
        </h3>
      </div>

      {/* Bowler Tables */}
      <div className="p-4">
        {/* Home Team */}
        <TeamSection
          teamName={match.homeTeamName}
          teamID={match.homeTeamID}
          bowlers={homeBowlers}
          matchIdx={matchIdx}
          allBowlers={allBowlers}
          hcp={homeHcp}
          onUpdateBowler={onUpdateBowler}
          onTogglePenalty={onTogglePenalty}
          onResolveBowler={onResolveBowler}
          onRemoveBowler={onRemoveBowler}
        />

        <button
          onClick={() =>
            onAddBowler(matchIdx, match.homeTeamID, match.homeTeamName)
          }
          className="mt-1 mb-4 px-2 py-1 font-body text-xs text-navy/40 hover:text-navy transition-colors"
        >
          + Add Bowler
        </button>

        {/* Away Team */}
        <TeamSection
          teamName={match.awayTeamName}
          teamID={match.awayTeamID}
          bowlers={awayBowlers}
          matchIdx={matchIdx}
          allBowlers={allBowlers}
          hcp={awayHcp}
          onUpdateBowler={onUpdateBowler}
          onTogglePenalty={onTogglePenalty}
          onResolveBowler={onResolveBowler}
          onRemoveBowler={onRemoveBowler}
        />

        <button
          onClick={() =>
            onAddBowler(matchIdx, match.awayTeamID, match.awayTeamName)
          }
          className="mt-1 px-2 py-1 font-body text-xs text-navy/40 hover:text-navy transition-colors"
        >
          + Add Bowler
        </button>
      </div>

      {/* Validation Warnings */}
      {warnings.length > 0 && (
        <div className="px-4 pb-4">
          {warnings.map((w, i) => (
            <div
              key={i}
              className={`px-3 py-2 rounded text-xs font-body mb-1 ${
                w.severity === 'warning'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Team Section ----

interface TeamSectionProps {
  teamName: string;
  teamID: number;
  bowlers: Array<{ bowler: StagedBowler; idx: number }>;
  matchIdx: number;
  allBowlers: Array<{ bowlerID: number; bowlerName: string }>;
  hcp: { g1: number | null; g2: number | null; g3: number | null };
  onUpdateBowler: (
    matchIdx: number,
    bowlerIdx: number,
    field: keyof StagedBowler,
    value: unknown,
  ) => void;
  onTogglePenalty: (matchIdx: number, bowlerIdx: number) => void;
  onResolveBowler: (
    matchIdx: number,
    bowlerIdx: number,
    bowlerID: number,
    bowlerName: string,
  ) => void;
  onRemoveBowler: (matchIdx: number, bowlerIdx: number) => void;
}

function TeamSection({
  teamName,
  bowlers,
  matchIdx,
  allBowlers,
  hcp,
  onUpdateBowler,
  onTogglePenalty,
  onResolveBowler,
  onRemoveBowler,
}: TeamSectionProps) {
  const hcpTotal =
    hcp.g1 != null && hcp.g2 != null && hcp.g3 != null
      ? hcp.g1 + hcp.g2 + hcp.g3
      : null;
  const hasHcp = hcp.g1 != null || hcp.g2 != null || hcp.g3 != null;
  return (
    <div className="mb-2">
      <p className="font-body text-xs font-semibold text-navy/50 mb-2 uppercase tracking-wider">
        {teamName}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-body">
          <thead>
            <tr className="text-navy/40 border-b border-navy/10">
              <th className="text-left py-1 px-1 min-w-[140px]">Name</th>
              <th className="text-center py-1 px-1 w-16">G1</th>
              <th className="text-center py-1 px-1 w-16">G2</th>
              <th className="text-center py-1 px-1 w-16">G3</th>
              <th className="text-center py-1 px-1 w-14">Turkeys</th>
              <th className="text-center py-1 px-1 w-14">Avg</th>
              <th className="text-center py-1 px-1 w-20">Status</th>
              <th className="text-center py-1 px-1 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {bowlers.map(({ bowler, idx }) => (
              <BowlerRow
                key={idx}
                bowler={bowler}
                matchIdx={matchIdx}
                bowlerIdx={idx}
                allBowlers={allBowlers}
                onUpdate={onUpdateBowler}
                onTogglePenalty={onTogglePenalty}
                onResolve={onResolveBowler}
                onRemove={onRemoveBowler}
              />
            ))}
          </tbody>
          {hasHcp && (
            <tfoot>
              <tr className="bg-navy/5 border-t border-navy/10">
                <td className="py-1.5 px-1 font-semibold text-navy/50">HCP Total</td>
                <td className="py-1.5 px-1 text-center font-semibold text-navy">{hcp.g1 ?? '--'}</td>
                <td className="py-1.5 px-1 text-center font-semibold text-navy">{hcp.g2 ?? '--'}</td>
                <td className="py-1.5 px-1 text-center font-semibold text-navy">{hcp.g3 ?? '--'}</td>
                <td className="py-1.5 px-1" />
                <td className="py-1.5 px-1" />
                <td className="py-1.5 px-1 text-center font-semibold text-navy/70">{hcpTotal ?? '--'}</td>
                <td className="py-1.5 px-1" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ---- Bowler Row ----

interface BowlerRowProps {
  bowler: StagedBowler;
  matchIdx: number;
  bowlerIdx: number;
  allBowlers: Array<{ bowlerID: number; bowlerName: string }>;
  onUpdate: (
    matchIdx: number,
    bowlerIdx: number,
    field: keyof StagedBowler,
    value: unknown,
  ) => void;
  onTogglePenalty: (matchIdx: number, bowlerIdx: number) => void;
  onResolve: (
    matchIdx: number,
    bowlerIdx: number,
    bowlerID: number,
    bowlerName: string,
  ) => void;
  onRemove: (matchIdx: number, bowlerIdx: number) => void;
}

function BowlerRow({
  bowler,
  matchIdx,
  bowlerIdx,
  allBowlers,
  onUpdate,
  onTogglePenalty,
  onResolve,
  onRemove,
}: BowlerRowProps) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [bowlerSearch, setBowlerSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const filteredBowlers = useMemo(() => {
    if (!bowlerSearch.trim()) return allBowlers.slice(0, 20);
    const q = bowlerSearch.toLowerCase();
    return allBowlers.filter((b) => b.bowlerName.toLowerCase().includes(q)).slice(0, 20);
  }, [bowlerSearch, allBowlers]);

  const parseScore = (val: string): number | null => {
    const num = parseInt(val, 10);
    return isNaN(num) ? null : num;
  };

  return (
    <tr
      className={`border-b border-navy/5 ${
        bowler.isUnmatched ? 'bg-amber-50' : ''
      } ${bowler.isPenalty ? 'opacity-50' : ''}`}
    >
      {/* Name */}
      <td className="py-1.5 px-1">
        {bowler.isUnmatched ? (
          <div className="relative">
            <div className="flex items-center gap-1">
              <span className="text-amber-700 font-semibold">
                {bowler.bowlerName || 'Unknown'}
              </span>
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded text-[10px] hover:bg-amber-300 transition-colors"
              >
                Resolve
              </button>
            </div>
            {showSuggestions && bowler.matchedSuggestions && (
              <div className="absolute z-10 mt-1 bg-white border border-navy/20 rounded shadow-lg py-1 min-w-[200px]">
                {bowler.matchedSuggestions.map((s) => (
                  <button
                    key={s.bowlerID}
                    onClick={() => {
                      onResolve(matchIdx, bowlerIdx, s.bowlerID, s.name);
                      setShowSuggestions(false);
                    }}
                    className="block w-full text-left px-3 py-1.5 text-xs hover:bg-navy/5 transition-colors"
                  >
                    {s.name}{' '}
                    <span className="text-navy/40">(match: {s.score})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : bowler.bowlerID == null ? (
          <div className="relative">
            <input
              type="text"
              value={bowlerSearch}
              onChange={(e) => {
                setBowlerSearch(e.target.value);
                setShowPicker(true);
              }}
              onFocus={() => setShowPicker(true)}
              className="w-full bg-transparent border-b border-navy/30 focus:border-navy/60 focus:outline-none px-0 py-0.5 text-navy"
              placeholder="Search bowler..."
            />
            {showPicker && (
              <div className="absolute z-10 mt-1 bg-white border border-navy/20 rounded shadow-lg py-1 min-w-[200px] max-h-48 overflow-y-auto">
                {filteredBowlers.map((b) => (
                  <button
                    key={b.bowlerID}
                    onClick={() => {
                      onResolve(matchIdx, bowlerIdx, b.bowlerID, b.bowlerName);
                      setShowPicker(false);
                      setBowlerSearch('');
                    }}
                    className="block w-full text-left px-3 py-1.5 text-xs hover:bg-navy/5 transition-colors"
                  >
                    {b.bowlerName}
                  </button>
                ))}
                {filteredBowlers.length === 0 && (
                  <p className="px-3 py-1.5 text-xs text-navy/40">No matches</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-navy py-0.5">{bowler.bowlerName}</span>
            <button
              onClick={() => {
                onUpdate(matchIdx, bowlerIdx, 'bowlerID', null);
                onUpdate(matchIdx, bowlerIdx, 'bowlerName', '');
              }}
              className="px-1 py-0.5 text-[10px] text-navy/30 hover:text-navy transition-colors"
              title="Change bowler"
            >
              swap
            </button>
          </div>
        )}
      </td>

      {/* Game 1 */}
      <td className="py-1.5 px-1">
        <input
          type="number"
          value={bowler.game1 ?? ''}
          onChange={(e) =>
            onUpdate(matchIdx, bowlerIdx, 'game1', parseScore(e.target.value))
          }
          disabled={bowler.isPenalty}
          min={0}
          max={300}
          className="w-full text-center bg-transparent border border-navy/10 rounded px-1 py-0.5 text-navy focus:border-navy/40 focus:outline-none disabled:bg-navy/5"
        />
      </td>

      {/* Game 2 */}
      <td className="py-1.5 px-1">
        <input
          type="number"
          value={bowler.game2 ?? ''}
          onChange={(e) =>
            onUpdate(matchIdx, bowlerIdx, 'game2', parseScore(e.target.value))
          }
          disabled={bowler.isPenalty}
          min={0}
          max={300}
          className="w-full text-center bg-transparent border border-navy/10 rounded px-1 py-0.5 text-navy focus:border-navy/40 focus:outline-none disabled:bg-navy/5"
        />
      </td>

      {/* Game 3 */}
      <td className="py-1.5 px-1">
        <input
          type="number"
          value={bowler.game3 ?? ''}
          onChange={(e) =>
            onUpdate(matchIdx, bowlerIdx, 'game3', parseScore(e.target.value))
          }
          disabled={bowler.isPenalty}
          min={0}
          max={300}
          className="w-full text-center bg-transparent border border-navy/10 rounded px-1 py-0.5 text-navy focus:border-navy/40 focus:outline-none disabled:bg-navy/5"
        />
      </td>

      {/* Turkeys */}
      <td className="py-1.5 px-1">
        <input
          type="number"
          value={bowler.turkeys}
          onChange={(e) =>
            onUpdate(
              matchIdx,
              bowlerIdx,
              'turkeys',
              parseInt(e.target.value, 10) || 0,
            )
          }
          disabled={bowler.isPenalty}
          min={0}
          max={12}
          className="w-full text-center bg-transparent border border-navy/10 rounded px-1 py-0.5 text-navy focus:border-navy/40 focus:outline-none disabled:bg-navy/5"
        />
      </td>

      {/* Avg */}
      <td className="py-1.5 px-1 text-center text-navy/50">
        {bowler.incomingAvg != null ? bowler.incomingAvg : '-'}
      </td>

      {/* Status */}
      <td className="py-1.5 px-1 text-center">
        <button
          onClick={() => onTogglePenalty(matchIdx, bowlerIdx)}
          className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
            bowler.isPenalty
              ? 'bg-red/10 text-red border border-red/20'
              : 'bg-navy/5 text-navy/40 hover:bg-navy/10'
          }`}
        >
          {bowler.isPenalty ? 'PENALTY' : 'Active'}
        </button>
      </td>

      {/* Remove */}
      <td className="py-1.5 px-1 text-center">
        <button
          onClick={() => onRemove(matchIdx, bowlerIdx)}
          className="px-2 py-1 text-sm font-semibold text-navy/30 hover:text-red hover:bg-red/10 rounded transition-colors"
          title="Remove bowler"
        >
          X
        </button>
      </td>
    </tr>
  );
}
