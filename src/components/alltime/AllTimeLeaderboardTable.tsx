'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { AllTimeLeaderRow } from '@/lib/queries';
import { scoreColorClass, seriesColorClass } from '@/lib/score-utils';
import { ScrollableTable } from '@/components/ui/ScrollableTable';

type SortColumn =
  | 'bowlerName'
  | 'gamesBowled'
  | 'totalPins'
  | 'highGame'
  | 'highSeries'
  | 'games200Plus'
  | 'series600Plus'
  | 'turkeys';

type SortDirection = 'asc' | 'desc';
type GenderTab = 'M' | 'F' | 'all';

const TABS: { key: GenderTab; label: string }[] = [
  { key: 'all', label: 'All Bowlers' },
  { key: 'M', label: 'Men' },
  { key: 'F', label: 'Women' },
];

const COLUMNS: { key: SortColumn; label: string; align: 'left' | 'right' }[] = [
  { key: 'bowlerName', label: 'Bowler', align: 'left' },
  { key: 'gamesBowled', label: 'Games', align: 'right' },
  { key: 'totalPins', label: 'Pins', align: 'right' },
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

interface Props {
  data: AllTimeLeaderRow[];
}

export function AllTimeLeaderboardTable({ data }: Props) {
  const [genderTab, setGenderTab] = useState<GenderTab>('all');
  const [sortColumn, setSortColumn] = useState<SortColumn>('totalPins');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const filtered = useMemo(() => {
    if (genderTab === 'all') return data;
    return data.filter((r) => r.gender === genderTab);
  }, [data, genderTab]);

  const sorted = useMemo(() => {
    const rows = [...filtered];
    rows.sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

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
      setSortDirection(col === 'bowlerName' ? 'asc' : 'desc');
    }
  }

  return (
    <div>
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
                  key={row.bowlerID}
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
                  <td className="px-3 py-2 text-right tabular-nums text-navy/70">
                    {row.gamesBowled}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-navy/70">
                    {row.totalPins.toLocaleString()}
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
    </div>
  );
}
