/**
 * Score pipeline logic: insert scores, run match results, run patches, bump cache.
 * Refactored from scripts/import-week-scores.mjs, populate-match-results.mjs,
 * and populate-patches.mjs for use in the admin UI confirm flow.
 */

import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { getDb, withRetry } from '@/lib/db';
import { MILESTONE_THRESHOLDS, type MilestoneCategory } from '@/lib/milestone-config';
import type { StagedMatch, PersonalBest } from './types';

export type { PersonalBest };

/**
 * Delete existing scores for a given season and week.
 * Returns the number of rows deleted.
 */
export async function deleteScoresForWeek(
  seasonID: number,
  week: number,
): Promise<number> {
  const db = await getDb();
  const result = await withRetry(
    () =>
      db
        .request()
        .input('seasonID', sql.Int, seasonID)
        .input('week', sql.Int, week)
        .query(
          'DELETE FROM scores WHERE seasonID = @seasonID AND week = @week',
        ),
    'deleteScoresForWeek',
  );
  return result.rowsAffected[0];
}

/**
 * Insert scores for a given season and week from staged match data.
 * Calculates incomingAvg per bowler before insert using 27-game rolling average.
 * Returns count of inserted rows and any personal bests achieved.
 *
 * NEVER inserts computed columns (hcpGame1/2/3, handSeries, incomingHcp, scratchSeries).
 */
export async function insertScores(
  seasonID: number,
  week: number,
  matches: StagedMatch[],
): Promise<{ inserted: number; personalBests: PersonalBest[] }> {
  const db = await getDb();
  let inserted = 0;

  // Get prior personal bests before inserting new scores
  const priorBests = new Map<
    number,
    { highGame: number; highSeries: number; bowlerName: string }
  >();

  const allBowlerIDs = matches
    .flatMap((m) => m.bowlers)
    .filter((b) => !b.isPenalty && b.bowlerID != null)
    .map((b) => b.bowlerID!);

  if (allBowlerIDs.length > 0) {
    const idList = allBowlerIDs.join(',');
    const bestResult = await withRetry(
      () =>
        db.request().query(`
          SELECT s.bowlerID, b.bowlerName,
            MAX(CASE WHEN s.game1 >= ISNULL(s.game2, 0) AND s.game1 >= ISNULL(s.game3, 0) THEN s.game1
                     WHEN s.game2 >= ISNULL(s.game3, 0) THEN s.game2
                     ELSE s.game3 END) AS highGame,
            MAX(s.game1 + s.game2 + s.game3) AS highSeries
          FROM scores s
          JOIN bowlers b ON b.bowlerID = s.bowlerID
          WHERE s.bowlerID IN (${idList}) AND s.isPenalty = 0
            AND s.game1 IS NOT NULL AND s.game2 IS NOT NULL AND s.game3 IS NOT NULL
          GROUP BY s.bowlerID, b.bowlerName
        `),
      'priorBests',
    );
    for (const row of bestResult.recordset) {
      priorBests.set(row.bowlerID, {
        highGame: row.highGame ?? 0,
        highSeries: row.highSeries ?? 0,
        bowlerName: row.bowlerName,
      });
    }
  }

  // Insert each bowler's scores
  for (const match of matches) {
    for (const b of match.bowlers) {
      if (!b.bowlerID) continue;

      const game1 = b.isPenalty ? null : b.game1;
      const game2 = b.isPenalty ? null : b.game2;
      const game3 = b.isPenalty ? null : b.game3;
      const turkeys = b.isPenalty ? 0 : (b.turkeys ?? 0);

      await withRetry(
        () =>
          db
            .request()
            .input('bowlerID', sql.Int, b.bowlerID)
            .input('seasonID', sql.Int, seasonID)
            .input('teamID', sql.Int, b.teamID)
            .input('week', sql.Int, week)
            .input('game1', sql.Int, game1)
            .input('game2', sql.Int, game2)
            .input('game3', sql.Int, game3)
            .input('incomingAvg', sql.Decimal(5, 1), b.incomingAvg)
            .input('turkeys', sql.Int, turkeys)
            .input('isPenalty', sql.Bit, b.isPenalty ? 1 : 0)
            .query(`
              INSERT INTO scores (bowlerID, seasonID, teamID, week, game1, game2, game3, incomingAvg, turkeys, isPenalty)
              VALUES (@bowlerID, @seasonID, @teamID, @week, @game1, @game2, @game3, @incomingAvg, @turkeys, @isPenalty)
            `),
        `insertScore-${b.bowlerID}`,
      );
      inserted++;
    }
  }

  // Check for new personal bests
  const personalBests: PersonalBest[] = [];
  for (const match of matches) {
    for (const b of match.bowlers) {
      if (b.isPenalty || !b.bowlerID) continue;
      if (b.game1 == null || b.game2 == null || b.game3 == null) continue;

      const prior = priorBests.get(b.bowlerID);
      const maxGame = Math.max(b.game1, b.game2, b.game3);
      const series = b.game1 + b.game2 + b.game3;

      if (!prior || maxGame > prior.highGame) {
        personalBests.push({
          bowlerID: b.bowlerID,
          bowlerName: b.bowlerName,
          type: 'highGame',
          value: maxGame,
          previousBest: prior?.highGame ?? null,
        });
      }
      if (!prior || series > prior.highSeries) {
        personalBests.push({
          bowlerID: b.bowlerID,
          bowlerName: b.bowlerName,
          type: 'highSeries',
          value: series,
          previousBest: prior?.highSeries ?? null,
        });
      }
    }
  }

  return { inserted, personalBests };
}

/**
 * Generate match results for a given season (and optionally a single week).
 * Deletes existing match results for the scope first, then regenerates.
 * Returns count of match results inserted.
 *
 * Logic ported from scripts/populate-match-results.mjs.
 */
export async function runMatchResults(
  seasonID: number,
  week?: number,
): Promise<number> {
  const db = await getDb();

  // Delete existing match results for this season (optionally scoped to week)
  if (week != null) {
    await withRetry(
      () =>
        db
          .request()
          .input('sid', sql.Int, seasonID)
          .input('week', sql.Int, week)
          .query(`
            DELETE mr FROM matchResults mr
            JOIN schedule sch ON mr.scheduleID = sch.scheduleID
            WHERE sch.seasonID = @sid AND sch.week = @week
          `),
      'deleteMatchResults',
    );
  } else {
    await withRetry(
      () =>
        db
          .request()
          .input('sid', sql.Int, seasonID)
          .query(`
            DELETE mr FROM matchResults mr
            JOIN schedule sch ON mr.scheduleID = sch.scheduleID
            WHERE sch.seasonID = @sid
          `),
      'deleteMatchResults',
    );
  }

  // Get matchups
  const matchQuery = week != null
    ? `SELECT scheduleID, week, matchNumber, team1ID, team2ID
       FROM schedule WHERE seasonID = @sid AND team1ID IS NOT NULL AND team2ID IS NOT NULL AND week = @week
       ORDER BY week, matchNumber`
    : `SELECT scheduleID, week, matchNumber, team1ID, team2ID
       FROM schedule WHERE seasonID = @sid AND team1ID IS NOT NULL AND team2ID IS NOT NULL
       ORDER BY week, matchNumber`;

  const matchReq = db.request().input('sid', sql.Int, seasonID);
  if (week != null) matchReq.input('week', sql.Int, week);
  const matchesResult = await withRetry(
    () => matchReq.query(matchQuery),
    'getScheduleMatches',
  );

  // Get team handicap game totals per week with bowler count
  const scoreReq = db.request().input('sid', sql.Int, seasonID);
  const teamScoresResult = await withRetry(
    () =>
      scoreReq.query(`
        SELECT week, teamID,
          SUM(hcpGame1) AS g1, SUM(hcpGame2) AS g2, SUM(hcpGame3) AS g3,
          SUM(hcpGame1 + hcpGame2 + hcpGame3) AS series,
          COUNT(*) AS bowlerCount
        FROM scores WHERE seasonID = @sid
        GROUP BY week, teamID
      `),
    'getTeamScores',
  );

  const scoreMap = new Map<string, {
    g1: number; g2: number; g3: number; series: number; bowlerCount: number;
  }>();
  for (const row of teamScoresResult.recordset) {
    scoreMap.set(`${row.week}-${row.teamID}`, row);
  }

  // Detect forfeit teams
  const forfeitResult = await withRetry(
    () =>
      db
        .request()
        .input('sid', sql.Int, seasonID)
        .query(`
          SELECT week, teamID FROM scores
          WHERE seasonID = @sid AND isPenalty = 1
          GROUP BY week, teamID
          HAVING COUNT(*) = 4
            AND COUNT(*) = (SELECT COUNT(*) FROM scores s2
                            WHERE s2.seasonID = @sid AND s2.week = scores.week
                              AND s2.teamID = scores.teamID)
        `),
    'detectForfeits',
  );
  const forfeitSet = new Set<string>();
  for (const row of forfeitResult.recordset) {
    forfeitSet.add(`${row.week}-${row.teamID}`);
  }

  // Get scratch data for ghost team scoring
  const scratchResult = await withRetry(
    () =>
      db
        .request()
        .input('sid', sql.Int, seasonID)
        .query(`
          SELECT week, teamID,
            SUM(game1) AS sg1, SUM(game2) AS sg2, SUM(game3) AS sg3,
            SUM(incomingAvg) AS teamAvg
          FROM scores WHERE seasonID = @sid AND isPenalty = 0
          GROUP BY week, teamID
        `),
    'getScratchData',
  );
  const scratchMap = new Map<string, {
    sg1: number; sg2: number; sg3: number; teamAvg: number;
  }>();
  for (const row of scratchResult.recordset) {
    scratchMap.set(`${row.week}-${row.teamID}`, row);
  }

  // Build bonus point rankings per week
  const weekTeams = new Map<number, Array<{ teamID: number; series: number }>>();
  for (const row of teamScoresResult.recordset) {
    if (
      row.bowlerCount === 4 &&
      !forfeitSet.has(`${row.week}-${row.teamID}`)
    ) {
      if (!weekTeams.has(row.week)) weekTeams.set(row.week, []);
      weekTeams.get(row.week)!.push({ teamID: row.teamID, series: row.series });
    }
  }

  const bonusMap = new Map<string, number>();
  for (const [wk, teams] of weekTeams) {
    const sorted = [...teams].sort((a, b) => b.series - a.series);
    const cutoff3 = sorted.length >= 5 ? sorted[4].series : -1;
    const cutoff2 = sorted.length >= 10 ? sorted[9].series : -1;
    const cutoff1 = sorted.length >= 15 ? sorted[14].series : -1;

    for (const team of sorted) {
      let bonus: number;
      if (team.series >= cutoff3 && cutoff3 >= 0) bonus = 3;
      else if (team.series >= cutoff2 && cutoff2 >= 0) bonus = 2;
      else if (team.series >= cutoff1 && cutoff1 >= 0) bonus = 1;
      else bonus = 0;
      bonusMap.set(`${wk}-${team.teamID}`, bonus);
    }
  }

  // Insert match results
  let totalInserted = 0;
  const GHOST_THRESHOLD = 20;

  for (const match of matchesResult.recordset) {
    const t1 = scoreMap.get(`${match.week}-${match.team1ID}`);
    const t2 = scoreMap.get(`${match.week}-${match.team2ID}`);
    if (!t1 || !t2) continue;
    if (t1.bowlerCount !== 4 || t2.bowlerCount !== 4) continue;

    const t1Forfeit = forfeitSet.has(`${match.week}-${match.team1ID}`);
    const t2Forfeit = forfeitSet.has(`${match.week}-${match.team2ID}`);

    let t1GamePts = 0;
    let t2GamePts = 0;

    if (t1Forfeit || t2Forfeit) {
      const opponentKey = t1Forfeit
        ? `${match.week}-${match.team2ID}`
        : `${match.week}-${match.team1ID}`;
      const opp = scratchMap.get(opponentKey);

      if (opp) {
        for (const game of ['sg1', 'sg2', 'sg3'] as const) {
          const scratchTotal = opp[game];
          const threshold = opp.teamAvg - GHOST_THRESHOLD;
          const oppWins = scratchTotal >= threshold;
          if (t1Forfeit) {
            t2GamePts += oppWins ? 2 : 0;
          } else {
            t1GamePts += oppWins ? 2 : 0;
          }
        }
      }
    } else {
      for (const game of ['g1', 'g2', 'g3'] as const) {
        if (t1[game] > t2[game]) {
          t1GamePts += 2;
        } else if (t1[game] < t2[game]) {
          t2GamePts += 2;
        } else {
          t1GamePts += 1;
          t2GamePts += 1;
        }
      }
    }

    const t1Bonus = t1Forfeit
      ? 0
      : (bonusMap.get(`${match.week}-${match.team1ID}`) ?? 0);
    const t2Bonus = t2Forfeit
      ? 0
      : (bonusMap.get(`${match.week}-${match.team2ID}`) ?? 0);

    await withRetry(
      () =>
        db
          .request()
          .input('scheduleID', sql.Int, match.scheduleID)
          .input('t1g1', sql.Int, t1.g1)
          .input('t1g2', sql.Int, t1.g2)
          .input('t1g3', sql.Int, t1.g3)
          .input('t1s', sql.Int, t1.series)
          .input('t2g1', sql.Int, t2.g1)
          .input('t2g2', sql.Int, t2.g2)
          .input('t2g3', sql.Int, t2.g3)
          .input('t2s', sql.Int, t2.series)
          .input('t1gp', sql.Int, t1GamePts)
          .input('t2gp', sql.Int, t2GamePts)
          .input('t1bp', sql.Int, t1Bonus)
          .input('t2bp', sql.Int, t2Bonus)
          .query(`
            INSERT INTO matchResults
              (scheduleID, team1Game1, team1Game2, team1Game3, team1Series,
               team2Game1, team2Game2, team2Game3, team2Series,
               team1GamePts, team2GamePts, team1BonusPts, team2BonusPts)
            VALUES
              (@scheduleID, @t1g1, @t1g2, @t1g3, @t1s,
               @t2g1, @t2g2, @t2g3, @t2s,
               @t1gp, @t2gp, @t1bp, @t2bp)
          `),
      `insertMatchResult-${match.scheduleID}`,
    );
    totalInserted++;
  }

  return totalInserted;
}

/**
 * Run patch calculations for a given season (optionally scoped to a week).
 * Returns list of newly awarded patch descriptions.
 *
 * Logic ported from scripts/populate-patches.mjs.
 * Only runs weekly patches (perfectGame, botw, highGame, highSeries, aboveAvg, threeOfAKind).
 * Season-level patches (playoff, champion, etc.) are not affected by weekly score entry.
 */
export async function runPatches(
  seasonID?: number,
  week?: number,
): Promise<string[]> {
  const db = await getDb();

  // Load patch catalog
  const patchRows = (await db.request().query('SELECT patchID, code FROM patches')).recordset;
  const patchMap = new Map<string, number>(patchRows.map((p: { code: string; patchID: number }) => [p.code, p.patchID]));

  const awarded: string[] = [];

  // Scope filters
  const weeklyAnd = [
    seasonID != null ? `sc.seasonID = ${Number(seasonID)}` : null,
    week != null ? `sc.week = ${Number(week)}` : null,
  ]
    .filter(Boolean)
    .join(' AND ');
  const weeklyFilter = weeklyAnd ? ` AND ${weeklyAnd}` : '';

  // Wipe existing weekly patches for this scope before repopulating
  if (seasonID != null) {
    const wipeReq = db.request().input('sid', sql.Int, seasonID);
    const weeklyCodes = ['perfectGame', 'botw', 'highGame', 'highSeries', 'aboveAvg', 'threeOfAKind'];
    const weeklyPIDs = weeklyCodes.map(c => patchMap.get(c)).filter((id): id is number => id != null);
    if (weeklyPIDs.length > 0) {
      let wipeSQL = `DELETE FROM bowlerPatches WHERE patchID IN (${weeklyPIDs.join(',')}) AND seasonID = @sid`;
      if (week != null) {
        wipeReq.input('wk', sql.Int, week);
        wipeSQL += ' AND week = @wk';
      }
      await withRetry(() => wipeReq.query(wipeSQL), 'wipeWeeklyPatches');
    }
  }

  async function insertPatchBatch(
    code: string,
    query: string,
    label: string,
  ): Promise<void> {
    const pid = patchMap.get(code);
    if (!pid) return;

    const rows = (await withRetry(() => db.request().query(query), `patch-${code}`)).recordset;
    for (const row of rows) {
      try {
        await db
          .request()
          .input('bowlerID', sql.Int, row.bowlerID)
          .input('patchID', sql.Int, pid)
          .input('seasonID', sql.Int, row.seasonID ?? null)
          .input('week', sql.Int, row.week ?? null)
          .query(`
            INSERT INTO bowlerPatches (bowlerID, patchID, seasonID, week)
            SELECT @bowlerID, @patchID, @seasonID, @week
            WHERE NOT EXISTS (
              SELECT 1 FROM bowlerPatches
              WHERE bowlerID = @bowlerID AND patchID = @patchID
                AND ISNULL(seasonID, 0) = ISNULL(@seasonID, 0)
                AND ISNULL(week, 0) = ISNULL(@week, 0)
            )
          `);
        // Get bowler name for the award summary
        const nameResult = await db
          .request()
          .input('bid', sql.Int, row.bowlerID)
          .query('SELECT bowlerName FROM bowlers WHERE bowlerID = @bid');
        const name = nameResult.recordset[0]?.bowlerName ?? `Bowler #${row.bowlerID}`;
        awarded.push(`${label}: ${name} (S${row.seasonID} W${row.week ?? '-'})`);
      } catch (err: unknown) {
        const sqlErr = err as { number?: number };
        if (sqlErr.number === 2627) continue; // duplicate key
        throw err;
      }
    }
  }

  // Perfect Game
  await insertPatchBatch(
    'perfectGame',
    `SELECT sc.bowlerID, sc.seasonID, sc.week FROM scores sc
     WHERE sc.isPenalty = 0 AND (sc.game1 = 300 OR sc.game2 = 300 OR sc.game3 = 300)${weeklyFilter}`,
    'Perfect Game',
  );

  // Bowler of the Week
  await insertPatchBatch(
    'botw',
    `SELECT x.bowlerID, x.seasonID, x.week FROM (
      SELECT sc.seasonID, sc.week, sc.bowlerID,
        ROW_NUMBER() OVER (PARTITION BY sc.seasonID, sc.week ORDER BY sc.handSeries DESC) AS rn
      FROM scores sc
      WHERE sc.isPenalty = 0 AND sc.incomingAvg IS NOT NULL AND sc.incomingAvg > 0${weeklyFilter}
    ) x WHERE x.rn = 1`,
    'Bowler of the Week',
  );

  // Weekly High Game
  await insertPatchBatch(
    'highGame',
    `SELECT x.bowlerID, x.seasonID, x.week FROM (
      SELECT sc.seasonID, sc.week, sc.bowlerID,
        ROW_NUMBER() OVER (PARTITION BY sc.seasonID, sc.week ORDER BY
          CASE WHEN sc.game1 >= ISNULL(sc.game2,0) AND sc.game1 >= ISNULL(sc.game3,0) THEN sc.game1
               WHEN sc.game2 >= ISNULL(sc.game3,0) THEN sc.game2
               ELSE sc.game3 END DESC) AS rn
      FROM scores sc
      WHERE sc.isPenalty = 0${weeklyFilter}
    ) x WHERE x.rn = 1`,
    'Weekly High Game',
  );

  // Weekly High Series
  await insertPatchBatch(
    'highSeries',
    `SELECT x.bowlerID, x.seasonID, x.week FROM (
      SELECT sc.seasonID, sc.week, sc.bowlerID,
        ROW_NUMBER() OVER (PARTITION BY sc.seasonID, sc.week ORDER BY sc.scratchSeries DESC) AS rn
      FROM scores sc
      WHERE sc.isPenalty = 0${weeklyFilter}
    ) x WHERE x.rn = 1`,
    'Weekly High Series',
  );

  // Above Average All 3 Games
  await insertPatchBatch(
    'aboveAvg',
    `SELECT sc.bowlerID, sc.seasonID, sc.week FROM scores sc
     WHERE sc.isPenalty = 0 AND sc.incomingAvg IS NOT NULL AND sc.incomingAvg > 0
       AND sc.game1 > sc.incomingAvg AND sc.game2 > sc.incomingAvg AND sc.game3 > sc.incomingAvg${weeklyFilter}`,
    'Above Average',
  );

  // Three of a Kind
  await insertPatchBatch(
    'threeOfAKind',
    `SELECT sc.bowlerID, sc.seasonID, sc.week FROM scores sc
     WHERE sc.isPenalty = 0 AND sc.game1 = sc.game2 AND sc.game2 = sc.game3
       AND sc.game1 IS NOT NULL AND sc.game1 > 0${weeklyFilter}`,
    'Three of a Kind',
  );

  return awarded;
}

/**
 * Bump .data-versions.json and clear local cache files for a season.
 * This ensures the next build will re-query affected data.
 */
export async function bumpCacheAndPublish(
  seasonID: number,
  _week: number,
): Promise<void> {
  const projectRoot = process.cwd();
  const versionsPath = path.join(projectRoot, '.data-versions.json');

  // Bump scores channel version
  let versions: Record<string, Record<string, number>> = {};
  try {
    versions = JSON.parse(fs.readFileSync(versionsPath, 'utf-8'));
  } catch {
    // File doesn't exist yet
  }

  if (!versions.scores) versions.scores = {};
  const key = String(seasonID);
  versions.scores[key] = (versions.scores[key] || 1) + 1;

  // Also bump schedule channel (match results changed)
  if (!versions.schedule) versions.schedule = {};
  versions.schedule[key] = (versions.schedule[key] || 1) + 1;

  try {
    fs.writeFileSync(versionsPath, JSON.stringify(versions, null, 2) + '\n');
  } catch {
    // Read-only filesystem on Vercel -- skip, cache busts on next deploy
  }

  // Clear local cache files for this season
  const cacheDir = path.join(projectRoot, '.next', 'cache', 'sql', 'v1');
  try {
    const files = fs.readdirSync(cacheDir);
    for (const f of files) {
      if (f.includes(`-${seasonID}_`) || f.includes(`-${seasonID}-`)) {
        fs.unlinkSync(path.join(cacheDir, f));
      }
    }
  } catch {
    // Cache dir may not exist or read-only on Vercel
  }
}

/**
 * Detect and record career milestones achieved in a specific week.
 * Mirrors scripts/record-milestones.mjs logic.
 */
export async function recordMilestones(
  seasonID: number,
  week: number,
): Promise<number> {
  const db = await getDb();

  const STAT_KEY_MAP: Record<MilestoneCategory, string> = {
    totalGames: 'totalGamesBowled',
    totalPins: 'totalPins',
    games200Plus: 'games200Plus',
    series600Plus: 'series600Plus',
    totalTurkeys: 'totalTurkeys',
  };

  const CONTRIB_KEY_MAP: Record<MilestoneCategory, string> = {
    totalGames: 'gamesAdded',
    totalPins: 'pinsAdded',
    games200Plus: 'g200Added',
    series600Plus: 's600Added',
    totalTurkeys: 'turkeysAdded',
  };

  // Cumulative stats through this week
  const statsRes = await db.request()
    .input('seasonID', sql.Int, seasonID)
    .input('week', sql.Int, week)
    .query(`
      SELECT sc.bowlerID, b.bowlerName,
        COUNT(*) * 3 AS totalGamesBowled,
        SUM(sc.scratchSeries) AS totalPins,
        SUM(CASE WHEN sc.game1 >= 200 THEN 1 ELSE 0 END
          + CASE WHEN sc.game2 >= 200 THEN 1 ELSE 0 END
          + CASE WHEN sc.game3 >= 200 THEN 1 ELSE 0 END) AS games200Plus,
        SUM(CASE WHEN sc.scratchSeries >= 600 THEN 1 ELSE 0 END) AS series600Plus,
        SUM(ISNULL(sc.turkeys, 0)) AS totalTurkeys
      FROM scores sc
      JOIN bowlers b ON sc.bowlerID = b.bowlerID
      WHERE sc.isPenalty = 0
        AND (sc.seasonID < @seasonID OR (sc.seasonID = @seasonID AND sc.week <= @week))
      GROUP BY sc.bowlerID, b.bowlerName
    `);

  // This week's contributions
  const contribRes = await db.request()
    .input('seasonID', sql.Int, seasonID)
    .input('week', sql.Int, week)
    .query(`
      SELECT sc.bowlerID,
        3 AS gamesAdded,
        sc.scratchSeries AS pinsAdded,
        (CASE WHEN sc.game1 >= 200 THEN 1 ELSE 0 END
         + CASE WHEN sc.game2 >= 200 THEN 1 ELSE 0 END
         + CASE WHEN sc.game3 >= 200 THEN 1 ELSE 0 END) AS g200Added,
        CASE WHEN sc.scratchSeries >= 600 THEN 1 ELSE 0 END AS s600Added,
        ISNULL(sc.turkeys, 0) AS turkeysAdded
      FROM scores sc
      WHERE sc.seasonID = @seasonID AND sc.week = @week AND sc.isPenalty = 0
    `);

  const contribMap = new Map(contribRes.recordset.map((c: Record<string, unknown>) => [c.bowlerID, c]));

  // Existing milestones to avoid duplicates
  const existingRes = await db.request()
    .query('SELECT bowlerID, category, threshold FROM bowlerMilestones');
  const existingSet = new Set(
    existingRes.recordset.map((r: Record<string, unknown>) => `${r.bowlerID}-${r.category}-${r.threshold}`)
  );

  // Delete any milestones already recorded for this specific week (re-confirm safe)
  await db.request()
    .input('seasonID', sql.Int, seasonID)
    .input('week', sql.Int, week)
    .query('DELETE FROM bowlerMilestones WHERE seasonID = @seasonID AND week = @week');

  let inserted = 0;

  for (const bowler of statsRes.recordset) {
    const contrib = contribMap.get(bowler.bowlerID) as Record<string, number> | undefined;

    for (const [category, config] of Object.entries(MILESTONE_THRESHOLDS) as [MilestoneCategory, (typeof MILESTONE_THRESHOLDS)[MilestoneCategory]][]) {
      const current = bowler[STAT_KEY_MAP[category]] as number;
      const weekAdded = contrib ? (contrib[CONTRIB_KEY_MAP[category]] as number) : 0;
      const prior = current - weekAdded;

      for (const threshold of config.thresholds) {
        if (current >= threshold && prior < threshold) {
          const key = `${bowler.bowlerID}-${category}-${threshold}`;
          if (!existingSet.has(key)) {
            await db.request()
              .input('bowlerID', sql.Int, bowler.bowlerID)
              .input('category', sql.VarChar(30), category)
              .input('threshold', sql.Int, threshold)
              .input('seasonID', sql.Int, seasonID)
              .input('week', sql.Int, week)
              .query(`
                INSERT INTO bowlerMilestones (bowlerID, category, threshold, seasonID, week)
                VALUES (@bowlerID, @category, @threshold, @seasonID, @week)
              `);
            inserted++;
          }
        }
      }
    }
  }

  return inserted;
}
