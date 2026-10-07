/**
 * Everything the recap draft needs, read at click time from the admin route.
 * Never runs at build time, so nothing here is cached and no page query changes.
 */
import sql from 'mssql';
import { getDb, withRetry } from '@/lib/db';
import { getWeekScores } from '@/lib/queries/seasons/weekly';
import { computeIndividualLeaders, computeWeeklyAwards } from '@/components/season/weekStatsUtils';
import type { MilestoneCategory } from '@/lib/milestone-config';
import { rankAmong, type DraftInput, type DraftMilestone } from './draft';

interface ClubRow {
  category: MilestoneCategory;
  threshold: number;
  bowlerID: number;
  bowlerName: string;
  seasonID: number;
  week: number;
  careerGames: number | null;
}

/** "Before or during this week" ordering key for (season, week). */
const when = (seasonID: number, week: number) => seasonID * 1000 + week;

export async function gatherDraftInput(seasonID: number, week: number): Promise<DraftInput> {
  const db = await getDb();

  // Same source as the week page, so BOTW/TOTW/personal bests always agree.
  const weekScores = await getWeekScores(seasonID, week);
  const { bowlers } = computeIndividualLeaders(weekScores, false);
  const { allTimeHighGames, allTimeHighSeries, bowlersOfWeek, teamOfWeek } = computeWeeklyAwards(weekScores, bowlers);

  // Season-to-date bowler series and team series, for the top-10 rank clause.
  // Team series sums handSeries over every row, penalties included, exactly as
  // computeWeeklyAwards does.
  const season = await withRetry(
    () =>
      db.request()
        .input('seasonID', sql.Int, seasonID)
        .input('week', sql.Int, week)
        .query<{ kind: 'bowler' | 'team'; series: number }>(`
          SELECT 'bowler' AS kind, CAST(handSeries AS INT) AS series
          FROM scores
          WHERE seasonID = @seasonID AND week <= @week AND isPenalty = 0 AND handSeries IS NOT NULL
          UNION ALL
          SELECT 'team', CAST(SUM(handSeries) AS INT)
          FROM scores
          WHERE seasonID = @seasonID AND week <= @week
          GROUP BY teamID, week
        `),
    'writeup-draft:season',
  );
  const bowlerSeries = season.recordset.filter((r) => r.kind === 'bowler').map((r) => r.series);
  const teamSeries = season.recordset.filter((r) => r.kind === 'team').map((r) => r.series);

  const teamNameBySlug = new Map(weekScores.map((s) => [s.bowlerSlug, s.teamName]));

  // Every member of every club someone joined this week, with career games
  // through the night they joined. SUM(gamesBowled), never COUNT * 3.
  const clubs = await withRetry(
    () =>
      db.request()
        .input('seasonID', sql.Int, seasonID)
        .input('week', sql.Int, week)
        .query<ClubRow>(`
          SELECT bm.category, bm.threshold, bm.bowlerID, b.bowlerName, bm.seasonID, bm.week,
            (SELECT SUM(sc.gamesBowled) FROM scores sc
             WHERE sc.bowlerID = bm.bowlerID AND sc.isPenalty = 0
               AND (sc.seasonID < bm.seasonID OR (sc.seasonID = bm.seasonID AND sc.week <= bm.week))
            ) AS careerGames
          FROM bowlerMilestones bm
          JOIN bowlers b ON b.bowlerID = bm.bowlerID
          WHERE EXISTS (
            SELECT 1 FROM bowlerMilestones t
            WHERE t.seasonID = @seasonID AND t.week = @week
              AND t.category = bm.category AND t.threshold = bm.threshold
          )
        `),
    'writeup-draft:clubs',
  );

  const milestones: DraftMilestone[] = clubs.recordset
    .filter((r) => r.seasonID === seasonID && r.week === week)
    .sort((a, b) => b.threshold - a.threshold) // the week page's order
    .map((m) => {
      const members = clubs.recordset.filter((r) => r.category === m.category && r.threshold === m.threshold);
      const club = rankAmong(when(m.seasonID, m.week), members.map((r) => when(r.seasonID, r.week)), 'asc');
      const fastest =
        m.category === 'totalGames' || m.careerGames == null
          ? null
          : rankAmong(
              m.careerGames,
              members.map((r) => r.careerGames).filter((g): g is number => g != null),
              'asc',
            );
      return { bowlerName: m.bowlerName, category: m.category, threshold: m.threshold, club, fastest };
    });

  return {
    bowlersOfWeek: bowlersOfWeek.map((b) => ({
      bowlerName: b.name,
      teamName: teamNameBySlug.get(b.slug) ?? '',
      handSeries: b.handSeries,
      seasonRank: rankAmong(b.handSeries, bowlerSeries),
    })),
    teamOfWeek: teamOfWeek
      ? { teamName: teamOfWeek.teamName, hcpSeries: teamOfWeek.hcpSeries, seasonRank: rankAmong(teamOfWeek.hcpSeries, teamSeries) }
      : null,
    personalBests: { highGames: allTimeHighGames.length, highSeries: allTimeHighSeries.length },
    milestones,
  };
}
