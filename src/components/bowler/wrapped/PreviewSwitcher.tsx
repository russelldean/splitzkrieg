import Link from 'next/link';

/**
 * Dev-only strip for flipping between a few bowlers with very different career
 * lengths while the recap is being designed. Never rendered in production.
 */
const PREVIEW_BOWLERS = [
  { slug: 'russ-dean', label: 'Russ (since 2007)' },
  { slug: 'christina-manzella', label: 'Christina (since 2018)' },
  { slug: 'ben-rice', label: 'Ben Rice' },
  { slug: 'justin-faerber', label: 'Justin Faerber (last bowled 2020)' },
];

export function PreviewSwitcher({ current }: { current: string }) {
  if (process.env.NODE_ENV === 'production') return null;
  return (
    <nav aria-label="Preview another bowler" className="sticky top-16 z-20 mb-5 flex flex-wrap gap-2 rounded-full bg-white/90 backdrop-blur border border-navy/10 shadow-sm px-2 py-1.5">
      {PREVIEW_BOWLERS.map(b => (
        <Link
          key={b.slug}
          href={`/bowler/${b.slug}/frame-by-frame`}
          prefetch={false}
          className={`px-3 py-1 rounded-full text-sm font-body transition-colors ${b.slug === current ? 'bg-navy text-cream' : 'text-navy hover:bg-navy/10'}`}
        >
          {b.label}
        </Link>
      ))}
    </nav>
  );
}
