'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { HighGameRecord } from '@/lib/queries/alltime';
import { InfoTooltip } from '@/components/ui/InfoTooltip';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  });
}

interface Props {
  records: HighGameRecord[];
  latestNight: number;
}

export function HighGameProgression({ records, latestNight }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  if (records.length === 0) return null;

  // Only actual records (not ties) define the step line
  const actualRecords = records.filter(r => !r.isTied);

  const minScore = Math.min(...actualRecords.map(r => r.score));
  const maxScore = Math.max(...actualRecords.map(r => r.score));
  const chartBottom = minScore - 10;
  const chartTop = maxScore + 5;
  const totalRange = chartTop - chartBottom;

  // Time-scaled x-axis using nightNumber
  const firstNight = actualRecords[0].nightNumber;
  const timeSpan = latestNight - firstNight || 1;

  function nightToPct(night: number): number {
    return ((night - firstNight) / timeSpan) * 100;
  }

  // X-axis year labels - show year of each record, deduplicated
  const yearLabels: { year: string; pct: number }[] = [];
  const seenYears = new Set<string>();
  for (const r of actualRecords) {
    if (!r.matchDate) continue;
    const yr = new Date(r.matchDate).toLocaleDateString('en-US', {
      year: 'numeric',
      timeZone: 'America/New_York',
    });
    if (!seenYears.has(yr)) {
      seenYears.add(yr);
      yearLabels.push({ year: `'${yr.slice(2)}`, pct: nightToPct(r.nightNumber) });
    }
  }

  // SVG viewBox width for precision
  const svgW = 1000;
  const svgH = 100;

  // Build the step path from actual records only
  const pathParts: string[] = [];
  for (let i = 0; i < actualRecords.length; i++) {
    const x = (nightToPct(actualRecords[i].nightNumber) / 100) * svgW;
    const y = svgH - ((actualRecords[i].score - chartBottom) / totalRange) * svgH;
    if (i === 0) {
      pathParts.push(`M ${x} ${y}`);
    } else {
      pathParts.push(`H ${x} V ${y}`);
    }
  }
  // Extend the last record's plateau to "now"
  const endX = (nightToPct(latestNight) / 100) * svgW;
  pathParts.push(`H ${endX}`);

  // For "Stood for" calculation, find the next actual record after each record
  function getNightsHeld(r: HighGameRecord): number | null {
    if (r.isTied) return null;
    const idx = actualRecords.indexOf(r);
    const nextNight = idx < actualRecords.length - 1
      ? actualRecords[idx + 1].nightNumber
      : latestNight;
    return nextNight - r.nightNumber;
  }

  function isCurrentRecord(r: HighGameRecord): boolean {
    return !r.isTied && actualRecords[actualRecords.length - 1] === r;
  }

  // Group records by nightNumber + score for chart markers
  // (multiple bowlers at the same point get merged into one dot)
  interface MarkerGroup {
    nightNumber: number;
    score: number;
    entries: HighGameRecord[];
    hasTie: boolean;
  }
  const markerGroups: MarkerGroup[] = [];
  for (const r of records) {
    const existing = markerGroups.find(
      (g) => g.nightNumber === r.nightNumber && g.score === r.score,
    );
    if (existing) {
      existing.entries.push(r);
      if (r.isTied) existing.hasTie = true;
    } else {
      markerGroups.push({
        nightNumber: r.nightNumber,
        score: r.score,
        entries: [r],
        hasTie: r.isTied,
      });
    }
  }

  return (
    <div className="mt-6">
      {/* Chart */}
      <div className="high-game-chart relative" style={{ height: 320 }}>
        {/* Chart area */}
        <div className="relative h-full bg-white rounded-lg border border-navy/10 p-2">
          {/* Horizontal grid lines */}
          {[0.25, 0.5, 0.75].map(pct => (
            <div
              key={pct}
              className="absolute left-0 right-0 border-t border-navy/5"
              style={{ bottom: `${pct * 100}%` }}
            />
          ))}

          {/* Step line */}
          <svg
            className="absolute inset-0 w-full h-full overflow-visible"
            preserveAspectRatio="none"
            viewBox={`0 0 ${svgW} ${svgH}`}
          >
            <path
              d={pathParts.join(' ')}
              fill="none"
              stroke="#DC2626"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Record markers - one dot per unique position */}
          {markerGroups.map((g, gi) => {
            const leftPct = nightToPct(g.nightNumber);
            const bottomPct = ((g.score - chartBottom) / totalRange) * 100;
            const isActive = activeIdx === gi;
            // Use the primary (non-tied) entry for "stood for"
            const primary = g.entries.find((e) => !e.isTied) || g.entries[0];
            const nightsHeld = getNightsHeld(primary);
            const allTied = g.entries.every((e) => e.isTied);

            return (
              <div
                key={`${g.nightNumber}-${g.score}`}
                className="absolute"
                style={{
                  left: `${leftPct}%`,
                  bottom: `${bottomPct}%`,
                  transform: 'translate(-50%, 50%)',
                  zIndex: isActive ? 20 : 10,
                }}
              >
                {/* Dot - outlined if all entries are ties, half-filled if mixed */}
                <button
                  onClick={() => setActiveIdx(isActive ? null : gi)}
                  className={`w-4 h-4 rounded-full border-2 shadow-sm transition-transform cursor-pointer ${
                    isActive
                      ? 'bg-navy border-white scale-125'
                      : allTied
                        ? 'bg-white border-red-600 hover:scale-110'
                        : 'bg-red-600 border-white hover:scale-110'
                  }`}
                />

                {/* Tooltip */}
                {isActive && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 cursor-pointer"
                    onClick={() => setActiveIdx(null)}
                  >
                    <div className="bg-navy text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap font-body">
                      <div className="font-bold text-sm">
                        {g.score}
                        {g.entries.length > 1 && (
                          <span className="ml-1.5 text-[11px] font-normal text-amber-300 uppercase">
                            {g.entries.length} bowlers
                          </span>
                        )}
                      </div>
                      {g.entries.map((e) => (
                        <div key={e.slug} className="flex items-center gap-1.5">
                          <Link
                            href={`/bowler/${e.slug}`}
                            className="text-red-300 hover:text-red-200 transition-colors"
                            onClick={(ev) => ev.stopPropagation()}
                          >
                            {e.bowlerName}
                          </Link>
                          {e.isTied && (
                            <span className="text-[10px] text-amber-300/80 uppercase">tied</span>
                          )}
                          {e.isPlayoff && (
                            <span className="text-[10px] text-sky-300/80 uppercase">playoffs</span>
                          )}
                        </div>
                      ))}
                      <div className="text-white/70">
                        Night {g.nightNumber}
                      </div>
                      {g.entries[0].matchDate && (
                        <div className="text-white/60">{formatDate(g.entries[0].matchDate)}</div>
                      )}
                      {nightsHeld != null && (
                        <div className="text-white/60 mt-1 border-t border-white/10 pt-1">
                          Stood for {nightsHeld} night{nightsHeld !== 1 ? 's' : ''}
                          {isCurrentRecord(primary) && ' (and counting)'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* X-axis year labels */}
          <div className="absolute left-0 right-0 -bottom-5">
            {yearLabels.map(({ year, pct }) => (
              <span
                key={year}
                className="absolute text-[11px] text-navy/75 font-body font-semibold -translate-x-1/2"
                style={{ left: `${pct}%` }}
              >
                {year}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline table below */}
      <div className="overflow-x-auto mt-14 bg-white rounded-lg border border-navy/10 px-4 py-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-navy/10 text-left">
              <th className="py-2 pr-4 font-heading text-navy/65 text-sm uppercase tracking-wider">
                Score
              </th>
              <th className="py-2 pr-4 font-heading text-navy/65 text-sm uppercase tracking-wider">
                Bowler
              </th>
              <th className="py-2 pr-4 font-heading text-navy/65 text-sm uppercase tracking-wider">
                Night
              </th>
              <th className="py-2 pr-4 font-heading text-navy/65 text-sm uppercase tracking-wider">
                Date
              </th>
              <th className="py-2 font-heading text-navy/65 text-sm uppercase tracking-wider">
                Stood
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const nightsHeld = getNightsHeld(r);
              const markerIdx = markerGroups.findIndex(
                g => g.nightNumber === r.nightNumber && g.score === r.score,
              );
              const isHighlighted = activeIdx === markerIdx;

              return (
                <tr
                  key={`${r.seasonID}-${r.week}-${r.slug}`}
                  className={`border-b border-navy/5 last:border-0 transition-colors ${isHighlighted ? 'bg-amber-50' : r.isTied ? 'bg-navy/[0.02]' : ''}`}
                >
                  <td className="py-3 pr-4 font-heading text-lg tabular-nums">
                    <button
                      onClick={() => {
                        setActiveIdx(isHighlighted ? null : markerIdx);
                        if (!isHighlighted) {
                          document.querySelector('.high-game-chart')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                      }}
                      className="cursor-pointer hover:underline"
                    >
                      <span className={r.isTied ? 'text-navy/60' : 'text-red-600'}>
                        {r.score}
                      </span>
                    </button>
                    {r.isTied && (
                      <span className="ml-2 text-xs font-body text-navy/60 uppercase tracking-wider">
                        Tied
                      </span>
                    )}
                    {r.isPlayoff && (
                      <InfoTooltip text="Playoff game" className="ml-1 inline-flex align-middle" />
                    )}
                    {r.isTied && r.score === 278 && r.slug === 'geoffrey-berry' && (
                      <InfoTooltip text="Yes, he tied his own record five years later" className="ml-1 inline-flex align-middle" />
                    )}
                  </td>
                  <td className="py-3 pr-4 font-body">
                    <Link
                      href={`/bowler/${r.slug}`}
                      className={`hover:text-red-600 transition-colors ${r.isTied ? 'text-navy/60' : 'text-navy'}`}
                    >
                      {r.bowlerName}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 font-body text-navy/70 tabular-nums">
                    {r.nightNumber}
                  </td>
                  <td className="py-3 pr-4 font-body text-navy/65">
                    {r.matchDate ? formatDate(r.matchDate) : ''}
                  </td>
                  <td className="py-3 font-body text-navy/65 tabular-nums">
                    {nightsHeld != null ? (
                      <>
                        {nightsHeld} night{nightsHeld !== 1 ? 's' : ''}
                        {isCurrentRecord(r) && '+'}
                      </>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
