import Link from 'next/link';

function getTrail(seasonSlug?: string) {
  return [
    { label: 'League Nights', href: '/week', key: '/week' },
    { label: 'Seasons', href: seasonSlug ? `/season/${seasonSlug}` : '/seasons', key: '/seasons' },
    { label: 'The Stats', href: seasonSlug ? `/stats/${seasonSlug}` : '/stats', key: '/stats' },
    { label: 'Bowlers', href: '/bowlers?filter=current', key: '/bowlers' },
    { label: 'Teams', href: '/teams?filter=current', key: '/teams' },
    { label: 'Resources', href: '/resources', key: '/resources' },
  ];
}

interface TrailNavProps {
  current: string;
  position?: 'top' | 'bottom';
  seasonSlug?: string;
}

export function TrailNav({ current, position = 'bottom', seasonSlug }: TrailNavProps) {
  const trail = getTrail(seasonSlug);
  const idx = trail.findIndex((t) => t.key === current);
  if (idx === -1) return null;

  const prev = idx > 0 ? trail[idx - 1] : null;
  const next = idx < trail.length - 1 ? trail[idx + 1] : null;

  const wrapperClass = position === 'top'
    ? 'mb-8'
    : 'mt-12';

  return (
    <nav className={wrapperClass}>
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
