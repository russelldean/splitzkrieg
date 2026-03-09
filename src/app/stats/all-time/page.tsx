/**
 * All-Time Stats page.
 * Shows team and individual championship history across all seasons.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import {
  getAllPlayoffHistory,
  getAllIndividualChampions,
  type PlayoffSeason,
  type IndividualChampionSeason,
} from '@/lib/queries';
import { TrailNav } from '@/components/ui/TrailNav';
import { SectionHeading } from '@/components/ui/SectionHeading';

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
        <div className="text-navy/65 text-xs">{season.displayName}</div>
      </td>
      <td className="py-3 pr-4 align-top font-body font-bold text-amber-700">
        <span className="inline-flex items-center gap-1">
          <span className="text-sm">{'🏆'}</span>
          <TeamName
            canonical={season.championName}
            historic={season.championHistoricName}
            count={totals.championships.get(season.championTeamID) || 0}
          />
        </span>
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

function CovidRow({ colSpan }: { colSpan: number }) {
  return (
    <tr className="border-b border-navy/5">
      <td className="py-3 pr-4 align-top whitespace-nowrap">
        <div className="font-heading text-navy/70">XXV</div>
        <div className="text-navy/65 text-xs">Spring 2020</div>
      </td>
      <td colSpan={colSpan} className="py-3 align-top font-body text-navy/65 italic">
        Season Incomplete: Covid
      </td>
    </tr>
  );
}

function BowlerLink({ name, slug, count }: { name: string; slug: string; count?: number }) {
  return (
    <Link href={`/bowler/${slug}`} className="hover:text-red-600 transition-colors">
      {name}
      {count && count > 1 && (
        <span className="opacity-60 ml-1">({count})</span>
      )}
    </Link>
  );
}

/** Per-cell running counts: scratch titles count before handicap within the same season. */
interface IndividualCellCounts {
  mensScratch: number;
  womensScratch: number;
  handicap: number;
}

function computeIndividualCounts(seasons: IndividualChampionSeason[]) {
  const counts = new Map<string, number>(); // slug → running count
  const snapshots = new Map<number, IndividualCellCounts>();

  const sorted = [...seasons].reverse();
  for (const s of sorted) {
    // Process scratch titles first so they get counted before handicap
    if (s.mensScratchSlug) counts.set(s.mensScratchSlug, (counts.get(s.mensScratchSlug) || 0) + 1);
    const mensScratch = s.mensScratchSlug ? counts.get(s.mensScratchSlug)! : 0;

    if (s.womensScratchSlug) counts.set(s.womensScratchSlug, (counts.get(s.womensScratchSlug) || 0) + 1);
    const womensScratch = s.womensScratchSlug ? counts.get(s.womensScratchSlug)! : 0;

    if (s.handicapSlug) counts.set(s.handicapSlug, (counts.get(s.handicapSlug) || 0) + 1);
    const handicap = s.handicapSlug ? counts.get(s.handicapSlug)! : 0;

    snapshots.set(s.seasonID, { mensScratch, womensScratch, handicap });
  }
  return snapshots;
}

function IndividualChampionRow({
  season,
  counts,
}: {
  season: IndividualChampionSeason;
  counts: IndividualCellCounts;
}) {
  return (
    <tr className="border-b border-navy/5 last:border-0">
      <td className="py-3 pr-4 align-top whitespace-nowrap">
        <div className="font-heading text-navy/70">{season.romanNumeral}</div>
        <div className="text-navy/65 text-xs">{season.displayName}</div>
      </td>
      <td className="py-3 pr-4 align-top font-body text-amber-700 font-bold">
        {season.mensScratchName && season.mensScratchSlug ? (
          <BowlerLink
            name={season.mensScratchName}
            slug={season.mensScratchSlug}
            count={counts.mensScratch}
          />
        ) : (
          <span className="font-heading text-red-600/60 font-bold">X</span>
        )}
      </td>
      <td className="py-3 pr-4 align-top font-body text-amber-700 font-bold">
        {season.womensScratchName && season.womensScratchSlug ? (
          <BowlerLink
            name={season.womensScratchName}
            slug={season.womensScratchSlug}
            count={counts.womensScratch}
          />
        ) : (
          <span className="font-heading text-red-600/60 font-bold">X</span>
        )}
      </td>
      <td className="py-3 align-top font-body text-amber-700 font-bold">
        {season.handicapName && season.handicapSlug ? (
          <BowlerLink
            name={season.handicapName}
            slug={season.handicapSlug}
            count={counts.handicap}
          />
        ) : (
          <span className="font-heading text-red-600/60 font-bold">X</span>
        )}
      </td>
    </tr>
  );
}

export default async function AllTimeStatsPage() {
  const [playoffs, individualChampions] = await Promise.all([
    getAllPlayoffHistory(),
    getAllIndividualChampions(),
  ]);
  const snapshots = computeRunningTotals(playoffs);
  const individualSnapshots = computeIndividualCounts(individualChampions);

  // Team championship rows with Covid gap
  const teamRows: React.ReactNode[] = [];
  let covidInserted = false;

  for (const s of playoffs) {
    if (!covidInserted && s.seasonID < 25) {
      teamRows.push(<CovidRow key="covid" colSpan={4} />);
      covidInserted = true;
    }
    teamRows.push(
      <PlayoffRow
        key={s.seasonID}
        season={s}
        totals={snapshots.get(s.seasonID)!}
      />
    );
  }
  if (!covidInserted) teamRows.push(<CovidRow key="covid" colSpan={4} />);

  // Individual championship rows with Covid gap
  const individualRows: React.ReactNode[] = [];
  let covidInserted2 = false;

  for (const s of individualChampions) {
    if (!covidInserted2 && s.seasonID < 25) {
      individualRows.push(<CovidRow key="covid" colSpan={3} />);
      covidInserted2 = true;
    }
    individualRows.push(
      <IndividualChampionRow
        key={s.seasonID}
        season={s}
        counts={individualSnapshots.get(s.seasonID)!}
      />,
    );
  }
  if (!covidInserted2) individualRows.push(<CovidRow key="covid" colSpan={3} />);

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
      <TrailNav current="/stats" position="top" />
      <div className="flex items-center gap-2 text-sm font-body text-navy/65 mb-4">
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

      {/* Team Championship History */}
      <section className="mt-10">
        <SectionHeading>Team Championships</SectionHeading>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-navy/10 text-left">
                <th className="py-2 pr-4 font-heading text-navy/60 text-xs sm:text-sm uppercase tracking-wider">
                  Season
                </th>
                <th className="py-2 pr-4 font-heading text-amber-700/50 text-xs sm:text-sm uppercase tracking-wider">
                  Champion
                </th>
                <th className="py-2 pr-4 font-heading text-slate-400 text-xs sm:text-sm uppercase tracking-wider">
                  Runner-Up
                </th>
                <th className="py-2 pr-4 font-heading text-navy/60 text-xs sm:text-sm uppercase tracking-wider">
                  Semifinalist
                </th>
                <th className="py-2 font-heading text-navy/60 text-xs sm:text-sm uppercase tracking-wider">
                  Semifinalist
                </th>
              </tr>
            </thead>
            <tbody>
              {teamRows}
            </tbody>
          </table>
        </div>

        {playoffs.length === 0 && (
          <p className="font-body text-navy/65 italic mt-4">
            No playoff data available.
          </p>
        )}
      </section>

      {/* Individual Championship History */}
      <section className="mt-10">
        <SectionHeading>Individual Champions</SectionHeading>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-navy/10 text-left">
                <th className="py-2 pr-4 font-heading text-navy/60 text-xs sm:text-sm uppercase tracking-wider">
                  Season
                </th>
                <th className="py-2 pr-4 font-heading text-amber-700/50 text-xs sm:text-sm uppercase tracking-wider">
                  Men&apos;s Scratch
                </th>
                <th className="py-2 pr-4 font-heading text-amber-700/50 text-xs sm:text-sm uppercase tracking-wider">
                  Women&apos;s Scratch
                </th>
                <th className="py-2 font-heading text-amber-700/50 text-xs sm:text-sm uppercase tracking-wider">
                  Handicap
                </th>
              </tr>
            </thead>
            <tbody>
              {individualRows}
            </tbody>
          </table>
        </div>

        {individualChampions.length === 0 && (
          <p className="font-body text-navy/65 italic mt-4">
            No individual championship data available.
          </p>
        )}
      </section>

      <TrailNav current="/stats" />
    </main>
  );
}
