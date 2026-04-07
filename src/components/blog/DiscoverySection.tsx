import Link from 'next/link';

interface Update {
  date: string;
  text: string;
  tag: 'fix' | 'feat';
  href?: string;
  description?: string;
}

interface OverrideLink {
  text: string;
  href: string;
  description?: string;
}

interface Props {
  seasonSlug: string;
  updates?: Update[];
  asOfDate?: string | Date;
  overrides?: OverrideLink[] | null;
}

const stableLinks = [
  {
    href: '/teams',
    title: 'Find Your Team',
    description: 'Look up any team\'s roster, record, and history',
  },
  {
    href: '/stats/all-time',
    title: 'All-Time Stats',
    description: 'Career leaders, championships, and stats on every bowler in league history',
  },
];

export function DiscoverySection({ seasonSlug, updates = [], asOfDate, overrides }: Props) {
  // Use overrides if provided, otherwise auto-pick from updates
  let rotatingHighlights: Array<{ text: string; href: string; description?: string; date?: string }>;

  if (overrides && overrides.length > 0) {
    rotatingHighlights = overrides;
  } else {
    const cutoff = asOfDate ? new Date(asOfDate).toISOString().slice(0, 10) : null;
    rotatingHighlights = updates
      .filter((u): u is Update & { href: string } => u.tag === 'feat' && !!u.href && (!cutoff || u.date <= cutoff))
      .slice(0, 2);
  }

  return (
    <div>
      <div className="h-px bg-gradient-to-r from-transparent via-navy/15 to-transparent mb-6" />
      <h3 className="font-heading text-lg text-navy/80 mb-4">Around the Site</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {stableLinks.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="group block bg-white border border-navy/10 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-red-600/30 transition-all"
          >
            <span className="font-heading text-base text-navy group-hover:text-red-600 transition-colors">
              {link.title}
            </span>
            <span className="block font-body text-sm text-navy/65 mt-0.5 leading-snug">
              {link.description}
            </span>
          </Link>
        ))}
        {rotatingHighlights.map((item, idx) => {
          const title = item.text;
          const subtitle = item.description ?? null;
          const date = 'date' in item ? (item as Update).date : null;
          let recencyLabel: string | null = null;
          if (date) {
            const daysAgo = Math.floor((Date.now() - new Date(date + 'T12:00:00').getTime()) / 86400000);
            recencyLabel = daysAgo <= 7 ? 'New this week' : daysAgo <= 30 ? 'Recently added' : 'New feature';
          }
          return (
            <Link
              key={item.href + idx}
              href={item.href}
              className="group block bg-white border border-navy/10 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-red-600/30 transition-all"
            >
              <span className="font-heading text-base text-navy group-hover:text-red-600 transition-colors">
                {title}
                {recencyLabel && (
                  <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-body font-medium uppercase tracking-wide bg-green-100 text-green-700 align-middle">{recencyLabel}</span>
                )}
              </span>
              {subtitle && (
                <span className="block font-body text-sm text-navy/65 mt-0.5 leading-snug">
                  {subtitle}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
