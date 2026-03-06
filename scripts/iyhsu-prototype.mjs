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
const SEASON_ID = 35; // Season XXXV
const WEEK = 3;

async function main() {
  const pool = await new sql.ConnectionPool(dbConfig).connect();

  // Get all bowler scores for this week (including penalty bowlers for team totals)
  const scoresRes = await pool.request().input('seasonID', sql.Int, SEASON_ID).input('week', sql.Int, WEEK).query(`
    SELECT
      sc.teamID,
      COALESCE(tnh.teamName, t.teamName) AS teamName,
      sc.bowlerID,
      b.bowlerName,
      sc.isPenalty,
      sc.hcpGame1,
      sc.hcpGame2,
      sc.hcpGame3,
      sc.handSeries
    FROM scores sc
    JOIN bowlers b ON sc.bowlerID = b.bowlerID
    JOIN teams t ON sc.teamID = t.teamID
    LEFT JOIN teamNameHistory tnh ON tnh.seasonID = sc.seasonID AND tnh.teamID = sc.teamID
    WHERE sc.seasonID = @seasonID AND sc.week = @week
    ORDER BY sc.teamID, sc.isPenalty, b.bowlerName
  `);

  // Get schedule (matchups) for this week
  const schedRes = await pool.request().input('seasonID', sql.Int, SEASON_ID).input('week', sql.Int, WEEK).query(`
    SELECT team1ID, team2ID
    FROM schedule
    WHERE seasonID = @seasonID AND week = @week
  `);

  await pool.close();

  const scores = scoresRes.recordset;
  const matchups = schedRes.recordset;

  // Group scores by team
  const teamBowlers = new Map();
  for (const s of scores) {
    if (!teamBowlers.has(s.teamID)) teamBowlers.set(s.teamID, { teamName: s.teamName, bowlers: [] });
    teamBowlers.get(s.teamID).bowlers.push(s);
  }

  // Calculate actual team hcp game totals
  function calcTeamGames(teamID, replaceBowlerID = null) {
    const team = teamBowlers.get(teamID);
    if (!team) return { g1: 0, g2: 0, g3: 0, series: 0 };
    let g1 = 0, g2 = 0, g3 = 0;
    for (const b of team.bowlers) {
      if (replaceBowlerID && b.bowlerID === replaceBowlerID) {
        // Replace with penalty scores
        g1 += PENALTY_HCP_GAME;
        g2 += PENALTY_HCP_GAME;
        g3 += PENALTY_HCP_GAME;
      } else {
        g1 += b.hcpGame1 ?? 0;
        g2 += b.hcpGame2 ?? 0;
        g3 += b.hcpGame3 ?? 0;
      }
    }
    return { g1, g2, g3, series: g1 + g2 + g3 };
  }

  // Calculate head-to-head game wins for a matchup
  function calcGamePts(team1Games, team2Games) {
    let t1 = 0, t2 = 0;
    const pairs = [
      [team1Games.g1, team2Games.g1],
      [team1Games.g2, team2Games.g2],
      [team1Games.g3, team2Games.g3],
    ];
    for (const [a, b] of pairs) {
      if (a > b) { t1 += 2; }
      else if (b > a) { t2 += 2; }
      else { t1 += 1; t2 += 1; } // ties worth 1 each
    }
    return { t1, t2 };
  }

  // Calculate XP tiers based on all team hcp series
  function calcXP(teamSeriesMap) {
    const ranked = [...teamSeriesMap.entries()]
      .sort((a, b) => b[1] - a[1]);
    const xp = new Map();
    ranked.forEach(([teamID], i) => {
      if (i < 5) xp.set(teamID, 3);
      else if (i < 10) xp.set(teamID, 2);
      else if (i < 15) xp.set(teamID, 1);
      else xp.set(teamID, 0);
    });
    return xp;
  }

  // --- ACTUAL results ---
  const actualTeamGames = new Map();
  const actualTeamSeries = new Map();
  for (const [teamID] of teamBowlers) {
    const games = calcTeamGames(teamID);
    actualTeamGames.set(teamID, games);
    actualTeamSeries.set(teamID, games.series);
  }
  const actualXP = calcXP(actualTeamSeries);

  // Actual total points per team
  const actualPoints = new Map();
  for (const [teamID] of teamBowlers) actualPoints.set(teamID, actualXP.get(teamID) ?? 0);
  for (const m of matchups) {
    const t1Games = actualTeamGames.get(m.team1ID);
    const t2Games = actualTeamGames.get(m.team2ID);
    if (!t1Games || !t2Games) continue;
    const pts = calcGamePts(t1Games, t2Games);
    actualPoints.set(m.team1ID, (actualPoints.get(m.team1ID) ?? 0) + pts.t1);
    actualPoints.set(m.team2ID, (actualPoints.get(m.team2ID) ?? 0) + pts.t2);
  }

  // --- For each NON-PENALTY bowler, compute hypothetical ---
  const results = [];
  for (const [teamID, team] of teamBowlers) {
    for (const bowler of team.bowlers) {
      if (bowler.isPenalty) continue;

      // Recalculate this bowler's team with penalty scores
      const hypTeamGames = calcTeamGames(teamID, bowler.bowlerID);

      // Recalculate all team series (only this team changes)
      const hypTeamSeries = new Map(actualTeamSeries);
      hypTeamSeries.set(teamID, hypTeamGames.series);
      const hypXP = calcXP(hypTeamSeries);

      // Recalculate total points for ALL teams
      const hypPoints = new Map();
      for (const [tid] of teamBowlers) hypPoints.set(tid, hypXP.get(tid) ?? 0);
      for (const m of matchups) {
        let t1Games, t2Games;
        if (m.team1ID === teamID) t1Games = hypTeamGames;
        else t1Games = actualTeamGames.get(m.team1ID);
        if (m.team2ID === teamID) t2Games = hypTeamGames;
        else t2Games = actualTeamGames.get(m.team2ID);
        if (!t1Games || !t2Games) continue;
        const pts = calcGamePts(t1Games, t2Games);
        hypPoints.set(m.team1ID, (hypPoints.get(m.team1ID) ?? 0) + pts.t1);
        hypPoints.set(m.team2ID, (hypPoints.get(m.team2ID) ?? 0) + pts.t2);
      }

      // Impact = actual team points - hypothetical team points (without this bowler)
      const impact = (actualPoints.get(teamID) ?? 0) - (hypPoints.get(teamID) ?? 0);

      // Also compute how much hcp series changed
      const seriesDelta = (actualTeamSeries.get(teamID) ?? 0) - hypTeamGames.series;

      results.push({
        bowlerName: bowler.bowlerName,
        teamName: team.teamName,
        hcpGames: `${bowler.hcpGame1}-${bowler.hcpGame2}-${bowler.hcpGame3}`,
        handSeries: bowler.handSeries,
        seriesOverPenalty: seriesDelta,
        impact,
        actualTeamPts: actualPoints.get(teamID) ?? 0,
        hypTeamPts: hypPoints.get(teamID) ?? 0,
      });
    }
  }

  // Sort by impact descending
  results.sort((a, b) => b.impact - a.impact || b.seriesOverPenalty - a.seriesOverPenalty);

  console.log(`\n=== IYHSU Impact — Season XXXV, Week ${WEEK} ===`);
  console.log(`Penalty hcp game: ${PENALTY_HCP_GAME} × 3 = ${PENALTY_HCP_GAME * 3} series\n`);

  console.log('Rank  Bowler                    Team                  Hcp Games       Series  Δ Series  Impact  Actual→Hyp');
  console.log('─'.repeat(115));
  results.forEach((r, i) => {
    const rank = String(i + 1).padStart(3);
    const name = r.bowlerName.padEnd(25);
    const team = r.teamName.padEnd(22);
    const games = r.hcpGames.padEnd(15);
    const series = String(r.handSeries).padStart(6);
    const delta = (r.seriesOverPenalty >= 0 ? '+' : '') + r.seriesOverPenalty;
    const impact = (r.impact >= 0 ? '+' : '') + r.impact;
    console.log(`${rank}  ${name} ${team} ${games} ${series}  ${delta.padStart(8)}  ${impact.padStart(6)}   ${r.actualTeamPts}→${r.hypTeamPts}`);
  });

  // Summary
  const positive = results.filter(r => r.impact > 0);
  const negative = results.filter(r => r.impact < 0);
  const zero = results.filter(r => r.impact === 0);
  console.log(`\nSummary: ${positive.length} bowlers with positive impact, ${zero.length} with zero, ${negative.length} with negative`);
  console.log('(Negative = team would have scored MORE points with a penalty bowler instead)');
}

main().catch(err => { console.error(err); process.exit(1); });
