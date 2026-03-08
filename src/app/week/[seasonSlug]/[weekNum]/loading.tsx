export default function WeekLoading() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl animate-pulse">
      {/* Breadcrumb skeleton */}
      <div className="mb-6">
        <div className="h-4 w-48 bg-navy/10 rounded mb-3" />
        <div className="h-10 w-72 bg-navy/10 rounded mb-2" />
        <div className="h-5 w-56 bg-navy/10 rounded" />
      </div>

      {/* Match summary skeleton */}
      <div className="space-y-3 mt-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-navy/[0.06] rounded-lg" />
        ))}
      </div>

      {/* Week stats skeleton */}
      <div className="mt-8 grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-navy/[0.06] rounded-lg" />
        ))}
      </div>
    </main>
  );
}
