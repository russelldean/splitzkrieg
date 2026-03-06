import sql from 'mssql';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const pool = await new sql.ConnectionPool({
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 30000 },
}).connect();

const seasonRes = await pool.request().query("SELECT TOP 1 seasonID FROM seasons ORDER BY seasonID DESC");
const seasonID = seasonRes.recordset[0].seasonID;

const mr = (await pool.request().query(`
  SELECT sch.team1ID AS homeTeamID, sch.team2ID AS awayTeamID,
         mr.team1Game1, mr.team1Game2, mr.team1Game3, mr.team1Series,
         mr.team2Game1, mr.team2Game2, mr.team2Game3, mr.team2Series,
         COALESCE(tnh1.teamName, t1.teamName) AS homeTeam,
         COALESCE(tnh2.teamName, t2.teamName) AS awayTeam
  FROM matchResults mr
  JOIN schedule sch ON mr.scheduleID = sch.scheduleID
  JOIN teams t1 ON sch.team1ID = t1.teamID
  JOIN teams t2 ON sch.team2ID = t2.teamID
  LEFT JOIN teamNameHistory tnh1 ON tnh1.teamID = sch.team1ID AND tnh1.seasonID = sch.seasonID
  LEFT JOIN teamNameHistory tnh2 ON tnh2.teamID = sch.team2ID AND tnh2.seasonID = sch.seasonID
  WHERE sch.seasonID = ${seasonID} AND sch.week = 3
`)).recordset;

const scores = (await pool.request().query(`
  SELECT b.bowlerName as name, b.slug, sc.teamID,
         COALESCE(tnh.teamName, t.teamName) AS teamName,
         sc.game1, sc.game2, sc.game3, sc.incomingHcp, sc.incomingAvg
  FROM scores sc
  JOIN bowlers b ON sc.bowlerID = b.bowlerID
  JOIN teams t ON sc.teamID = t.teamID
  LEFT JOIN teamNameHistory tnh ON tnh.teamID = sc.teamID AND tnh.seasonID = sc.seasonID
  WHERE sc.seasonID = ${seasonID} AND sc.week = 3
  ORDER BY sc.teamID, b.bowlerName
`)).recordset;

// Expected hcp game = incomingAvg + incomingHcp (what you'd score bowling your average)
// Above-expected = your actual hcp game - expected hcp game
// = (game + hcp) - (avg + hcp) = game - avg
// So it simplifies to: how many pins above your average did you bowl each game

const allPIN = [];

for (const match of mr) {
  const margins = [
    match.team1Game1 - match.team2Game1,
    match.team1Game2 - match.team2Game2,
    match.team1Game3 - match.team2Game3,
  ];

  const homeBowlers = scores.filter(s => s.teamID === match.homeTeamID);
  const awayBowlers = scores.filter(s => s.teamID === match.awayTeamID);

  for (const { bowlers, sign } of [
    { bowlers: homeBowlers, sign: 1 },
    { bowlers: awayBowlers, sign: -1 },
  ]) {
    for (const b of bowlers) {
      // No average = neutral (0 contribution)
      if (b.incomingAvg == null || b.incomingHcp == null || b.game1 == null) {
        allPIN.push({ name: b.name, team: b.teamName, pin: 0, details: ["no avg — neutral"] });
        continue;
      }

      const games = [b.game1, b.game2, b.game3];
      const expectedGame = b.incomingAvg; // above average = game - avg (hcp cancels out)
      let pin = 0;
      const details = [];

      for (let g = 0; g < 3; g++) {
        const aboveAvg = games[g] - expectedGame;
        const margin = margins[g] * sign;
        const absMargin = Math.abs(margins[g]);

        if (absMargin === 0) {
          details.push(`G${g+1}: tie, 0`);
          continue;
        }

        let credit = (aboveAvg / absMargin) * 2;
        credit = Math.max(-2, Math.min(2, credit));

        pin += credit;
        details.push(`G${g+1}: ${games[g]} (${aboveAvg >= 0 ? "+" : ""}${aboveAvg} vs avg ${expectedGame}) margin ${margin > 0 ? "+" : ""}${margin} → ${credit >= 0 ? "+" : ""}${credit.toFixed(2)}`);
      }

      allPIN.push({ name: b.name, team: b.teamName, pin, details });
    }
  }
}

allPIN.sort((a, b) => b.pin - a.pin);

console.log("=== PIN RANKINGS — Week 3 ===");
console.log("(Personal Impact Number: your above/below avg share of the game margin)\n");

for (let i = 0; i < allPIN.length; i++) {
  const p = allPIN[i];
  const sign = p.pin >= 0 ? "+" : "";
  console.log(`${String(i + 1).padStart(2)}. ${p.name.padEnd(22)} ${sign}${p.pin.toFixed(2)}  (${p.team})`);
  console.log(`    ${p.details.join(" | ")}`);
}

await pool.close();
