/**
 * All-Time Stats page.
 * Currently shows playoff/championship history across all seasons.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { getAllPlayoffHistory, type PlayoffSeason } from '@/lib/queries';

export const metadata: Metadata = {
  title: 'All-Time Stats | Splitzkrieg',
  description:
    'All-time leaderboards, records, and championship history across 35+ seasons of Splitzkrieg Bowling League.',
};

/**
 * Running totals per team:
 * - championships: count of titles won
 * - finals: count of finals appearances (champion or runner-up)
 * - playoffs: count of any playoff appearance (champion, runner-up, or semifinalist)
 */
interface RunningTotals {
  championships: Map<number, number>;
  finals: Map<number, number>;
  playoffs: Map<number, number>;
}

function computeRunningTotals(playoffs: PlayoffSeason[]): Map<number, RunningTotals> {
  // Process oldest-first to build cumulative counts
  const sorted = [...playoffs].reverse();
  const champCount = new Map<number, number>();
  const finalsCount = new Map<number, number>();
  const playoffsCount = new Map<number, number>();

  // Map: seasonID -> snapshot of running totals at that season
  const snapshots = new Map<number, RunningTotals>();

  for (const s of sorted) {
    // All four teams get a playoff appearance
    for (const teamID of [s.championTeamID, s.runnerUpTeamID, s.semi1TeamID, s.semi2TeamID]) {
      if (teamID) playoffsCount.set(teamID, (playoffsCount.get(teamID) || 0) + 1);
    }
    // Champion and runner-up get a finals appearance
    for (const teamID of [s.championTeamID, s.runnerUpTeamID]) {
      if (teamID) finalsCount.set(teamID, (finalsCount.get(teamID) || 0) + 1);
    }
    // Champion gets a championship
    champCount.set(s.championTeamID, (champCount.get(s.championTeamID) || 0) + 1);

    snapshots.set(s.seasonID, {
      championships: new Map(champCount),
      finals: new Map(finalsCount),
      playoffs: new Map(playoffsCount),
    });
  }

  return snapshots;
}

function TeamName({
  canonical,
  historic,
  count,
}: {
  canonical: string;
  historic: string | null;
  count: number;
}) {
  const differs = historic && historic !== canonical;
  return (
    <div className="leading-tight">
      <div>
        {canonical}
        {count > 1 && (
          <span className="opacity-60 ml-1">({count})</span>
        )}
      </div>
      {differs && (
        <div className="opacity-40 text-xs">{historic}</div>
      )}
    </div>
  );
}

function PlayoffRow({
  season,
  totals,
}: {
  season: PlayoffSeason;
  totals: RunningTotals;
}) {
  return (
    <tr className="border-b border-navy/5 last:border-0">
      <td className="py-3 pr-4 align-top whitespace-nowrap">
        <div className="font-heading text-navy/70">{season.romanNumeral}</div>
        <div className="text-navy/40 text-xs">{season.displayName}</div>
      </td>
      <td className="py-3 pr-4 align-top font-body font-bold text-amber-700">
        <TeamName
          canonical={season.championName}
          historic={season.championHistoricName}
          count={totals.championships.get(season.championTeamID) || 0}
        />
      </td>
      <td className="py-3 pr-4 align-top font-body font-medium text-slate-600">
        <TeamName
          canonical={season.runnerUpName}
          historic={season.runnerUpHistoricName}
          count={totals.finals.get(season.runnerUpTeamID) || 0}
        />
      </td>
      <td className="py-3 pr-4 align-top font-body text-navy/70">
        {season.semi1Name && (
          <TeamName
            canonical={season.semi1Name}
            historic={season.semi1HistoricName}
            count={totals.playoffs.get(season.semi1TeamID!) || 0}
          />
        )}
      </td>
      <td className="py-3 align-top font-body text-navy/70">
        {season.semi2Name && (
          <TeamName
            canonical={season.semi2Name}
            historic={season.semi2HistoricName}
            count={totals.playoffs.get(season.semi2TeamID!) || 0}
          />
        )}
      </td>
    </tr>
  );
}

function CovidRow() {
  return (
    <tr className="border-b border-navy/5">
      <td className="py-3 pr-4 align-top whitespace-nowrap">
        <div className="font-heading text-navy/70">XXV</div>
        <div className="text-navy/40 text-xs">Spring 2020</div>
      </td>
      <td colSpan={4} className="py-3 align-top font-body text-navy/40 italic">
        Season Incomplete: Covid
      </td>
    </tr>
  );
}

export default async function AllTimeStatsPage() {
  const playoffs = await getAllPlayoffHistory();
  const snapshots = computeRunningTotals(playoffs);

  const rows: React.ReactNode[] = [];
  let covidInserted = false;

  for (const s of playoffs) {
    if (!covidInserted && s.seasonID < 25) {
      rows.push(<CovidRow key="covid" />);
      covidInserted = true;
    }
    rows.push(
      <PlayoffRow
        key={s.seasonID}
        season={s}
        totals={snapshots.get(s.seasonID)!}
      />
    );
  }
  if (!covidInserted) rows.push(<CovidRow key="covid" />);

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center gap-2 text-sm font-body text-navy/50 mb-4">
        <Link
          href="/stats"
          className="hover:text-red-600 transition-colors"
        >
          Stats
        </Link>
        <span className="text-navy/30">/</span>
        <span className="text-navy/70">All-Time</span>
      </div>

      <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl text-navy">
        All-Time Stats
      </h1>
      <p className="font-body text-lg text-navy/60 mt-1">
        35+ seasons of Splitzkrieg bowling history
      </p>

      {/* Championship History */}
      <section className="mt-10">
        <h2 className="font-heading text-2xl text-navy mb-4">
          Championship History
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-navy/10 text-left">
                <th className="py-2 pr-4 font-heading text-navy/50 text-xs uppercase tracking-wider">
                  Season
                </th>
                <th className="py-2 pr-4 font-heading text-amber-700/50 text-xs uppercase tracking-wider">
                  Champion
                </th>
                <th className="py-2 pr-4 font-heading text-slate-400 text-xs uppercase tracking-wider">
                  Runner-Up
                </th>
                <th className="py-2 pr-4 font-heading text-navy/50 text-xs uppercase tracking-wider">
                  Semifinalist
                </th>
                <th className="py-2 font-heading text-navy/50 text-xs uppercase tracking-wider">
                  Semifinalist
                </th>
              </tr>
            </thead>
            <tbody>
              {rows}
            </tbody>
          </table>
        </div>

        {playoffs.length === 0 && (
          <p className="font-body text-navy/50 italic mt-4">
            No playoff data available.
          </p>
        )}
      </section>

      <div className="mt-8 pt-6 border-t border-navy/10 flex flex-wrap gap-4">
        <Link
          href="/stats"
          className="text-sm font-body text-navy/50 hover:text-red-600 transition-colors"
        >
          Current Season Stats
        </Link>
        <Link
          href="/bowlers"
          className="text-sm font-body text-navy/50 hover:text-red-600 transition-colors"
        >
          Browse Bowlers
        </Link>
      </div>
    </main>
  );
}
