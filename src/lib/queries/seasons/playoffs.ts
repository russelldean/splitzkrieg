/**
 * Playoff bracket, playoff history, and individual championship queries.
 */
import { cache } from 'react';
import { getDb, cachedQuery } from '../../db';

export interface PlayoffMatchup {
  winnerName: string;
  winnerSlug: string;
  winnerSeed: number | null;
  loserName: string;
  loserSlug: string;
  loserSeed: number | null;
}

export interface SeasonPlayoffBracket {
  final: PlayoffMatchup;
  semi1: PlayoffMatchup | null;
  semi2: PlayoffMatchup | null;
}

const PLAYOFF_SEEDS_CTE = `
  WITH teamPtsUnpivot AS (
    SELECT sch.team1ID AS teamID, mr.team1GamePts AS gamePts, mr.team1BonusPts AS bonusPts
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.seasonID = @seasonID
    UNION ALL
    SELECT sch.team2ID AS teamID, mr.team2GamePts AS gamePts, mr.team2BonusPts AS bonusPts
    FROM matchResults mr
    JOIN schedule sch ON mr.scheduleID = sch.scheduleID
    WHERE sch.seasonID = @seasonID
  ),
  seeds AS (
    SELECT teamID,
           ROW_NUMBER() OVER (ORDER BY SUM(gamePts) + SUM(bonusPts) DESC) AS seed
    FROM teamPtsUnpivot
    GROUP BY teamID
  )`;

const PLAYOFF_FINAL_SQL = `
  ${PLAYOFF_SEEDS_CTE}
  SELECT
    COALESCE(hc.teamName, tc.teamName) AS champName, tc.slug AS champSlug, sc.seed AS champSeed,
    COALESCE(hr.teamName, tr.teamName) AS ruName, tr.slug AS ruSlug, sr.seed AS ruSeed
  FROM playoffResults pr
  JOIN teams tc ON pr.team1ID = tc.teamID
  JOIN teams tr ON pr.team2ID = tr.teamID
  LEFT JOIN teamNameHistory hc ON hc.seasonID = pr.seasonID AND hc.teamID = pr.team1ID
  LEFT JOIN teamNameHistory hr ON hr.seasonID = pr.seasonID AND hr.teamID = pr.team2ID
  LEFT JOIN seeds sc ON sc.teamID = pr.team1ID
  LEFT JOIN seeds sr ON sr.teamID = pr.team2ID
  WHERE pr.seasonID = @seasonID AND pr.playoffType = 'Team' AND pr.round = 'final'
`;

const PLAYOFF_SEMI_SQL = `
  ${PLAYOFF_SEEDS_CTE}
  SELECT
    COALESCE(hl.teamName, tl.teamName) AS loserName, tl.slug AS loserSlug, sl.seed AS loserSeed,
    COALESCE(hw.teamName, tw.teamName) AS winnerName, tw.slug AS winnerSlug, sw.seed AS winnerSeed
  FROM playoffResults pr
  JOIN teams tl ON pr.team1ID = tl.teamID
  LEFT JOIN teams tw ON pr.winnerTeamID = tw.teamID
  LEFT JOIN teamNameHistory hl ON hl.seasonID = pr.seasonID AND hl.teamID = pr.team1ID
  LEFT JOIN teamNameHistory hw ON hw.seasonID = pr.seasonID AND hw.teamID = pr.winnerTeamID
  LEFT JOIN seeds sl ON sl.teamID = pr.team1ID
  LEFT JOIN seeds sw ON sw.teamID = pr.winnerTeamID
  WHERE pr.seasonID = @seasonID AND pr.playoffType = 'Team' AND pr.round = 'semifinal'
  ORDER BY pr.playoffID
`;

const PLAYOFF_ALL_SQL = PLAYOFF_FINAL_SQL + PLAYOFF_SEMI_SQL + '/* v3: fix cross-division semi matchups */';

export const getSeasonPlayoffBracket = cache(async (seasonID: number): Promise<SeasonPlayoffBracket | null> => {
  return cachedQuery(`getSeasonPlayoffBracket-${seasonID}`, async () => {

    const db = await getDb();

    const finalResult = await db.request()
      .input('seasonID', seasonID)
      .query<{
        champName: string; champSlug: string; champSeed: number | null;
        ruName: string; ruSlug: string; ruSeed: number | null;
      }>(PLAYOFF_FINAL_SQL);
    if (finalResult.recordset.length === 0) return null;
    const f = finalResult.recordset[0];

    const semiResult = await db.request()
      .input('seasonID', seasonID)
      .query<{
        loserName: string; loserSlug: string; loserSeed: number | null;
        winnerName: string | null; winnerSlug: string | null; winnerSeed: number | null;
      }>(PLAYOFF_SEMI_SQL);

    const semis = semiResult.recordset;

    function buildMatchup(
      wName: string, wSlug: string, wSeed: number | null,
      lName: string, lSlug: string, lSeed: number | null,
    ): PlayoffMatchup {
      return { winnerName: wName, winnerSlug: wSlug, winnerSeed: wSeed, loserName: lName, loserSlug: lSlug, loserSeed: lSeed };
    }

    // When winnerTeamID is NULL on semis, infer winner from the final:
    // the two finalists are the two semi winners — assign each to one semi.
    const remainingFinalists = [
      { name: f.champName, slug: f.champSlug, seed: f.champSeed },
      { name: f.ruName, slug: f.ruSlug, seed: f.ruSeed },
    ];

    function buildSemi(semi: typeof semis[0] | undefined): PlayoffMatchup | null {
      if (!semi) return null;
      if (semi.winnerName) {
        return buildMatchup(semi.winnerName, semi.winnerSlug!, semi.winnerSeed,
          semi.loserName, semi.loserSlug, semi.loserSeed);
      }
      // Infer: pick a remaining finalist (prefer one whose slug differs from the loser)
      let idx = remainingFinalists.findIndex(t => t.slug !== semi.loserSlug);
      if (idx === -1) idx = 0; // fallback
      if (idx < remainingFinalists.length) {
        const inferred = remainingFinalists.splice(idx, 1)[0];
        return buildMatchup(inferred.name, inferred.slug, inferred.seed,
          semi.loserName, semi.loserSlug, semi.loserSeed);
      }
      return buildMatchup('', '', null, semi.loserName, semi.loserSlug, semi.loserSeed);
    }

    return {
      final: buildMatchup(f.champName, f.champSlug, f.champSeed, f.ruName, f.ruSlug, f.ruSeed),
      semi1: buildSemi(semis[0]),
      semi2: buildSemi(semis[1]),
    };
  }, null, { stable: true, sql: PLAYOFF_ALL_SQL });
});

export interface PlayoffSeason {
  seasonID: number;
  romanNumeral: string;
  displayName: string;
  championTeamID: number;
  championName: string;
  championHistoricName: string | null;
  runnerUpTeamID: number;
  runnerUpName: string;
  runnerUpHistoricName: string | null;
  semi1TeamID: number | null;
  semi1Name: string | null;
  semi1HistoricName: string | null;
  semi2TeamID: number | null;
  semi2Name: string | null;
  semi2HistoricName: string | null;
}

const GET_ALL_PLAYOFF_HISTORY_SQL = `
  WITH finals AS (
    SELECT seasonID, team1ID AS championTeamID, team2ID AS runnerUpTeamID
    FROM playoffResults
    WHERE playoffType = 'Team' AND round = 'final'
  ),
  semis AS (
    SELECT seasonID, team1ID AS semiTeamID,
           ROW_NUMBER() OVER (PARTITION BY seasonID ORDER BY playoffID) AS rn
    FROM playoffResults
    WHERE playoffType = 'Team' AND round = 'semifinal'
  )
  SELECT
    s.seasonID,
    s.romanNumeral,
    s.displayName,
    f.championTeamID,
    tc.teamName             AS championName,
    thc.teamName            AS championHistoricName,
    f.runnerUpTeamID,
    tr.teamName             AS runnerUpName,
    thr.teamName            AS runnerUpHistoricName,
    s1.semiTeamID           AS semi1TeamID,
    ts1.teamName            AS semi1Name,
    ths1.teamName           AS semi1HistoricName,
    s2.semiTeamID           AS semi2TeamID,
    ts2.teamName            AS semi2Name,
    ths2.teamName           AS semi2HistoricName
  FROM seasons s
  JOIN finals f ON f.seasonID = s.seasonID
  JOIN teams tc ON f.championTeamID = tc.teamID
  JOIN teams tr ON f.runnerUpTeamID = tr.teamID
  LEFT JOIN semis s1 ON s1.seasonID = s.seasonID AND s1.rn = 1
  LEFT JOIN teams ts1 ON s1.semiTeamID = ts1.teamID
  LEFT JOIN semis s2 ON s2.seasonID = s.seasonID AND s2.rn = 2
  LEFT JOIN teams ts2 ON s2.semiTeamID = ts2.teamID
  LEFT JOIN teamNameHistory thc ON thc.seasonID = s.seasonID AND thc.teamID = f.championTeamID
  LEFT JOIN teamNameHistory thr ON thr.seasonID = s.seasonID AND thr.teamID = f.runnerUpTeamID
  LEFT JOIN teamNameHistory ths1 ON ths1.seasonID = s.seasonID AND ths1.teamID = s1.semiTeamID
  LEFT JOIN teamNameHistory ths2 ON ths2.seasonID = s.seasonID AND ths2.teamID = s2.semiTeamID
  ORDER BY s.seasonID DESC
`;

export const getAllPlayoffHistory = cache(async (): Promise<PlayoffSeason[]> => {
  return cachedQuery('getAllPlayoffHistory', async () => {
    const db = await getDb();
    const result = await db.request().query<PlayoffSeason>(GET_ALL_PLAYOFF_HISTORY_SQL);
    return result.recordset;
  }, [], { stable: true, sql: GET_ALL_PLAYOFF_HISTORY_SQL + '/* v2: fix cross-division semi matchups */' });
});

export interface IndividualChampionSeason {
  seasonID: number;
  romanNumeral: string;
  displayName: string;
  mensScratchName: string | null;
  mensScratchSlug: string | null;
  womensScratchName: string | null;
  womensScratchSlug: string | null;
  handicapName: string | null;
  handicapSlug: string | null;
}

const GET_ALL_INDIVIDUAL_CHAMPIONS_SQL = `
  SELECT
    s.seasonID,
    s.romanNumeral,
    s.displayName,
    bm.bowlerName AS mensScratchName, bm.slug AS mensScratchSlug,
    bw.bowlerName AS womensScratchName, bw.slug AS womensScratchSlug,
    bh.bowlerName AS handicapName, bh.slug AS handicapSlug
  FROM seasons s
  LEFT JOIN seasonChampions cm ON cm.seasonID = s.seasonID AND cm.championshipType = 'MensScratch'
  LEFT JOIN bowlers bm ON cm.winnerBowlerID = bm.bowlerID
  LEFT JOIN seasonChampions cw ON cw.seasonID = s.seasonID AND cw.championshipType = 'WomensScratch'
  LEFT JOIN bowlers bw ON cw.winnerBowlerID = bw.bowlerID
  LEFT JOIN seasonChampions ch ON ch.seasonID = s.seasonID AND ch.championshipType = 'Handicap'
  LEFT JOIN bowlers bh ON ch.winnerBowlerID = bh.bowlerID
  WHERE cm.id IS NOT NULL OR cw.id IS NOT NULL OR ch.id IS NOT NULL
  ORDER BY s.seasonID DESC
`;

export const getAllIndividualChampions = cache(async (): Promise<IndividualChampionSeason[]> => {
  return cachedQuery('getAllIndividualChampions', async () => {
    const db = await getDb();
    const result = await db.request().query<IndividualChampionSeason>(GET_ALL_INDIVIDUAL_CHAMPIONS_SQL);
    return result.recordset;
  }, [], { stable: true, sql: GET_ALL_INDIVIDUAL_CHAMPIONS_SQL });
});
