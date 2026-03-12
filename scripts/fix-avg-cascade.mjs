#!/usr/bin/env node
/**
 * Fix cascading incomingAvg errors for specific bowlers.
 * Recomputes 27-game rolling avg from scores and corrects any row
 * where stored avg differs by 3+ from computed, starting from game 9+.
 */
import fs from 'fs';
import sql from 'mssql';

const envContent = fs.readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 120000 },
};

const pool = await sql.connect(config);

const bowlerNames = [
  'Alison Trott',
  'Fikri Yucel',
  'Emma Allott',
  'Mike Morrone',
  'Mike DePasquale',
];

let totalFixed = 0;

for (const name of bowlerNames) {
  const result = await pool.request()
    .input('name', sql.VarChar, name)
    .query(`
      SELECT s.scoreID, se.romanNumeral, s.seasonID, s.week,
             s.game1, s.game2, s.game3,
             CAST(s.incomingAvg AS INT) AS incomingAvg,
             s.isPenalty
      FROM scores s
      JOIN bowlers b ON b.bowlerID = s.bowlerID
      JOIN seasons se ON se.seasonID = s.seasonID
      WHERE b.bowlerName = @name
      ORDER BY s.seasonID, s.week
    `);

  const rows = result.recordset;
  const realGames = [];
  const fixes = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    // Compute expected rolling avg from prior non-penalty games
    let computedAvg = null;
    if (realGames.length > 0) {
      const allScores = [];
      for (const g of realGames) {
        allScores.push(g.game1, g.game2, g.game3);
      }
      const last27 = allScores.slice(-27);
      computedAvg = Math.floor(last27.reduce((a, b) => a + b, 0) / last27.length);
    }

    const gameNum = realGames.length + 1; // 1-based, this is the Nth game-week
    const stored = r.incomingAvg;
    const diff = (computedAvg !== null && stored !== null) ? stored - computedAvg : null;

    if (diff !== null && Math.abs(diff) >= 3 && gameNum >= 9 && !r.isPenalty) {
      fixes.push({
        scoreID: r.scoreID,
        season: r.romanNumeral,
        week: r.week,
        stored,
        computed: computedAvg,
        diff,
        gameNum,
      });
    }

    if (!r.isPenalty) {
      realGames.push({ game1: r.game1, game2: r.game2, game3: r.game3 });
    }
  }

  if (fixes.length === 0) {
    console.log(`${name}: no cascade errors to fix`);
    continue;
  }

  console.log(`\n${name}: fixing ${fixes.length} rows`);
  for (const fix of fixes) {
    await pool.request()
      .input('scoreID', sql.Int, fix.scoreID)
      .input('newAvg', sql.Decimal, fix.computed)
      .query('UPDATE scores SET incomingAvg = @newAvg WHERE scoreID = @scoreID');

    console.log(`  S${fix.season} W${fix.week} game#${fix.gameNum}: ${fix.stored} -> ${fix.computed} (was off by ${fix.diff > 0 ? '+' : ''}${fix.diff})`);
    totalFixed++;
  }
}

console.log(`\nTotal rows fixed: ${totalFixed}`);
await pool.close();
