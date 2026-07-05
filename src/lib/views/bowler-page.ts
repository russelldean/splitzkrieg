/**
 * Bowler page view-model: one batched per-bowler read + pure assembly.
 *
 * Consolidates the 7 per-bowler SELECTs plus a single-bowler AVG(game1/2/3) for the
 * GameProfile archetype into one mssql request (result.recordsets[0..7]), then maps
 * them into a flat DTO. Per-bowler SQL is reused verbatim from the query modules.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../db';
import {
  GET_BOWLER_CAREER_SUMMARY_SQL,
  BOWLER_SEASON_STATS_SQL,
  GET_BOWLER_GAME_LOG_SQL,
  GET_BOWLER_ROLLING_AVG_HISTORY_SQL,
  GET_BOWLER_PATCHES_SQL,
  GET_BOWLER_STAR_STATS_SQL,
} from '../queries/bowlers';
import { BOWLER_FACTS_SQL } from '../queries/facts';
import type {
  BowlerCareerSummary,
  BowlerSeasonStats,
  GameLogWeek,
  RollingAvgPoint,
  BowlerPatch,
  BowlerStarStats,
} from '../queries/bowlers';
import type { RandomFact } from '../queries/facts';
import { classifyArchetype, type GameProfileRow } from '../queries/alltime';
import type { TeamStat } from '@/components/bowler/TeamBreakdown';

export interface BowlerPageView {
  careerSummary: BowlerCareerSummary | null;
  seasonStats: BowlerSeasonStats[];
  gameLog: GameLogWeek[];
  rollingAvgHistory: RollingAvgPoint[];
  patches: BowlerPatch[];
  starStats: BowlerStarStats;
  facts: RandomFact[];
  teams: TeamStat[];
  gameProfile: GameProfileRow | null;
}

export interface WeekDelta {
  totalPins: number;
  totalGames: number;
  games200Plus: number;
  series600Plus: number;
  turkeys: number | null;
  avgChange: number | null;
  newHighGame: boolean;
  newHighSeries: boolean;
}

/** Mirror of getBowlerStarStats' post-processing (bowlers.ts:519-535). */
export function reduceStarStats(rows: Array<{ code: string; cnt: number }>): BowlerStarStats {
  const counts = new Map(rows.map(r => [r.code, r.cnt]));
  return {
    perfectGames: counts.get('perfectGame') ?? 0,
    botwWins: counts.get('botw') ?? 0,
    playoffAppearances: counts.get('playoff') ?? 0,
    championships: counts.get('champion') ?? 0,
    isCaptain: (counts.get('captain') ?? 0) > 0,
    weeklyHighGameWins: counts.get('highGame') ?? 0,
    weeklyHighSeriesWins: counts.get('highSeries') ?? 0,
    aboveAvgAllThreeCount: counts.get('aboveAvg') ?? 0,
    threeOfAKindCount: counts.get('threeOfAKind') ?? 0,
    scratchPlayoffAppearances: counts.get('scratchPlayoff') ?? 0,
    hcpPlayoffAppearances: counts.get('hcpPlayoff') ?? 0,
    scratchChampionships: counts.get('scratchChampion') ?? 0,
    hcpChampionships: counts.get('hcpChampion') ?? 0,
  };
}

/** Mirror of getBowlerFacts' row mapping (facts.ts:95-111). */
export function mapFacts(rows: Array<Record<string, unknown>>): RandomFact[] {
  return rows.map((r) => ({
    factTypeID: r.factTypeID as number,
    bowlerName: r.bowlerName as string,
    bowlerSlug: r.bowlerSlug as string,
    seasonSlug: r.seasonSlug as string,
    week: r.week as number,
    year: r.year as number,
    value: r.value as number,
    previousValue: (r.previousValue as number) ?? null,
    isCareerHigh: !!r.isCareerHigh,
    gender: (r.gender as string) ?? null,
    referenceDate: r.referenceDate ? (r.referenceDate as Date).toISOString() : null,
    refMonth: null,
    refDay: null,
    milestoneCategory: null,
    milestoneOrdinal: null,
  }));
}

/** Mirror of the page's team-breakdown derivation (page.tsx:128-146). */
export function deriveTeams(seasonStats: BowlerSeasonStats[]): { teams: TeamStat[]; totalNights: number } {
  const teamMap = new Map<string, { teamName: string; teamSlug: string | null; nights: number }>();
  for (const s of seasonStats) {
    const key = s.teamSlug ?? s.canonicalTeamName ?? s.teamName ?? 'Unknown';
    const existing = teamMap.get(key);
    if (existing) {
      existing.nights += s.nightsBowled;
    } else {
      teamMap.set(key, {
        teamName: s.canonicalTeamName ?? s.teamName ?? 'Unknown',
        teamSlug: s.teamSlug,
        nights: s.nightsBowled,
      });
    }
  }
  const totalNights = seasonStats.reduce((sum, s) => sum + s.nightsBowled, 0);
  const teams: TeamStat[] = Array.from(teamMap.values())
    .sort((a, b) => b.nights - a.nights)
    .map(t => ({
      teamName: t.teamName,
      teamSlug: t.teamSlug,
      nights: t.nights,
      pct: totalNights > 0 ? Math.round((t.nights / totalNights) * 100) : 0,
    }));
  return { teams, totalNights };
}

/**
 * Build the bowler's own GameProfile row from a single-bowler AVG row.
 * Mirror of the per-row build in getGameProfiles (alltime.ts:395-413), for one bowler.
 * Returns null when the bowler has no qualifying (all-three-non-null) games.
 */
export function buildGameProfile(
  row: { games: number; avg1: number | null; avg2: number | null; avg3: number | null } | undefined,
  id: { bowlerName: string; slug: string; isActive: boolean | null },
): GameProfileRow | null {
  if (!row || !row.games || row.avg1 == null || row.avg2 == null || row.avg3 == null) return null;
  const { avg1, avg2, avg3 } = row;
  const overallAvg = (avg1 + avg2 + avg3) / 3;
  const spread = Math.max(avg1, avg2, avg3) - Math.min(avg1, avg2, avg3);
  const pctSpread = overallAvg > 0 ? (spread / overallAvg) * 100 : 0;
  const { bestGame, archetype } = classifyArchetype(avg1, avg2, avg3, pctSpread);
  return {
    bowlerName: id.bowlerName,
    slug: id.slug,
    nights: row.games,
    games: row.games * 3,
    avg1, avg2, avg3,
    overallAvg,
    pctSpread,
    bestGame,
    archetype,
    isActive: !!id.isActive,
  };
}

/**
 * Assemble the flat DTO from the 8 recordsets, in this fixed order:
 * 0 careerSummary, 1 seasonStats, 2 gameLog, 3 rollingAvgHistory,
 * 4 patches, 5 starStats(code/cnt), 6 facts, 7 archetype(games,avg1..3).
 */
export function assembleBowlerView(recordsets: unknown[][]): BowlerPageView {
  const careerSummary = ((recordsets[0] ?? [])[0] as BowlerCareerSummary) ?? null;
  const seasonStats = (recordsets[1] ?? []) as BowlerSeasonStats[];
  const { teams } = deriveTeams(seasonStats);
  const gameProfile = careerSummary
    ? buildGameProfile(
        (recordsets[7] ?? [])[0] as { games: number; avg1: number | null; avg2: number | null; avg3: number | null } | undefined,
        { bowlerName: careerSummary.bowlerName, slug: careerSummary.slug, isActive: careerSummary.isActive },
      )
    : null;
  return {
    careerSummary,
    seasonStats,
    gameLog: (recordsets[2] ?? []) as GameLogWeek[],
    rollingAvgHistory: (recordsets[3] ?? []) as RollingAvgPoint[],
    patches: (recordsets[4] ?? []) as BowlerPatch[],
    starStats: reduceStarStats((recordsets[5] ?? []) as Array<{ code: string; cnt: number }>),
    facts: mapFacts((recordsets[6] ?? []) as Array<Record<string, unknown>>),
    teams,
    gameProfile,
  };
}

/**
 * Last-week delta (page.tsx:154-189). Needs currentSeasonID (league state) to gate
 * "active in the current season" - kept OUT of the cached view so the per-bowler
 * cache key stays clean; the page passes league.currentSeasonID in.
 */
export function computeWeekDelta(view: BowlerPageView, currentSeasonID: number | null): WeekDelta | null {
  const { careerSummary, seasonStats, gameLog } = view;
  const latestSeason = seasonStats.length > 0 ? seasonStats[0] : null;
  const isCurrentSeason = latestSeason != null && latestSeason.seasonID === currentSeasonID;
  if (!isCurrentSeason || !careerSummary) return null;

  const latestSeasonLog = gameLog.filter(w => latestSeason && w.seasonID === latestSeason.seasonID);
  const lastWeek = latestSeasonLog.length > 0 ? latestSeasonLog[latestSeasonLog.length - 1] : null;
  if (!lastWeek) return null;

  const games = [lastWeek.game1, lastWeek.game2, lastWeek.game3].filter(
    (g): g is number => g !== null && g > 0,
  );
  const weekPins = games.reduce((sum, g) => sum + g, 0);
  const weekMaxGame = games.length > 0 ? Math.max(...games) : 0;
  const weekSeries = lastWeek.scratchSeries ?? 0;
  const avgChange = careerSummary.rollingAvg != null && lastWeek.incomingAvg != null
    ? careerSummary.rollingAvg - lastWeek.incomingAvg
    : null;

  return {
    totalPins: weekPins,
    totalGames: games.length,
    games200Plus: games.filter(g => g >= 200).length,
    series600Plus: weekSeries >= 600 ? 1 : 0,
    turkeys: lastWeek.turkeys,
    avgChange,
    newHighGame: careerSummary.highGame !== null && weekMaxGame >= careerSummary.highGame,
    newHighSeries: careerSummary.highSeries !== null && weekSeries >= careerSummary.highSeries,
  };
}

/**
 * New single-bowler archetype aggregate (same WHERE as getGameProfiles, one bowler).
 * Statement 8 of the batch; feeds buildGameProfile.
 */
const BOWLER_ARCHETYPE_SQL = `
  SELECT
    COUNT(*) AS games,
    AVG(CAST(game1 AS FLOAT)) AS avg1,
    AVG(CAST(game2 AS FLOAT)) AS avg2,
    AVG(CAST(game3 AS FLOAT)) AS avg3
  FROM scores
  WHERE bowlerID = @bowlerID
    AND isPenalty = 0
    AND game1 IS NOT NULL AND game2 IS NOT NULL AND game3 IS NOT NULL
`;

/**
 * Batched per-bowler SQL. Order MUST match assembleBowlerView's recordset order:
 * 0 careerSummary, 1 seasonStats, 2 gameLog, 3 rollingAvgHistory,
 * 4 patches, 5 starStats, 6 facts, 7 archetype.
 * The first 7 are reused verbatim from the query modules - do NOT edit them here.
 */
export const BOWLER_VIEW_BATCH_SQL = [
  GET_BOWLER_CAREER_SUMMARY_SQL,
  BOWLER_SEASON_STATS_SQL,
  GET_BOWLER_GAME_LOG_SQL,
  GET_BOWLER_ROLLING_AVG_HISTORY_SQL,
  GET_BOWLER_PATCHES_SQL,
  GET_BOWLER_STAR_STATS_SQL,
  BOWLER_FACTS_SQL,
  BOWLER_ARCHETYPE_SQL,
].join(';\n');

const EMPTY_VIEW: BowlerPageView = {
  careerSummary: null,
  seasonStats: [],
  gameLog: [],
  rollingAvgHistory: [],
  patches: [],
  starStats: reduceStarStats([]),
  facts: [],
  teams: [],
  gameProfile: null,
};

/**
 * One round-trip for the whole bowler page (was 8). Per-bowler cache invalidation
 * via { bowlerID } (NOT dependsOn: ['scores']). React.cache dedupes within a render.
 */
export const getBowlerPageView = cache(async (bowlerID: number): Promise<BowlerPageView> => {
  return cachedQuery(
    `getBowlerPageView-${bowlerID}`,
    async () => {
      const db = await getDb();
      const result = await db
        .request()
        .input('bowlerID', bowlerID)
        .query(BOWLER_VIEW_BATCH_SQL);
      // mssql returns one entry per statement in result.recordsets, in order.
      return assembleBowlerView(result.recordsets as unknown[][]);
    },
    EMPTY_VIEW,
    { sql: BOWLER_VIEW_BATCH_SQL, bowlerID },
  );
});
