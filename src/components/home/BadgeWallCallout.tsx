import Link from 'next/link';

interface Props {
  /** Roman numeral of the season whose Badge Wall this links to. */
  romanNumeral: string;
  seasonSlug: string;
}

/**
 * Temporary homepage door to the Badge Wall. The homepage only renders it once
 * the current season's final has a winner, so it disappears on its own when
 * the next season becomes current.
 */
export function BadgeWallCallout({ romanNumeral, seasonSlug }: Props) {
  return (
    <Link
      href={`/season/${seasonSlug}/badges`}
      prefetch={false}
      className="group flex items-center gap-4 rounded-xl border border-navy/10 bg-white px-5 py-4 shadow-sm transition-all hover:border-red-600/40 hover:shadow-md"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-600/10 text-red-600 transition-colors group-hover:bg-red-600 group-hover:text-white">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-heading text-base text-navy transition-colors group-hover:text-red-600">
          Season {romanNumeral} Badge Wall
        </div>
        <div className="font-body text-sm text-navy/65">
          Every badge earned this season, from weekly highs to champions
        </div>
      </div>
      <span className="flex shrink-0 items-center gap-1 font-body text-sm font-medium text-navy/65 transition-colors group-hover:text-red-600">
        <span className="hidden sm:inline">View</span>
        <svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </span>
    </Link>
  );
}
