import Link from 'next/link';
import type { SeasonScheduleWeek, PairH2HSummary } from '@/lib/queries';

const GHOST_TEAM_ID = 45;

interface Props {
  schedule: SeasonScheduleWeek[];
  h2hSummaries: PairH2HSummary[];
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function getTeamPct(summary: PairH2HSummary | undefined, teamID: number): string | null {
  if (!summary) return null;
  const isTeam1 = summary.team1ID === teamID;
  const w = isTeam1 ? summary.wins : summary.losses;
  const t = summary.ties;
  const total = w + (isTeam1 ? summary.losses : summary.wins) + t;
  if (total === 0) return null;
  return `${(((w + t * 0.5) / total) * 100).toFixed(1)}%`;
}

function getH2HRecord(summary: PairH2HSummary | undefined, teamID: number): string | null {
  if (!summary) return null;
  const isTeam1 = summary.team1ID === teamID;
  const w = isTeam1 ? summary.wins : summary.losses;
  const l = isTeam1 ? summary.losses : summary.wins;
  const t = summary.ties;
  return `${w}-${l}${t > 0 ? `-${t}` : ''}`;
}

export function WeekSchedulePreview({ schedule, h2hSummaries }: Props) {
  if (schedule.length === 0) return null;

  const h2hMap = new Map<string, PairH2HSummary>();
  for (const s of h2hSummaries) {
    h2hMap.set(pairKey(s.team1ID, s.team2ID), s);
  }

  return (
    <div className="space-y-3">
      <h3 className="font-heading text-lg text-navy mb-3">Upcoming Matchups</h3>
      {schedule.map((matchup, idx) => {
        const isGhostMatch = matchup.homeTeamID === GHOST_TEAM_ID || matchup.awayTeamID === GHOST_TEAM_ID;
        const summary = h2hMap.get(pairKey(matchup.homeTeamID, matchup.awayTeamID));
        const homePct = getTeamPct(summary, matchup.homeTeamID);
        const awayPct = getTeamPct(summary, matchup.awayTeamID);
        const record = getH2HRecord(summary, matchup.homeTeamID);
        const hasHistory = summary && (summary.wins + summary.losses + summary.ties) > 0;
        const isFirstTime = !isGhostMatch && !hasHistory;

        return (
          <div
            key={idx}
            className="bg-white border border-navy/10 rounded-lg shadow-sm overflow-hidden"
          >
            {/* Team names row */}
            <div className="flex items-center px-4 py-3 font-body">
              <div className="flex-1 min-w-0">
                <Link
                  href={`/team/${matchup.homeTeamSlug}`}
                  className="font-semibold text-navy hover:text-red-600 transition-colors"
                >
                  {matchup.homeTeamName}
                  {matchup.homeTeamID === GHOST_TEAM_ID && ' 👻'}
                </Link>
                {!isGhostMatch && homePct && (
                  <span className="ml-2 text-sm tabular-nums text-navy/70">{homePct}</span>
                )}
              </div>
              <div className="text-sm text-navy/50 px-3 shrink-0">vs</div>
              <div className="flex-1 min-w-0 text-right">
                {!isGhostMatch && awayPct && (
                  <span className="mr-2 text-sm tabular-nums text-navy/70">{awayPct}</span>
                )}
                <Link
                  href={`/team/${matchup.awayTeamSlug}`}
                  className="font-semibold text-navy hover:text-red-600 transition-colors"
                >
                  {matchup.awayTeamName}
                  {matchup.awayTeamID === GHOST_TEAM_ID && ' 👻'}
                </Link>
              </div>
            </div>
            {/* H2H record bar */}
            {!isGhostMatch && (
              <div className="px-4 py-1.5 border-t border-navy/5 bg-navy/[0.03] text-sm font-body text-navy/70">
                {isFirstTime ? (
                  <span className="italic">First Time Matchup</span>
                ) : (
                  <>
                    <span className="text-navy/50">H2H</span>{' '}
                    <span className="tabular-nums font-medium text-navy">{record}</span>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
