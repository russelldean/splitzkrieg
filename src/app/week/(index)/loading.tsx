/**
 * Instant feedback while /week loads.
 *
 * Without this, clicking "All Weeks" showed nothing at all until the whole
 * page arrived: no spinner, no skeleton, not even a hint the click registered.
 * The week DETAIL route already had a loading.tsx; the index was the one route
 * that did not, which is why this navigation in particular felt broken rather
 * than merely slow.
 *
 * Mirrors the real page's shape (full-bleed hero, then the season accordion)
 * so the swap is a fill-in rather than a jump.
 */
export default function WeekIndexLoading() {
  return (
    <>
      {/* Hero block, same height as the real one */}
      <div className="relative overflow-hidden h-52 sm:h-64 md:h-80 bg-navy/10 animate-pulse">
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-6">
          <div className="w-full">
            <div className="h-9 w-64 bg-navy/15 rounded" />
            <div className="h-4 w-52 bg-navy/10 rounded mt-3" />
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 animate-pulse">
        {/* Season accordion: one open season, then collapsed ones */}
        <div className="rounded-xl border border-navy/10 bg-white shadow-sm overflow-hidden mb-3">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="h-6 w-44 bg-navy/10 rounded" />
            <div className="h-4 w-16 bg-navy/[0.06] rounded" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border-t border-navy/5 px-5 py-3">
              <div className="h-4 w-full bg-navy/[0.06] rounded" />
            </div>
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-navy/10 bg-white shadow-sm flex items-center justify-between px-5 py-4 mb-3"
          >
            <div className="h-6 w-40 bg-navy/10 rounded" />
            <div className="h-4 w-16 bg-navy/[0.06] rounded" />
          </div>
        ))}
      </main>
    </>
  );
}
