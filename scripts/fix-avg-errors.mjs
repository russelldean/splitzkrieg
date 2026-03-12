#!/usr/bin/env node
/**
 * Fix confirmed incomingAvg errors found by audit.
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

const fixes = [
  { name: 'Alison Trott',   season: 'XXIII', week: 9, oldAvg: 63,  newAvg: 118 },
  { name: 'Fikri Yucel',    season: 'XV',    week: 4, oldAvg: 139, newAvg: 122 },
  { name: 'Fikri Yucel',    season: 'XVI',   week: 3, oldAvg: 100, newAvg: 114 },
  { name: 'Emma Allott',    season: 'XV',    week: 8, oldAvg: 83,  newAvg: 97  },
  { name: 'Mike Morrone',   season: 'XXVI',  week: 1, oldAvg: 121, newAvg: 141 },
];

const pool = await sql.connect(config);

for (const fix of fixes) {
  // Look up bowlerID and seasonID
  const lookup = await pool.request()
    .input('name', sql.VarChar, fix.name)
    .input('roman', sql.VarChar, fix.season)
    .query(`
      SELECT b.bowlerID, se.seasonID
      FROM bowlers b, seasons se
      WHERE b.bowlerName = @name AND se.romanNumeral = @roman
    `);

  if (lookup.recordset.length !== 1) {
    console.log(`SKIP: Could not find unique match for ${fix.name} S${fix.season}`);
    continue;
  }

  const { bowlerID, seasonID } = lookup.recordset[0];

  // Verify current value matches expected
  const check = await pool.request()
    .input('bowlerID', sql.Int, bowlerID)
    .input('seasonID', sql.Int, seasonID)
    .input('week', sql.Int, fix.week)
    .query(`
      SELECT CAST(incomingAvg AS INT) AS incomingAvg
      FROM scores
      WHERE bowlerID = @bowlerID AND seasonID = @seasonID AND week = @week AND isPenalty = 0
    `);

  if (check.recordset.length !== 1) {
    console.log(`SKIP: No score row for ${fix.name} S${fix.season} W${fix.week}`);
    continue;
  }

  const current = check.recordset[0].incomingAvg;
  if (current !== fix.oldAvg) {
    console.log(`SKIP: ${fix.name} S${fix.season} W${fix.week} -- expected ${fix.oldAvg} but found ${current}`);
    continue;
  }

  // Apply fix
  const result = await pool.request()
    .input('bowlerID', sql.Int, bowlerID)
    .input('seasonID', sql.Int, seasonID)
    .input('week', sql.Int, fix.week)
    .input('newAvg', sql.Decimal, fix.newAvg)
    .query(`
      UPDATE scores
      SET incomingAvg = @newAvg
      WHERE bowlerID = @bowlerID AND seasonID = @seasonID AND week = @week AND isPenalty = 0
    `);

  console.log(`FIXED: ${fix.name} S${fix.season} W${fix.week} -- ${fix.oldAvg} -> ${fix.newAvg} (${result.rowsAffected[0]} row)`);
}

await pool.close();
console.log('\nDone.');
