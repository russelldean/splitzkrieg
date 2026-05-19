import Link from 'next/link';
import type { SeasonChampionsCardData } from '@/lib/queries';

interface Props {
  romanNumeral: string;
  seasonSlug: string;
  champions: SeasonChampionsCardData;
}

function ChampionRow({
  label,
  name,
  slug,
  href,
}: {
  label: string;
  name: string;
  slug: string;
  href: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-amber-700/80 font-heading shrink-0">
        {label}
      </span>
      <Link
        href={href}
        className="font-heading text-sm sm:text-base text-navy hover:text-red-600 transition-colors truncate text-right"
      >
        {name}
      </Link>
    </div>
  );
}

export function SeasonChampionsCard({ romanNumeral, seasonSlug, champions }: Props) {
  return (
    <Link
      href={`/playoffs/${seasonSlug}/2`}
      className="group flex flex-col bg-white rounded-xl border border-amber-300/60 shadow-sm hover:shadow-md hover:border-amber-400 transition-all px-6 pt-4 pb-6 md:h-full"
    >
      <div className="flex items-baseline justify-between mb-2">
        <div>
          <h3 className="font-heading text-lg text-navy group-hover:text-red-600 transition-colors">
            Season {romanNumeral} Champions
          </h3>
          <p className="text-xs font-body text-navy/60">Crowned at The Final</p>
        </div>
        <span className="text-[10px] font-heading uppercase tracking-wider text-amber-700 font-semibold">
          🏆 Final
        </span>
      </div>

      {champions.team && (
        <div className="mt-3 mb-3 pb-3 border-b border-amber-200/60 text-center">
          <div className="text-[10px] uppercase tracking-wider text-amber-700/80 font-heading mb-1.5">
            Team Champion
          </div>
          <div className="font-heading text-lg sm:text-xl text-amber-900 truncate">
            {champions.team.name}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-around divide-y divide-amber-200/60">
        {champions.mensScratch && (
          <ChampionRow
            label="Men's Scratch"
            name={champions.mensScratch.name}
            slug={champions.mensScratch.slug}
            href={`/bowler/${champions.mensScratch.slug}`}
          />
        )}
        {champions.womensScratch && (
          <ChampionRow
            label="Women's Scratch"
            name={champions.womensScratch.name}
            slug={champions.womensScratch.slug}
            href={`/bowler/${champions.womensScratch.slug}`}
          />
        )}
        {champions.handicap && (
          <ChampionRow
            label="Handicap"
            name={champions.handicap.name}
            slug={champions.handicap.slug}
            href={`/bowler/${champions.handicap.slug}`}
          />
        )}
      </div>
    </Link>
  );
}
