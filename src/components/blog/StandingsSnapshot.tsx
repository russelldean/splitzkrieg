import Link from 'next/link';
import { getSeasonIDByRoman } from '@/lib/queries/blog';
import { getDb, cachedQuery } from '@/lib/db';

interface SnapshotRow {
  teamName: string;
  teamSlug: string;
  totalPts: number;
  rank: number;
  prevRank: number | null;
}

const RANKED_SNAPSHOT_SQL = `
  WITH teamPtsUnpivot AS (
    SELECT sch.team1ID AS teamID, mr.team1GamePts AS gamePts, mr.team1BonusPts AS bonusPts, sch.week
    FROM matchResults mr JOIN schedule sch ON mr.scheduleID = sch.scheduleID WHERE sch.seasonID = @seasonID
    UNION ALL
    SELECT sch.team2ID, mr.team2GamePts, mr.team2BonusPts, sch.week
    FROM matchResults mr JOIN schedule sch ON mr.scheduleID = sch.scheduleID WHERE sch.seasonID = @seasonID
  ),
  currentPts AS (
    SELECT teamID, SUM(gamePts) + SUM(bonusPts) AS totalPts FROM teamPtsUnpivot WHERE week <= @week GROUP BY teamID
  ),
  prevPts AS (
    SELECT teamID, SUM(gamePts) + SUM(bonusPts) AS totalPts FROM teamPtsUnpivot WHERE week <= @week - 1 GROUP BY teamID
  ),
  currentRanked AS (
    SELECT teamID, totalPts, CAST(RANK() OVER (ORDER BY totalPts DESC) AS INT) AS rank FROM currentPts
  ),
  prevRanked AS (
    SELECT teamID, CAST(RANK() OVER (ORDER BY totalPts DESC) AS INT) AS rank FROM prevPts
  )
  SELECT
    COALESCE(tnh.teamName, t.teamName) AS teamName,
    t.slug AS teamSlug,
    cr.totalPts, cr.rank, pr.rank AS prevRank
  FROM currentRanked cr
  JOIN teams t ON cr.teamID = t.teamID
  LEFT JOIN prevRanked pr ON pr.teamID = cr.teamID
  LEFT JOIN teamNameHistory tnh ON tnh.teamID = cr.teamID
    AND tnh.id = (SELECT MAX(id) FROM teamNameHistory WHERE teamID = cr.teamID)
  ORDER BY cr.rank
`;

async function getRankedSnapshot(seasonID: number, week: number): Promise<SnapshotRow[]> {
  const params = JSON.stringify({ seasonID, week });
  return cachedQuery('getRankedStandingsSnapshot', async () => {
    const db = await getDb();
    const result = await db.request()
      .input('seasonID', seasonID).input('week', week)
      .query<SnapshotRow>(RANKED_SNAPSHOT_SQL);
    return result.recordset;
  }, [], { sql: RANKED_SNAPSHOT_SQL + params });
}

interface StandingsSnapshotProps {
  season: string;
  week: number | string;
}

function MovementArrow({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null) {
    return <span className="text-navy/30">--</span>;
  }
  const diff = previous - current;
  if (diff > 0) {
    return (
      <span className="text-green-600 font-medium flex items-center gap-0.5">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
        {diff}
      </span>
    );
  }
  if (diff < 0) {
    return (
      <span className="text-red-500 font-medium flex items-center gap-0.5">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
        {Math.abs(diff)}
      </span>
    );
  }
  return <span className="text-navy/30">-</span>;
}

export async function StandingsSnapshot({ season, week }: StandingsSnapshotProps) {
  const weekNum = typeof week === 'string' ? parseInt(week, 10) : week;
  const seasonID = await getSeasonIDByRoman(season);
  if (!seasonID || isNaN(weekNum)) return null;

  const standings = await getRankedSnapshot(seasonID, weekNum);

  if (standings.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-navy/10 shadow-sm p-5 my-6">
      <h3 className="font-heading text-lg text-navy mb-4">Standings</h3>
      <table className="w-full font-body text-sm">
        <thead>
          <tr className="text-navy/50 text-xs uppercase tracking-wide border-b border-navy/10">
            <th className="py-2 text-left w-8">#</th>
            <th className="py-2 text-left">Team</th>
            <th className="py-2 text-right w-16">Pts</th>
            <th className="py-2 text-center w-16">Move</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((row) => (
            <tr key={row.teamSlug} className="border-b border-navy/5 last:border-0">
              <td className="py-2 text-navy/50 tabular-nums">{row.rank}</td>
              <td className="py-2">
                <Link href={`/team/${row.teamSlug}`} className="text-navy hover:text-red-600 transition-colors">
                  {row.teamName}
                </Link>
              </td>
              <td className="py-2 text-right tabular-nums font-semibold text-navy">{row.totalPts}</td>
              <td className="py-2 flex justify-center">
                <MovementArrow current={row.rank} previous={row.prevRank} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
