'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { SeasonFullStatsRow } from '@/lib/queries';
import { scoreColorClass, seriesColorClass } from '@/lib/score-utils';
import { ScrollableTable } from '@/components/ui/ScrollableTable';
import { SectionHeading } from '@/components/ui/SectionHeading';

interface Props {
  stats: SeasonFullStatsRow[];
  minGames: number;
}

type SortColumn =
  | 'bowlerName'
  | 'teamName'
  | 'gamesBowled'
  | 'totalPins'
  | 'scratchAvg'
  | 'hcpAvg'
  | 'highGame'
  | 'highSeries'
  | 'games200Plus'
  | 'series600Plus'
  | 'turkeys';

type SortDirection = 'asc' | 'desc';
type GenderTab = 'M' | 'F' | 'all';

const TABS: { key: GenderTab; label: string }[] = [
  { key: 'all', label: 'All Bowlers' },
  { key: 'M', label: "Men" },
  { key: 'F', label: "Women" },
];

const COLUMNS: { key: SortColumn; label: string; align: 'left' | 'right' }[] = [
  { key: 'bowlerName', label: 'Bowler', align: 'left' },
  { key: 'teamName', label: 'Team', align: 'left' },
  { key: 'gamesBowled', label: 'Games', align: 'right' },
  { key: 'totalPins', label: 'Pins', align: 'right' },
  { key: 'scratchAvg', label: 'Scratch Avg', align: 'right' },
  { key: 'hcpAvg', label: 'HCP Avg', align: 'right' },
  { key: 'highGame', label: 'High Game', align: 'right' },
  { key: 'highSeries', label: 'High Series', align: 'right' },
  { key: 'games200Plus', label: '200+', align: 'right' },
  { key: 'series600Plus', label: '600+', align: 'right' },
  { key: 'turkeys', label: 'Turkeys', align: 'right' },
];

function SortArrow({ direction }: { direction: SortDirection }) {
  return (
    <span className="ml-1 text-red-600/60">
      {direction === 'desc' ? '\u25BC' : '\u25B2'}
    </span>
  );
}

export function FullStatsTable({ stats, minGames }: Props) {
  const [genderTab, setGenderTab] = useState<GenderTab>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('scratchAvg');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Compute ranks for eligible bowlers
  const scratchRankByGender = useMemo(() => {
    const rankMap = new Map<string, number>(); // key: `${gender}-${bowlerID}`
    for (const g of ['M', 'F'] as const) {
      const eligible = stats
        .filter(s => s.gender === g && s.scratchAvg != null && s.gamesBowled >= minGames)
        .sort((a, b) => (b.scratchAvg ?? 0) - (a.scratchAvg ?? 0));
      eligible.forEach((s, i) => rankMap.set(`${g}-${s.bowlerID}`, i + 1));
    }
    return rankMap;
  }, [stats, minGames]);

  const hcpRanks = useMemo(() => {
    const rankMap = new Map<number, number>();
    const eligible = stats
      .filter(s => s.hcpAvg != null && s.gamesBowled >= minGames)
      .sort((a, b) => (b.hcpAvg ?? 0) - (a.hcpAvg ?? 0));
    eligible.forEach((s, i) => rankMap.set(s.bowlerID, i + 1));
    return rankMap;
  }, [stats, minGames]);

  const filtered = useMemo(() => {
    if (genderTab === 'all') return stats;
    return stats.filter((s) => s.gender === genderTab);
  }, [stats, genderTab]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      // Handle nulls -- push to bottom
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const cmp = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      const numA = Number(aVal);
      const numB = Number(bVal);
      return sortDirection === 'asc' ? numA - numB : numB - numA;
    });
    return rows;
  }, [filtered, sortColumn, sortDirection]);

  function handleSort(col: SortColumn) {
    if (sortColumn === col) {
      setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortColumn(col);
      setSortDirection(col === 'bowlerName' || col === 'teamName' ? 'asc' : 'desc');
    }
  }

  if (stats.length === 0) {
    return (
      <section id="stats">
        <SectionHeading>Full Stats</SectionHeading>
        <p className="font-body text-navy/65">No stats data available.</p>
      </section>
    );
  }

  return (
    <section>
      <SectionHeading>Full Stats</SectionHeading>

      {/* Gender tabs */}
      <div className="flex gap-1 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setGenderTab(tab.key)}
            className={`px-4 py-2 text-sm font-body rounded-t transition-colors ${
              genderTab === tab.key
                ? 'bg-navy text-cream font-semibold'
                : 'bg-navy/5 text-navy/60 hover:bg-navy/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="font-body text-navy/65 py-4">No bowlers in this category.</p>
      ) : (
        <ScrollableTable>
          <table className="w-full text-sm sm:text-base font-body">
            <thead>
              <tr className="border-b border-navy/10 bg-navy/[0.02] text-navy/60 text-xs sm:text-sm uppercase tracking-wider">
                <th className="px-3 py-2 text-left w-10 sticky left-0 bg-white z-10">#</th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2 cursor-pointer hover:text-navy transition-colors select-none whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    } ${col.key === 'bowlerName' ? 'sticky left-10 bg-white z-10' : ''}`}
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    {sortColumn === col.key && <SortArrow direction={sortDirection} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => (
                <tr
                  key={`${row.bowlerID}-${row.teamSlug ?? 'no-team'}`}
                  className="border-b border-navy/5 hover:bg-navy/[0.05] transition-colors"
                >
                  <td className="px-3 py-2 text-navy/65 tabular-nums sticky left-0 bg-white z-10">{i + 1}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap sticky left-10 bg-white z-10">
                    <Link
                      href={`/bowler/${row.slug}`}
                      className="text-navy hover:text-red-600 transition-colors"
                    >
                      {row.bowlerName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-navy/60 max-w-[120px] truncate">
                    {row.teamSlug ? (
                      <Link
                        href={`/team/${row.teamSlug}`}
                        className="hover:text-red-600 transition-colors"
                        title={row.teamName ?? undefined}
                      >
                        {row.teamName ?? '\u2014'}
                      </Link>
                    ) : (
                      <span title={row.teamName ?? undefined}>{row.teamName ?? '\u2014'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-navy/70">
                    {row.gamesBowled}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-navy/70">
                    {row.totalPins.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-navy/70 whitespace-nowrap">
                    <span className="flex items-center justify-end gap-1">
                      <span className="tabular-nums">{row.scratchAvg?.toFixed(1) ?? '\u2014'}</span>
                      <span className="text-navy/65 text-xs w-8 text-left tabular-nums">
                        {row.gender && scratchRankByGender.has(`${row.gender}-${row.bowlerID}`)
                          ? `(${genderTab === 'all' ? (row.gender === 'M' ? 'M' : 'W') : ''}${scratchRankByGender.get(`${row.gender}-${row.bowlerID}`)})`
                          : ''}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-navy/70 whitespace-nowrap">
                    <span className="flex items-center justify-end gap-1">
                      <span className="tabular-nums">{row.hcpAvg?.toFixed(1) ?? '\u2014'}</span>
                      <span className="text-navy/65 text-xs w-6 text-left tabular-nums">
                        {hcpRanks.has(row.bowlerID)
                          ? `(${hcpRanks.get(row.bowlerID)})`
                          : ''}
                      </span>
                    </span>
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${scoreColorClass(row.highGame)}`}>
                    {row.highGame ?? '\u2014'}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums ${seriesColorClass(row.highSeries)}`}>
                    {row.highSeries ?? '\u2014'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-navy/70">
                    {row.games200Plus}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-navy/70">
                    {row.series600Plus}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-navy/70">
                    {row.turkeys}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollableTable>
      )}
    </section>
  );
}
