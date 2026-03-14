/**
 * Populate playoffResults and seasonChampions from CSV data.
 *
 * Usage:
 *   node scripts/populate-playoffs.mjs [--dry-run] [--wipe]
 *
 * --dry-run: Show what would be inserted without writing
 * --wipe:    Clear existing data before inserting
 */

import sql from 'mssql';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');
const WIPE = process.argv.includes('--wipe');

function bumpDataVersion(channel, seasonID) {
  const filePath = resolve(PROJECT_ROOT, '.data-versions.json');
  let versions = {};
  try { versions = JSON.parse(readFileSync(filePath, 'utf8')); } catch {}
  if (!versions[channel]) versions[channel] = {};
  const key = String(seasonID);
  versions[channel][key] = (versions[channel][key] || 1) + 1;
  writeFileSync(filePath, JSON.stringify(versions, null, 2) + '\n');
  console.log(`Bumped .data-versions.json: ${channel}.${seasonID} → v${versions[channel][key]}`);
}

const config = {
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

// Map CSV team names → canonical teamIDs
// Some CSV names differ from canonical (case, hyphens, abbreviations)
const TEAM_NAME_TO_ID = {
  'Bull City Balsa': 6,
  'Hot Shotz': 15,
  'Pin-Ups': 22,
  'Ten Pin Teasers': 32,
  'Pin Pricks': 20,
  'Gutterglory': 11,
  'E-Bowla': 7,
  'Bowl\'d Peanuts': 5,
  'Solid Bowled': 27,
  'Village Idiots': 41,
  'Guttermouths': 12,
  'Spare Club For Men': 29, // canonical: "Spare Club for Men"
  'Sparely Legal': 30,
  'Jive Turkeys': 16,
  'Lucky Strikes': 18,
  'Fancy Pants': 8,
  'Vandal-Lane Industries': 40,
  'Thoughts and Spares': 38,
  'The Boom Kings': 33,
  'Roll Your Own': 25,
  'Wild Llamas': 42,
  'Valley of the Balls': 39,
  'Stinky Cheese': 31,
  'Sparadigm Shift': 28,
  'The Guttersnipes': 36,
  'Smoke-A-Bowl': 26,  // canonical: "Smoke-a-Bowl"
  'Bowlonomics': 14,   // franchise currently named "HOT FUN"
  'Guttersnipes': 13,
  'Grandma\'s Teeth': 9,
  'Alley-Oops': 1,     // canonical: "Alley Oops"
  'Bowl Durham': 4,
  'Guttermouths': 12,
};

// Roman numeral → seasonID (1:1 mapping)
const ROMAN_TO_SEASON = {};
const romans = [
  'I','II','III','IV','V','VI','VII','VIII','IX','X',
  'XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX',
  'XXI','XXII','XXIII','XXIV','XXV','XXVI','XXVII','XXVIII','XXIX','XXX',
  'XXXI','XXXII','XXXIII','XXXIV','XXXV',
];
romans.forEach((r, i) => { ROMAN_TO_SEASON[r] = i + 1; });

function resolveTeamID(name) {
  const trimmed = name.trim();
  if (!trimmed || trimmed === '-') return null;
  const id = TEAM_NAME_TO_ID[trimmed];
  if (!id) throw new Error(`Unknown team name: "${trimmed}"`);
  return id;
}

async function main() {
  // Parse CSV
  const csvPath = resolve(__dirname, '../docs/Splitzkrieg History - Team Champions (1).csv');
  const csv = readFileSync(csvPath, 'utf-8');
  const lines = csv.trim().split('\n');
  const header = lines[0]; // Season,Champion,Runner Up,Semi-Finalist,Semi-Finalist

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const roman = parts[0].trim();
    const seasonID = ROMAN_TO_SEASON[roman];
    if (!seasonID) {
      console.warn(`Unknown season: ${roman}, skipping`);
      continue;
    }
    const champion = resolveTeamID(parts[1]);
    const runnerUp = resolveTeamID(parts[2]);
    const semi1 = resolveTeamID(parts[3]);
    const semi2 = resolveTeamID(parts[4]);

    // Season XXV (COVID) has no champion
    if (!champion) {
      console.log(`Season ${roman} (${seasonID}): no champion (COVID), skipping`);
      continue;
    }

    rows.push({ seasonID, roman, champion, runnerUp, semi1, semi2 });
  }

  console.log(`Parsed ${rows.length} seasons with playoff data\n`);

  const pool = await sql.connect(config);

  if (WIPE && !DRY_RUN) {
    console.log('Wiping existing playoffResults and seasonChampions (team only)...');
    await pool.query("DELETE FROM playoffResults WHERE playoffType = 'team'");
    await pool.query("DELETE FROM seasonChampions WHERE championshipType = 'team'");
    console.log('Wiped.\n');
  }

  let championsInserted = 0;
  let playoffsInserted = 0;

  for (const row of rows) {
    const { seasonID, roman, champion, runnerUp, semi1, semi2 } = row;

    // --- seasonChampions ---
    if (DRY_RUN) {
      console.log(`[DRY] seasonChampions: season=${roman} (${seasonID}), champion teamID=${champion}`);
    } else {
      await pool.request()
        .input('seasonID', sql.Int, seasonID)
        .input('championshipType', sql.VarChar, 'team')
        .input('winnerTeamID', sql.Int, champion)
        .query(`INSERT INTO seasonChampions (seasonID, championshipType, winnerTeamID)
                VALUES (@seasonID, @championshipType, @winnerTeamID)`);
      championsInserted++;
    }

    // --- playoffResults: Final ---
    if (DRY_RUN) {
      console.log(`[DRY] playoffResults: season=${roman}, round=final, team1=${champion} vs team2=${runnerUp}, winner=${champion}`);
    } else {
      await pool.request()
        .input('seasonID', sql.Int, seasonID)
        .input('playoffType', sql.VarChar, 'team')
        .input('round', sql.VarChar, 'final')
        .input('team1ID', sql.Int, champion)
        .input('team2ID', sql.Int, runnerUp)
        .input('winnerTeamID', sql.Int, champion)
        .query(`INSERT INTO playoffResults (seasonID, playoffType, round, team1ID, team2ID, winnerTeamID)
                VALUES (@seasonID, @playoffType, @round, @team1ID, @team2ID, @winnerTeamID)`);
      playoffsInserted++;
    }

    // --- playoffResults: Semifinals ---
    // We know the losers but not exact bracket pairings
    // Store each semifinal with the losing team; winner unknown
    for (const loser of [semi1, semi2]) {
      if (!loser) continue;
      if (DRY_RUN) {
        console.log(`[DRY] playoffResults: season=${roman}, round=semifinal, loser teamID=${loser}`);
      } else {
        await pool.request()
          .input('seasonID', sql.Int, seasonID)
          .input('playoffType', sql.VarChar, 'team')
          .input('round', sql.VarChar, 'semifinal')
          .input('team1ID', sql.Int, loser)
          .query(`INSERT INTO playoffResults (seasonID, playoffType, round, team1ID)
                  VALUES (@seasonID, @playoffType, @round, @team1ID)`);
        playoffsInserted++;
      }
    }
  }

  if (!DRY_RUN) {
    console.log(`\nInserted ${championsInserted} seasonChampions rows`);
    console.log(`Inserted ${playoffsInserted} playoffResults rows`);

    // Verify
    const v1 = await pool.query("SELECT COUNT(*) as cnt FROM seasonChampions WHERE championshipType = 'team'");
    const v2 = await pool.query("SELECT COUNT(*) as cnt FROM playoffResults WHERE playoffType = 'team'");
    console.log(`\nVerification: ${v1.recordset[0].cnt} seasonChampions, ${v2.recordset[0].cnt} playoffResults`);

    // Bump data versions for all affected seasons so queries invalidate
    const affectedSeasons = new Set(rows.map(r => r.seasonID));
    for (const sid of affectedSeasons) {
      bumpDataVersion('schedule', sid);
    }
  }

  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
