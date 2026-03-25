'use client';
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
  const dateStr = formatMatchDate(week.matchDate, { month: 'short', day: 'numeric' });

  return (
    <section className="bg-white rounded-lg border border-navy/10 px-5 py-4">
      {/* Header + scores in one row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-heading text-lg text-navy whitespace-nowrap">Last Week</span>
          <span className="text-sm text-navy/65 font-body truncate">
            Wk {week.week}
            {dateStr ? ` \u00b7 ${dateStr}` : ''}
            {week.opponentSlug ? (
              <>
                {' \u00b7 vs '}
                <Link
                  href={`/team/${week.opponentSlug}`}
                  className="text-navy hover:text-red-600 underline-offset-2 hover:underline"
                >
                  {week.opponentName ?? ''}
                </Link>
              </>
            ) : week.opponentName ? ` \u00b7 vs ${week.opponentName}` : null}
          </span>
        </div>

        {/* Game scores inline */}
        <div className="flex items-center gap-3 shrink-0">
          {[
            { label: 'G1', value: week.game1, color: scoreColorClass(week.game1) },
            { label: 'G2', value: week.game2, color: scoreColorClass(week.game2) },
            { label: 'G3', value: week.game3, color: scoreColorClass(week.game3) },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <div className="text-[10px] uppercase tracking-wide text-navy/60 font-body leading-none mb-0.5">
                {label}
              </div>
              <div className={`text-lg font-heading tabular-nums leading-tight ${color}`}>
                {value ?? '\u2014'}
              </div>
            </div>
          ))}
          <div className="text-center pl-2 border-l border-navy/10">
            <div className="text-[10px] uppercase tracking-wide text-navy/60 font-body leading-none mb-0.5">
              Series
            </div>
            <div className={`text-lg font-heading tabular-nums leading-tight ${seriesColorClass(week.scratchSeries)}`}>
              {week.scratchSeries ?? '\u2014'}
            </div>
          </div>
        </div>
      </div>

      {/* Delta badges - compact row */}
      {hasDeltaContent(delta) && (
        <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-navy/5">
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
      )}
    </section>
  );
}

function hasDeltaContent(delta: WeekDelta): boolean {
  return delta.totalPins > 0 || delta.avgChange !== null || delta.games200Plus > 0 ||
    delta.series600Plus > 0 || (delta.turkeys !== null && delta.turkeys > 0) ||
    delta.newHighGame || delta.newHighSeries;
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
      className={`inline-flex items-center gap-1 text-xs font-body px-2 py-0.5 rounded-full border ${colors[variant]}`}
    >
      <span className="text-navy/65">{label}</span>
      <span>{value}</span>
    </span>
  );
}
