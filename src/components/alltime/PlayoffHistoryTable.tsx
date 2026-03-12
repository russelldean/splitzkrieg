import Link from 'next/link';
import type { PlayoffSeason } from '@/lib/queries';

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

export function computeRunningTotals(playoffs: PlayoffSeason[]): Map<number, RunningTotals> {
  const sorted = [...playoffs].reverse();
  const champCount = new Map<number, number>();
  const finalsCount = new Map<number, number>();
  const playoffsCount = new Map<number, number>();

  const snapshots = new Map<number, RunningTotals>();

  for (const s of sorted) {
    for (const teamID of [s.championTeamID, s.runnerUpTeamID, s.semi1TeamID, s.semi2TeamID]) {
      if (teamID) playoffsCount.set(teamID, (playoffsCount.get(teamID) || 0) + 1);
    }
    for (const teamID of [s.championTeamID, s.runnerUpTeamID]) {
      if (teamID) finalsCount.set(teamID, (finalsCount.get(teamID) || 0) + 1);
    }
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

export function PlayoffHistoryTable({ playoffs }: { playoffs: PlayoffSeason[] }) {
  const snapshots = computeRunningTotals(playoffs);

  const rows: React.ReactNode[] = [];
  let covidInserted = false;

  for (const s of playoffs) {
    if (!covidInserted && s.seasonID < 25) {
      rows.push(<CovidRow key="covid" colSpan={4} />);
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
  if (!covidInserted) rows.push(<CovidRow key="covid" colSpan={4} />);

  return (
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
          {rows}
        </tbody>
      </table>
    </div>
  );
}
