'use client';
import { useState } from 'react';
import Link from 'next/link';
import { scoreColorClass, seriesColorClass } from '@/lib/score-utils';
import { formatMatchDate } from '@/lib/bowling-time';
import type { GameLogWeek } from '@/lib/queries';

export interface WeekDelta {
  totalPins: number;
  totalGames: number;
  games200Plus: number;
  series600Plus: number;
  turkeys: number | null;
  avgChange: number | null;
  newHighGame: boolean;
  newHighSeries: boolean;
}

interface Props {
  week: GameLogWeek;
  delta: WeekDelta;
}

export function LastWeekHighlight({ week, delta }: Props) {
  const [expanded, setExpanded] = useState(false);

  const dateStr = formatMatchDate(week.matchDate, { month: 'short', day: 'numeric', year: 'numeric' });

  const games = [week.game1, week.game2, week.game3].filter(
    (g): g is number => g !== null
  );
  const maxGame = games.length > 0 ? Math.max(...games) : null;

  return (
    <section>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between bg-white rounded-lg border border-navy/10 px-6 py-4 hover:bg-navy/[0.05] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-heading text-xl text-navy">Last Week</span>
          <span className="text-sm text-navy/65 font-body">
            {week.displayName} Wk {week.week}
            {dateStr ? ` \u00b7 ${dateStr}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className={`font-heading text-xl tabular-nums ${seriesColorClass(week.scratchSeries)}`}>
            {week.scratchSeries ?? '\u2014'}
          </span>
          <span className="text-navy/65 text-sm">
            {expanded ? '\u25B2' : '\u25BC'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="bg-white rounded-b-lg border border-t-0 border-navy/10 px-6 pb-5 pt-3 -mt-2">
          {/* Game scores row */}
          <div className="flex items-center gap-6 mb-4">
            {week.opponentSlug ? (
              <span className="text-sm text-navy/60 font-body">
                vs{' '}
                <Link
                  href={`/team/${week.opponentSlug}`}
                  className="text-navy hover:text-red-600 underline-offset-2 hover:underline"
                >
                  {week.opponentName ?? ''}
                </Link>
              </span>
            ) : week.opponentName ? (
              <span className="text-sm text-navy/60 font-body">
                vs {week.opponentName}
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'G1', value: week.game1, color: scoreColorClass(week.game1) },
              { label: 'G2', value: week.game2, color: scoreColorClass(week.game2) },
              { label: 'G3', value: week.game3, color: scoreColorClass(week.game3) },
              { label: 'Series', value: week.scratchSeries, color: seriesColorClass(week.scratchSeries) },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <div className="text-xs uppercase tracking-wide text-navy/60 font-body mb-1">
                  {label}
                </div>
                <div className={`text-2xl font-heading tabular-nums ${color}`}>
                  {value ?? '\u2014'}
                </div>
              </div>
            ))}
          </div>

          {/* Delta badges */}
          <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-navy/5">
            {delta.newHighGame && (
              <DeltaBadge label="High Game" value="NEW" variant="new" />
            )}
            {delta.newHighSeries && (
              <DeltaBadge label="High Series" value="NEW" variant="new" />
            )}
            <DeltaBadge
              label="Pins"
              value={`+${delta.totalPins.toLocaleString()}`}
            />
            {delta.avgChange !== null && (
              <DeltaBadge
                label="Avg"
                value={`${delta.avgChange >= 0 ? '+' : ''}${delta.avgChange.toFixed(1)}`}
                variant={delta.avgChange >= 0 ? 'positive' : 'negative'}
              />
            )}
            {delta.games200Plus > 0 && (
              <DeltaBadge label="200+" value={`+${delta.games200Plus}`} />
            )}
            {delta.series600Plus > 0 && (
              <DeltaBadge label="600+" value={`+${delta.series600Plus}`} />
            )}
            {delta.turkeys !== null && delta.turkeys > 0 && (
              <DeltaBadge label="Turkeys" value={`+${delta.turkeys}`} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function DeltaBadge({
  label,
  value,
  variant = 'positive',
}: {
  label: string;
  value: string;
  variant?: 'positive' | 'negative' | 'new';
}) {
  const colors = {
    positive: 'bg-green-50 text-green-700 border-green-200',
    negative: 'bg-red-50 text-red-600 border-red-200',
    new: 'bg-amber-50 text-amber-700 border-amber-300 font-bold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-body px-2.5 py-1 rounded-full border ${colors[variant]}`}
    >
      <span className="text-navy/65">{label}</span>
      <span>{value}</span>
    </span>
  );
}
