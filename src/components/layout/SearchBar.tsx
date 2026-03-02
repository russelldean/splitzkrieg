'use client';

export function SearchBar() {
  return (
    <div className="relative w-full">
      <input
        type="search"
        placeholder="Search bowlers..."
        className="w-full bg-white border border-navy/20 rounded-lg px-4 py-2 text-sm font-body text-navy placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-red/30 focus:border-red/30 transition-colors"
        aria-label="Search bowlers"
      />
    </div>
  );
}
