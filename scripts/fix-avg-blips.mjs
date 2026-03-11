#!/usr/bin/env node
/**
 * Fix 110 isolated incomingAvg blips (one-off typos by league secretary).
 *
 * Each row was identified by audit-averages.mjs + audit-context.mjs:
 *   - Stored avg is 4+ pins off from 27-game rolling average
 *   - Weeks before and after are clean (0-1 pin off)
 *   - Excludes Seasons I-III, Denis Webb, early career, sustained/cascading patterns
 *
 * Usage:
 *   node scripts/fix-avg-blips.mjs              # Dry run (default)
 *   node scripts/fix-avg-blips.mjs --apply      # Apply changes
 *
 * After applying:
 *   1. Re-run populate-match-results.mjs --wipe for affected seasons
 *   2. Re-run calculate-patches.mjs
 *   3. Clear query cache and deploy
 */
import sql from 'mssql';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const config = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 60000 },
};

const apply = process.argv.includes('--apply');

// All 110 blips: [bowlerName, seasonDisplayName, week, currentStoredAvg, correctAvg]
const blips = [
  // 10+ pins (18 + 5 reclassified = 23)
  ['Sarah Carrier', 'Spring 2014', 5, 133, 87],
  ['Emma Allott', 'Fall 2013', 5, 121, 94],
  ['Kamal Bennoune', 'Spring 2014', 3, 104, 126],
  ['Steve Dalton', 'Spring 2011', 2, 106, 128],
  ['Nick Cain', 'Fall 2018', 7, 127, 145],
  ['McGregor Bell', 'Fall 2013', 5, 110, 127],
  ['Dave McDonald', 'Fall 2014', 1, 120, 136],
  ['Nathan McKinney', 'Spring 2016', 4, 119, 135],
  ['Sven Johnson', 'Fall 2013', 5, 94, 109],
  ['Mark Oates', 'Fall 2016', 2, 146, 160],
  ['Bridget Fletcher', 'Spring 2016', 4, 129, 116],
  ['Emmet Furlong', 'Fall 2016', 6, 135, 123],
  ['Paul Cardillo', 'Spring 2013', 6, 139, 127],
  ['Bobby Hundley', 'Fall 2012', 6, 139, 128],
  ['Dave Shaw', 'Spring 2014', 1, 115, 126],
  ['Alix Bowman', 'Spring 2013', 6, 111, 121],
  ['Cameron Dye', 'Fall 2022', 1, 198, 208],
  ['Jeff Camarati', 'Fall 2022', 8, 98, 108],
  // Reclassified from excluded
  ['Brian Williams', 'Fall 2012', 9, 123, 153],
  ['Thom Wiley', 'Fall 2012', 9, 154, 125],
  ['Rob Mossefin', 'Spring 2016', 4, 117, 132],
  ['Kellie Gates', 'Fall 2013', 6, 140, 125],
  ['Kellie Gates', 'Spring 2014', 1, 127, 137],

  // 6-9 pins (15)
  ['Dave McDonald', 'Fall 2019', 2, 136, 127],
  ['Genevieve d\'Entremont', 'Spring 2014', 3, 129, 120],
  ['Harper Gordek', 'Spring 2016', 9, 138, 147],
  ['Jason Jones', 'Fall 2021', 2, 160, 169],
  ['Melissa Adams', 'Spring 2016', 9, 70, 61],
  ['Renee Rendahl', 'Spring 2016', 2, 112, 103],
  ['Alix Bowman', 'Spring 2014', 3, 115, 123],
  ['Nate Sisco', 'Spring 2016', 9, 193, 185],
  ['Eric Thomas', 'Fall 2016', 6, 173, 166],
  ['Julie Thomson', 'Fall 2012', 5, 121, 128],
  ['Ted Glick', 'Spring 2018', 1, 141, 134],
  ['Barrett Jorgensen', 'Fall 2025', 1, 162, 168],
  ['Graham Killion', 'Fall 2017', 7, 175, 169],
  ['Kristie Porter', 'Spring 2023', 2, 144, 150],
  ['Seth Horton', 'Fall 2024', 1, 122, 128],

  // 4-5 pins (72)
  ['Antonio Fields', 'Spring 2012', 9, 122, 127],
  ['Betsy Thomas', 'Fall 2018', 2, 118, 113],
  ['Bill Verner', 'Fall 2015', 1, 130, 125],
  ['Brent Arnold', 'Fall 2022', 2, 149, 144],
  ['Brian Delk', 'Spring 2020', 1, 193, 188],
  ['Chuck Samuels', 'Spring 2020', 1, 138, 133],
  ['Dave Bjorkback', 'Spring 2016', 1, 133, 128],
  ['Enrico Boarati', 'Spring 2016', 9, 142, 147],
  ['Eric Thomas', 'Spring 2017', 5, 161, 166],
  ['Fikri Yucel', 'Spring 2018', 1, 125, 120],
  ['Forrest DeMarcus', 'Spring 2020', 1, 138, 143],
  ['Geoffrey Berry', 'Spring 2016', 9, 178, 173],
  ['Harper Gordek', 'Spring 2020', 1, 148, 143],
  ['Jack Driver', 'Spring 2020', 1, 161, 156],
  ['James Mwalali', 'Fall 2024', 1, 122, 117],
  ['Joe Brogan', 'Spring 2025', 1, 131, 136],
  ['John Williams', 'Spring 2015', 2, 153, 158],
  ['Kristin Pearson', 'Spring 2020', 1, 145, 140],
  ['Mark Koyanagi', 'Fall 2011', 1, 171, 166],
  ['Matt Vogt', 'Fall 2022', 2, 116, 121],
  ['Matt Vogt', 'Spring 2023', 5, 131, 136],
  ['Michael Daul', 'Fall 2025', 1, 130, 135],
  ['Nate Sisco', 'Fall 2022', 8, 195, 190],
  ['Paul Marsh', 'Spring 2016', 9, 169, 174],
  ['Scott Waldowski', 'Fall 2023', 1, 131, 126],
  ['Spott Philpott', 'Fall 2011', 1, 177, 172],
  ['Terrence Chambers', 'Fall 2024', 1, 176, 171],
  ['Tracy Wills', 'Fall 2016', 6, 144, 139],
  ['Alison Trott', 'Fall 2025', 1, 126, 122],
  ['Amy Kostrewa', 'Fall 2015', 6, 155, 151],
  ['Amy Kostrewa', 'Fall 2019', 4, 145, 149],
  ['Ash Bowie', 'Fall 2023', 1, 112, 108],
  ['Barrett Jorgensen', 'Fall 2024', 1, 139, 143],
  ['Ben Wilson', 'Fall 2025', 1, 126, 130],
  ['Brooke Insley', 'Spring 2017', 2, 129, 125],
  ['Brooke Insley', 'Spring 2020', 1, 141, 137],
  ['Cameron Dye', 'Fall 2024', 1, 168, 172],
  ['Chris Klindt', 'Fall 2022', 2, 170, 174],
  ['Chuck Samuels', 'Spring 2025', 1, 135, 131],
  ['Dave Bjorkback', 'Fall 2018', 3, 121, 125],
  ['Dave Graedon', 'Spring 2012', 9, 142, 146],
  ['Dave Graedon', 'Spring 2022', 4, 138, 134],
  ['Enrico Boarati', 'Fall 2017', 7, 175, 171],
  ['Fikri Yucel', 'Spring 2020', 1, 126, 130],
  ['Forrest DeMarcus', 'Fall 2019', 1, 136, 132],
  ['Forrest DeMarcus', 'Fall 2022', 2, 146, 142],
  ['Fred Cooley', 'Fall 2023', 1, 171, 167],
  ['Geoffrey Berry II', 'Fall 2023', 5, 118, 114],
  ['Hattie Pink', 'Fall 2016', 6, 77, 81],
  ['James Cartwright', 'Fall 2011', 1, 147, 143],
  ['James Hepler', 'Fall 2011', 1, 149, 145],
  ['Jim Haverkamp', 'Fall 2011', 1, 114, 118],
  ['Jim Haverkamp', 'Fall 2012', 9, 126, 122],
  ['Joe Brogan', 'Fall 2024', 1, 117, 113],
  ['John Terribili', 'Fall 2025', 1, 137, 133],
  ['Justin Faerber', 'Spring 2016', 9, 150, 154],
  ['Justin Sacco', 'Spring 2025', 1, 112, 116],
  ['Karen Merowchek', 'Spring 2012', 9, 142, 138],
  ['Kelly Farrell', 'Fall 2016', 6, 118, 114],
  ['Kim Walker', 'Spring 2012', 9, 85, 89],
  ['Kristie Porter', 'Spring 2017', 7, 145, 141],
  ['Kristine Pryzgoda', 'Spring 2016', 9, 130, 126],
  ['Matt Tauch', 'Fall 2023', 1, 145, 141],
  ['Matt Vogt', 'Spring 2022', 1, 120, 116],
  ['Melissa Lee', 'Spring 2025', 1, 132, 128],
  ['Norwood Cheek', 'Fall 2025', 1, 144, 148],
  ['Patrick Nerz', 'Fall 2019', 4, 130, 134],
  ['Scott Jeffries', 'Fall 2022', 1, 161, 157],
  ['Tino McCullough', 'Fall 2016', 6, 138, 142],
  ['Tracy Wills', 'Fall 2022', 8, 135, 139],
  ['Vance Woods', 'Fall 2023', 1, 156, 152],
  ['Vance Woods', 'Fall 2025', 1, 151, 155],
];

async function main() {
  const pool = await sql.connect(config);

  console.log(apply ? 'APPLYING fixes...\n' : 'DRY RUN (use --apply to execute)\n');

  // Pre-load bowler name->ID and season displayName->ID lookups
  const bowlerLookup = new Map();
  const bRes = await pool.request().query('SELECT bowlerID, bowlerName FROM bowlers');
  for (const r of bRes.recordset) bowlerLookup.set(r.bowlerName, r.bowlerID);

  const seasonLookup = new Map();
  const sRes = await pool.request().query('SELECT seasonID, displayName FROM seasons');
  for (const r of sRes.recordset) seasonLookup.set(r.displayName, r.seasonID);

  let updated = 0;
  let skipped = 0;
  let mismatch = 0;
  let notFound = 0;
  const affectedSeasonIDs = new Set();
  const affectedBowlerIDs = new Set();

  console.log('Bowler                     Season         Wk  Old -> New  Diff  Status');
  console.log('-------------------------  -------------  --  ---------  ----  ------');

  for (const [name, season, week, oldAvg, newAvg] of blips) {
    const bowlerID = bowlerLookup.get(name);
    const seasonID = seasonLookup.get(season);
    const diff = oldAvg - newAvg;
    const diffStr = (diff > 0 ? '+' : '') + diff;

    const line = `${name.padEnd(25)}  ${season.padEnd(13)}  ${String(week).padStart(2)}  ${String(oldAvg).padStart(3)} -> ${String(newAvg).padStart(3)}  ${diffStr.padStart(4)}`;

    if (!bowlerID) {
      console.log(`${line}  BOWLER NOT FOUND`);
      notFound++;
      continue;
    }
    if (!seasonID) {
      console.log(`${line}  SEASON NOT FOUND`);
      notFound++;
      continue;
    }

    // Look up the score row
    const check = await pool.request()
      .input('bowlerID', sql.Int, bowlerID)
      .input('seasonID', sql.Int, seasonID)
      .input('week', sql.Int, week)
      .query('SELECT scoreID, incomingAvg FROM scores WHERE bowlerID = @bowlerID AND seasonID = @seasonID AND week = @week AND isPenalty = 0');

    if (check.recordset.length === 0) {
      console.log(`${line}  ROW NOT FOUND`);
      notFound++;
      continue;
    }

    const row = check.recordset[0];
    const currentAvg = parseFloat(row.incomingAvg);

    if (currentAvg === newAvg) {
      console.log(`${line}  ALREADY FIXED`);
      skipped++;
      affectedSeasonIDs.add(seasonID);
      affectedBowlerIDs.add(bowlerID);
      continue;
    }

    if (currentAvg !== oldAvg) {
      console.log(`${line}  MISMATCH (current=${currentAvg})`);
      mismatch++;
      continue;
    }

    if (apply) {
      await pool.request()
        .input('scoreID', sql.Int, row.scoreID)
        .input('newAvg', sql.Int, newAvg)
        .query('UPDATE scores SET incomingAvg = @newAvg WHERE scoreID = @scoreID');
      console.log(`${line}  UPDATED`);
    } else {
      console.log(`${line}  PENDING`);
    }

    updated++;
    affectedSeasonIDs.add(seasonID);
    affectedBowlerIDs.add(bowlerID);
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total blips:     ${blips.length}`);
  console.log(`${apply ? 'Updated' : 'Pending'}:        ${updated}`);
  console.log(`Already fixed:   ${skipped}`);
  console.log(`Mismatched:      ${mismatch}`);
  console.log(`Not found:       ${notFound}`);

  // Show affected seasons for match results recalc
  const affectedSeasons = [...affectedSeasonIDs].sort((a, b) => a - b);
  const seasonNames = [];
  for (const [name, id] of seasonLookup) {
    if (affectedSeasonIDs.has(id)) seasonNames.push({ id, name });
  }
  seasonNames.sort((a, b) => a.id - b.id);

  console.log(`\nAffected seasons (${affectedSeasons.length}):`);
  for (const s of seasonNames) {
    console.log(`  ${s.name} (ID: ${s.id})`);
  }

  console.log(`\nAffected bowlers: ${affectedBowlerIDs.size}`);

  if (apply && updated > 0) {
    console.log('\n=== NEXT STEPS ===');
    console.log('1. Re-run match results for affected seasons:');
    for (const s of seasonNames) {
      console.log(`   node scripts/populate-match-results.mjs --wipe --season=${s.id}`);
    }
    console.log('2. Re-run patches: node scripts/calculate-patches.mjs');
    console.log('3. Clear query cache and deploy');
  }

  await pool.close();
}

main().catch(err => { console.error(err); process.exit(1); });
