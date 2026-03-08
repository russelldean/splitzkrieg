export default function StatsLoading() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl animate-pulse">
      {/* TrailNav skeleton */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-navy/10">
        <div className="h-4 w-28 bg-navy/10 rounded" />
        <div className="h-4 w-28 bg-navy/10 rounded" />
      </div>

      {/* Breadcrumb skeleton */}
      <div className="h-4 w-48 bg-navy/10 rounded mb-4" />

      {/* Title + subtitle */}
      <div className="mb-8">
        <div className="h-10 w-64 bg-navy/10 rounded mb-2" />
        <div className="h-5 w-44 bg-navy/10 rounded mb-3" />
        {/* Season nav skeleton */}
        <div className="h-9 w-48 bg-navy/[0.06] rounded" />
      </div>

      {/* Leaderboard section skeletons */}
      <div className="space-y-12">
        {/* Men's scratch */}
        <div>
          <div className="h-6 w-32 bg-navy/10 rounded mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-8 bg-navy/[0.04] rounded" />
              ))}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-8 bg-navy/[0.04] rounded" />
              ))}
            </div>
          </div>
        </div>

        {/* Women's scratch */}
        <div>
          <div className="h-6 w-40 bg-navy/10 rounded mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-8 bg-navy/[0.04] rounded" />
              ))}
            </div>
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-8 bg-navy/[0.04] rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
