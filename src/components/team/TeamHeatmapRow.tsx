import Link from 'next/link';
import type { TeamScheduleRow } from '@/lib/queries';
import { nightRecordStr } from '@/lib/game-record';
import { heatColor, heatTextColor } from '@/lib/heat-color';
import { formatMatchDate } from '@/lib/bowling-time';

function tooltip(r: TeamScheduleRow): string {
  const date = formatMatchDate(r.matchDate, { month: 'short', day: 'numeric' }) ?? 'TBD';
  const rec = nightRecordStr(
    [r.ourGame1, r.ourGame2, r.ourGame3],
    [r.theirGame1, r.theirGame2, r.theirGame3],
  );
  return `Wk ${r.week} - ${date} - vs ${r.opponentName} - ${rec}, ${r.xp} XP - ${r.total} pts`;
}

export function TeamHeatmapRow({
  schedule,
  seasonSlug,
}: {
  schedule: TeamScheduleRow[];
  seasonSlug: string;
}) {
  // Only weeks that have been bowled - no placeholders for upcoming weeks.
  const played = schedule.filter((r) => r.played);
  if (played.length === 0) return null;

  return (
    <div>
      <p className="font-body text-xs text-navy/55 mb-2">Points earned each week (0-9). Red = hot.</p>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {played.map((r) => (
          <Link
            key={r.week}
            href={`/week/${seasonSlug}/${r.week}`}
            title={tooltip(r)}
            className="group flex flex-col items-center gap-1 shrink-0"
          >
            <div
              className="w-9 h-8 rounded flex items-center justify-center text-xs font-semibold tabular-nums transition-transform group-hover:scale-105"
              style={{ backgroundColor: heatColor(r.total ?? 0), color: heatTextColor(r.total ?? 0) }}
            >
              {r.total}
            </div>
            <span className="text-[10px] font-body text-navy/50 tabular-nums leading-none">{r.week}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
