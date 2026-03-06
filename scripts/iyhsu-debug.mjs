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
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 120000,
    requestTimeout: 30000,
  },
};

const PENALTY_HCP_GAME = 199;
const SEASON_ID = 35;
const WEEK = 3;
const DEBUG_BOWLER = 'Russ Dean';

async function main() {
  const pool = await new sql.ConnectionPool(dbConfig).connect();

  const scoresRes = await pool.request().input('seasonID', sql.Int, SEASON_ID).input('week', sql.Int, WEEK).query(`
    SELECT sc.teamID, COALESCE(tnh.teamName, t.teamName) AS teamName, sc.bowlerID, b.bowlerName,
           sc.isPenalty, sc.hcpGame1, sc.hcpGame2, sc.hcpGame3, sc.handSeries
    FROM scores sc
    JOIN bowlers b ON sc.bowlerID = b.bowlerID
    JOIN teams t ON sc.teamID = t.teamID
    LEFT JOIN teamNameHistory tnh ON tnh.seasonID = sc.seasonID AND tnh.teamID = sc.teamID
    WHERE sc.seasonID = @seasonID AND sc.week = @week
    ORDER BY sc.teamID, b.bowlerName
  `);

  const schedRes = await pool.request().input('seasonID', sql.Int, SEASON_ID).input('week', sql.Int, WEEK).query(`
    SELECT team1ID, team2ID FROM schedule WHERE seasonID = @seasonID AND week = @week
  `);

  await pool.close();

  const scores = scoresRes.recordset;
  const matchups = schedRes.recordset;

  // Find Russ's team
  const russ = scores.find(s => s.bowlerName === DEBUG_BOWLER && !s.isPenalty);
  if (!russ) { console.log('Bowler not found'); return; }

  const russTeamID = russ.teamID;
  const matchup = matchups.find(m => m.team1ID === russTeamID || m.team2ID === russTeamID);
  const opponentID = matchup.team1ID === russTeamID ? matchup.team2ID : matchup.team1ID;

  const teammates = scores.filter(s => s.teamID === russTeamID);
  const opponents = scores.filter(s => s.teamID === opponentID);

  console.log(`\n=== Debug: ${DEBUG_BOWLER} — Season XXXV Week ${WEEK} ===\n`);
  console.log(`Team: ${russ.teamName} (ID ${russTeamID})`);
  console.log(`Opponent: ${opponents[0]?.teamName} (ID ${opponentID})\n`);

  // Show all teammates
  console.log('--- Lucky Strikes Bowlers ---');
  let actualG1 = 0, actualG2 = 0, actualG3 = 0;
  for (const b of teammates) {
    console.log(`  ${b.bowlerName.padEnd(25)} ${b.hcpGame1}-${b.hcpGame2}-${b.hcpGame3}  (${b.handSeries}) ${b.isPenalty ? '[PENALTY]' : ''}`);
    actualG1 += b.hcpGame1 ?? 0;
    actualG2 += b.hcpGame2 ?? 0;
    actualG3 += b.hcpGame3 ?? 0;
  }
  console.log(`  ${'TEAM TOTAL'.padEnd(25)} ${actualG1}-${actualG2}-${actualG3}  (${actualG1+actualG2+actualG3})\n`);

  // Hypothetical (replace Russ with penalty)
  let hypG1 = 0, hypG2 = 0, hypG3 = 0;
  for (const b of teammates) {
    if (b.bowlerID === russ.bowlerID) {
      hypG1 += PENALTY_HCP_GAME; hypG2 += PENALTY_HCP_GAME; hypG3 += PENALTY_HCP_GAME;
    } else {
      hypG1 += b.hcpGame1 ?? 0; hypG2 += b.hcpGame2 ?? 0; hypG3 += b.hcpGame3 ?? 0;
    }
  }
  console.log('--- Lucky Strikes WITHOUT Russ (penalty 199-199-199) ---');
  console.log(`  TEAM TOTAL:              ${hypG1}-${hypG2}-${hypG3}  (${hypG1+hypG2+hypG3})\n`);

  // Opponent totals
  let oppG1 = 0, oppG2 = 0, oppG3 = 0;
  console.log(`--- ${opponents[0]?.teamName} Bowlers ---`);
  for (const b of opponents) {
    console.log(`  ${b.bowlerName.padEnd(25)} ${b.hcpGame1}-${b.hcpGame2}-${b.hcpGame3}  (${b.handSeries}) ${b.isPenalty ? '[PENALTY]' : ''}`);
    oppG1 += b.hcpGame1 ?? 0;
    oppG2 += b.hcpGame2 ?? 0;
    oppG3 += b.hcpGame3 ?? 0;
  }
  console.log(`  ${'TEAM TOTAL'.padEnd(25)} ${oppG1}-${oppG2}-${oppG3}  (${oppG1+oppG2+oppG3})\n`);

  // Head-to-head comparison
  console.log('--- Head-to-Head: ACTUAL ---');
  const games = [
    { label: 'Game 1', us: actualG1, them: oppG1 },
    { label: 'Game 2', us: actualG2, them: oppG2 },
    { label: 'Game 3', us: actualG3, them: oppG3 },
  ];
  let actualGamePts = 0;
  for (const g of games) {
    const result = g.us > g.them ? 'WIN' : g.us < g.them ? 'LOSS' : 'TIE';
    if (g.us > g.them) actualGamePts += 1;
    else if (g.us === g.them) actualGamePts += 0.5;
    console.log(`  ${g.label}: ${g.us} vs ${g.them} → ${result}`);
  }
  console.log(`  Game Points: ${actualGamePts}\n`);

  console.log('--- Head-to-Head: WITHOUT RUSS ---');
  const hypGames = [
    { label: 'Game 1', us: hypG1, them: oppG1 },
    { label: 'Game 2', us: hypG2, them: oppG2 },
    { label: 'Game 3', us: hypG3, them: oppG3 },
  ];
  let hypGamePts = 0;
  for (const g of hypGames) {
    const result = g.us > g.them ? 'WIN' : g.us < g.them ? 'LOSS' : 'TIE';
    if (g.us > g.them) hypGamePts += 1;
    else if (g.us === g.them) hypGamePts += 0.5;
    console.log(`  ${g.label}: ${g.us} vs ${g.them} → ${result}`);
  }
  console.log(`  Game Points: ${hypGamePts}\n`);

  console.log(`Head-to-head delta: ${actualGamePts} → ${hypGamePts} (${actualGamePts - hypGamePts > 0 ? '+' : ''}${actualGamePts - hypGamePts})`);

  // XP comparison
  const teamTotals = new Map();
  for (const s of scores) {
    const cur = teamTotals.get(s.teamID) ?? 0;
    teamTotals.set(s.teamID, cur + (s.handSeries ?? 0));
  }

  const hypTeamTotals = new Map(teamTotals);
  hypTeamTotals.set(russTeamID, hypTeamTotals.get(russTeamID) - russ.handSeries + PENALTY_HCP_GAME * 3);

  const actualRanked = [...teamTotals.entries()].sort((a, b) => b[1] - a[1]);
  const hypRanked = [...hypTeamTotals.entries()].sort((a, b) => b[1] - a[1]);

  const teamNames = new Map();
  for (const s of scores) teamNames.set(s.teamID, s.teamName);

  function getXP(rank) { return rank < 5 ? 3 : rank < 10 ? 2 : rank < 15 ? 1 : 0; }

  const actualRussRank = actualRanked.findIndex(([id]) => id === russTeamID);
  const hypRussRank = hypRanked.findIndex(([id]) => id === russTeamID);

  console.log(`\n--- XP Rankings ---`);
  console.log(`ACTUAL: Lucky Strikes ranked #${actualRussRank + 1} (series ${teamTotals.get(russTeamID)}) → ${getXP(actualRussRank)} XP`);
  console.log(`WITHOUT RUSS: Lucky Strikes ranked #${hypRussRank + 1} (series ${hypTeamTotals.get(russTeamID)}) → ${getXP(hypRussRank)} XP`);
  console.log(`XP delta: ${getXP(actualRussRank)} → ${getXP(hypRussRank)} (${getXP(actualRussRank) - getXP(hypRussRank) > 0 ? '+' : ''}${getXP(actualRussRank) - getXP(hypRussRank)})`);

  console.log(`\n--- Total Impact ---`);
  const totalActual = actualGamePts + getXP(actualRussRank);
  const totalHyp = hypGamePts + getXP(hypRussRank);
  console.log(`Actual total: ${actualGamePts} game + ${getXP(actualRussRank)} XP = ${totalActual}`);
  console.log(`Hyp total:    ${hypGamePts} game + ${getXP(hypRussRank)} XP = ${totalHyp}`);
  console.log(`Impact: ${totalActual - totalHyp > 0 ? '+' : ''}${totalActual - totalHyp}`);
}

main().catch(err => { console.error(err); process.exit(1); });
