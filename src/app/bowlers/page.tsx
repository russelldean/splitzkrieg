import { getAllBowlersDirectory, type DirectoryBowler } from '@/lib/queries';
import { EmptyState } from '@/components/ui/EmptyState';
import { BackToTop } from '@/components/ui/BackToTop';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bowlers',
  description:
    `Browse all Splitzkrieg Bowling League bowlers. Find any bowler from ${new Date().getFullYear() - 2007} years of league history.`,
};

function groupByLetter(bowlers: DirectoryBowler[]) {
  return bowlers.reduce<Record<string, DirectoryBowler[]>>((groups, bowler) => {
    const letter = bowler.bowlerName[0].toUpperCase();
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(bowler);
    return groups;
  }, {});
}

export default async function BowlersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const allBowlers = await getAllBowlersDirectory();
  const bowlers = filter === 'current' ? allBowlers.filter(b => b.isActive) : allBowlers;

  if (bowlers.length === 0) {
    return (
      <div className="min-h-screen bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <EmptyState
            title="No Bowlers Found"
            message="No bowler data available."
          />
        </div>
      </div>
    );
  }

  const grouped = groupByLetter(bowlers);
  const letters = Object.keys(grouped).sort();

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl sm:text-4xl text-navy">
            {filter === 'current' ? 'Current Bowlers' : 'All Bowlers'}
          </h1>
          <p className="font-body text-navy/50 mt-2">
            {bowlers.length} bowlers{filter !== 'current' && <> across {new Date().getFullYear() - 2007} years of Splitzkrieg history</>}
          </p>
          <div className="flex gap-3 mt-2">
            <Link
              href="/bowlers?filter=current"
              className={`text-sm font-body transition-colors ${filter === 'current' ? 'text-navy font-semibold' : 'text-navy/40 hover:text-red-600'}`}
            >
              Current
            </Link>
            <span className="text-navy/20">|</span>
            <Link
              href="/bowlers"
              className={`text-sm font-body transition-colors ${filter !== 'current' ? 'text-navy font-semibold' : 'text-navy/40 hover:text-red-600'}`}
            >
              All Bowlers
            </Link>
          </div>
        </div>

        {/* Alphabet Quick Nav */}
        <nav className="flex flex-wrap gap-1.5 mb-10" aria-label="Jump to letter">
          {letters.map((letter) => (
            <a
              key={letter}
              href={`#letter-${letter}`}
              className="w-8 h-8 flex items-center justify-center rounded font-heading text-sm text-navy/70 hover:text-navy hover:bg-navy/5 transition-colors"
            >
              {letter}
            </a>
          ))}
        </nav>

        {/* Bowler Directory */}
        <div className="space-y-10">
          {letters.map((letter) => (
            <section key={letter} id={`letter-${letter}`}>
              <h2 className="font-heading text-2xl text-navy border-b border-navy/10 pb-2 mb-4">
                {letter}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2">
                {grouped[letter].map((bowler) => (
                  <div key={bowler.bowlerID} className="flex items-center gap-2 py-1">
                    <Link
                      href={`/bowler/${bowler.slug}`}
                      className="font-body text-navy hover:text-red transition-colors truncate"
                    >
                      {bowler.bowlerName}
                    </Link>
                    {bowler.isActive && (
                      <span
                        className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0"
                        title="Active bowler"
                      />
                    )}
                    <span className="text-navy/40 text-xs flex-shrink-0">
                      {bowler.seasonsActive}s
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <BackToTop />
      </div>
    </div>
  );
}
