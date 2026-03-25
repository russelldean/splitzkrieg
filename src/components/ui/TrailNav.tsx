import Link from 'next/link';
import { getCurrentSeasonSnapshot } from '@/lib/queries';

function getTrail(seasonSlug?: string, weekNumber?: number, weekFallbackAnchor?: string, seasonRoman?: string) {
  const s = seasonRoman ? ` ${seasonRoman}` : '';
  const weekHref = seasonSlug && weekNumber
    ? `/week/${seasonSlug}/${weekNumber}`
    : weekFallbackAnchor
      ? `/week#season-${weekFallbackAnchor}`
      : '/week';
  return [
    { label: seasonSlug && weekNumber ? `Week ${weekNumber} Results` : 'Week Results', href: weekHref, key: '/week' },
    { label: 'Standings & Highlights', href: seasonSlug ? `/season/${seasonSlug}` : '/seasons', key: '/seasons' },
    { label: 'Leaderboards & Stats', href: seasonSlug ? `/stats/${seasonSlug}` : '/stats', key: '/stats' },
  ];
}

interface TrailNavProps {
  current: string;
  position?: 'top' | 'bottom';
  seasonSlug?: string;
  weekNumber?: number;
  seasonRoman?: string;
}

export async function TrailNav({ current, position = 'bottom', seasonSlug, weekNumber, seasonRoman }: TrailNavProps) {
  // Auto-resolve latest week number and roman numeral for the current season
  let resolvedWeekNumber = weekNumber;
  let resolvedRoman = seasonRoman;
  let weekFallbackAnchor: string | undefined;
  if (seasonSlug && !weekNumber) {
    const snapshot = await getCurrentSeasonSnapshot();
    if (snapshot && snapshot.slug === seasonSlug) {
      resolvedWeekNumber = snapshot.weekNumber;
      if (!resolvedRoman) resolvedRoman = snapshot.romanNumeral;
    } else {
      // Non-current season: link to the week index anchored to this season
      weekFallbackAnchor = seasonSlug;
    }
  }

  const trail = getTrail(seasonSlug, resolvedWeekNumber, weekFallbackAnchor, resolvedRoman);

  if (position === 'top') {
    // Season-scoped pages take priority when seasonSlug is present
    if (seasonSlug) {
      const idx = trail.findIndex((t) => t.key === current);
      if (idx === -1) return null;
      return (
        <nav className="mb-5">
          <div className="flex gap-1 -mx-1 px-1">
            {trail.map((item) => {
              const isCurrent = item.key === current;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`flex-1 text-center px-2 py-1.5 rounded-lg font-body text-sm leading-tight transition-all ${
                    isCurrent
                      ? 'bg-navy text-cream font-semibold'
                      : 'text-navy/60 hover:text-navy hover:bg-navy/[0.06]'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <div className="border-b border-navy/20 mt-3" />
        </nav>
      );
    }

    // Index pages: Seasons / Bowlers / Teams
    const browseTrail = [
      { label: 'Seasons', href: '/seasons', key: '/seasons' },
      { label: 'Bowlers', href: '/bowlers?filter=current', key: '/bowlers' },
      { label: 'Teams', href: '/teams?filter=current', key: '/teams' },
    ];
    const isBrowsePage = browseTrail.some((t) => t.key === current);
    if (!isBrowsePage) return null;

    return (
      <nav className="mb-5">
        <div className="flex gap-1 -mx-1 px-1">
          {browseTrail.map((item) => {
            const isCurrent = item.key === current;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex-1 text-center px-2 py-1.5 rounded-lg font-body text-sm leading-tight transition-all ${
                  isCurrent
                    ? 'bg-navy text-cream font-semibold'
                    : 'text-navy/60 hover:text-navy hover:bg-navy/[0.06]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="border-b border-navy/20 mt-3" />
      </nav>
    );
  }

  // Bottom position: prev/next style (kept for pages that still use it)
  const idx = trail.findIndex((t) => t.key === current);
  if (idx === -1) return null;

  const prev = idx > 0 ? trail[idx - 1] : null;
  const next = idx < trail.length - 1 ? trail[idx + 1] : null;

  return (
    <nav className="mt-12">
      <div className="h-px bg-gradient-to-r from-transparent via-navy/15 to-transparent mb-4" />
      <div className="flex items-center justify-between">
        {prev ? (
          <Link
            href={prev.href}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-navy/[0.04] hover:bg-navy/[0.08] border border-transparent hover:border-navy/10 font-body text-sm text-navy/60 hover:text-navy transition-all"
          >
            <svg className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {prev.label}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={next.href}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-navy/[0.04] hover:bg-navy/[0.08] border border-transparent hover:border-navy/10 font-body text-sm text-navy/60 hover:text-navy transition-all"
          >
            {next.label}
            <svg className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        ) : (
          <span />
        )}
      </div>
    </nav>
  );
}
