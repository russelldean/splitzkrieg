import Link from 'next/link';
import { getSeasonBySlug } from '@/lib/queries';
import { getLeaderboardSnapshot } from '@/lib/queries/blog';
import type { SeasonLeaderEntry } from '@/lib/queries';

interface Props {
  seasonSlug: string;
  week: number | string;
}

function LeaderCard({ title, leaders, playoffCutoff, isAvg = false }: { title: string; leaders: SeasonLeaderEntry[]; playoffCutoff: number; isAvg?: boolean }) {
  if (leaders.length === 0) return null;

  // Expand ties at the cutoff
  let cutoffIdx = playoffCutoff;
  if (leaders.length > playoffCutoff) {
    const cutoffValue = leaders[playoffCutoff - 1].value;
    while (cutoffIdx < leaders.length && leaders[cutoffIdx].value === cutoffValue) cutoffIdx++;
  } else {
    cutoffIdx = leaders.length;
  }

  const topValue = leaders[0].value;
  return (
    <div className="bg-white border border-navy/10 rounded-lg shadow-sm overflow-hidden">
      <div className="px-3 py-1 bg-navy/[0.03] border-b border-navy/10">
        <h3 className="font-heading text-sm text-navy/70 leading-tight">{title}</h3>
      </div>
      <div className="py-0.5">
        {leaders.map((entry, i) => {
          const inPlayoffs = i < cutoffIdx;
          const isTop = entry.value === topValue;
          return (
            <div
              key={entry.bowlerID}
              className={`flex justify-between text-sm font-body py-0.5 px-3 ${
                inPlayoffs ? 'bg-amber-100/70 border-l-2 border-l-amber-400' : ''
              }`}
            >
              <span className="truncate mr-2">
                <span className="text-navy/50 tabular-nums mr-1.5">{i + 1}.</span>
                <Link
                  href={`/bowler/${entry.slug}`}
                  className={`text-navy hover:text-red-600 transition-colors ${isTop ? 'font-bold' : ''}`}
                >
                  {entry.bowlerName}
                </Link>
              </span>
              <span className={`tabular-nums shrink-0 ${isTop ? 'font-bold text-navy' : 'text-navy/60'}`}>
                {isAvg ? entry.value.toFixed(1) : entry.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export async function LeaderboardSnapshot({ seasonSlug, week }: Props) {
  const weekNum = typeof week === 'string' ? parseInt(week, 10) : week;
  const seasonData = await getSeasonBySlug(seasonSlug);
  if (!seasonData || isNaN(weekNum)) return null;

  const [mensScratch, womensScratch, hcpAvgRaw] = await Promise.all([
    getLeaderboardSnapshot(seasonData.seasonID, weekNum, 'M', 'avg'),
    getLeaderboardSnapshot(seasonData.seasonID, weekNum, 'F', 'avg'),
    // Fetch extra rows so we have 10 eligible after filtering scratch qualifiers
    getLeaderboardSnapshot(seasonData.seasonID, weekNum, null, 'hcpAvg', 30),
  ]);

  // Scratch playoff qualifiers (top 8 men's + top 8 women's) are ineligible for handicap playoffs
  const scratchPlayoffIDs = new Set([
    ...mensScratch.slice(0, 8).map(e => e.bowlerID),
    ...womensScratch.slice(0, 8).map(e => e.bowlerID),
  ]);
  const hcpAvg = hcpAvgRaw
    .filter(e => !scratchPlayoffIDs.has(e.bowlerID))
    .slice(0, 10);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <LeaderCard title="Men's Scratch Avg" leaders={mensScratch} playoffCutoff={8} isAvg />
      <LeaderCard title="Women's Scratch Avg" leaders={womensScratch} playoffCutoff={8} isAvg />
      <LeaderCard title="Handicap Avg" leaders={hcpAvg} playoffCutoff={8} isAvg />
    </div>
  );
}
