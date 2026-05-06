/**
 * Playoff admin operations: read/write the playoff field for a season.
 *
 * - Team semifinals/final live in `playoffResults` (existing table).
 * - Individual playoff field (Men's / Women's Scratch, Handicap) lives in
 *   `individualPlayoffParticipants` (new table).
 *
 * No caching — these are admin writes and admin-page reads.
 */

import sql from 'mssql';
import { getDb } from '@/lib/db';
import { getSeasonStandings } from '@/lib/queries/seasons/standings';

export type ChampionshipType = 'MensScratch' | 'WomensScratch' | 'Handicap';

export interface DivisionTopTeam {
  teamID: number;
  teamName: string;
  divisionName: string;
  divRank: number;
  totalPts: number;
}

export interface PlayoffEligibleBowler {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  teamID: number | null;
  teamName: string | null;
  value: number; // avg or hcpAvg, depending on category
  gamesBowled: number;
}

export interface SemifinalRow {
  playoffID: number;
  team1ID: number;
  team2ID: number;
  winnerTeamID: number | null;
}

export interface FinalRow {
  playoffID: number;
  team1ID: number;
  team2ID: number;
  winnerTeamID: number | null;
}

// ──────────────────────────────────────────────────────────────────
// Team playoff seeding
// ──────────────────────────────────────────────────────────────────

/**
 * Returns the top 2 teams per division (post-tiebreaker), ordered by division
 * then divRank. These are the suggested playoff teams. Caller decides matchups.
 *
 * Uses the cached getSeasonStandings query so the order matches what's shown
 * on the public standings page (including any H2H tiebreaker resolution).
 */
export async function getDivisionTopTeams(seasonID: number): Promise<DivisionTopTeam[]> {
  const standings = await getSeasonStandings(seasonID);
  const byDivision = new Map<string, typeof standings>();
  for (const row of standings) {
    const div = row.divisionName ?? 'Division A';
    if (!byDivision.has(div)) byDivision.set(div, []);
    byDivision.get(div)!.push(row);
  }

  const out: DivisionTopTeam[] = [];
  for (const [divisionName, rows] of byDivision) {
    rows.slice(0, 2).forEach((r, idx) => {
      out.push({
        teamID: r.teamID,
        teamName: r.teamName,
        divisionName,
        divRank: idx + 1,
        totalPts: r.totalPts,
      });
    });
  }
  return out.sort((a, b) =>
    a.divisionName.localeCompare(b.divisionName) || a.divRank - b.divRank
  );
}

/**
 * All teams that played at least one match in the given season.
 * Used to populate semifinal team dropdowns.
 */
export async function getAllSeasonTeams(seasonID: number): Promise<Array<{
  teamID: number; teamName: string; divisionName: string | null;
}>> {
  const db = await getDb();
  const result = await db
    .request()
    .input('seasonID', sql.Int, seasonID)
    .query<{ teamID: number; teamName: string; divisionName: string | null }>(`
      SELECT DISTINCT
        t.teamID,
        COALESCE(tnh.teamName, t.teamName) AS teamName,
        sd.divisionName
      FROM scores sc
      JOIN teams t ON t.teamID = sc.teamID
      LEFT JOIN teamNameHistory tnh ON tnh.seasonID = @seasonID AND tnh.teamID = t.teamID
      LEFT JOIN seasonDivisions sd ON sd.seasonID = @seasonID AND sd.teamID = t.teamID
      WHERE sc.seasonID = @seasonID
      ORDER BY sd.divisionName, teamName
    `);
  return result.recordset;
}

// ──────────────────────────────────────────────────────────────────
// Team playoff semifinal/final rows in playoffResults
// ──────────────────────────────────────────────────────────────────

export async function getPlayoffSemifinals(seasonID: number): Promise<SemifinalRow[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input('seasonID', sql.Int, seasonID)
    .query<SemifinalRow>(`
      SELECT playoffID, team1ID, team2ID, winnerTeamID
      FROM playoffResults
      WHERE seasonID = @seasonID AND playoffType = 'Team' AND round = 'semifinal'
      ORDER BY playoffID
    `);
  return result.recordset;
}

export async function getPlayoffFinal(seasonID: number): Promise<FinalRow | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input('seasonID', sql.Int, seasonID)
    .query<FinalRow>(`
      SELECT playoffID, team1ID, team2ID, winnerTeamID
      FROM playoffResults
      WHERE seasonID = @seasonID AND playoffType = 'Team' AND round = 'final'
    `);
  return result.recordset[0] || null;
}

/**
 * Replace the two semifinal rows for a season. Pass exactly 2 matchups.
 * If existing semis have winners recorded, those are preserved when team IDs match.
 */
export async function saveSemifinalMatchups(
  seasonID: number,
  matchups: Array<{ team1ID: number; team2ID: number }>,
): Promise<void> {
  if (matchups.length !== 2) {
    throw new Error(`Expected 2 semifinal matchups, got ${matchups.length}`);
  }
  const db = await getDb();
  const tx = new sql.Transaction(db);
  await tx.begin();
  try {
    // Capture existing winners by team-pair so we don't drop them on rewrite
    const existing = await new sql.Request(tx)
      .input('seasonID', sql.Int, seasonID)
      .query<SemifinalRow>(`
        SELECT playoffID, team1ID, team2ID, winnerTeamID
        FROM playoffResults
        WHERE seasonID = @seasonID AND playoffType = 'Team' AND round = 'semifinal'
      `);

    function findExistingWinner(t1: number, t2: number): number | null {
      const row = existing.recordset.find(r =>
        (r.team1ID === t1 && r.team2ID === t2) ||
        (r.team1ID === t2 && r.team2ID === t1),
      );
      return row?.winnerTeamID ?? null;
    }

    await new sql.Request(tx)
      .input('seasonID', sql.Int, seasonID)
      .query(`
        DELETE FROM playoffResults
        WHERE seasonID = @seasonID AND playoffType = 'Team' AND round = 'semifinal'
      `);

    for (const m of matchups) {
      const winner = findExistingWinner(m.team1ID, m.team2ID);
      await new sql.Request(tx)
        .input('seasonID', sql.Int, seasonID)
        .input('team1ID', sql.Int, m.team1ID)
        .input('team2ID', sql.Int, m.team2ID)
        .input('winnerTeamID', sql.Int, winner)
        .query(`
          INSERT INTO playoffResults (seasonID, playoffType, round, team1ID, team2ID, winnerTeamID)
          VALUES (@seasonID, 'Team', 'semifinal', @team1ID, @team2ID, @winnerTeamID)
        `);
    }

    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

/**
 * Update winnerTeamID on a single semifinal row. Used when admin records results.
 */
export async function recordSemifinalWinner(playoffID: number, winnerTeamID: number): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input('playoffID', sql.Int, playoffID)
    .input('winnerTeamID', sql.Int, winnerTeamID)
    .query(`
      UPDATE playoffResults
      SET winnerTeamID = @winnerTeamID
      WHERE playoffID = @playoffID
        AND playoffType = 'Team' AND round = 'semifinal'
    `);
}

/**
 * Insert or replace the final row for a season. Winner stays NULL until recorded.
 */
export async function saveTeamFinalMatchup(
  seasonID: number,
  team1ID: number,
  team2ID: number,
): Promise<void> {
  const db = await getDb();
  const tx = new sql.Transaction(db);
  await tx.begin();
  try {
    const existing = await new sql.Request(tx)
      .input('seasonID', sql.Int, seasonID)
      .query<{ winnerTeamID: number | null; team1ID: number; team2ID: number }>(`
        SELECT winnerTeamID, team1ID, team2ID FROM playoffResults
        WHERE seasonID = @seasonID AND playoffType = 'Team' AND round = 'final'
      `);

    let preservedWinner: number | null = null;
    if (existing.recordset.length > 0) {
      const ex = existing.recordset[0];
      const sameMatchup =
        (ex.team1ID === team1ID && ex.team2ID === team2ID) ||
        (ex.team1ID === team2ID && ex.team2ID === team1ID);
      if (sameMatchup) preservedWinner = ex.winnerTeamID;
    }

    await new sql.Request(tx)
      .input('seasonID', sql.Int, seasonID)
      .query(`
        DELETE FROM playoffResults
        WHERE seasonID = @seasonID AND playoffType = 'Team' AND round = 'final'
      `);

    await new sql.Request(tx)
      .input('seasonID', sql.Int, seasonID)
      .input('team1ID', sql.Int, team1ID)
      .input('team2ID', sql.Int, team2ID)
      .input('winnerTeamID', sql.Int, preservedWinner)
      .query(`
        INSERT INTO playoffResults (seasonID, playoffType, round, team1ID, team2ID, winnerTeamID)
        VALUES (@seasonID, 'Team', 'final', @team1ID, @team2ID, @winnerTeamID)
      `);

    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

export async function recordFinalWinner(seasonID: number, winnerTeamID: number): Promise<void> {
  const db = await getDb();
  await db
    .request()
    .input('seasonID', sql.Int, seasonID)
    .input('winnerTeamID', sql.Int, winnerTeamID)
    .query(`
      UPDATE playoffResults
      SET winnerTeamID = @winnerTeamID
      WHERE seasonID = @seasonID AND playoffType = 'Team' AND round = 'final'
    `);
}

// ──────────────────────────────────────────────────────────────────
// Individual playoff field
// ──────────────────────────────────────────────────────────────────

const MIN_GAMES_FOR_PLAYOFFS = 18; // matches getMinGamesForWeek(>=9)

/**
 * Top N bowlers by season scratch average for the given gender.
 * Filters to bowlers who bowled >= MIN_GAMES_FOR_PLAYOFFS games.
 */
export async function getTopScratchBowlers(
  seasonID: number,
  gender: 'M' | 'F',
  limit: number,
): Promise<PlayoffEligibleBowler[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input('seasonID', sql.Int, seasonID)
    .input('gender', sql.Char(1), gender)
    .input('limit', sql.Int, limit)
    .input('minGames', sql.Int, MIN_GAMES_FOR_PLAYOFFS)
    .query<PlayoffEligibleBowler>(`
      WITH agg AS (
        SELECT
          sc.bowlerID,
          COUNT(sc.scoreID) * 3 AS gamesBowled,
          CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS value
        FROM scores sc
        WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
        GROUP BY sc.bowlerID
        HAVING COUNT(sc.scoreID) * 3 >= @minGames
      ),
      ranked AS (
        SELECT TOP (@limit)
          a.bowlerID, b.bowlerName, b.slug, a.value, a.gamesBowled
        FROM agg a
        JOIN bowlers b ON b.bowlerID = a.bowlerID
        WHERE b.gender = @gender
        ORDER BY a.value DESC
      )
      SELECT
        r.bowlerID, r.bowlerName, r.slug, r.value, r.gamesBowled,
        pt.teamID, COALESCE(tnh.teamName, t.teamName) AS teamName
      FROM ranked r
      OUTER APPLY (
        SELECT TOP 1 sc2.teamID
        FROM scores sc2
        WHERE sc2.bowlerID = r.bowlerID AND sc2.seasonID = @seasonID AND sc2.isPenalty = 0
        GROUP BY sc2.teamID
        ORDER BY COUNT(*) DESC
      ) pt
      LEFT JOIN teams t ON t.teamID = pt.teamID
      LEFT JOIN teamNameHistory tnh ON tnh.seasonID = @seasonID AND tnh.teamID = pt.teamID
      ORDER BY r.value DESC
    `);
  return result.recordset;
}

/**
 * Top N bowlers by handicap average. Excludes bowlerIDs already selected
 * for scratch playoffs (per league rule).
 */
export async function getTopHandicapBowlers(
  seasonID: number,
  excludeBowlerIDs: number[],
  limit: number,
): Promise<PlayoffEligibleBowler[]> {
  const db = await getDb();
  const exclusionList = excludeBowlerIDs.length > 0
    ? excludeBowlerIDs.join(',')
    : '0'; // no-op exclusion when list is empty
  // Inlining the exclusion list is safe: every value is a numeric bowlerID we just queried.
  const result = await db
    .request()
    .input('seasonID', sql.Int, seasonID)
    .input('limit', sql.Int, limit)
    .input('minGames', sql.Int, MIN_GAMES_FOR_PLAYOFFS)
    .query<PlayoffEligibleBowler>(`
      WITH agg AS (
        SELECT
          sc.bowlerID,
          COUNT(sc.scoreID) * 3 AS gamesBowled,
          CAST(SUM(sc.handSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS value
        FROM scores sc
        WHERE sc.seasonID = @seasonID AND sc.isPenalty = 0
          AND sc.bowlerID NOT IN (${exclusionList})
        GROUP BY sc.bowlerID
        HAVING COUNT(sc.scoreID) * 3 >= @minGames
      ),
      ranked AS (
        SELECT TOP (@limit)
          a.bowlerID, b.bowlerName, b.slug, a.value, a.gamesBowled
        FROM agg a
        JOIN bowlers b ON b.bowlerID = a.bowlerID
        ORDER BY a.value DESC
      )
      SELECT
        r.bowlerID, r.bowlerName, r.slug, r.value, r.gamesBowled,
        pt.teamID, COALESCE(tnh.teamName, t.teamName) AS teamName
      FROM ranked r
      OUTER APPLY (
        SELECT TOP 1 sc2.teamID
        FROM scores sc2
        WHERE sc2.bowlerID = r.bowlerID AND sc2.seasonID = @seasonID AND sc2.isPenalty = 0
        GROUP BY sc2.teamID
        ORDER BY COUNT(*) DESC
      ) pt
      LEFT JOIN teams t ON t.teamID = pt.teamID
      LEFT JOIN teamNameHistory tnh ON tnh.seasonID = @seasonID AND tnh.teamID = pt.teamID
      ORDER BY r.value DESC
    `);
  return result.recordset;
}

/**
 * For round 2 pre-fill: top N bowlers from round 1 of a category, ranked by
 * the night's appropriate metric (scratchSeries for scratch categories,
 * handSeries for handicap). Returns empty if round 1 scores aren't entered.
 *
 * Pulls from `scores` for the playoff week. Limited to bowlers in the round 1
 * participant list for that category.
 */
export async function getTopAdvancingFromRoundOne(
  seasonID: number,
  championshipType: ChampionshipType,
  limit: number,
): Promise<Array<{ bowlerID: number; bowlerName: string; series: number }>> {
  const db = await getDb();

  // Determine playoff week 1 = max regular week + 1
  const maxWeekResult = await db
    .request()
    .input('seasonID', sql.Int, seasonID)
    .query<{ maxWeek: number | null }>(
      `SELECT MAX(week) AS maxWeek FROM schedule WHERE seasonID = @seasonID`,
    );
  const maxRegularWeek = maxWeekResult.recordset[0]?.maxWeek ?? 9;
  const round1Week = maxRegularWeek + 1;

  const seriesCol = championshipType === 'Handicap' ? 'sc.handSeries' : 'sc.scratchSeries';

  const result = await db
    .request()
    .input('seasonID', sql.Int, seasonID)
    .input('week', sql.Int, round1Week)
    .input('type', sql.VarChar(30), championshipType)
    .input('limit', sql.Int, limit)
    .query<{ bowlerID: number; bowlerName: string; series: number }>(`
      SELECT TOP (@limit)
        ipp.bowlerID,
        b.bowlerName,
        ${seriesCol} AS series
      FROM individualPlayoffParticipants ipp
      JOIN bowlers b ON b.bowlerID = ipp.bowlerID
      JOIN scores sc ON sc.bowlerID = ipp.bowlerID
        AND sc.seasonID = ipp.seasonID
        AND sc.week = @week
        AND sc.isPenalty = 0
      WHERE ipp.seasonID = @seasonID
        AND ipp.championshipType = @type
        AND ipp.round = 1
      ORDER BY ${seriesCol} DESC
    `);
  return result.recordset;
}

/**
 * Read saved participants for a category/round. Returns rows ordered by position.
 */
export async function getIndividualPlayoffParticipants(
  seasonID: number,
  championshipType: ChampionshipType,
  round: 1 | 2,
): Promise<Array<{ position: number; bowlerID: number; bowlerName: string; slug: string }>> {
  const db = await getDb();
  const result = await db
    .request()
    .input('seasonID', sql.Int, seasonID)
    .input('type', sql.VarChar(30), championshipType)
    .input('round', sql.Int, round)
    .query<{ position: number; bowlerID: number; bowlerName: string; slug: string }>(`
      SELECT ipp.position, ipp.bowlerID, b.bowlerName, b.slug
      FROM individualPlayoffParticipants ipp
      JOIN bowlers b ON b.bowlerID = ipp.bowlerID
      WHERE ipp.seasonID = @seasonID
        AND ipp.championshipType = @type
        AND ipp.round = @round
      ORDER BY ipp.position
    `);
  return result.recordset;
}

/**
 * Replace the participants for a category/round. Validates no duplicate bowlerIDs.
 */
export async function saveIndividualPlayoffParticipants(
  seasonID: number,
  championshipType: ChampionshipType,
  round: 1 | 2,
  bowlerIDs: number[],
): Promise<void> {
  const seen = new Set<number>();
  for (const id of bowlerIDs) {
    if (seen.has(id)) {
      throw new Error(`Duplicate bowlerID ${id} in ${championshipType} round ${round}`);
    }
    seen.add(id);
  }

  const db = await getDb();
  const tx = new sql.Transaction(db);
  await tx.begin();
  try {
    await new sql.Request(tx)
      .input('seasonID', sql.Int, seasonID)
      .input('type', sql.VarChar(30), championshipType)
      .input('round', sql.Int, round)
      .query(`
        DELETE FROM individualPlayoffParticipants
        WHERE seasonID = @seasonID
          AND championshipType = @type
          AND round = @round
      `);

    for (let i = 0; i < bowlerIDs.length; i++) {
      await new sql.Request(tx)
        .input('seasonID', sql.Int, seasonID)
        .input('type', sql.VarChar(30), championshipType)
        .input('round', sql.Int, round)
        .input('position', sql.Int, i + 1)
        .input('bowlerID', sql.Int, bowlerIDs[i])
        .query(`
          INSERT INTO individualPlayoffParticipants
            (seasonID, championshipType, round, position, bowlerID)
          VALUES (@seasonID, @type, @round, @position, @bowlerID)
        `);
    }

    await tx.commit();
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}
