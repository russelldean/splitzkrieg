'use client';

import { useState, useMemo, useCallback } from 'react';
import type {
  ChampionshipType,
  DivisionTopTeam,
} from '@/lib/admin/playoff-admin';
import type {
  PlayoffScoreInput,
  PlayoffScoreRow,
  PlayoffLineupSeed,
  TeamRosterBowler,
} from '@/lib/admin/playoff-scores-admin';
import { rollupTeamTotals } from '@/lib/admin/playoff-scores-utils';

// Shape returned by getIndividualPlayoffParticipants (saved selections, not candidates),
// enriched server-side with the bowler's rolling avg as of the playoff week.
interface SavedParticipant {
  position: number;
  bowlerID: number;
  bowlerName: string;
  slug: string;
  incomingAvg: number | null;
}

type ParticipantsByRoundType = {
  1: Record<ChampionshipType, SavedParticipant[]>;
  2: Record<ChampionshipType, SavedParticipant[]>;
};

interface Props {
  seasonID: number;
  seasonName: string;
  topTeams: DivisionTopTeam[];
  individualParticipants: ParticipantsByRoundType;
  existingScores: { 1: PlayoffScoreRow[]; 2: PlayoffScoreRow[] };
  teamLineups: {
    1: Record<number, PlayoffLineupSeed[]>;
    2: Record<number, PlayoffLineupSeed[]>;
  };
  teamRosters: {
    1: Record<number, TeamRosterBowler[]>;
    2: Record<number, TeamRosterBowler[]>;
  };
}

type SelectionMode =
  | { kind: 'team'; teamID: number }
  | { kind: 'individual'; championshipType: ChampionshipType };

interface EditableRow {
  bowlerID: number;
  bowlerName: string;
  teamID: number | null;
  championshipType: ChampionshipType | null;
  game1: number | null;
  game2: number | null;
  game3: number | null;
  incomingAvg: number | null;
  turkeys: number | null;
}

export function PlayoffScoresheetClient({
  seasonID,
  seasonName,
  topTeams,
  individualParticipants,
  existingScores: initialExistingScores,
  teamLineups,
  teamRosters,
}: Props) {
  const [round, setRound] = useState<1 | 2>(1);
  const [mode, setMode] = useState<SelectionMode | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // Local copy so we can refetch after save without depending on router.refresh
  // making its way through to the server component's props on every dev render.
  const [existingScores, setExistingScores] = useState(initialExistingScores);

  const refetchRound = useCallback(async (r: 1 | 2) => {
    const res = await fetch(`/api/evillair/playoffs/scoresheet?seasonID=${seasonID}&round=${r}`);
    if (!res.ok) return;
    const body = (await res.json()) as { rows: PlayoffScoreRow[] };
    setExistingScores(prev => ({ ...prev, [r]: body.rows }));
  }, [seasonID]);

  function loadMode(newMode: SelectionMode, newRound: 1 | 2) {
    setError(null);
    setSavedAt(null);
    const existing = existingScores[newRound];

    // One DB row per (season, bowler, round). A bowler can be on a team AND in
    // an individual bracket simultaneously, so we always look up prior data by
    // bowlerID (not filtered by team/championship) and preserve both fields.
    const priorByBowler = new Map(existing.map(r => [r.bowlerID, r]));

    if (newMode.kind === 'team') {
      // Bowlers on this team = anyone with teamID matching OR anyone in the
      // submitted lineup. Union both to catch bowlers whose team association
      // got nulled by a later individual-bracket save.
      const lineupSeed = teamLineups[newRound][newMode.teamID] ?? [];
      const bowlerIDs = new Set<number>([
        ...existing.filter(r => r.teamID === newMode.teamID).map(r => r.bowlerID),
        ...lineupSeed.map(s => s.bowlerID),
      ]);
      const seedByBowler = new Map(lineupSeed.map(s => [s.bowlerID, s]));

      setRows(
        Array.from(bowlerIDs).map(bowlerID => {
          const prior = priorByBowler.get(bowlerID);
          const seed = seedByBowler.get(bowlerID);
          return {
            bowlerID,
            bowlerName: seed?.bowlerName ?? `Bowler ${bowlerID}`,
            teamID: newMode.teamID,
            championshipType: prior?.championshipType ?? null,
            game1: prior?.game1 ?? null,
            game2: prior?.game2 ?? null,
            game3: prior?.game3 ?? null,
            incomingAvg: prior?.incomingAvg ?? seed?.incomingAvg ?? null,
            turkeys: prior?.turkeys ?? null,
          };
        }),
      );
    } else {
      const participants = individualParticipants[newRound][newMode.championshipType];
      setRows(
        participants.map(p => {
          const prior = priorByBowler.get(p.bowlerID);
          return {
            bowlerID: p.bowlerID,
            bowlerName: p.bowlerName,
            teamID: prior?.teamID ?? null,
            championshipType: newMode.championshipType,
            game1: prior?.game1 ?? null,
            game2: prior?.game2 ?? null,
            game3: prior?.game3 ?? null,
            incomingAvg: prior?.incomingAvg ?? p.incomingAvg ?? null,
            turkeys: prior?.turkeys ?? null,
          };
        }),
      );
    }
    setMode(newMode);
    setRound(newRound);
  }

  function updateGame(idx: number, key: 'game1' | 'game2' | 'game3', value: string) {
    setRows(rs =>
      rs.map((r, i) =>
        i === idx ? { ...r, [key]: value === '' ? null : Number(value) } : r,
      ),
    );
  }

  function addBowlerToTeam(bowler: TeamRosterBowler) {
    if (mode?.kind !== 'team') return;
    if (rows.some(r => r.bowlerID === bowler.bowlerID)) return;
    setRows(rs => [
      ...rs,
      {
        bowlerID: bowler.bowlerID,
        bowlerName: bowler.bowlerName,
        teamID: mode.teamID,
        championshipType: null,
        game1: null,
        game2: null,
        game3: null,
        incomingAvg: bowler.incomingAvg,
        turkeys: null,
      },
    ]);
  }

  function removeRow(idx: number) {
    setRows(rs => rs.filter((_, i) => i !== idx));
  }

  const availableRoster: TeamRosterBowler[] =
    mode?.kind === 'team'
      ? (teamRosters[round][mode.teamID] ?? []).filter(
          r => !rows.some(row => row.bowlerID === r.bowlerID),
        )
      : [];

  const totals = useMemo(() => rollupTeamTotals(rows), [rows]);

  // Matches DB computed column: FLOOR((225 - FLOOR(avg)) * 0.95). Null/zero avg -> 0 hcp.
  const computeHcp = (avg: number | null): number => {
    if (avg == null) return 0;
    return Math.floor((225 - Math.floor(avg)) * 0.95);
  };

  const hcpTotals = useMemo(() => {
    let g1 = 0, g2 = 0, g3 = 0;
    for (const r of rows) {
      const h = computeHcp(r.incomingAvg);
      g1 += (r.game1 ?? 0) + h;
      g2 += (r.game2 ?? 0) + h;
      g3 += (r.game3 ?? 0) + h;
    }
    return { game1: g1, game2: g2, game3: g3, series: g1 + g2 + g3 };
  }, [rows]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload: PlayoffScoreInput[] = rows.map(r => ({
        bowlerID: r.bowlerID,
        teamID: r.teamID,
        championshipType: r.championshipType,
        game1: r.game1,
        game2: r.game2,
        game3: r.game3,
        incomingAvg: r.incomingAvg,
        turkeys: r.turkeys,
      }));
      const res = await fetch('/api/evillair/playoffs/save-scoresheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonID, round, rows: payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Save failed (${res.status})`);
      }
      setSavedAt(new Date().toLocaleTimeString());
      await refetchRound(round);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const activeLabel =
    mode == null
      ? null
      : mode.kind === 'team'
        ? `Team ${mode.teamID} - Round ${round}`
        : `${mode.championshipType} - Round ${round}`;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="font-heading text-2xl text-navy">Playoff Scoresheets - {seasonName}</h1>

      {/* Round selector */}
      <div className="flex gap-2">
        {([1, 2] as const).map(r => (
          <button
            key={r}
            className={`px-3 py-1 rounded border font-body text-sm ${
              round === r
                ? 'bg-navy text-cream border-navy'
                : 'border-navy/20 text-navy hover:bg-navy/5'
            }`}
            onClick={() => setRound(r)}
          >
            Round {r}
          </button>
        ))}
      </div>

      {/* Selection grid */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-navy/10 p-4">
          <h2 className="font-heading text-base text-navy mb-2">Team matches</h2>
          <ul className="space-y-1">
            {topTeams.map(t => (
              <li key={t.teamID}>
                <button
                  className="font-body text-sm text-navy underline hover:text-navy/70"
                  onClick={() => loadMode({ kind: 'team', teamID: t.teamID }, round)}
                >
                  {t.teamName} ({t.divisionName} #{t.divRank})
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-navy/10 p-4">
          <h2 className="font-heading text-base text-navy mb-2">Individual brackets</h2>
          <ul className="space-y-1">
            {(['MensScratch', 'WomensScratch', 'Handicap'] as const).map(ct => (
              <li key={ct}>
                <button
                  className="font-body text-sm text-navy underline hover:text-navy/70"
                  onClick={() => loadMode({ kind: 'individual', championshipType: ct }, round)}
                >
                  {ct}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Score entry table */}
      {mode && (
        <div className="bg-white rounded-lg shadow-sm border border-navy/10">
          <header className="bg-navy/5 px-5 py-3 border-b border-navy/10">
            <h2 className="font-heading text-base text-navy">{activeLabel}</h2>
          </header>
          <div className="p-5">
            <table className="w-full text-sm font-body">
              <thead>
                <tr className="text-left text-navy/60 border-b border-navy/10">
                  <th className="pb-2 pr-4">Bowler</th>
                  <th className="pb-2 pr-4">Avg</th>
                  <th className="pb-2 pr-4">Hcp</th>
                  <th className="pb-2 pr-4">Game 1</th>
                  <th className="pb-2 pr-4">Game 2</th>
                  <th className="pb-2 pr-4">Game 3</th>
                  <th className="pb-2 pr-4">Scratch</th>
                  <th className="pb-2">Hcp Series</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-4 text-navy/40 text-center">
                      {mode.kind === 'team'
                        ? 'No lineup submitted for this team’s playoff week yet. Have the captain submit a lineup or enter scores via /evillair/scoresheets.'
                        : 'No participants saved for this selection yet.'}
                    </td>
                  </tr>
                )}
                {rows.map((r, i) => {
                  const series = (r.game1 ?? 0) + (r.game2 ?? 0) + (r.game3 ?? 0);
                  const hcp = computeHcp(r.incomingAvg);
                  const handSeries = series === 0 ? 0 : series + 3 * hcp;
                  return (
                    <tr key={r.bowlerID} className="border-t border-navy/10">
                      <td className="py-2 pr-4 text-navy">{r.bowlerName}</td>
                      <td className="py-2 pr-4 text-navy/60">{r.incomingAvg ?? '-'}</td>
                      <td className="py-2 pr-4 text-navy/60">{r.incomingAvg != null ? hcp : '-'}</td>
                      {(['game1', 'game2', 'game3'] as const).map(g => (
                        <td key={g} className="py-2 pr-4">
                          <input
                            type="number"
                            min={0}
                            max={300}
                            className="w-16 border border-navy/20 rounded px-1 py-0.5 font-body text-sm text-navy"
                            value={r[g] ?? ''}
                            onChange={e => updateGame(i, g, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="py-2 pr-4 font-semibold text-navy">{series || '-'}</td>
                      <td className="py-2 font-semibold text-navy">{handSeries || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
              {mode.kind === 'team' && rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-navy/20 font-semibold text-navy">
                    <td className="pt-2 pr-4">Scratch</td>
                    <td className="pt-2 pr-4" />
                    <td className="pt-2 pr-4" />
                    <td className="pt-2 pr-4">{totals.scratch.game1 || '-'}</td>
                    <td className="pt-2 pr-4">{totals.scratch.game2 || '-'}</td>
                    <td className="pt-2 pr-4">{totals.scratch.game3 || '-'}</td>
                    <td className="pt-2 pr-4">{totals.scratch.series || '-'}</td>
                    <td className="pt-2" />
                  </tr>
                  <tr className="font-semibold text-navy">
                    <td className="pt-1 pr-4">+ Hcp</td>
                    <td className="pt-1 pr-4" />
                    <td className="pt-1 pr-4" />
                    <td className="pt-1 pr-4">{hcpTotals.game1 || '-'}</td>
                    <td className="pt-1 pr-4">{hcpTotals.game2 || '-'}</td>
                    <td className="pt-1 pr-4">{hcpTotals.game3 || '-'}</td>
                    <td className="pt-1 pr-4" />
                    <td className="pt-1">{hcpTotals.series || '-'}</td>
                  </tr>
                </tfoot>
              )}
            </table>

            {mode.kind === 'team' && availableRoster.length > 0 && (
              <div className="mt-4 flex items-center gap-2">
                <label className="font-body text-xs text-navy/60">Add bowler:</label>
                <select
                  className="border border-navy/20 rounded px-2 py-1 font-body text-sm text-navy bg-white"
                  value=""
                  onChange={e => {
                    const id = parseInt(e.target.value, 10);
                    const b = availableRoster.find(x => x.bowlerID === id);
                    if (b) addBowlerToTeam(b);
                    e.target.value = '';
                  }}
                >
                  <option value="">Select a bowler...</option>
                  {availableRoster.map(b => (
                    <option key={b.bowlerID} value={b.bowlerID}>
                      {b.bowlerName} ({b.incomingAvg ?? '-'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                className="px-4 py-2 bg-navy text-cream font-body text-sm rounded hover:bg-navy/90 disabled:opacity-50 transition-colors"
                onClick={save}
                disabled={saving || rows.length === 0}
              >
                {saving ? 'Saving...' : 'Save scoresheet'}
              </button>
              {savedAt && (
                <span className="font-body text-sm text-green-700">Saved at {savedAt}</span>
              )}
              {error && (
                <span className="font-body text-sm text-red-600">{error}</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
