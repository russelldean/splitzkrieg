import Link from 'next/link';
import type { IndividualChampionSeason } from '@/lib/queries';

interface IndividualCellCounts {
  mensScratch: number;
  womensScratch: number;
  handicap: number;
}

function computeIndividualCounts(seasons: IndividualChampionSeason[]) {
  const counts = new Map<string, number>();
  const snapshots = new Map<number, IndividualCellCounts>();

  const sorted = [...seasons].reverse();
  for (const s of sorted) {
    if (s.mensScratchSlug) counts.set(s.mensScratchSlug, (counts.get(s.mensScratchSlug) || 0) + 1);
    const mensScratch = s.mensScratchSlug ? counts.get(s.mensScratchSlug)! : 0;

    if (s.womensScratchSlug) counts.set(s.womensScratchSlug, (counts.get(s.womensScratchSlug) || 0) + 1);
    const womensScratch = s.womensScratchSlug ? counts.get(s.womensScratchSlug)! : 0;

    if (s.handicapSlug) counts.set(s.handicapSlug, (counts.get(s.handicapSlug) || 0) + 1);
    const handicap = s.handicapSlug ? counts.get(s.handicapSlug)! : 0;

    snapshots.set(s.seasonID, { mensScratch, womensScratch, handicap });
  }
  return snapshots;
}

function BowlerLink({ name, slug, count }: { name: string; slug: string; count?: number }) {
  return (
    <Link href={`/bowler/${slug}`} className="hover:text-red-600 transition-colors">
      {name}
      {count && count > 1 && (
        <span className="opacity-60 ml-1">({count})</span>
      )}
    </Link>
  );
}

function CovidRow({ colSpan }: { colSpan: number }) {
  return (
    <tr className="border-b border-navy/5">
      <td className="py-3 pr-4 align-top whitespace-nowrap">
        <div className="font-heading text-navy/70">XXV</div>
        <div className="text-navy/65 text-xs">Spring 2020</div>
      </td>
      <td colSpan={colSpan} className="py-3 align-top font-body text-navy/65 italic">
        Season Incomplete: Covid
      </td>
    </tr>
  );
}

function IndividualChampionRow({
  season,
  counts,
}: {
  season: IndividualChampionSeason;
  counts: IndividualCellCounts;
}) {
  return (
    <tr className="border-b border-navy/5 last:border-0">
      <td className="py-3 pr-4 align-top whitespace-nowrap">
        <div className="font-heading text-navy/70">{season.romanNumeral}</div>
        <div className="text-navy/65 text-xs">{season.displayName}</div>
      </td>
      <td className="py-3 pr-4 align-top font-body text-amber-700 font-bold">
        {season.mensScratchName && season.mensScratchSlug ? (
          <BowlerLink
            name={season.mensScratchName}
            slug={season.mensScratchSlug}
            count={counts.mensScratch}
          />
        ) : (
          <span className="font-heading text-red-600/60 font-bold">X</span>
        )}
      </td>
      <td className="py-3 pr-4 align-top font-body text-amber-700 font-bold">
        {season.womensScratchName && season.womensScratchSlug ? (
          <BowlerLink
            name={season.womensScratchName}
            slug={season.womensScratchSlug}
            count={counts.womensScratch}
          />
        ) : (
          <span className="font-heading text-red-600/60 font-bold">X</span>
        )}
      </td>
      <td className="py-3 align-top font-body text-amber-700 font-bold">
        {season.handicapName && season.handicapSlug ? (
          <BowlerLink
            name={season.handicapName}
            slug={season.handicapSlug}
            count={counts.handicap}
          />
        ) : (
          <span className="font-heading text-red-600/60 font-bold">X</span>
        )}
      </td>
    </tr>
  );
}

export function IndividualChampionsTable({ champions }: { champions: IndividualChampionSeason[] }) {
  const snapshots = computeIndividualCounts(champions);

  const rows: React.ReactNode[] = [];
  let covidInserted = false;

  for (const s of champions) {
    if (!covidInserted && s.seasonID < 25) {
      rows.push(<CovidRow key="covid" colSpan={3} />);
      covidInserted = true;
    }
    rows.push(
      <IndividualChampionRow
        key={s.seasonID}
        season={s}
        counts={snapshots.get(s.seasonID)!}
      />,
    );
  }
  if (!covidInserted) rows.push(<CovidRow key="covid" colSpan={3} />);

  return (
    <div className="relative overflow-x-auto bg-white rounded-lg border border-navy/10 shadow-sm px-4 py-2">
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.06] text-[16rem] leading-none select-none flex flex-col items-center justify-start pt-24 gap-16">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i}>🏆</span>
        ))}
      </div>
      <table className="relative w-full text-sm">
        <thead>
          <tr className="border-b-2 border-navy/10 text-left">
            <th className="py-2 pr-4 font-heading text-navy/60 text-sm uppercase tracking-wider">
              Season
            </th>
            <th className="py-2 pr-4 font-heading text-amber-700/50 text-sm uppercase tracking-wider">
              Men&apos;s Scratch
            </th>
            <th className="py-2 pr-4 font-heading text-amber-700/50 text-sm uppercase tracking-wider">
              Women&apos;s Scratch
            </th>
            <th className="py-2 font-heading text-amber-700/50 text-sm uppercase tracking-wider">
              Handicap
            </th>
          </tr>
        </thead>
        <tbody>
          {rows}
        </tbody>
      </table>
    </div>
  );
}
