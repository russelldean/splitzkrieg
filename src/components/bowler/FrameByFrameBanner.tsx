import Link from 'next/link';

interface Props {
  slug: string;
  /** Roman numeral of the season the recap covers, null when the bowler did not play it. */
  season: string | null;
  /** Whether the bowler scored in that season; changes the pitch line. */
  bowledThisSeason: boolean;
}

/** A row of tiny scoresheet frames, decoration for the banner. */
function MiniSheet() {
  return (
    <div className="hidden sm:flex border border-cream/50 rounded-sm" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="relative w-6 h-7 border-r border-cream/50 last:border-r-0">
          <span className="absolute top-0 right-0 w-2.5 h-2.5 border-l border-b border-cream/50" />
          {i % 3 === 1 && <span className="absolute bottom-1 inset-x-0 text-center font-heading text-[9px] leading-none text-cream">X</span>}
        </span>
      ))}
    </div>
  );
}

/**
 * The door to Frame by Frame from the bowler page: sits right under the hero so
 * it is the first thing after the name.
 */
export function FrameByFrameBanner({ slug, season, bowledThisSeason }: Props) {
  return (
    <Link
      href={`/bowler/${slug}/frame-by-frame`}
      prefetch={false}
      className="group mt-6 flex items-center justify-between gap-4 rounded-xl bg-navy px-5 py-4 text-cream shadow-sm hover:bg-navy/95 transition-colors"
    >
      <div className="flex items-center gap-5 min-w-0">
        <MiniSheet />
        <div className="min-w-0">
          <p className="font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-cream/80">Frame by Frame{season && <> &middot; Season {season}</>}</p>
          <p className="font-heading text-xl sm:text-2xl leading-tight mt-0.5">
            {bowledThisSeason ? 'This Is Your Season.' : 'This Is Your Bowling Life.'}
          </p>
        </div>
      </div>
      <span className="shrink-0 inline-flex items-center gap-2 rounded-full bg-red px-4 py-2 font-body text-sm font-semibold text-cream group-hover:bg-red-light transition-colors">
        Open
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </span>
    </Link>
  );
}
