import Link from 'next/link';
import { getSeasonBySlug, getMinGamesForWeek } from '@/lib/queries';
import { getLeaderboardSnapshot } from '@/lib/queries/blog';
import { cutoffIndex, playoffQualifiers } from '@/lib/leaderboard-cutoff';
import type { SeasonLeaderEntry } from '@/lib/queries';

interface Props {
  seasonSlug: string;
  week: number | string;
}

function LeaderCard({ title, leaders, playoffCutoff, isAvg = false }: { title: string; leaders: SeasonLeaderEntry[]; playoffCutoff: number; isAvg?: boolean }) {
  if (leaders.length === 0) return null;

  const cutoffIdx = cutoffIndex(leaders.map(l => l.value), playoffCutoff);

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
                <span className="text-navy/60 tabular-nums mr-1.5">{i + 1}.</span>
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

  // Eligibility floor ramps with the week, matching /stats. This is a snapshot,
  // so it keys off the week being viewed, not the season's latest played week.
  const minGames = getMinGamesForWeek(weekNum);

  const [mensScratch, womensScratch, hcpAvgRaw] = await Promise.all([
    getLeaderboardSnapshot(seasonData.seasonID, weekNum, 'M', 'avg', 10, minGames),
    getLeaderboardSnapshot(seasonData.seasonID, weekNum, 'F', 'avg', 10, minGames),
    // Fetch extra rows so we have 10 eligible after filtering scratch qualifiers
    getLeaderboardSnapshot(seasonData.seasonID, weekNum, null, 'hcpAvg', 30, minGames),
  ]);

  // Scratch playoff qualifiers are ineligible for handicap playoffs. Ties at the
  // 8th value qualify too, so the exclusion has to expand them the same way the
  // highlight does, or the card marks 9 men qualified while excluding only 8.
  const scratchPlayoffIDs = new Set([
    ...playoffQualifiers(mensScratch),
    ...playoffQualifiers(womensScratch),
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
