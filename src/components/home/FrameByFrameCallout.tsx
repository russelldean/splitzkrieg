import { MiniSheet } from '@/components/bowler/FrameByFrameBanner';

interface Props {
  /** Roman numeral of the season the recaps cover. */
  season: string;
}

/**
 * Homepage door to Frame by Frame. People do not know it exists yet, so this
 * sits at the top of the main column and points them at the header search:
 * type your name, land on your page, the banner there takes you the rest of
 * the way. (It used to carry its own search; that duplicated the header's.)
 */
export function FrameByFrameCallout({ season }: Props) {
  return (
    <section className="rounded-xl bg-navy text-cream shadow-md ring-1 ring-navy/10 px-5 py-5 sm:px-8 sm:py-6">
      <div className="flex items-center gap-5 min-w-0 text-left">
        <MiniSheet />
        <div className="min-w-0 w-full">
          <p className="font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-cream/80">
            <span className="mr-2 rounded-full bg-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-navy">New</span>
            Frame by Frame &middot; Season {season}
          </p>
          <h2 className="font-heading text-2xl sm:text-3xl leading-tight mt-1">Your season, one frame at a time.</h2>
          <p className="font-body text-sm sm:text-base text-cream/85 mt-1">
            If you ever bowled here, you have one. Search your name at the top of the page.
          </p>
        </div>
      </div>
    </section>
  );
}
