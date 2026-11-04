import Link from 'next/link';
import type { IndividualChampionSeason } from '@/lib/queries';

interface IndividualCellCounts {
  mensScratch: number;
  womensScratch: number;
  handicap: number;
  turkeys: number;
}

function computeIndividualCounts(seasons: IndividualChampionSeason[]) {
  const counts = new Map<string, number>();
  const snapshots = new Map<number, IndividualCellCounts>();

  // Each column keeps its own running tally so a scratch title and a turkey
  // trophy for the same bowler do not add together.
  const bump = (key: string, slug: string | null) => {
    if (!slug) return 0;
    const k = `${key}:${slug}`;
    const next = (counts.get(k) || 0) + 1;
    counts.set(k, next);
    return next;
  };

  const sorted = [...seasons].reverse();
  for (const s of sorted) {
    snapshots.set(s.seasonID, {
      mensScratch: bump('m', s.mensScratchSlug),
      womensScratch: bump('w', s.womensScratchSlug),
      handicap: bump('h', s.handicapSlug),
      turkeys: bump('t', s.turkeySlug),
    });
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

const CELL = 'py-3 px-3 align-top font-body text-navy font-semibold bg-amber-50/60';
const EMPTY = <span className="font-heading text-red-600/60 font-bold">X</span>;

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
      <td className={CELL}>
        {season.mensScratchName && season.mensScratchSlug ? (
          <BowlerLink
            name={season.mensScratchName}
            slug={season.mensScratchSlug}
            count={counts.mensScratch}
          />
        ) : EMPTY}
      </td>
      <td className={CELL}>
        {season.womensScratchName && season.womensScratchSlug ? (
          <BowlerLink
            name={season.womensScratchName}
            slug={season.womensScratchSlug}
            count={counts.womensScratch}
          />
        ) : EMPTY}
      </td>
      <td className={CELL}>
        {season.handicapName && season.handicapSlug ? (
          <BowlerLink
            name={season.handicapName}
            slug={season.handicapSlug}
            count={counts.handicap}
          />
        ) : EMPTY}
      </td>
      <td className={CELL}>
        {season.turkeyName && season.turkeySlug ? (
          <>
            <BowlerLink
              name={season.turkeyName}
              slug={season.turkeySlug}
              count={counts.turkeys}
            />
            {season.turkeyCount != null && (
              <div className="text-navy/65 text-xs font-normal">
                {season.turkeyCount} turkeys
              </div>
            )}
          </>
        ) : EMPTY}
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
      rows.push(<CovidRow key="covid" colSpan={4} />);
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
  if (!covidInserted) rows.push(<CovidRow key="covid" colSpan={4} />);

  return (
    <div className="relative overflow-x-auto bg-white rounded-lg border border-navy/10 shadow-sm px-4 py-2">
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.08] sm:opacity-[0.06] text-[6rem] sm:text-[12rem] leading-none select-none flex flex-col items-start justify-start pt-16 sm:pt-24 gap-10 sm:gap-16">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex w-full justify-evenly shrink-0">
            <span>🏆</span>
            <span>🏆</span>
          </div>
        ))}
      </div>
      <table className="relative w-full text-sm">
        <thead>
          <tr className="border-b-2 border-navy/10 text-left">
            <th className="py-2 pr-4 font-heading text-navy/60 text-sm uppercase tracking-wider">
              Season
            </th>
            <th className="py-2 px-3 font-heading text-amber-800/70 text-sm uppercase tracking-wider">
              Men&apos;s Scratch
            </th>
            <th className="py-2 px-3 font-heading text-amber-800/70 text-sm uppercase tracking-wider">
              Women&apos;s Scratch
            </th>
            <th className="py-2 px-3 font-heading text-amber-800/70 text-sm uppercase tracking-wider">
              Handicap
            </th>
            <th className="py-2 px-3 font-heading text-amber-800/70 text-sm uppercase tracking-wider">
              Turkey Trophy
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
