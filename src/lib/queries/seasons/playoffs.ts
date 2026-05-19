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
  /** True when both teams are set but the winner hasn't been recorded yet (in-progress final). */
  pending?: boolean;
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
    pr.winnerTeamID,
    COALESCE(h1.teamName, t1.teamName) AS team1Name, t1.slug AS team1Slug, s1.seed AS team1Seed, pr.team1ID,
    COALESCE(h2.teamName, t2.teamName) AS team2Name, t2.slug AS team2Slug, s2.seed AS team2Seed, pr.team2ID
  FROM playoffResults pr
  JOIN teams t1 ON pr.team1ID = t1.teamID
  JOIN teams t2 ON pr.team2ID = t2.teamID
  LEFT JOIN teamNameHistory h1 ON h1.seasonID = pr.seasonID AND h1.teamID = pr.team1ID
  LEFT JOIN teamNameHistory h2 ON h2.seasonID = pr.seasonID AND h2.teamID = pr.team2ID
  LEFT JOIN seeds s1 ON s1.teamID = pr.team1ID
  LEFT JOIN seeds s2 ON s2.teamID = pr.team2ID
  WHERE pr.seasonID = @seasonID AND pr.playoffType = 'Team' AND pr.round = 'final'
`;

const PLAYOFF_SEMI_SQL = `
  ${PLAYOFF_SEEDS_CTE}
  SELECT
    pr.winnerTeamID,
    COALESCE(h1.teamName, t1.teamName) AS team1Name, t1.slug AS team1Slug, s1.seed AS team1Seed, pr.team1ID,
    COALESCE(h2.teamName, t2.teamName) AS team2Name, t2.slug AS team2Slug, s2.seed AS team2Seed, pr.team2ID
  FROM playoffResults pr
  JOIN teams t1 ON pr.team1ID = t1.teamID
  JOIN teams t2 ON pr.team2ID = t2.teamID
  LEFT JOIN teamNameHistory h1 ON h1.seasonID = pr.seasonID AND h1.teamID = pr.team1ID
  LEFT JOIN teamNameHistory h2 ON h2.seasonID = pr.seasonID AND h2.teamID = pr.team2ID
  LEFT JOIN seeds s1 ON s1.teamID = pr.team1ID
  LEFT JOIN seeds s2 ON s2.teamID = pr.team2ID
  WHERE pr.seasonID = @seasonID AND pr.playoffType = 'Team' AND pr.round = 'semifinal'
  ORDER BY pr.playoffID
`;

const PLAYOFF_ALL_SQL = PLAYOFF_FINAL_SQL + PLAYOFF_SEMI_SQL + '/* v4: symmetric team1/team2, winner via winnerTeamID, pending final support */';

export const getSeasonPlayoffBracket = cache(async (seasonID: number): Promise<SeasonPlayoffBracket | null> => {
  return cachedQuery(`getSeasonPlayoffBracket-${seasonID}`, async () => {

    const db = await getDb();

    interface MatchupRow {
      winnerTeamID: number | null;
      team1ID: number; team1Name: string; team1Slug: string; team1Seed: number | null;
      team2ID: number; team2Name: string; team2Slug: string; team2Seed: number | null;
    }

    const finalResult = await db.request()
      .input('seasonID', seasonID)
      .query<MatchupRow>(PLAYOFF_FINAL_SQL);
    if (finalResult.recordset.length === 0) return null;

    const semiResult = await db.request()
      .input('seasonID', seasonID)
      .query<MatchupRow>(PLAYOFF_SEMI_SQL);

    function buildMatchup(row: MatchupRow, allowPending: boolean): PlayoffMatchup | null {
      const t1 = { name: row.team1Name, slug: row.team1Slug, seed: row.team1Seed, id: row.team1ID };
      const t2 = { name: row.team2Name, slug: row.team2Slug, seed: row.team2Seed, id: row.team2ID };
      const winnerIsT1 = row.winnerTeamID === t1.id;
      const winnerIsT2 = row.winnerTeamID === t2.id;
      if (!winnerIsT1 && !winnerIsT2) {
        if (!allowPending) return null;
        return {
          winnerName: t1.name, winnerSlug: t1.slug, winnerSeed: t1.seed,
          loserName: t2.name, loserSlug: t2.slug, loserSeed: t2.seed,
          pending: true,
        };
      }
      const winner = winnerIsT1 ? t1 : t2;
      const loser = winnerIsT1 ? t2 : t1;
      return {
        winnerName: winner.name, winnerSlug: winner.slug, winnerSeed: winner.seed,
        loserName: loser.name, loserSlug: loser.slug, loserSeed: loser.seed,
      };
    }

    const semis = semiResult.recordset;
    const finalMatchup = buildMatchup(finalResult.recordset[0], true);
    if (!finalMatchup) return null;

    return {
      final: finalMatchup,
      semi1: semis[0] ? buildMatchup(semis[0], false) : null,
      semi2: semis[1] ? buildMatchup(semis[1], false) : null,
    };
  }, null, { sql: PLAYOFF_ALL_SQL, seasonID });
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
  }, [], { sql: GET_ALL_PLAYOFF_HISTORY_SQL, dependsOn: ['playoffScores'] });
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

export interface SeasonIndividualChampions {
  mensScratchBowlerID: number | null;
  womensScratchBowlerID: number | null;
  handicapBowlerID: number | null;
}

const GET_SEASON_INDIVIDUAL_CHAMPIONS_SQL = `
  SELECT
    cm.winnerBowlerID AS mensScratchBowlerID,
    cw.winnerBowlerID AS womensScratchBowlerID,
    ch.winnerBowlerID AS handicapBowlerID
  FROM seasons s
  LEFT JOIN seasonChampions cm ON cm.seasonID = s.seasonID AND cm.championshipType = 'MensScratch'
  LEFT JOIN seasonChampions cw ON cw.seasonID = s.seasonID AND cw.championshipType = 'WomensScratch'
  LEFT JOIN seasonChampions ch ON ch.seasonID = s.seasonID AND ch.championshipType = 'Handicap'
  WHERE s.seasonID = @seasonID
`;

export const getSeasonIndividualChampions = cache(async (seasonID: number): Promise<SeasonIndividualChampions | null> => {
  return cachedQuery(`getSeasonIndividualChampions-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db.request()
      .input('seasonID', seasonID)
      .query<SeasonIndividualChampions>(GET_SEASON_INDIVIDUAL_CHAMPIONS_SQL);
    if (result.recordset.length === 0) return null;
    const row = result.recordset[0];
    // If no champions at all, return null
    if (!row.mensScratchBowlerID && !row.womensScratchBowlerID && !row.handicapBowlerID) return null;
    return row;
  }, null, { sql: GET_SEASON_INDIVIDUAL_CHAMPIONS_SQL, seasonID });
});

export interface SeasonChampionsCardData {
  team: { name: string; slug: string } | null;
  mensScratch: { name: string; slug: string } | null;
  womensScratch: { name: string; slug: string } | null;
  handicap: { name: string; slug: string } | null;
}

const GET_SEASON_CHAMPIONS_CARD_SQL = `
  SELECT
    tt.teamName        AS teamName,    tt.slug   AS teamSlug,
    bm.bowlerName      AS mensName,    bm.slug   AS mensSlug,
    bw.bowlerName      AS womensName,  bw.slug   AS womensSlug,
    bh.bowlerName      AS hcpName,     bh.slug   AS hcpSlug
  FROM seasons s
  LEFT JOIN seasonChampions ct ON ct.seasonID = s.seasonID AND ct.championshipType = 'Team'
  LEFT JOIN teams tt           ON tt.teamID = ct.winnerTeamID
  LEFT JOIN seasonChampions cm ON cm.seasonID = s.seasonID AND cm.championshipType = 'MensScratch'
  LEFT JOIN bowlers bm         ON bm.bowlerID = cm.winnerBowlerID
  LEFT JOIN seasonChampions cw ON cw.seasonID = s.seasonID AND cw.championshipType = 'WomensScratch'
  LEFT JOIN bowlers bw         ON bw.bowlerID = cw.winnerBowlerID
  LEFT JOIN seasonChampions ch ON ch.seasonID = s.seasonID AND ch.championshipType = 'Handicap'
  LEFT JOIN bowlers bh         ON bh.bowlerID = ch.winnerBowlerID
  WHERE s.seasonID = @seasonID
`;

export const getSeasonChampionsCard = cache(async (seasonID: number): Promise<SeasonChampionsCardData | null> => {
  return cachedQuery(`getSeasonChampionsCard-${seasonID}`, async () => {
    const db = await getDb();
    const result = await db.request()
      .input('seasonID', seasonID)
      .query<{
        teamName: string | null; teamSlug: string | null;
        mensName: string | null; mensSlug: string | null;
        womensName: string | null; womensSlug: string | null;
        hcpName: string | null; hcpSlug: string | null;
      }>(GET_SEASON_CHAMPIONS_CARD_SQL);
    if (result.recordset.length === 0) return null;
    const r = result.recordset[0];
    if (!r.teamName && !r.mensName && !r.womensName && !r.hcpName) return null;
    return {
      team: r.teamName && r.teamSlug ? { name: r.teamName, slug: r.teamSlug } : null,
      mensScratch: r.mensName && r.mensSlug ? { name: r.mensName, slug: r.mensSlug } : null,
      womensScratch: r.womensName && r.womensSlug ? { name: r.womensName, slug: r.womensSlug } : null,
      handicap: r.hcpName && r.hcpSlug ? { name: r.hcpName, slug: r.hcpSlug } : null,
    };
  }, null, { sql: GET_SEASON_CHAMPIONS_CARD_SQL, seasonID, dependsOn: ['playoffScores'] });
});

export const getAllIndividualChampions = cache(async (): Promise<IndividualChampionSeason[]> => {
  return cachedQuery('getAllIndividualChampions', async () => {
    const db = await getDb();
    const result = await db.request().query<IndividualChampionSeason>(GET_ALL_INDIVIDUAL_CHAMPIONS_SQL);
    return result.recordset;
  }, [], { sql: GET_ALL_INDIVIDUAL_CHAMPIONS_SQL, dependsOn: ['playoffScores'] });
});

const GET_TEAM_CHAMPIONSHIP_WINS_SQL = `
  SELECT winnerTeamID AS teamID, COUNT(*) AS wins
  FROM playoffResults
  WHERE playoffType = 'Team' AND round = 'final' AND winnerTeamID IS NOT NULL
  GROUP BY winnerTeamID
`;

export const getTeamChampionshipWins = cache(async (): Promise<Map<number, number>> => {
  const rows = await cachedQuery('getTeamChampionshipWins', async () => {
    const db = await getDb();
    const result = await db.request().query<{ teamID: number; wins: number }>(GET_TEAM_CHAMPIONSHIP_WINS_SQL);
    return result.recordset;
  }, [], { sql: GET_TEAM_CHAMPIONSHIP_WINS_SQL, dependsOn: ['playoffScores'] });
  return new Map(rows.map(r => [r.teamID, r.wins]));
});

const GET_INDIVIDUAL_CHAMPIONSHIP_WINS_SQL = `
  SELECT winnerBowlerID AS bowlerID, championshipType, COUNT(*) AS wins
  FROM seasonChampions
  WHERE winnerBowlerID IS NOT NULL
  GROUP BY winnerBowlerID, championshipType
`;

export interface IndividualChampionshipWins {
  MensScratch: number;
  WomensScratch: number;
  Handicap: number;
}

export const getIndividualChampionshipWins = cache(async (): Promise<Map<number, IndividualChampionshipWins>> => {
  const rows = await cachedQuery('getIndividualChampionshipWins', async () => {
    const db = await getDb();
    const result = await db.request().query<{
      bowlerID: number;
      championshipType: 'MensScratch' | 'WomensScratch' | 'Handicap';
      wins: number;
    }>(GET_INDIVIDUAL_CHAMPIONSHIP_WINS_SQL);
    return result.recordset;
  }, [], { sql: GET_INDIVIDUAL_CHAMPIONSHIP_WINS_SQL, dependsOn: ['playoffScores'] });

  const out = new Map<number, IndividualChampionshipWins>();
  for (const r of rows) {
    const entry = out.get(r.bowlerID) ?? { MensScratch: 0, WomensScratch: 0, Handicap: 0 };
    entry[r.championshipType] = r.wins;
    out.set(r.bowlerID, entry);
  }
  return out;
});
