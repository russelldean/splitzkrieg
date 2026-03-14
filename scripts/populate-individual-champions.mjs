/**
 * Populate seasonChampions with individual playoff winners from CSV.
 *
 * Usage:
 *   node scripts/populate-individual-champions.mjs              # insert missing
 *   node scripts/populate-individual-champions.mjs --wipe       # wipe and repopulate
 *   node scripts/populate-individual-champions.mjs --dry-run    # preview without writing
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

// Load env
const envContent = readFileSync(resolve(__dirname, '../.env.local'), 'utf8');
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

// CSV franchise names that don't match teamNameHistory exactly
const FRANCHISE_ALIASES = {
  'gutter mouths': 'guttermouths',       // DB uses one word
  'mom ballerz': 'alley oops',           // franchise rename
  'wolf splitzers': 'thoughts and spares', // same franchise (teamID 38), various names over the years
};

// Map CSV title → championshipType in DB
const TITLE_TO_TYPE = {
  'Mens Scratch': 'MensScratch',
  'Womens Scratch': 'WomensScratch',
  'Handicap': 'Handicap',
};

// Map CSV period → seasons.period (or null for early seasons that span full year)
function normalizePeriod(sf) {
  const trimmed = sf.trim();
  if (trimmed === 'Spring') return 'Spring';
  if (trimmed === 'Fall') return 'Fall';
  if (trimmed === 'Spring/Fall') return null; // early seasons — match by year only
  if (trimmed === 'Covid') return null; // skip
  return null;
}

async function main() {
  // Parse CSV
  const csvPath = resolve(__dirname, '../docs/Splitzkrieg History - Individual Winners.csv');
  const csv = readFileSync(csvPath, 'utf-8');
  const lines = csv.trim().split('\n');
  // Line 1: "Individual Trophies,,,,"
  // Line 2: "Year,S/F,Title,Winner,Franchise"
  // Data starts at line 3

  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    // Handle commas carefully — no quoted fields in this CSV
    const parts = lines[i].split(',');
    const year = parseInt(parts[0].trim(), 10);
    const sf = parts[1].trim();
    const title = parts[2].trim();
    const winner = parts[3].trim();
    const franchise = parts[4].trim();

    // Skip Covid year
    if (sf === 'Covid') {
      console.log(`Skipping Covid row: ${winner} (${title})`);
      continue;
    }

    const championshipType = TITLE_TO_TYPE[title];
    if (!championshipType) {
      console.warn(`Unknown title: "${title}" — skipping`);
      continue;
    }

    const period = normalizePeriod(sf);
    rows.push({ year, period, championshipType, winner, franchise });
  }

  console.log(`Parsed ${rows.length} individual champion rows (excluding Covid)\n`);

  const pool = await sql.connect(dbConfig);

  // Build lookup maps from DB

  // 1. Seasons: year + period → seasonID
  const seasonRows = (await pool.request().query(
    'SELECT seasonID, year, period FROM seasons'
  )).recordset;

  const seasonMap = new Map(); // "year-period" or "year" → seasonID
  for (const s of seasonRows) {
    seasonMap.set(`${s.year}-${s.period}`, s.seasonID);
    // For early seasons (only one per year), also store by year alone
    // We'll check year-only as fallback
  }
  // Build year-only map for seasons where only one season exists for that year
  const yearCount = new Map();
  for (const s of seasonRows) {
    yearCount.set(s.year, (yearCount.get(s.year) || 0) + 1);
  }
  const yearOnlyMap = new Map();
  for (const s of seasonRows) {
    if (yearCount.get(s.year) === 1) {
      yearOnlyMap.set(s.year, s.seasonID);
    }
  }

  function resolveSeasonID(year, period) {
    if (period) {
      const key = `${year}-${period}`;
      const id = seasonMap.get(key);
      if (id) return id;
    }
    // Fall back to year-only for early seasons
    const id = yearOnlyMap.get(year);
    if (id) return id;
    return null;
  }

  // 2. Bowlers: name → bowlerID (canonical + alternates)
  const bowlerRows = (await pool.request().query(
    'SELECT bowlerID, bowlerName FROM bowlers'
  )).recordset;
  const altRows = (await pool.request().query(
    'SELECT bowlerID, alternateName FROM bowlerNameHistory'
  )).recordset;

  const bowlerNameMap = new Map(); // lowercase name → bowlerID
  for (const b of bowlerRows) {
    bowlerNameMap.set(b.bowlerName.toLowerCase(), b.bowlerID);
  }
  for (const a of altRows) {
    bowlerNameMap.set(a.alternateName.toLowerCase(), a.bowlerID);
  }

  function resolveBowlerID(name) {
    const id = bowlerNameMap.get(name.toLowerCase());
    if (id) return id;
    return null;
  }

  // 3. Teams: franchise name per season → teamID via teamNameHistory
  const teamHistoryRows = (await pool.request().query(
    'SELECT teamID, seasonID, teamName FROM teamNameHistory'
  )).recordset;
  const teamRows = (await pool.request().query(
    'SELECT teamID, teamName FROM teams'
  )).recordset;

  // seasonID + lowercase team name → teamID
  const teamSeasonMap = new Map();
  for (const t of teamHistoryRows) {
    teamSeasonMap.set(`${t.seasonID}-${t.teamName.toLowerCase()}`, t.teamID);
  }
  // Canonical name fallback
  const teamCanonicalMap = new Map();
  for (const t of teamRows) {
    teamCanonicalMap.set(t.teamName.toLowerCase(), t.teamID);
  }

  function resolveTeamID(franchise, seasonID) {
    const lower = franchise.toLowerCase();
    // Try exact match on teamNameHistory for this season
    const key = `${seasonID}-${lower}`;
    const id = teamSeasonMap.get(key);
    if (id) return id;
    // Try alias
    const alias = FRANCHISE_ALIASES[lower];
    if (alias) {
      const aliasKey = `${seasonID}-${alias}`;
      const aliasId = teamSeasonMap.get(aliasKey);
      if (aliasId) return aliasId;
      // Try canonical with alias
      const canonId = teamCanonicalMap.get(alias);
      if (canonId) return canonId;
    }
    // Fallback to canonical
    return teamCanonicalMap.get(lower) || null;
  }

  // Wipe if requested
  if (WIPE && !DRY_RUN) {
    const types = ['MensScratch', 'WomensScratch', 'Handicap'];
    const del = await pool.request().query(
      `DELETE FROM seasonChampions WHERE championshipType IN ('MensScratch', 'WomensScratch', 'Handicap')`
    );
    console.log(`Wiped ${del.rowsAffected[0]} individual champion rows\n`);
  }

  // Insert
  let inserted = 0;
  const errors = [];

  for (const row of rows) {
    const seasonID = resolveSeasonID(row.year, row.period);
    if (!seasonID) {
      errors.push(`No seasonID for year=${row.year} period=${row.period}`);
      continue;
    }

    const bowlerID = resolveBowlerID(row.winner);
    if (!bowlerID) {
      errors.push(`No bowlerID for "${row.winner}"`);
      continue;
    }

    const teamID = resolveTeamID(row.franchise, seasonID);
    if (!teamID) {
      errors.push(`No teamID for "${row.franchise}" in season ${seasonID}`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`[DRY] seasonChampions: season=${seasonID} (${row.year} ${row.period || 'full'}), type=${row.championshipType}, bowler=${row.winner} (${bowlerID}), team=${row.franchise} (${teamID})`);
      inserted++;
    } else {
      await pool.request()
        .input('seasonID', sql.Int, seasonID)
        .input('championshipType', sql.VarChar, row.championshipType)
        .input('winnerBowlerID', sql.Int, bowlerID)
        .input('winnerTeamID', sql.Int, teamID)
        .query(`
          INSERT INTO seasonChampions (seasonID, championshipType, winnerBowlerID, winnerTeamID)
          SELECT @seasonID, @championshipType, @winnerBowlerID, @winnerTeamID
          WHERE NOT EXISTS (
            SELECT 1 FROM seasonChampions
            WHERE seasonID = @seasonID AND championshipType = @championshipType
          )
        `);
      inserted++;
    }
  }

  if (errors.length > 0) {
    console.log(`\n=== ERRORS (${errors.length}) ===`);
    for (const e of errors) console.log(`  ${e}`);
  }

  console.log(`\n${DRY_RUN ? 'Would insert' : 'Inserted'} ${inserted} individual champion rows`);

  if (!DRY_RUN) {
    const v = await pool.request().query(
      `SELECT championshipType, COUNT(*) as cnt FROM seasonChampions WHERE championshipType IN ('MensScratch', 'WomensScratch', 'Handicap') GROUP BY championshipType`
    );
    console.log('\nVerification:');
    for (const r of v.recordset) {
      console.log(`  ${r.championshipType}: ${r.cnt} rows`);
    }

    // Bump data versions for all affected seasons so queries invalidate
    const affectedSeasons = new Set(rows.map(r => resolveSeasonID(r.year, r.period)).filter(Boolean));
    for (const sid of affectedSeasons) {
      bumpDataVersion('scores', sid);
    }
  }

  await pool.close();
}

main().catch(e => { console.error(e); process.exit(1); });
