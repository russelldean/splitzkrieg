'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Team {
  teamID: number;
  teamName: string;
  divisionName: string | null;
}

interface DivisionTopTeam {
  teamID: number;
  teamName: string;
  divisionName: string;
  divRank: number;
  totalPts: number;
}

interface SemifinalRow {
  playoffID: number;
  team1ID: number;
  team2ID: number;
  winnerTeamID: number | null;
}

interface FinalRow {
  playoffID: number;
  team1ID: number;
  team2ID: number;
  winnerTeamID: number | null;
}

interface RoundTwoCategory {
  type: 'MensScratch' | 'WomensScratch' | 'Handicap';
  saved: SavedParticipant[];
  pool: SavedParticipant[]; // 8 round 1 participants — the only swap pool for round 2
  advancing: Array<{ bowlerID: number; bowlerName: string; series: number }>;
}

interface BowlerCandidate {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  teamID: number | null;
  teamName: string | null;
  value: number;
  gamesBowled: number;
}

interface SavedParticipant {
  position: number;
  bowlerID: number;
  bowlerName: string;
  slug: string;
}

interface CategoryData {
  candidates: BowlerCandidate[];
  saved: SavedParticipant[];
}

interface Props {
  seasonID: number;
  seasonName: string;
  divisionTopTeams: DivisionTopTeam[];
  allTeams: Team[];
  semifinals: SemifinalRow[];
  mScratch: CategoryData;
  wScratch: CategoryData;
  handicap: CategoryData;
  teamFinal: FinalRow | null;
  round2: {
    mScratch: RoundTwoCategory;
    wScratch: RoundTwoCategory;
    handicap: RoundTwoCategory;
  };
}

const FIELD_SIZE = 8;
const ROUND2_FIELD_SIZE = 4;

type Status = { text: string; type: 'success' | 'error' } | null;

export function PlayoffsAdminClient(props: Props) {
  const router = useRouter();

  // Suggested matchups: A1 vs A2, B1 vs B2 from divisionTopTeams.
  const divA = props.divisionTopTeams.filter(t => t.divisionName === 'Division A');
  const divB = props.divisionTopTeams.filter(t => t.divisionName === 'Division B');
  const suggestedSemi1 = divA.length === 2 ? [divA[0].teamID, divA[1].teamID] : [0, 0];
  const suggestedSemi2 = divB.length === 2 ? [divB[0].teamID, divB[1].teamID] : [0, 0];

  // Initial semis: saved if present, else suggested
  const initialSemi1: [number, number] = props.semifinals[0]
    ? [props.semifinals[0].team1ID, props.semifinals[0].team2ID]
    : [suggestedSemi1[0], suggestedSemi1[1]];
  const initialSemi2: [number, number] = props.semifinals[1]
    ? [props.semifinals[1].team1ID, props.semifinals[1].team2ID]
    : [suggestedSemi2[0], suggestedSemi2[1]];

  const [semi1, setSemi1] = useState<[number, number]>(initialSemi1);
  const [semi2, setSemi2] = useState<[number, number]>(initialSemi2);

  // Initial picks per category: saved if present, else top-8 candidates
  const initialPicks = (cat: CategoryData): number[] =>
    cat.saved.length === FIELD_SIZE
      ? cat.saved.map(s => s.bowlerID)
      : cat.candidates.slice(0, FIELD_SIZE).map(c => c.bowlerID);

  const [mPicks, setMPicks] = useState<number[]>(initialPicks(props.mScratch));
  const [wPicks, setWPicks] = useState<number[]>(initialPicks(props.wScratch));
  const [hPicks, setHPicks] = useState<number[]>(initialPicks(props.handicap));

  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [round1Date, setRound1Date] = useState<string>('');
  const [round2Date, setRound2Date] = useState<string>('');

  // Round 2 state
  const semiWinners = props.semifinals.map(s => s.winnerTeamID);
  const bothSemisRecorded = semiWinners.every(w => w !== null);

  // Team final pre-fill: from saved final OR from semi winners (if both recorded)
  const initialFinal: [number, number] = props.teamFinal
    ? [props.teamFinal.team1ID, props.teamFinal.team2ID]
    : bothSemisRecorded
      ? [semiWinners[0]!, semiWinners[1]!]
      : [0, 0];
  const [finalMatchup, setFinalMatchup] = useState<[number, number]>(initialFinal);

  // Round 2 individual picks per category — initial:
  //   1. Saved round 2 selections if present
  //   2. Else top 4 advancing (if scores in)
  //   3. Else empty 4 slots
  const initialR2 = (cat: RoundTwoCategory): number[] => {
    if (cat.saved.length === ROUND2_FIELD_SIZE) return cat.saved.map(s => s.bowlerID);
    if (cat.advancing.length === ROUND2_FIELD_SIZE) return cat.advancing.map(a => a.bowlerID);
    return new Array(ROUND2_FIELD_SIZE).fill(0);
  };
  const [mR2, setMR2] = useState<number[]>(initialR2(props.round2.mScratch));
  const [wR2, setWR2] = useState<number[]>(initialR2(props.round2.wScratch));
  const [hR2, setHR2] = useState<number[]>(initialR2(props.round2.handicap));

  const setStatus = (key: string, status: Status) =>
    setStatuses(s => ({ ...s, [key]: status }));

  const teamName = useCallback(
    (id: number) => props.allTeams.find(t => t.teamID === id)?.teamName ?? '—',
    [props.allTeams],
  );

  const saveSemis = useCallback(async () => {
    setBusy('semis');
    setStatus('semis', null);
    try {
      const res = await fetch('/api/evillair/playoffs/save-semis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonID: props.seasonID,
          matchups: [
            { team1ID: semi1[0], team2ID: semi1[1] },
            { team1ID: semi2[0], team2ID: semi2[1] },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('semis', { text: data.error || 'Failed to save', type: 'error' });
      } else {
        setStatus('semis', { text: 'Saved', type: 'success' });
        router.refresh();
      }
    } catch (e) {
      setStatus('semis', { text: e instanceof Error ? e.message : 'Network error', type: 'error' });
    } finally {
      setBusy(null);
    }
  }, [props.seasonID, semi1, semi2, router]);

  const recordSemiWinner = useCallback(async (playoffID: number, winnerTeamID: number) => {
    const key = `semi-${playoffID}`;
    setBusy(key);
    setStatus(key, null);
    try {
      const res = await fetch('/api/evillair/playoffs/record-semi-winner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playoffID, winnerTeamID }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(key, { text: data.error || 'Failed', type: 'error' });
      } else {
        setStatus(key, { text: 'Saved', type: 'success' });
        router.refresh();
      }
    } catch (e) {
      setStatus(key, { text: e instanceof Error ? e.message : 'Network error', type: 'error' });
    } finally {
      setBusy(null);
    }
  }, [router]);

  const saveTeamFinal = useCallback(async () => {
    setBusy('final');
    setStatus('final', null);
    try {
      const res = await fetch('/api/evillair/playoffs/save-final', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonID: props.seasonID,
          team1ID: finalMatchup[0],
          team2ID: finalMatchup[1],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('final', { text: data.error || 'Failed', type: 'error' });
      } else {
        setStatus('final', { text: 'Saved', type: 'success' });
        router.refresh();
      }
    } catch (e) {
      setStatus('final', { text: e instanceof Error ? e.message : 'Network error', type: 'error' });
    } finally {
      setBusy(null);
    }
  }, [props.seasonID, finalMatchup, router]);

  const saveRound2Category = useCallback(
    async (
      key: 'mR2' | 'wR2' | 'hR2',
      championshipType: 'MensScratch' | 'WomensScratch' | 'Handicap',
      bowlerIDs: number[],
    ) => {
      setBusy(key);
      setStatus(key, null);
      try {
        const res = await fetch('/api/evillair/playoffs/save-individuals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seasonID: props.seasonID,
            championshipType,
            round: 2,
            bowlerIDs,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus(key, { text: data.error || 'Failed', type: 'error' });
        } else {
          setStatus(key, { text: 'Saved', type: 'success' });
          router.refresh();
        }
      } catch (e) {
        setStatus(key, { text: e instanceof Error ? e.message : 'Network error', type: 'error' });
      } finally {
        setBusy(null);
      }
    },
    [props.seasonID, router],
  );

  const generateRound2 = useCallback(async () => {
    if (!round2Date) {
      setStatus('generate2', { text: 'Pick a date first', type: 'error' });
      return;
    }
    setBusy('generate2');
    setStatus('generate2', null);
    try {
      const d = new Date(round2Date + 'T12:00:00');
      const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const res = await fetch('/api/evillair/playoffs/scoresheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonID: props.seasonID, round: 2, matchDate: formatted }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed' }));
        setStatus('generate2', { text: data.error || 'Failed to generate', type: 'error' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `playoff-scoresheets-s${props.seasonID}-r2.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('generate2', { text: 'Downloaded', type: 'success' });
    } catch (e) {
      setStatus('generate2', { text: e instanceof Error ? e.message : 'Network error', type: 'error' });
    } finally {
      setBusy(null);
    }
  }, [round2Date, props.seasonID]);

  const generateRound1 = useCallback(async () => {
    if (!round1Date) {
      setStatus('generate', { text: 'Pick a date first', type: 'error' });
      return;
    }
    setBusy('generate');
    setStatus('generate', null);
    try {
      // Format YYYY-MM-DD into "Mon D, YYYY" (e.g. "May 11, 2026")
      const d = new Date(round1Date + 'T12:00:00');
      const formatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const res = await fetch('/api/evillair/playoffs/scoresheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonID: props.seasonID, round: 1, matchDate: formatted }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed' }));
        setStatus('generate', { text: data.error || 'Failed to generate', type: 'error' });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `playoff-scoresheets-s${props.seasonID}-r1.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('generate', { text: 'Downloaded', type: 'success' });
    } catch (e) {
      setStatus('generate', { text: e instanceof Error ? e.message : 'Network error', type: 'error' });
    } finally {
      setBusy(null);
    }
  }, [round1Date, props.seasonID]);

  const saveCategory = useCallback(
    async (
      key: 'mScratch' | 'wScratch' | 'handicap',
      championshipType: 'MensScratch' | 'WomensScratch' | 'Handicap',
      bowlerIDs: number[],
    ) => {
      setBusy(key);
      setStatus(key, null);
      try {
        const res = await fetch('/api/evillair/playoffs/save-individuals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seasonID: props.seasonID,
            championshipType,
            round: 1,
            bowlerIDs,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus(key, { text: data.error || 'Failed to save', type: 'error' });
        } else {
          setStatus(key, { text: 'Saved', type: 'success' });
          router.refresh();
        }
      } catch (e) {
        setStatus(key, { text: e instanceof Error ? e.message : 'Network error', type: 'error' });
      } finally {
        setBusy(null);
      }
    },
    [props.seasonID, router],
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-heading text-2xl text-navy mb-1">Playoffs</h1>
      <p className="font-body text-sm text-navy/60 mb-8">
        {props.seasonName} — Round 1 setup
      </p>

      {/* Round 1 generate */}
      <section className="bg-white rounded-lg shadow-sm border border-navy/10 mb-6">
        <header className="bg-navy/5 px-5 py-3 border-b border-navy/10">
          <h2 className="font-heading text-base text-navy">Round 1 Scoresheets</h2>
        </header>
        <div className="p-5">
          <p className="font-body text-xs text-navy/60 mb-4">
            Combined PDF: 2 team semifinals + 3 individual sheets (M Scratch, W Scratch, Handicap).
            Save matchups and individual fields below first, then generate.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="block font-body text-xs text-navy/60 mb-1">Match date</label>
              <input
                type="date"
                value={round1Date}
                onChange={e => setRound1Date(e.target.value)}
                className="font-body text-sm border border-navy/20 rounded px-3 py-2 bg-white text-navy"
              />
            </div>
            <button
              onClick={generateRound1}
              disabled={busy !== null || !round1Date}
              className="self-end px-4 py-2 bg-navy text-cream font-body text-sm rounded hover:bg-navy/90 disabled:opacity-50 transition-colors"
            >
              {busy === 'generate' ? 'Generating...' : 'Generate Round 1 PDF'}
            </button>
            <div className="self-end pb-2">
              <StatusLabel status={statuses.generate} />
            </div>
          </div>
        </div>
      </section>

      {/* Team Semifinals */}
      <section className="bg-white rounded-lg shadow-sm border border-navy/10 mb-6">
        <header className="bg-navy/5 px-5 py-3 border-b border-navy/10">
          <h2 className="font-heading text-base text-navy">Team Semifinals</h2>
        </header>
        <div className="p-5">
          <p className="font-body text-xs text-navy/60 mb-3">
            Suggested by division (top 2 in each, post-tiebreaker):
          </p>
          <ul className="font-body text-sm text-navy/80 mb-5 space-y-0.5">
            {['Division A', 'Division B'].map(div => {
              const teams = props.divisionTopTeams.filter(t => t.divisionName === div);
              return teams.length === 2 ? (
                <li key={div}>
                  <span className="text-navy/50">{div}:</span>{' '}
                  1. {teams[0].teamName} ({teams[0].totalPts}) ·{' '}
                  2. {teams[1].teamName} ({teams[1].totalPts})
                </li>
              ) : null;
            })}
          </ul>

          <div className="space-y-4">
            <SemiPicker
              label="Semifinal #1"
              value={semi1}
              onChange={setSemi1}
              teams={props.allTeams}
            />
            <SemiPicker
              label="Semifinal #2"
              value={semi2}
              onChange={setSemi2}
              teams={props.allTeams}
            />
          </div>

          <div className="flex items-center justify-between mt-5 pt-4 border-t border-navy/10">
            <StatusLabel status={statuses.semis} />
            <button
              onClick={saveSemis}
              disabled={busy !== null}
              className="px-4 py-2 bg-navy text-cream font-body text-sm rounded hover:bg-navy/90 disabled:opacity-50 transition-colors"
            >
              {busy === 'semis' ? 'Saving...' : 'Save Matchups'}
            </button>
          </div>

          {props.semifinals.length === 2 && (
            <p className="font-body text-xs text-navy/50 mt-4">
              Currently saved:{' '}
              {teamName(props.semifinals[0].team1ID)} vs {teamName(props.semifinals[0].team2ID)} ·{' '}
              {teamName(props.semifinals[1].team1ID)} vs {teamName(props.semifinals[1].team2ID)}
            </p>
          )}
        </div>
      </section>

      <CategorySection
        title="Men's Scratch (top 8)"
        helpText="Pre-filled from current season scratch leaderboard. Swap any slot."
        candidates={props.mScratch.candidates}
        picks={mPicks}
        onChange={setMPicks}
        valueLabel="avg"
        status={statuses.mScratch}
        busy={busy === 'mScratch'}
        disabled={busy !== null}
        onSave={() => saveCategory('mScratch', 'MensScratch', mPicks)}
      />

      <CategorySection
        title="Women's Scratch (top 8)"
        helpText="Pre-filled from current season scratch leaderboard. Swap any slot."
        candidates={props.wScratch.candidates}
        picks={wPicks}
        onChange={setWPicks}
        valueLabel="avg"
        status={statuses.wScratch}
        busy={busy === 'wScratch'}
        disabled={busy !== null}
        onSave={() => saveCategory('wScratch', 'WomensScratch', wPicks)}
      />

      <CategorySection
        title="Handicap (top 8)"
        helpText="Excludes bowlers in the scratch fields above. Save M/W scratch first to refresh this list."
        candidates={props.handicap.candidates}
        picks={hPicks}
        onChange={setHPicks}
        valueLabel="hcp avg"
        status={statuses.handicap}
        busy={busy === 'handicap'}
        disabled={busy !== null}
        onSave={() => saveCategory('handicap', 'Handicap', hPicks)}
      />

      <h2 className="font-heading text-xl text-navy mt-12 mb-4 pb-2 border-b border-navy/10">
        Round 2
      </h2>

      {/* Round 2 generate */}
      <section className="bg-white rounded-lg shadow-sm border border-navy/10 mb-6">
        <header className="bg-navy/5 px-5 py-3 border-b border-navy/10">
          <h2 className="font-heading text-base text-navy">Round 2 Scoresheets</h2>
        </header>
        <div className="p-5">
          <p className="font-body text-xs text-navy/60 mb-4">
            Combined PDF: 1 team final + 3 individual finals (4 vs 4). Record semi
            winners and round 2 individual fields below first.
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <label className="block font-body text-xs text-navy/60 mb-1">Match date</label>
              <input
                type="date"
                value={round2Date}
                onChange={e => setRound2Date(e.target.value)}
                className="font-body text-sm border border-navy/20 rounded px-3 py-2 bg-white text-navy"
              />
            </div>
            <button
              onClick={generateRound2}
              disabled={busy !== null || !round2Date}
              className="self-end px-4 py-2 bg-navy text-cream font-body text-sm rounded hover:bg-navy/90 disabled:opacity-50 transition-colors"
            >
              {busy === 'generate2' ? 'Generating...' : 'Generate Round 2 PDF'}
            </button>
            <div className="self-end pb-2">
              <StatusLabel status={statuses.generate2} />
            </div>
          </div>
        </div>
      </section>

      {/* Record semi winners */}
      <section className="bg-white rounded-lg shadow-sm border border-navy/10 mb-6">
        <header className="bg-navy/5 px-5 py-3 border-b border-navy/10">
          <h2 className="font-heading text-base text-navy">Record Semifinal Winners</h2>
        </header>
        <div className="p-5">
          {props.semifinals.length < 2 ? (
            <p className="font-body text-sm text-navy/60">
              Save semifinal matchups above first.
            </p>
          ) : (
            <div className="space-y-4">
              {props.semifinals.map((semi, i) => (
                <SemiWinnerPicker
                  key={semi.playoffID}
                  label={`Semifinal #${i + 1}`}
                  semi={semi}
                  teamName={teamName}
                  busy={busy === `semi-${semi.playoffID}`}
                  disabled={busy !== null}
                  status={statuses[`semi-${semi.playoffID}`]}
                  onPick={(winnerTeamID) => recordSemiWinner(semi.playoffID, winnerTeamID)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Team final */}
      <section className="bg-white rounded-lg shadow-sm border border-navy/10 mb-6">
        <header className="bg-navy/5 px-5 py-3 border-b border-navy/10">
          <h2 className="font-heading text-base text-navy">Team Final</h2>
        </header>
        <div className="p-5">
          {!bothSemisRecorded && !props.teamFinal ? (
            <p className="font-body text-sm text-navy/60">
              Record both semifinal winners first to auto-fill the final matchup.
            </p>
          ) : (
            <>
              <p className="font-body text-xs text-navy/60 mb-4">
                Pre-filled from semifinal winners. Override if needed.
              </p>
              <div className="flex items-center gap-3 mb-5">
                <TeamSelect
                  value={finalMatchup[0]}
                  onChange={v => setFinalMatchup([v, finalMatchup[1]])}
                  teams={props.allTeams}
                />
                <span className="font-body text-xs text-navy/50">vs</span>
                <TeamSelect
                  value={finalMatchup[1]}
                  onChange={v => setFinalMatchup([finalMatchup[0], v])}
                  teams={props.allTeams}
                />
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-navy/10">
                <StatusLabel status={statuses.final} />
                <button
                  onClick={saveTeamFinal}
                  disabled={
                    busy !== null ||
                    !finalMatchup[0] ||
                    !finalMatchup[1] ||
                    finalMatchup[0] === finalMatchup[1]
                  }
                  className="px-4 py-2 bg-navy text-cream font-body text-sm rounded hover:bg-navy/90 disabled:opacity-50 transition-colors"
                >
                  {busy === 'final' ? 'Saving...' : 'Save Final Matchup'}
                </button>
              </div>
              {props.teamFinal && (
                <p className="font-body text-xs text-navy/50 mt-3">
                  Currently saved: {teamName(props.teamFinal.team1ID)} vs {teamName(props.teamFinal.team2ID)}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <Round2CategorySection
        title="Men's Scratch — Top 4"
        cat={props.round2.mScratch}
        picks={mR2}
        onChange={setMR2}
        seriesLabel="series"
        status={statuses.mR2}
        busy={busy === 'mR2'}
        disabled={busy !== null}
        onSave={() => saveRound2Category('mR2', 'MensScratch', mR2)}
      />

      <Round2CategorySection
        title="Women's Scratch — Top 4"
        cat={props.round2.wScratch}
        picks={wR2}
        onChange={setWR2}
        seriesLabel="series"
        status={statuses.wR2}
        busy={busy === 'wR2'}
        disabled={busy !== null}
        onSave={() => saveRound2Category('wR2', 'WomensScratch', wR2)}
      />

      <Round2CategorySection
        title="Handicap — Top 4"
        cat={props.round2.handicap}
        picks={hR2}
        onChange={setHR2}
        seriesLabel="hcp series"
        status={statuses.hR2}
        busy={busy === 'hR2'}
        disabled={busy !== null}
        onSave={() => saveRound2Category('hR2', 'Handicap', hR2)}
      />
    </div>
  );
}

function StatusLabel({ status }: { status: Status }) {
  if (!status) return <span />;
  return (
    <span
      className={`font-body text-xs ${
        status.type === 'success' ? 'text-green-700' : 'text-red'
      }`}
    >
      {status.text}
    </span>
  );
}

function SemiPicker({
  label,
  value,
  onChange,
  teams,
}: {
  label: string;
  value: [number, number];
  onChange: (v: [number, number]) => void;
  teams: Team[];
}) {
  return (
    <div>
      <p className="font-body text-xs font-semibold text-navy/60 uppercase tracking-wider mb-1.5">
        {label}
      </p>
      <div className="flex items-center gap-3">
        <TeamSelect
          value={value[0]}
          onChange={v => onChange([v, value[1]])}
          teams={teams}
        />
        <span className="font-body text-xs text-navy/50">vs</span>
        <TeamSelect
          value={value[1]}
          onChange={v => onChange([value[0], v])}
          teams={teams}
        />
      </div>
    </div>
  );
}

function TeamSelect({
  value,
  onChange,
  teams,
}: {
  value: number;
  onChange: (v: number) => void;
  teams: Team[];
}) {
  // Group by division for readable dropdown
  const groups = new Map<string, Team[]>();
  for (const t of teams) {
    const div = t.divisionName ?? 'Other';
    if (!groups.has(div)) groups.set(div, []);
    groups.get(div)!.push(t);
  }

  return (
    <select
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="flex-1 font-body text-sm border border-navy/20 rounded px-3 py-2 bg-white text-navy"
    >
      <option value={0}>— Select team —</option>
      {Array.from(groups.entries()).map(([div, ts]) => (
        <optgroup key={div} label={div}>
          {ts.map(t => (
            <option key={t.teamID} value={t.teamID}>
              {t.teamName}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function SemiWinnerPicker({
  label,
  semi,
  teamName,
  busy,
  disabled,
  status,
  onPick,
}: {
  label: string;
  semi: SemifinalRow;
  teamName: (id: number) => string;
  busy: boolean;
  disabled: boolean;
  status: Status;
  onPick: (winnerTeamID: number) => void;
}) {
  return (
    <div>
      <p className="font-body text-xs font-semibold text-navy/60 uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        {[semi.team1ID, semi.team2ID].map(teamID => {
          const isWinner = semi.winnerTeamID === teamID;
          return (
            <button
              key={teamID}
              type="button"
              onClick={() => onPick(teamID)}
              disabled={disabled}
              className={`px-4 py-2 font-body text-sm rounded border transition-colors ${
                isWinner
                  ? 'bg-navy text-cream border-navy'
                  : 'bg-white text-navy border-navy/20 hover:bg-navy/5'
              } disabled:opacity-50`}
            >
              {teamName(teamID)} {isWinner && '✓'}
            </button>
          );
        })}
        {busy && <span className="font-body text-xs text-navy/50">Saving...</span>}
        <StatusLabel status={status} />
      </div>
    </div>
  );
}

function Round2CategorySection({
  title,
  cat,
  picks,
  onChange,
  seriesLabel,
  status,
  busy,
  disabled,
  onSave,
}: {
  title: string;
  cat: RoundTwoCategory;
  picks: number[];
  onChange: (v: number[]) => void;
  seriesLabel: string;
  status: Status;
  busy: boolean;
  disabled: boolean;
  onSave: () => void;
}) {
  const setSlot = (i: number, bowlerID: number) => {
    const next = [...picks];
    next[i] = bowlerID;
    onChange(next);
  };

  const poolMap = new Map(cat.pool.map(p => [p.bowlerID, p]));
  const advancingMap = new Map(cat.advancing.map(a => [a.bowlerID, a]));

  const counts = new Map<number, number>();
  for (const id of picks) {
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const dupIDs = new Set(Array.from(counts.entries()).filter(([, n]) => n > 1).map(([id]) => id));
  const hasDup = dupIDs.size > 0;
  const hasEmpty = picks.some(p => !p);
  const noPool = cat.pool.length === 0;

  return (
    <section className="bg-white rounded-lg shadow-sm border border-navy/10 mb-6">
      <header className="bg-navy/5 px-5 py-3 border-b border-navy/10">
        <h2 className="font-heading text-base text-navy">{title}</h2>
      </header>
      <div className="p-5">
        {noPool ? (
          <p className="font-body text-sm text-navy/60">
            No round 1 field saved for this category. Save the round 1 selections above first.
          </p>
        ) : (
          <>
            <p className="font-body text-xs text-navy/60 mb-4">
              {cat.advancing.length === ROUND2_FIELD_SIZE
                ? `Pre-filled with top 4 from round 1 by ${seriesLabel}. Override if needed (e.g. someone can't make it).`
                : `Round 1 scores not yet recorded. Pick the top 4 advancing manually.`}
            </p>

            <ol className="space-y-2">
              {Array.from({ length: ROUND2_FIELD_SIZE }, (_, i) => {
                const id = picks[i];
                const advancing = id ? advancingMap.get(id) : undefined;
                const isDup = id && dupIDs.has(id);
                return (
                  <li key={i} className="flex items-center gap-3">
                    <span className="font-body text-xs text-navy/40 w-5">{i + 1}.</span>
                    <select
                      value={id || 0}
                      onChange={e => setSlot(i, Number(e.target.value))}
                      className={`flex-1 font-body text-sm border rounded px-3 py-1.5 bg-white text-navy ${
                        isDup ? 'border-red ring-1 ring-red/40' : 'border-navy/20'
                      }`}
                    >
                      <option value={0}>— Select bowler —</option>
                      {cat.pool.map(p => {
                        const adv = advancingMap.get(p.bowlerID);
                        return (
                          <option key={p.bowlerID} value={p.bowlerID}>
                            {p.bowlerName}
                            {adv ? ` (${seriesLabel} ${adv.series})` : ''}
                          </option>
                        );
                      })}
                      {/* Allow keeping a saved pick that isn't in the round 1 pool */}
                      {id && !poolMap.has(id) && (
                        <option value={id}>(saved bowler #{id} — outside round 1 pool)</option>
                      )}
                    </select>
                    <span className="font-body text-xs text-navy/40 w-20 text-right">
                      {advancing ? advancing.series : ''}
                    </span>
                  </li>
                );
              })}
            </ol>

            {hasDup && (
              <p className="font-body text-xs text-red mt-3">
                A bowler appears in more than one slot — fix duplicates before saving.
              </p>
            )}

            <div className="flex items-center justify-between mt-5 pt-4 border-t border-navy/10">
              <StatusLabel status={status} />
              <button
                onClick={onSave}
                disabled={disabled || hasDup || hasEmpty}
                className="px-4 py-2 bg-navy text-cream font-body text-sm rounded hover:bg-navy/90 disabled:opacity-50 transition-colors"
              >
                {busy ? 'Saving...' : `Save ${title.split(' —')[0]}`}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function CategorySection({
  title,
  helpText,
  candidates,
  picks,
  onChange,
  valueLabel,
  status,
  busy,
  disabled,
  onSave,
}: {
  title: string;
  helpText: string;
  candidates: BowlerCandidate[];
  picks: number[];
  onChange: (v: number[]) => void;
  valueLabel: string;
  status: Status;
  busy: boolean;
  disabled: boolean;
  onSave: () => void;
}) {
  const setSlot = (i: number, bowlerID: number) => {
    const next = [...picks];
    next[i] = bowlerID;
    onChange(next);
  };

  // Picked bowlers (for showing avg next to each row)
  const candidateMap = new Map(candidates.map(c => [c.bowlerID, c]));

  // Detect duplicates in current picks
  const counts = new Map<number, number>();
  for (const id of picks) {
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const dupIDs = new Set(Array.from(counts.entries()).filter(([, n]) => n > 1).map(([id]) => id));
  const hasDup = dupIDs.size > 0;
  const hasEmpty = picks.some(p => !p);

  return (
    <section className="bg-white rounded-lg shadow-sm border border-navy/10 mb-6">
      <header className="bg-navy/5 px-5 py-3 border-b border-navy/10">
        <h2 className="font-heading text-base text-navy">{title}</h2>
      </header>
      <div className="p-5">
        <p className="font-body text-xs text-navy/60 mb-4">{helpText}</p>

        <ol className="space-y-2">
          {Array.from({ length: FIELD_SIZE }, (_, i) => {
            const id = picks[i];
            const picked = id ? candidateMap.get(id) : undefined;
            const isDup = id && dupIDs.has(id);
            return (
              <li key={i} className="flex items-center gap-3">
                <span className="font-body text-xs text-navy/40 w-5">{i + 1}.</span>
                <select
                  value={id || 0}
                  onChange={e => setSlot(i, Number(e.target.value))}
                  className={`flex-1 font-body text-sm border rounded px-3 py-1.5 bg-white text-navy ${
                    isDup ? 'border-red ring-1 ring-red/40' : 'border-navy/20'
                  }`}
                >
                  <option value={0}>— Select bowler —</option>
                  {candidates.map(c => (
                    <option key={c.bowlerID} value={c.bowlerID}>
                      {c.bowlerName} ({valueLabel} {c.value})
                    </option>
                  ))}
                  {/* Allow keeping a pick that isn't in current top-N list */}
                  {id && !candidateMap.has(id) && (
                    <option value={id}>(saved bowler #{id} — not in current top {candidates.length})</option>
                  )}
                </select>
                <span className="font-body text-xs text-navy/40 w-20 text-right">
                  {picked ? `${picked.gamesBowled} gms` : ''}
                </span>
              </li>
            );
          })}
        </ol>

        {hasDup && (
          <p className="font-body text-xs text-red mt-3">
            A bowler appears in more than one slot — fix duplicates before saving.
          </p>
        )}

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-navy/10">
          <StatusLabel status={status} />
          <button
            onClick={onSave}
            disabled={disabled || hasDup || hasEmpty}
            className="px-4 py-2 bg-navy text-cream font-body text-sm rounded hover:bg-navy/90 disabled:opacity-50 transition-colors"
          >
            {busy ? 'Saving...' : `Save ${title.split(' (')[0]}`}
          </button>
        </div>
      </div>
    </section>
  );
}
