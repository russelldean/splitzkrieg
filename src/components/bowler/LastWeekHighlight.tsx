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

export function LastWeekHighlight({ week }: Props) {
  const dateStr = formatMatchDate(week.matchDate, { month: 'short', day: 'numeric' });

  return (
    <section className="bg-white rounded-lg border border-navy/10 px-5 py-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-heading text-lg text-navy whitespace-nowrap">Last Week</span>
          {/* Mobile: week # only. Desktop: week + date + opponent */}
          <span className="text-sm text-navy/65 font-body sm:hidden">Wk {week.week}</span>
          <span className="text-sm text-navy/65 font-body truncate hidden sm:inline">
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
    </section>
  );
}
