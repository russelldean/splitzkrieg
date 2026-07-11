import Link from 'next/link';
import type { TeamScheduleRow } from '@/lib/queries';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { TeamHeatmapRow } from './TeamHeatmapRow';
import { nightRecordStr } from '@/lib/game-record';
import { formatMatchDate } from '@/lib/bowling-time';

const FULL_DATE: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };

export function TeamSchedule({
  schedule,
  seasonSlug,
}: {
  schedule: TeamScheduleRow[];
  seasonSlug: string;
}) {
  if (schedule.length === 0) return null;
  const nextWeek = schedule.find((r) => !r.played)?.week ?? null;
  const hasPlayed = schedule.some((r) => r.played);

  return (
    <section id="schedule">
      <SectionHeading>Season Schedule</SectionHeading>

      {hasPlayed && (
        <div className="mb-5">
          <TeamHeatmapRow schedule={schedule} seasonSlug={seasonSlug} />
        </div>
      )}

      <div className="bg-white border border-navy/10 rounded-lg shadow-sm overflow-x-auto -mx-4 sm:mx-0">
        <table className="w-full text-xs sm:text-base font-body">
          <thead>
            <tr className="border-b border-navy/10 text-navy/65 text-xs sm:text-sm uppercase tracking-wider">
              <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-right w-8 sm:w-10">Wk</th>
              <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left">Date</th>
              <th className="px-2 sm:px-3 py-1.5 sm:py-2 text-left">Opponent</th>
              <th className="px-2 py-1.5 sm:py-2 text-right">Record</th>
              <th className="px-2 py-1.5 sm:py-2 text-right hidden sm:table-cell">XP</th>
              <th className="px-2 py-1.5 sm:py-2 text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((r) => {
              const isNext = r.week === nextWeek;
              const rec = r.played
                ? nightRecordStr(
                    [r.ourGame1, r.ourGame2, r.ourGame3],
                    [r.theirGame1, r.theirGame2, r.theirGame3],
                  )
                : null;
              return (
                <tr
                  key={r.week}
                  className={`border-b border-navy/5 ${isNext ? 'bg-amber-100/70 border-l-2 border-l-amber-400' : ''}`}
                >
                  <td className="px-2 py-1.5 sm:py-2.5 text-right tabular-nums text-navy/65">{r.week}</td>
                  <td className="px-2 py-1.5 sm:py-2.5 text-navy/70 whitespace-nowrap">
                    {formatMatchDate(r.matchDate, FULL_DATE) ?? 'TBD'}
                  </td>
                  <td className="px-2 py-1.5 sm:py-2.5 font-medium">
                    <Link href={`/team/${r.opponentSlug}`} className="text-navy hover:text-red-600 transition-colors">
                      {r.opponentName}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 sm:py-2.5 text-right tabular-nums text-navy/70">
                    {rec ?? (isNext ? <span className="text-amber-600">Next</span> : '')}
                  </td>
                  <td className="px-2 py-1.5 sm:py-2.5 text-right tabular-nums text-navy/70 hidden sm:table-cell">
                    {r.played ? r.xp : ''}
                  </td>
                  <td className="px-2 py-1.5 sm:py-2.5 text-right tabular-nums font-semibold text-navy">
                    {r.played ? r.total : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
