import sql from 'mssql';
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

function bumpDataVersion(channel, seasonID) {
  const filePath = resolve(PROJECT_ROOT, '.data-versions.json');
  let versions = {};
  try { versions = JSON.parse(readFileSync(filePath, 'utf8')); } catch {}
  if (!versions[channel]) versions[channel] = {};
  const key = String(seasonID);
  versions[channel][key] = (versions[channel][key] || 1) + 1;
  writeFileSync(filePath, JSON.stringify(versions, null, 2) + '\n');
  console.log(`\nBumped .data-versions.json: ${channel}.${seasonID} → v${versions[channel][key]}`);
}

function clearLocalCache(seasonID) {
  const cacheDir = resolve(PROJECT_ROOT, '.next', 'cache', 'sql', 'v1');
  let deleted = 0;
  try {
    for (const f of readdirSync(cacheDir)) {
      if (f.includes(`-${seasonID}_`) || f.includes(`-${seasonID}-`)) {
        unlinkSync(resolve(cacheDir, f));
        deleted++;
      }
    }
  } catch { /* cache dir may not exist */ }
  if (deleted > 0) console.log(`Cleared ${deleted} local cache files for season ${seasonID}`);
}

const envContent = readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const dbConfig = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 120000,
    requestTimeout: 30000,
  },
};

async function main() {
  const pool = await new sql.ConnectionPool(dbConfig).connect();
  const dryRun = process.argv.includes('--dry-run');
  const wipe = process.argv.includes('--wipe');
  const seasonFilter = process.argv.find(a => a.startsWith('--season='));
  const targetSeasonID = seasonFilter ? parseInt(seasonFilter.split('=')[1]) : null;

  console.log(dryRun ? '=== DRY RUN ===' : '=== POPULATING matchResults ===');

  // Wipe existing data if requested
  if (wipe) {
    if (targetSeasonID) {
      const del = await pool.request()
        .input('sid', sql.Int, targetSeasonID)
        .query(`DELETE mr FROM matchResults mr JOIN schedule sch ON mr.scheduleID = sch.scheduleID WHERE sch.seasonID = @sid`);
      console.log(`Wiped ${del.rowsAffected[0]} existing matchResults for season ${targetSeasonID}`);
    } else {
      const del = await pool.request().query('DELETE FROM matchResults');
      console.log(`Wiped ${del.rowsAffected[0]} existing matchResults`);
    }
  }

  // Get seasons with schedule data (any team count — handles 18 and 20 team seasons)
  const seasons = await pool.request().query(`
    SELECT s.seasonID, sea.displayName, sea.teamCount
    FROM schedule s
    JOIN seasons sea ON s.seasonID = sea.seasonID
    WHERE s.team1ID IS NOT NULL
    ${targetSeasonID ? `AND s.seasonID = ${targetSeasonID}` : ''}
    GROUP BY s.seasonID, sea.displayName, sea.teamCount
    ORDER BY s.seasonID
  `);
  console.log(`Seasons with schedule data: ${seasons.recordset.map(s => `${s.displayName} (${s.teamCount}T)`).join(', ')}\n`);

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const season of seasons.recordset) {
    const sid = season.seasonID;
    console.log(`\n--- ${season.displayName} (ID: ${sid}, ${season.teamCount} teams) ---`);

    // Get existing matchResults for this season (to skip already-populated matches)
    const existing = await pool.request()
      .input('sid', sql.Int, sid)
      .query(`
        SELECT mr.scheduleID FROM matchResults mr
        JOIN schedule sch ON mr.scheduleID = sch.scheduleID
        WHERE sch.seasonID = @sid
      `);
    const existingSet = new Set(existing.recordset.map(r => r.scheduleID));
    if (existingSet.size > 0) {
      console.log(`  Has ${existingSet.size} existing match results — will add missing ones`);
    }

    // Get all matchups for this season
    const matches = await pool.request()
      .input('sid', sql.Int, sid)
      .query(`
        SELECT scheduleID, week, matchNumber, team1ID, team2ID
        FROM schedule
        WHERE seasonID = @sid AND team1ID IS NOT NULL AND team2ID IS NOT NULL
        ORDER BY week, matchNumber
      `);

    // Get team handicap game totals per week WITH bowler count
    const teamScores = await pool.request()
      .input('sid', sql.Int, sid)
      .query(`
        SELECT
          week, teamID,
          SUM(hcpGame1) AS g1,
          SUM(hcpGame2) AS g2,
          SUM(hcpGame3) AS g3,
          SUM(hcpGame1 + hcpGame2 + hcpGame3) AS series,
          COUNT(*) AS bowlerCount
        FROM scores
        WHERE seasonID = @sid
        GROUP BY week, teamID
      `);

    // Index by week+teamID
    const scoreMap = new Map();
    for (const row of teamScores.recordset) {
      scoreMap.set(`${row.week}-${row.teamID}`, row);
    }

    // Get all team series for bonus point calculation (ranked per week)
    const weekTeams = new Map();
    for (const row of teamScores.recordset) {
      if (row.bowlerCount === 4) {
        if (!weekTeams.has(row.week)) weekTeams.set(row.week, []);
        weekTeams.get(row.week).push({ teamID: row.teamID, series: row.series });
      }
    }

    // Calculate bonus points (XP): rank all teams by hcp series each week
    // Standard rule: top 5 = 3pts, 6-10 = 2pts, 11-15 = 1pt, 16+ = 0pts
    // Ties at cutoffs: both teams get the higher bucket
    const bonusMap = new Map();
    for (const [week, teams] of weekTeams) {
      const sorted = [...teams].sort((a, b) => b.series - a.series);

      // Determine cutoff series values (use the 5th, 10th, 15th team's series)
      const cutoff3 = sorted.length >= 5 ? sorted[4].series : -1;   // top 5 threshold
      const cutoff2 = sorted.length >= 10 ? sorted[9].series : -1;  // top 10 threshold
      const cutoff1 = sorted.length >= 15 ? sorted[14].series : -1; // top 15 threshold

      for (const team of sorted) {
        let bonus;
        if (team.series >= cutoff3 && cutoff3 >= 0) bonus = 3;
        else if (team.series >= cutoff2 && cutoff2 >= 0) bonus = 2;
        else if (team.series >= cutoff1 && cutoff1 >= 0) bonus = 1;
        else bonus = 0;
        bonusMap.set(`${week}-${team.teamID}`, bonus);
      }
    }

    let seasonInserted = 0;
    let seasonSkipped = 0;

    for (const match of matches.recordset) {
      // Skip if already populated
      if (existingSet.has(match.scheduleID)) {
        totalSkipped++;
        continue;
      }

      const t1 = scoreMap.get(`${match.week}-${match.team1ID}`);
      const t2 = scoreMap.get(`${match.week}-${match.team2ID}`);

      if (!t1 || !t2) {
        // No score data for this week yet (future matches)
        continue;
      }

      // Skip matches where either team doesn't have exactly 4 bowlers
      if (t1.bowlerCount !== 4 || t2.bowlerCount !== 4) {
        seasonSkipped++;
        continue;
      }

      // Game points: compare each game, winner gets 2, tie = 1 each, loser = 0
      let t1GamePts = 0, t2GamePts = 0;
      for (const game of ['g1', 'g2', 'g3']) {
        if (t1[game] > t2[game]) { t1GamePts += 2; }
        else if (t1[game] < t2[game]) { t2GamePts += 2; }
        else { t1GamePts += 1; t2GamePts += 1; }
      }

      const t1Bonus = bonusMap.get(`${match.week}-${match.team1ID}`) ?? 0;
      const t2Bonus = bonusMap.get(`${match.week}-${match.team2ID}`) ?? 0;

      if (!dryRun) {
        await pool.request()
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
          `);
      }

      // Derive W for display (game wins: 0-3, can be 1.5 on a 3-3 tie)
      const t1Wins = t1GamePts / 2;
      const t2Wins = t2GamePts / 2;
      const t1Pts = t1GamePts + t1Bonus;
      const t2Pts = t2GamePts + t2Bonus;

      console.log(
        `  Wk${String(match.week).padStart(2)} M${String(match.matchNumber).padStart(2)}: ` +
        `T1[${t1.g1},${t1.g2},${t1.g3}=${t1.series}] vs T2[${t2.g1},${t2.g2},${t2.g3}=${t2.series}] → ` +
        `W:${t1Wins}/${t2Wins} XP:${t1Bonus}/${t2Bonus} Pts:${t1Pts}/${t2Pts}`
      );
      seasonInserted++;
    }

    console.log(`  ${seasonInserted} inserted, ${seasonSkipped} skipped (incomplete bowler data)`);
    if (!dryRun && seasonInserted > 0) {
      bumpDataVersion('schedule', sid);
      clearLocalCache(sid);
    }
    totalInserted += seasonInserted;
  }

  console.log(`\n=== TOTAL: ${totalInserted} matches ${dryRun ? 'would be' : ''} inserted, ${totalSkipped} skipped ===`);
  await pool.close();
}

main().catch(err => { console.error(err); process.exit(1); });
