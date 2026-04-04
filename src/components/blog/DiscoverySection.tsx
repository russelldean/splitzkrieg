import Link from 'next/link';

interface Update {
  date: string;
  text: string;
  tag: 'fix' | 'feat';
  href?: string;
  description?: string;
}

interface Props {
  seasonSlug: string;
  updates?: Update[];
  asOfDate?: string | Date;
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

export function DiscoverySection({ seasonSlug, updates = [], asOfDate }: Props) {
  // Get the 2 most recent feat entries with hrefs, filtered to post publish date
  const cutoff = asOfDate ? new Date(asOfDate).toISOString().slice(0, 10) : null;
  const rotatingHighlights = updates
    .filter(u => u.tag === 'feat' && u.href && (!cutoff || u.date <= cutoff))
    .slice(0, 2);

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
        {rotatingHighlights.map(update => {
          const updateDate = new Date(update.date + 'T12:00:00');
          const now = new Date();
          const daysAgo = Math.floor((now.getTime() - updateDate.getTime()) / 86400000);
          const recency = daysAgo <= 7 ? 'New this week' : daysAgo <= 30 ? 'Recently added' : 'New feature';
          return (
            <Link
              key={update.href}
              href={update.href!}
              className="group block bg-white border border-navy/10 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-red-600/30 transition-all"
            >
              {(() => {
                const raw = update.description ?? update.text;
                const [title, subtitle] = raw.includes('|') ? raw.split('|', 2).map(s => s.trim()) : [raw, null];
                return (
                  <>
                    <span className="font-heading text-base text-navy group-hover:text-red-600 transition-colors">
                      {title}
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-body font-medium uppercase tracking-wide bg-green-100 text-green-700 align-middle">{recency}</span>
                    </span>
                    {subtitle && (
                      <span className="block font-body text-sm text-navy/65 mt-0.5 leading-snug">
                        {subtitle}
                      </span>
                    )}
                  </>
                );
              })()}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
