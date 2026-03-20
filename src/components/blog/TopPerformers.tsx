import Link from 'next/link';
import { getSeasonIDByRoman, getTopPerformers, type TopPerformer } from '@/lib/queries/blog';
import { scoreColorClass, seriesColorClass } from '@/lib/score-utils';

interface TopPerformersProps {
  season: string;
  week: number | string;
}

function RankedList({
  title,
  items,
  colorFn,
}: {
  title: string;
  items: TopPerformer[];
  colorFn: (score: number | null) => string;
}) {
  return (
    <div>
      <h4 className="font-heading text-sm uppercase tracking-wide text-navy/60 mb-2">{title}</h4>
      <ol className="space-y-1">
        {items.map((item, i) => (
          <li key={`${item.slug}-${i}`} className="flex items-center gap-2 font-body text-sm">
            <span className="text-navy/60 w-4 text-right">{i + 1}.</span>
            <Link href={`/bowler/${item.slug}`} className="text-navy hover:text-red-600 transition-colors">
              {item.bowlerName}
            </Link>
            <span className={`ml-auto tabular-nums font-semibold ${colorFn(item.value)}`}>
              {item.value}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export async function TopPerformers({ season, week }: TopPerformersProps) {
  const weekNum = typeof week === 'string' ? parseInt(week, 10) : week;
  const seasonID = await getSeasonIDByRoman(season);
  if (!seasonID || isNaN(weekNum)) return null;

  const data = await getTopPerformers(seasonID, weekNum);

  return (
    <div className="bg-white rounded-lg border border-navy/10 shadow-sm p-5 my-6">
      <h3 className="font-heading text-lg text-navy mb-4">Top Performers</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <RankedList title="Scratch Series" items={data.scratchSeries} colorFn={seriesColorClass} />
        <RankedList title="Scratch Game" items={data.scratchGame} colorFn={scoreColorClass} />
        <RankedList title="Handicap Series" items={data.hcpSeries} colorFn={seriesColorClass} />
      </div>
    </div>
  );
}
