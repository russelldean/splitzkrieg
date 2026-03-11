import Link from 'next/link';
import type { SeasonNav as SeasonNavType } from '@/lib/queries';

interface Props {
  current: { seasonID: number; slug: string; romanNumeral: string };
  allSeasons: SeasonNavType[];
  basePath?: string;
}

export function SeasonNav({ current, allSeasons, basePath = '/season' }: Props) {
  const idx = allSeasons.findIndex(s => s.seasonID === current.seasonID);
  const prev = idx < allSeasons.length - 1 ? allSeasons[idx + 1] : null; // older
  const next = idx > 0 ? allSeasons[idx - 1] : null; // newer

  return (
    <div className="flex items-center justify-between mt-4">
      <div>
        {prev ? (
          <Link
            href={`${basePath}/${prev.slug}`}
            className="flex items-center gap-1 text-sm font-body text-navy/65 hover:text-red-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            Season {prev.romanNumeral}{' '}
              <span className="text-navy/40">({prev.displayName})</span>
          </Link>
        ) : <span />}
      </div>
      <Link
        href="/seasons"
        className="text-sm font-body text-navy/65 hover:text-red-600 transition-colors"
      >
        All Seasons
      </Link>
      <div>
        {next ? (
          <Link
            href={`${basePath}/${next.slug}`}
            className="flex items-center gap-1 text-sm font-body text-navy/65 hover:text-red-600 transition-colors"
          >
            Season {next.romanNumeral}{' '}
              <span className="text-navy/40">({next.displayName})</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </Link>
        ) : <span />}
      </div>
    </div>
  );
}
