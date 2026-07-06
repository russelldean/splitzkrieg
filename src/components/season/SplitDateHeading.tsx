import { formatMatchDate } from '@/lib/bowling-time';

/**
 * Date divider shown above each group of matches on a split week (a week whose
 * matches span more than one date). Not rendered for single-date weeks.
 */
export function SplitDateHeading({ date, count }: { date: string | null; count: number }) {
  const label =
    formatMatchDate(date, { weekday: 'long', month: 'long', day: 'numeric' }) ?? 'Date TBD';
  return (
    <div className="flex items-baseline gap-2 mb-3 pb-1.5 border-b border-navy/10">
      <h4 className="font-heading text-base text-navy">{label}</h4>
      <span className="text-xs text-navy/50 font-body tabular-nums">
        {count} {count === 1 ? 'match' : 'matches'}
      </span>
    </div>
  );
}
