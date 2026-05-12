'use client';

import { useState, useMemo } from 'react';
import type {
  ChampionshipType,
  DivisionTopTeam,
} from '@/lib/admin/playoff-admin';
import type {
  PlayoffScoreInput,
  PlayoffScoreRow,
} from '@/lib/admin/playoff-scores-admin';
import { rollupTeamTotals } from '@/lib/admin/playoff-scores-utils';

// Shape returned by getIndividualPlayoffParticipants (saved selections, not candidates)
interface SavedParticipant {
  position: number;
  bowlerID: number;
  bowlerName: string;
  slug: string;
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
}

export function PlayoffScoresheetClient({
  seasonID,
  seasonName,
  topTeams,
  individualParticipants,
  existingScores,
}: Props) {
  const [round, setRound] = useState<1 | 2>(1);
  const [mode, setMode] = useState<SelectionMode | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function loadMode(newMode: SelectionMode, newRound: 1 | 2) {
    setError(null);
    setSavedAt(null);
    const existing = existingScores[newRound];

    if (newMode.kind === 'team') {
      const teamRows = existing.filter(r => r.teamID === newMode.teamID);
      setRows(
        teamRows.map(r => ({
          bowlerID: r.bowlerID,
          bowlerName: `Bowler ${r.bowlerID}`,
          teamID: r.teamID,
          championshipType: r.championshipType,
          game1: r.game1,
          game2: r.game2,
          game3: r.game3,
          incomingAvg: r.incomingAvg,
        })),
      );
    } else {
      const participants = individualParticipants[newRound][newMode.championshipType];
      const existingByBowler = new Map(
        existing
          .filter(r => r.championshipType === newMode.championshipType)
          .map(r => [r.bowlerID, r]),
      );
      setRows(
        participants.map(p => {
          const prior = existingByBowler.get(p.bowlerID);
          return {
            bowlerID: p.bowlerID,
            bowlerName: p.bowlerName,
            teamID: prior?.teamID ?? null,
            championshipType: newMode.championshipType,
            game1: prior?.game1 ?? null,
            game2: prior?.game2 ?? null,
            game3: prior?.game3 ?? null,
            incomingAvg: prior?.incomingAvg ?? null,
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

  const totals = useMemo(() => rollupTeamTotals(rows), [rows]);

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
                  <th className="pb-2 pr-4">Game 1</th>
                  <th className="pb-2 pr-4">Game 2</th>
                  <th className="pb-2 pr-4">Game 3</th>
                  <th className="pb-2">Series</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-navy/40 text-center">
                      No participants saved for this selection yet.
                    </td>
                  </tr>
                )}
                {rows.map((r, i) => {
                  const series = (r.game1 ?? 0) + (r.game2 ?? 0) + (r.game3 ?? 0);
                  return (
                    <tr key={r.bowlerID} className="border-t border-navy/10">
                      <td className="py-2 pr-4 text-navy">{r.bowlerName}</td>
                      <td className="py-2 pr-4 text-navy/60">{r.incomingAvg ?? '-'}</td>
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
                      <td className="py-2 font-semibold text-navy">{series || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
              {mode.kind === 'team' && rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-navy/20 font-semibold text-navy">
                    <td className="pt-2 pr-4">Totals</td>
                    <td className="pt-2 pr-4" />
                    <td className="pt-2 pr-4">{totals.scratch.game1 || '-'}</td>
                    <td className="pt-2 pr-4">{totals.scratch.game2 || '-'}</td>
                    <td className="pt-2 pr-4">{totals.scratch.game3 || '-'}</td>
                    <td className="pt-2">{totals.scratch.series || '-'}</td>
                  </tr>
                </tfoot>
              )}
            </table>

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
