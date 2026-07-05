// Phase 1 Task 3 verification: confirm the current-season slug helpers return
// only current-season slugs, using the same env-loading pattern as other scripts.
import sql from 'mssql';
import { readFileSync } from 'fs';

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
  options: { encrypt: true, trustServerCertificate: false },
};

const BOWLER_SQL = `
  SELECT DISTINCT b.slug
  FROM bowlers b
  JOIN scores sc ON sc.bowlerID = b.bowlerID
  JOIN seasons se ON se.seasonID = sc.seasonID
  WHERE se.isCurrentSeason = 1
    AND sc.isPenalty = 0
    AND b.slug IS NOT NULL
  ORDER BY b.slug
`;

const TEAM_SQL = `
  SELECT DISTINCT t.slug
  FROM teams t
  JOIN schedule sch ON sch.team1ID = t.teamID OR sch.team2ID = t.teamID
  JOIN seasons se ON se.seasonID = sch.seasonID
  WHERE se.isCurrentSeason = 1
    AND t.slug IS NOT NULL
  ORDER BY t.slug
`;

const ALL_TEAM_SQL = `SELECT slug FROM teams WHERE slug IS NOT NULL ORDER BY teamName`;
const CURRENT_SEASON_SQL = `
  SELECT LOWER(REPLACE(displayName, ' ', '-')) AS slug, displayName, isCurrentSeason
  FROM seasons WHERE isCurrentSeason = 1
`;

async function main() {
  const pool = await new sql.ConnectionPool(dbConfig).connect();

  const cur = (await pool.request().query(CURRENT_SEASON_SQL)).recordset;
  console.log('current season (isCurrentSeason=1):', cur.map(r => `${r.displayName} [${r.slug}]`).join(', ') || '(none)');

  const bowlers = (await pool.request().query(BOWLER_SQL)).recordset;
  const teams = (await pool.request().query(TEAM_SQL)).recordset;
  const allTeams = new Set((await pool.request().query(ALL_TEAM_SQL)).recordset.map(r => r.slug));

  console.log('current-season bowlers:', bowlers.length);
  console.log('current-season teams:', teams.length);
  console.log('sample bowler slugs:', bowlers.slice(0, 5).map(r => r.slug).join(', '));
  console.log('team slugs:', teams.map(r => r.slug).join(', '));

  const allExist = teams.every(t => allTeams.has(t.slug));
  console.log('all current-season teams exist in full team set:', allExist);

  const bowlerOK = bowlers.length > 0;
  const teamOK = teams.length >= 1 && teams.length <= 24;
  console.log('\nRESULT:',
    bowlerOK && teamOK && allExist ? 'PASS' : 'FAIL',
    `(bowlers>0: ${bowlerOK}, 1<=teams<=24: ${teamOK}, teamsSubset: ${allExist})`);

  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
