import Link from 'next/link';
import updates from '../../../content/updates';

interface Props {
  seasonSlug: string;
}

const stableLinks = [
  {
    href: '/',
    title: 'Find Your Profile',
    description: 'Look up any bowler\'s career stats and records',
  },
  {
    href: '/stats/all-time',
    title: 'All-Time Records',
    description: 'Career leaders across 35 seasons',
  },
];

export function DiscoverySection({ seasonSlug }: Props) {
  // Get the 2 most recent feat entries with hrefs for rotating highlights
  const rotatingHighlights = updates
    .filter(u => u.tag === 'feat' && u.href)
    .slice(0, 2);

  return (
    <div>
      <div className="h-px bg-gradient-to-r from-transparent via-navy/15 to-transparent mb-6" />
      <h3 className="font-heading text-lg text-navy/80 mb-1">Explore Splitzkrieg</h3>
      <p className="font-body text-sm text-navy/65 mb-3">
        A few places to start:
      </p>
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
        {rotatingHighlights.map(update => (
          <Link
            key={update.href}
            href={update.href!}
            className="group block bg-white border border-navy/10 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-red-600/30 transition-all"
          >
            <span className="font-heading text-base text-navy group-hover:text-red-600 transition-colors">
              {update.text}
            </span>
            <span className="block font-body text-sm text-navy/65 mt-0.5 leading-snug">
              Added {update.date}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
