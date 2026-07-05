// Verify the optimized all-time-roster SQL returns identical per-bowler data to
// the old correlated-subquery version, and compare timing. Correctness is keyed
// by bowlerID (order-independent; the ORDER BY tie-break may differ between plans,
// which is benign). Only apply the rewrite if data matches for every team.
import sql from 'mssql';
import { readFileSync } from 'fs';

const ROOT = process.cwd();
const env = readFileSync(ROOT + '/.env.local', 'utf8');
for (const line of env.split('\n')) { const m = line.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim(); }
const pool = await new sql.ConnectionPool({
  server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, requestTimeout: 120000 },
}).connect();

const OLD = `
  SELECT
    b.bowlerID, b.bowlerName, b.slug,
    COUNT(sc.scoreID) * 3 AS totalGames,
    SUM(sc.scratchSeries) AS totalPins,
    CAST(SUM(sc.scratchSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS average,
    COUNT(DISTINCT sc.seasonID) AS seasonsWithTeam,
    (SELECT TOP 1 sn.displayName FROM scores sc2 JOIN seasons sn ON sc2.seasonID = sn.seasonID
     WHERE sc2.bowlerID = b.bowlerID AND sc2.teamID = @teamID AND sc2.isPenalty = 0
     ORDER BY sn.year ASC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END ASC) AS firstSeason,
    (SELECT TOP 1 sn.displayName FROM scores sc2 JOIN seasons sn ON sc2.seasonID = sn.seasonID
     WHERE sc2.bowlerID = b.bowlerID AND sc2.teamID = @teamID AND sc2.isPenalty = 0
     ORDER BY sn.year DESC, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END DESC) AS lastSeason
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.teamID = @teamID AND sc.isPenalty = 0
  GROUP BY b.bowlerID, b.bowlerName, b.slug
  ORDER BY totalGames DESC, average DESC
`;

const NEW = `
  WITH teamScores AS (
    SELECT sc.bowlerID, sc.scoreID, sc.scratchSeries, sc.seasonID,
           sn.displayName, sn.year, CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END AS pOrd
    FROM scores sc
    JOIN seasons sn ON sc.seasonID = sn.seasonID
    WHERE sc.teamID = @teamID AND sc.isPenalty = 0
  ),
  firstLast AS (
    SELECT bowlerID,
      MAX(CASE WHEN rnFirst = 1 THEN displayName END) AS firstSeason,
      MAX(CASE WHEN rnLast  = 1 THEN displayName END) AS lastSeason
    FROM (
      SELECT bowlerID, displayName,
        ROW_NUMBER() OVER (PARTITION BY bowlerID ORDER BY year ASC,  pOrd ASC)  AS rnFirst,
        ROW_NUMBER() OVER (PARTITION BY bowlerID ORDER BY year DESC, pOrd DESC) AS rnLast
      FROM teamScores
    ) x
    GROUP BY bowlerID
  )
  SELECT
    b.bowlerID, b.bowlerName, b.slug,
    COUNT(ts.scoreID) * 3 AS totalGames,
    SUM(ts.scratchSeries) AS totalPins,
    CAST(SUM(ts.scratchSeries) * 1.0 / NULLIF(COUNT(ts.scoreID) * 3, 0) AS DECIMAL(5,1)) AS average,
    COUNT(DISTINCT ts.seasonID) AS seasonsWithTeam,
    fl.firstSeason, fl.lastSeason
  FROM teamScores ts
  JOIN bowlers b ON b.bowlerID = ts.bowlerID
  JOIN firstLast fl ON fl.bowlerID = ts.bowlerID
  GROUP BY b.bowlerID, b.bowlerName, b.slug, fl.firstSeason, fl.lastSeason
  ORDER BY totalGames DESC, average DESC
`;

// Sample a spread of teams incl. the heaviest by all-time bowler count.
const teams = (await pool.request().query(
  `SELECT sc.teamID, t.teamName, COUNT(DISTINCT sc.bowlerID) n
   FROM scores sc JOIN teams t ON t.teamID=sc.teamID
   WHERE sc.isPenalty=0 GROUP BY sc.teamID, t.teamName
   ORDER BY COUNT(DISTINCT sc.bowlerID) DESC`
)).recordset.filter((_, i) => i < 5 || i % 7 === 0).slice(0, 8);

const key = r => `${r.bowlerID}|${r.totalGames}|${r.totalPins}|${r.average}|${r.seasonsWithTeam}|${r.firstSeason}|${r.lastSeason}`;
let allMatch = true;

for (const t of teams) {
  const tOld = Date.now(); const oldRows = (await pool.request().input('teamID', t.teamID).query(OLD)).recordset; const oldMs = Date.now() - tOld;
  const tNew = Date.now(); const newRows = (await pool.request().input('teamID', t.teamID).query(NEW)).recordset; const newMs = Date.now() - tNew;
  const oldSet = new Set(oldRows.map(key));
  const newSet = new Set(newRows.map(key));
  const sameCount = oldRows.length === newRows.length;
  const sameData = oldSet.size === newSet.size && [...oldSet].every(k => newSet.has(k));
  const ok = sameCount && sameData;
  if (!ok) allMatch = false;
  console.log(`${ok ? 'MATCH' : 'MISMATCH'}  ${t.teamName} (id ${t.teamID})  rows old=${oldRows.length} new=${newRows.length}  time old=${oldMs}ms new=${newMs}ms  (${(oldMs/Math.max(newMs,1)).toFixed(1)}x faster)`);
  if (!ok) {
    for (const k of oldSet) if (!newSet.has(k)) console.log(`   only in OLD: ${k}`);
    for (const k of newSet) if (!oldSet.has(k)) console.log(`   only in NEW: ${k}`);
  }
}
console.log(allMatch ? '\nALL TEAMS MATCH - safe to apply the rewrite.' : '\nMISMATCH FOUND - do NOT apply.');
await pool.close();
