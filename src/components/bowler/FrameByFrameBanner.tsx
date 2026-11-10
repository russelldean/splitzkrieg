import Link from 'next/link';

interface Props {
  slug: string;
  /** Roman numeral of the season the recap covers. */
  season: string;
  /** False when that is an earlier season than the league's latest. */
  current: boolean;
}

/** A row of tiny scoresheet frames, decoration for the banner and the homepage callout. */
export function MiniSheet() {
  return (
    <div className="hidden sm:flex border border-cream/50 rounded-sm" aria-hidden>
      {Array.from({ length: 10 }, (_, i) => (
        <span key={i} className="relative w-6 h-7 border-r border-cream/50 last:border-r-0">
          <span className="absolute top-0 right-0 w-2.5 h-2.5 border-l border-b border-cream/50" />
          {i % 3 === 1 && <span className="absolute bottom-1 inset-x-0 text-center font-heading text-[9px] leading-none font-bold text-red-light">X</span>}
        </span>
      ))}
    </div>
  );
}

/**
 * The door to Frame by Frame from the bowler page: sits right under the hero so
 * it is the first thing after the name.
 */
export function FrameByFrameBanner({ slug, season, current }: Props) {
  return (
    <Link
      href={`/bowler/${slug}/frame-by-frame`}
      prefetch={false}
      className="group mt-6 flex items-center justify-between gap-4 rounded-xl bg-navy px-5 py-4 text-cream shadow-sm hover:bg-navy/95 transition-colors"
    >
      <div className="flex items-center gap-5 min-w-0">
        <MiniSheet />
        <div className="min-w-0">
          <p className="font-body text-[11px] font-semibold uppercase tracking-[0.2em] text-cream/80">Season {season}</p>
          <p className="font-heading text-xl sm:text-2xl leading-tight mt-0.5">Frame by Frame</p>
        </div>
      </div>
      <span className="shrink-0 flex items-center gap-3">
        <span className="hidden sm:inline-block text-2xl motion-safe:[animation:fbf-point_1.1s_ease-in-out_infinite]" aria-hidden>{'\u{1F449}'}</span>
        <span className="relative inline-flex">
          <span className="absolute -top-2 -right-2 z-10 rounded-full bg-amber-300 px-1.5 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider text-navy shadow motion-safe:[animation:fbf-new_1.6s_ease-in-out_infinite]">New</span>
          <span className="relative overflow-hidden inline-flex items-center gap-2 rounded-full bg-red px-5 py-2.5 font-body text-sm sm:text-base font-semibold text-cream shadow-lg group-hover:bg-red-light transition-colors motion-safe:[animation:fbf-glow_2.2s_ease-in-out_infinite,fbf-wiggle_3.4s_ease-in-out_infinite]">
            <span className="pointer-events-none absolute inset-0 motion-safe:[animation:fbf-shine_2.6s_ease-in-out_infinite]" style={{ background: 'linear-gradient(115deg, transparent 35%, rgba(255,251,242,0.55) 50%, transparent 65%)' }} aria-hidden />
            <span className="relative">{current ? 'See your season' : 'See your bowling history'}</span>
            <svg className="relative w-4 h-4 motion-safe:group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </span>
        </span>
        <style>{`
          @keyframes fbf-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(229, 62, 62, 0.7), 0 10px 15px -3px rgba(0,0,0,0.3); } 50% { box-shadow: 0 0 0 12px rgba(229, 62, 62, 0), 0 10px 15px -3px rgba(0,0,0,0.3); } }
          @keyframes fbf-wiggle { 0%, 82%, 100% { transform: rotate(0) scale(1); } 85% { transform: rotate(-4deg) scale(1.06); } 88% { transform: rotate(4deg) scale(1.06); } 91% { transform: rotate(-3deg) scale(1.04); } 94% { transform: rotate(2deg) scale(1.02); } }
          @keyframes fbf-shine { 0% { transform: translateX(-120%); } 55%, 100% { transform: translateX(120%); } }
          @keyframes fbf-point { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(8px); } }
          @keyframes fbf-new { 0%, 100% { transform: rotate(-8deg) scale(1); } 50% { transform: rotate(8deg) scale(1.12); } }
        `}</style>
      </span>
    </Link>
  );
}
