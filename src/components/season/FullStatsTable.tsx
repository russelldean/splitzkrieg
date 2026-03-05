'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { SeasonFullStatsRow } from '@/lib/queries';
import { scoreColorClass, seriesColorClass } from '@/lib/score-utils';
import { strikeX } from '@/components/ui/StrikeX';

interface Props {
  stats: SeasonFullStatsRow[];
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
  { key: 'M', label: "Men's Scratch" },
  { key: 'F', label: "Women's Scratch" },
  { key: 'all', label: 'All Bowlers' },
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

export function FullStatsTable({ stats }: Props) {
  const [genderTab, setGenderTab] = useState<GenderTab>('M');
  const [sortColumn, setSortColumn] = useState<SortColumn>('scratchAvg');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

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
      <section>
        <h2 className="font-heading text-2xl text-navy mb-4">Full Stats</h2>
        <p className="font-body text-navy/50">No stats data available.</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="font-heading text-2xl text-navy mb-4">Full Stats</h2>

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
        <p className="font-body text-navy/50 py-4">No bowlers in this category.</p>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="border-b border-navy/10 text-navy/50 text-xs uppercase tracking-wider">
                <th className="px-3 py-2 text-left w-10">#</th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`px-3 py-2 cursor-pointer hover:text-navy transition-colors select-none whitespace-nowrap ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
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
                  key={row.bowlerID}
                  className="border-b border-navy/5 hover:bg-navy/[0.02] transition-colors"
                >
                  <td className="px-3 py-2 text-navy/40 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2 font-medium whitespace-nowrap">
                    <Link
                      href={`/bowler/${row.slug}`}
                      className="text-navy hover:text-red-600 transition-colors"
                    >
                      {row.bowlerName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-navy/60 whitespace-nowrap">
                    {row.teamSlug ? (
                      <Link
                        href={`/team/${row.teamSlug}`}
                        className="hover:text-red-600 transition-colors"
                      >
                        {row.teamName ? strikeX(row.teamName) : '\u2014'}
                      </Link>
                    ) : (
                      <span>{row.teamName ?? '\u2014'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-navy/70">
                    {row.gamesBowled}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-navy/70">
                    {row.totalPins.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-navy/70">
                    {row.scratchAvg?.toFixed(1) ?? '\u2014'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-navy/70">
                    {row.hcpAvg?.toFixed(1) ?? '\u2014'}
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
        </div>
      )}
    </section>
  );
}
