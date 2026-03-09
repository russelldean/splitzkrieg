import sql from 'mssql';
import { readFileSync } from 'fs';

const env = readFileSync('/Users/russdean/Projects/splitzkrieg/.env.local', 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const pool = await sql.connect({
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
});

// UI method: DECIMAL(5,1) — same as getSeasonLeaderboard
const uiMens = (await pool.query(`
  SELECT b.bowlerID, b.bowlerName,
    CAST(SUM(sc.game1 + sc.game2 + sc.game3) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS scratchAvg
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = 29 AND sc.isPenalty = 0 AND b.gender = 'M'
  GROUP BY b.bowlerID, b.bowlerName
  HAVING COUNT(sc.scoreID) * 3 >= 18
  ORDER BY scratchAvg DESC
`)).recordset;

// Patch method: FLOAT
const patchMens = (await pool.query(`
  SELECT sc3.bowlerID, b3.bowlerName,
    CAST(SUM(sc3.game1 + sc3.game2 + sc3.game3) AS FLOAT) / (COUNT(*) * 3) AS scratchAvg
  FROM scores sc3
  JOIN bowlers b3 ON b3.bowlerID = sc3.bowlerID
  WHERE sc3.isPenalty = 0 AND b3.gender = 'M' AND sc3.seasonID = 29
  GROUP BY sc3.seasonID, sc3.bowlerID, b3.bowlerName, b3.gender
  HAVING COUNT(*) * 3 >= 18
  ORDER BY scratchAvg DESC
`)).recordset;

console.log('UI top 10 mens scratch (DECIMAL 5,1):');
uiMens.slice(0, 10).forEach((r, i) => console.log(`  #${i+1} ${r.bowlerName.padEnd(22)} ${r.scratchAvg}`));

console.log('\nPatch top 10 mens scratch (FLOAT):');
patchMens.slice(0, 10).forEach((r, i) => console.log(`  #${i+1} ${r.bowlerName.padEnd(22)} ${r.scratchAvg.toFixed(4)}`));

const uiTop8 = new Set(uiMens.slice(0, 8).map(r => r.bowlerID));
const patchTop8 = new Set(patchMens.slice(0, 8).map(r => r.bowlerID));
const onlyInUI = [...uiTop8].filter(id => !patchTop8.has(id));
const onlyInPatch = [...patchTop8].filter(id => !uiTop8.has(id));

if (onlyInUI.length || onlyInPatch.length) {
  console.log('\nDIFFERENCE in mens top 8!');
  const getName = id => uiMens.find(r => r.bowlerID === id)?.bowlerName || patchMens.find(r => r.bowlerID === id)?.bowlerName;
  onlyInUI.forEach(id => console.log(`  UI only: ${getName(id)} (${id})`));
  onlyInPatch.forEach(id => console.log(`  Patch only: ${getName(id)} (${id})`));
} else {
  console.log('\nMens top 8 match.');
}

// Now check the hcp rankings with each method's exclusion list
console.log('\n--- HCP playoff check ---');

// UI method: exclude UI top 8 mens + top 8 womens, then rank by hcpAvg from fullStats
const uiWomens = (await pool.query(`
  SELECT b.bowlerID, b.bowlerName,
    CAST(SUM(sc.game1 + sc.game2 + sc.game3) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS scratchAvg
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = 29 AND sc.isPenalty = 0 AND b.gender = 'F'
  GROUP BY b.bowlerID, b.bowlerName
  HAVING COUNT(sc.scoreID) * 3 >= 18
  ORDER BY scratchAvg DESC
`)).recordset;

const uiExcluded = new Set([
  ...uiMens.slice(0, 8).map(r => r.bowlerID),
  ...uiWomens.slice(0, 8).map(r => r.bowlerID),
]);

const allHcp = (await pool.query(`
  SELECT sc.bowlerID, b.bowlerName,
    CAST(SUM(sc.handSeries) * 1.0 / NULLIF(COUNT(sc.scoreID) * 3, 0) AS DECIMAL(5,1)) AS hcpAvg
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  WHERE sc.seasonID = 29 AND sc.isPenalty = 0
  GROUP BY sc.bowlerID, b.bowlerName
  HAVING COUNT(sc.scoreID) * 3 >= 18
  ORDER BY hcpAvg DESC
`)).recordset;

const uiHcpEligible = allHcp.filter(r => !uiExcluded.has(r.bowlerID));
console.log('\nUI hcp top 10 (after excluding scratch top 8):');
uiHcpEligible.slice(0, 10).forEach((r, i) => {
  const flag = r.bowlerName === 'Mike Morrone' ? ' <<<' : '';
  console.log(`  #${i+1} ${r.bowlerName.padEnd(22)} ${r.hcpAvg}${flag}`);
});

// Find Morrone
const mmUI = uiHcpEligible.findIndex(r => r.bowlerName === 'Mike Morrone');
console.log(`\nMorrone UI hcp rank: #${mmUI + 1}`);

// Patch method exclusion
const patchWomens = (await pool.query(`
  SELECT sc3.bowlerID, b3.bowlerName,
    CAST(SUM(sc3.game1 + sc3.game2 + sc3.game3) AS FLOAT) / (COUNT(*) * 3) AS scratchAvg
  FROM scores sc3
  JOIN bowlers b3 ON b3.bowlerID = sc3.bowlerID
  WHERE sc3.isPenalty = 0 AND b3.gender = 'F' AND sc3.seasonID = 29
  GROUP BY sc3.seasonID, sc3.bowlerID, b3.bowlerName, b3.gender
  HAVING COUNT(*) * 3 >= 18
  ORDER BY scratchAvg DESC
`)).recordset;

const patchExcluded = new Set([
  ...patchMens.slice(0, 8).map(r => r.bowlerID),
  ...patchWomens.slice(0, 8).map(r => r.bowlerID),
]);

const patchHcpEligible = allHcp.filter(r => !patchExcluded.has(r.bowlerID));
console.log('\nPatch hcp top 10 (after excluding scratch top 8):');
patchHcpEligible.slice(0, 10).forEach((r, i) => {
  const flag = r.bowlerName === 'Mike Morrone' ? ' <<<' : '';
  console.log(`  #${i+1} ${r.bowlerName.padEnd(22)} ${r.hcpAvg}${flag}`);
});

const mmPatch = patchHcpEligible.findIndex(r => r.bowlerName === 'Mike Morrone');
console.log(`\nMorrone patch hcp rank: #${mmPatch + 1}`);

// Show difference in excluded sets
const exOnlyUI = [...uiExcluded].filter(id => !patchExcluded.has(id));
const exOnlyPatch = [...patchExcluded].filter(id => !uiExcluded.has(id));
if (exOnlyUI.length || exOnlyPatch.length) {
  console.log('\nExclusion set differs!');
  const getName = id => allHcp.find(r => r.bowlerID === id)?.bowlerName || String(id);
  exOnlyUI.forEach(id => console.log(`  Excluded by UI only: ${getName(id)}`));
  exOnlyPatch.forEach(id => console.log(`  Excluded by patch only: ${getName(id)}`));
}

await pool.close();
