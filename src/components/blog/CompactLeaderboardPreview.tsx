import Link from 'next/link';
import { getSeasonBySlug } from '@/lib/queries';
import { getLeaderboardSnapshot } from '@/lib/queries/blog';

interface Props {
  seasonSlug: string;
  week: number;
}

export async function CompactLeaderboardPreview({ seasonSlug, week }: Props) {
  const seasonData = await getSeasonBySlug(seasonSlug);
  if (!seasonData) return null;

  const [mensScratch, womensScratch, hcp] = await Promise.all([
    getLeaderboardSnapshot(seasonData.seasonID, week, 'M', 'avg'),
    getLeaderboardSnapshot(seasonData.seasonID, week, 'F', 'avg'),
    getLeaderboardSnapshot(seasonData.seasonID, week, null, 'hcpAvg'),
  ]);

  const mensTop3 = mensScratch.slice(0, 3);
  const womensTop3 = womensScratch.slice(0, 3);
  const hcpTop3 = hcp.slice(0, 3);

  if (mensTop3.length === 0 && womensTop3.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <LeaderColumn title="Men's Scratch Avg" leaders={mensTop3} />
      <LeaderColumn title="Women's Scratch Avg" leaders={womensTop3} />
      {hcpTop3.length > 0 && (
        <LeaderColumn title="Handicap Avg" leaders={hcpTop3} />
      )}
    </div>
  );
}

function LeaderColumn({ title, leaders }: { title: string; leaders: Array<{ bowlerName: string; slug: string; value: number }> }) {
  if (leaders.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-navy/10 shadow-sm overflow-hidden">
      <div className="px-3 py-1 bg-navy/[0.03] border-b border-navy/10">
        <h4 className="font-heading text-sm text-navy/70 leading-tight">{title}</h4>
      </div>
      <div className="divide-y divide-navy/5">
        {leaders.map((entry, i) => (
          <div key={entry.slug} className="flex items-center justify-between px-3 py-1.5 text-sm font-body">
            <span className="truncate mr-2">
              <span className="text-navy/65 tabular-nums mr-1.5">{i + 1}.</span>
              <Link
                href={`/bowler/${entry.slug}`}
                className={`text-navy hover:text-red-600 transition-colors ${i === 0 ? 'font-bold' : ''}`}
              >
                {entry.bowlerName}
              </Link>
            </span>
            <span className={`tabular-nums shrink-0 ${i === 0 ? 'font-bold text-navy' : 'text-navy/60'}`}>
              {entry.value.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
