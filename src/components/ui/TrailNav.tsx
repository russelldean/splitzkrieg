import Link from 'next/link';

const trail = [
  { label: 'League Nights', href: '/week' },
  { label: 'Seasons', href: '/seasons' },
  { label: 'The Stats', href: '/stats' },
  { label: 'Bowlers', href: '/bowlers' },
  { label: 'Teams', href: '/teams' },
  { label: 'Resources', href: '/resources' },
];

export function TrailNav({ current, position = 'bottom' }: { current: string; position?: 'top' | 'bottom' }) {
  const idx = trail.findIndex((t) => t.href === current);
  if (idx === -1) return null;

  const prev = idx > 0 ? trail[idx - 1] : null;
  const next = idx < trail.length - 1 ? trail[idx + 1] : null;

  const className = position === 'top'
    ? 'flex items-center justify-between mb-6 pb-4 border-b border-navy/10'
    : 'flex items-center justify-between mt-10 pt-6 border-t border-navy/10';

  return (
    <nav className={className}>
      {prev ? (
        <Link
          href={prev.href}
          className="group flex items-center gap-2 font-body text-sm text-navy/60 hover:text-navy transition-colors"
        >
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
          className="group flex items-center gap-2 font-body text-sm text-navy/60 hover:text-navy transition-colors"
        >
          {next.label}
          <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
