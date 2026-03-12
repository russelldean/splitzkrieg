#!/usr/bin/env node
/**
 * For suspect bowlers, recompute 27-game rolling avg from actual scores
 * and compare to stored incomingAvg to find discrepancies.
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

const suspects = [
  'Alison Trott',
  'Fikri Yucel',
  'Emma Allott',
  'Mike Morrone',
  'Mike DePasquale',
];

for (const name of suspects) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`=== ${name} ===`);
  console.log('='.repeat(80));

  const result = await pool.request()
    .input('name', sql.VarChar, name)
    .query(`
      SELECT se.romanNumeral, se.period, se.year, s.seasonID,
             s.week, s.game1, s.game2, s.game3, s.scratchSeries,
             CAST(s.incomingAvg AS INT) AS incomingAvg,
             s.isPenalty
      FROM scores s
      JOIN bowlers b ON b.bowlerID = s.bowlerID
      JOIN seasons se ON se.seasonID = s.seasonID
      WHERE b.bowlerName = @name
      ORDER BY s.seasonID, s.week
    `);

  const rows = result.recordset;

  // Recompute rolling avg (27-game, non-penalty only)
  // incomingAvg for week N = floor(avg of last 27 games BEFORE this week)
  const realGames = []; // { game1, game2, game3 } for non-penalty weeks in order

  console.log('');
  console.log(
    'Season'.padEnd(8),
    'Wk'.padStart(2),
    'Pen'.padEnd(3),
    'G1'.padStart(4),
    'G2'.padStart(4),
    'G3'.padStart(4),
    'Ser'.padStart(5),
    'StoredAvg'.padStart(10),
    'Computed'.padStart(10),
    'Diff'.padStart(6),
    'Note'
  );
  console.log('-'.repeat(100));

  for (const r of rows) {
    // Compute what incomingAvg SHOULD be based on prior games
    let computedAvg = null;
    if (realGames.length > 0) {
      // Take last 27 games (each week = 3 games, so last 9 weeks = 27 games)
      // But rolling avg is per-game, not per-week
      const allScores = [];
      for (const g of realGames) {
        allScores.push(g.game1, g.game2, g.game3);
      }
      const last27 = allScores.slice(-27);
      const sum = last27.reduce((a, b) => a + b, 0);
      computedAvg = Math.floor(sum / last27.length);
    }

    const storedAvg = r.incomingAvg;
    const diff = (computedAvg !== null && storedAvg !== null) ? storedAvg - computedAvg : null;
    const flag = (diff !== null && Math.abs(diff) > 2) ? ' *** ERROR' : '';

    const pen = r.isPenalty ? 'PEN' : '   ';

    console.log(
      `S${r.romanNumeral}`.padEnd(8),
      String(r.week).padStart(2),
      pen.padEnd(3),
      String(r.game1).padStart(4),
      String(r.game2).padStart(4),
      String(r.game3).padStart(4),
      String(r.scratchSeries).padStart(5),
      storedAvg !== null ? String(storedAvg).padStart(10) : '       ---',
      computedAvg !== null ? String(computedAvg).padStart(10) : '       ---',
      diff !== null ? String(diff).padStart(6) : '   ---',
      flag
    );

    // Only add non-penalty games to rolling window
    if (!r.isPenalty) {
      realGames.push({ game1: r.game1, game2: r.game2, game3: r.game3 });
    }
  }
}

await pool.close();
