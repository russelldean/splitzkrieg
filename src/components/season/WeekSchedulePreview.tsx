import Link from 'next/link';
import type { SeasonScheduleWeek, PairH2HSummary, StandingsRow } from '@/lib/queries';

const GHOST_TEAM_ID = 45;

interface Props {
  schedule: SeasonScheduleWeek[];
  h2hSummaries: PairH2HSummary[];
  standings?: StandingsRow[];
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function getH2HRecord(summary: PairH2HSummary | undefined, teamID: number): string | null {
  if (!summary) return null;
  const isTeam1 = summary.team1ID === teamID;
  const w = isTeam1 ? summary.wins : summary.losses;
  const l = isTeam1 ? summary.losses : summary.wins;
  const t = summary.ties;
  return `${w}-${l}${t > 0 ? `-${t}` : ''}`;
}

function MatchCard({
  matchup,
  h2hMap,
  standingsMap,
  rankMap,
}: {
  matchup: SeasonScheduleWeek;
  h2hMap: Map<string, PairH2HSummary>;
  standingsMap: Map<number, StandingsRow>;
  rankMap: Map<number, number>;
}) {
  const isGhostMatch = matchup.homeTeamID === GHOST_TEAM_ID || matchup.awayTeamID === GHOST_TEAM_ID;
  const summary = h2hMap.get(pairKey(matchup.homeTeamID, matchup.awayTeamID));
  const record = getH2HRecord(summary, matchup.homeTeamID);
  const hasHistory = summary && (summary.wins + summary.losses + summary.ties) > 0;
  const isFirstTime = !isGhostMatch && !hasHistory;
  const homeStanding = standingsMap.get(matchup.homeTeamID);
  const awayStanding = standingsMap.get(matchup.awayTeamID);
  const homeRank = rankMap.get(matchup.homeTeamID);
  const awayRank = rankMap.get(matchup.awayTeamID);

  return (
    <div className="bg-white border border-navy/10 rounded-lg shadow-sm overflow-hidden">
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
          {homeRank != null && (
            <div className="text-xs text-navy/50 tabular-nums font-body mt-0.5">
              #{homeRank} &middot; {homeStanding?.totalPts ?? 0} pts
            </div>
          )}
        </div>
        <div className="text-sm text-navy/50 px-3 shrink-0">vs</div>
        <div className="flex-1 min-w-0 text-right">
          <Link
            href={`/team/${matchup.awayTeamSlug}`}
            className="font-semibold text-navy hover:text-red-600 transition-colors"
          >
            {matchup.awayTeamName}
            {matchup.awayTeamID === GHOST_TEAM_ID && ' 👻'}
          </Link>
          {awayRank != null && (
            <div className="text-xs text-navy/50 tabular-nums font-body mt-0.5">
              #{awayRank} &middot; {awayStanding?.totalPts ?? 0} pts
            </div>
          )}
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
}

export function WeekSchedulePreview({ schedule, h2hSummaries, standings = [] }: Props) {
  if (schedule.length === 0) return null;

  const h2hMap = new Map<string, PairH2HSummary>();
  for (const s of h2hSummaries) {
    h2hMap.set(pairKey(s.team1ID, s.team2ID), s);
  }

  const standingsMap = new Map<number, StandingsRow>();
  for (const s of standings) {
    standingsMap.set(s.teamID, s);
  }

  // Compute rank within each division
  const rankMap = new Map<number, number>();
  const divisionTeams = new Map<string, StandingsRow[]>();
  for (const s of standings) {
    const div = s.divisionName ?? '__none__';
    if (!divisionTeams.has(div)) divisionTeams.set(div, []);
    divisionTeams.get(div)!.push(s);
  }
  for (const teams of divisionTeams.values()) {
    // standings are already sorted by totalPts DESC within division
    teams.forEach((t, i) => rankMap.set(t.teamID, i + 1));
  }

  // Group matchups by division
  const divisionNames = [...divisionTeams.keys()].filter(d => d !== '__none__').sort();
  const hasDivisions = divisionNames.length > 0;

  if (hasDivisions) {
    // Build a team-to-division map
    const teamDivision = new Map<number, string>();
    for (const s of standings) {
      if (s.divisionName) teamDivision.set(s.teamID, s.divisionName);
    }

    const divisionMatchups = new Map<string, SeasonScheduleWeek[]>();
    for (const matchup of schedule) {
      const div = teamDivision.get(matchup.homeTeamID) ?? teamDivision.get(matchup.awayTeamID) ?? 'Other';
      if (!divisionMatchups.has(div)) divisionMatchups.set(div, []);
      divisionMatchups.get(div)!.push(matchup);
    }

    return (
      <div className="space-y-6">
        <h3 className="font-heading text-lg text-navy">Upcoming Matchups</h3>
        {divisionNames.map(div => {
          const matchups = divisionMatchups.get(div) ?? [];
          if (matchups.length === 0) return null;
          return (
            <div key={div}>
              <h4 className="font-heading text-sm text-navy/65 uppercase tracking-wider mb-2">{div}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {matchups.map((matchup, idx) => (
                  <MatchCard
                    key={idx}
                    matchup={matchup}
                    h2hMap={h2hMap}
                    standingsMap={standingsMap}
                    rankMap={rankMap}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {/* Any matchups not in a division */}
        {divisionMatchups.has('Other') && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {divisionMatchups.get('Other')!.map((matchup, idx) => (
              <MatchCard
                key={idx}
                matchup={matchup}
                h2hMap={h2hMap}
                standingsMap={standingsMap}
                rankMap={rankMap}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // No divisions: two-column grid
  return (
    <div>
      <h3 className="font-heading text-lg text-navy mb-3">Upcoming Matchups</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {schedule.map((matchup, idx) => (
          <MatchCard
            key={idx}
            matchup={matchup}
            h2hMap={h2hMap}
            standingsMap={standingsMap}
            rankMap={rankMap}
          />
        ))}
      </div>
    </div>
  );
}
