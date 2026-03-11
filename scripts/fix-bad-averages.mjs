#!/usr/bin/env node
/**
 * Fix known bad incomingAvg values identified by audit.
 *
 * Category 1: Impossible values (avg > 225, negative handicap)
 * Category 2: Averages shuffled within teams in source CSV
 *
 * For each fix, the correct avg is determined by:
 *   1. Cross-referencing the CSV handicap column (ground truth from league sheets)
 *   2. Confirming with 27-game rolling avg recomputation
 *   Where they agree, that's the value. Where they differ, CSV handicap wins.
 *
 * Usage:
 *   node scripts/fix-bad-averages.mjs --dry-run    # Preview changes (default)
 *   node scripts/fix-bad-averages.mjs --apply       # Apply changes
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

// Each fix: scoreID, bowlerName, context, oldAvg, newAvg, source
const fixes = [
  // Category 1: Impossible values
  {
    scoreID: 14541,
    bowler: "Morgan Ellis",
    context: "Spring 2014 Wk 7",
    oldAvg: 256,
    newAvg: 156, // CSV HCP=65 → FLOOR((225-156)*0.95)=65 ✓
    source: "CSV handicap implies avg=156 (HCP=65)",
  },
  {
    scoreID: 14542,
    bowler: "McGregor Bell",
    context: "Spring 2014 Wk 7",
    oldAvg: 238,
    newAvg: 128, // CSV HCP=92, recomputed=128 → FLOOR((225-128)*0.95)=92 ✓
    source: "CSV handicap (HCP=92) and recomputed (128) both agree",
  },
  // Category 2: Guttersnipes — Spring 2016 Wk 9 (averages shuffled in source CSV)
  {
    scoreID: 11956,
    bowler: "Emmet Furlong",
    context: "Spring 2016 Wk 9",
    oldAvg: 62,
    newAvg: 122, // CSV HCP=98 → avg≈121; recomputed=122. Use 122 (≈1 pin from HCP)
    source: "Recomputed=122, CSV HCP=98 implies 121 (1-pin rounding diff)",
  },
  {
    scoreID: 11957,
    bowler: "Jim Haverkamp",
    context: "Spring 2016 Wk 9",
    oldAvg: 122,
    newAvg: 137, // CSV HCP=83, recomputed=137 → FLOOR((225-137)*0.95)=83 ✓
    source: "CSV handicap (HCP=83) and recomputed (137) both agree",
  },
  {
    scoreID: 11955,
    bowler: "Melissa Adams",
    context: "Spring 2016 Wk 9",
    oldAvg: 104,
    newAvg: 70, // CSV HCP=147 → FLOOR((225-70)*0.95)=147 ✓; recomputed=61 (diff formula)
    source: "CSV handicap implies avg=70 (HCP=147); recomputed=61 differs, trust league sheet",
  },
  {
    scoreID: 11954,
    bowler: "Ben Riseling",
    context: "Spring 2016 Wk 9",
    oldAvg: 99,
    newAvg: 103, // CSV HCP=115 → FLOOR((225-103)*0.95)=115 ✓; recomputed=103 ✓
    source: "CSV handicap (HCP=115) and recomputed (103) both agree",
  },
  // Category 2: Boom Kings — Spring 2016 Wk 8 (averages shuffled in source CSV)
  {
    scoreID: 11873,
    bowler: "Scott Jeffries",
    context: "Spring 2016 Wk 8",
    oldAvg: 130,
    newAvg: 156, // CSV HCP=65 → FLOOR((225-156)*0.95)=65 ✓; recomputed=156 ✓
    source: "CSV handicap (HCP=65) and recomputed (156) both agree",
  },
  {
    scoreID: 11876,
    bowler: "Tony Lawrence",
    context: "Spring 2016 Wk 8",
    oldAvg: 148,
    newAvg: 176, // CSV HCP=46 → FLOOR((225-176)*0.95)=46 ✓; recomputed=176 ✓
    source: "CSV handicap (HCP=46) and recomputed (176) both agree",
  },
  {
    scoreID: 11874,
    bowler: "Harper Gordek",
    context: "Spring 2016 Wk 8",
    oldAvg: 156,
    newAvg: 148, // CSV HCP=73 → FLOOR((225-148)*0.95)=73 ✓; recomputed=148 ✓
    source: "CSV handicap (HCP=73) and recomputed (148) both agree",
  },
  // Kristine Pryzgoda Spring 2016 Wk 8: stored=130, recomputed=130, HCP=90 ✓ — no fix needed
];

async function main() {
  const pool = await sql.connect(config);

  console.log(apply ? "APPLYING fixes...\n" : "DRY RUN — preview only (use --apply to execute)\n");

  console.log("Bowler                  Context              Old → New   Source");
  console.log("----------------------  -------------------  ---------  ------");

  for (const fix of fixes) {
    console.log(
      `${fix.bowler.padEnd(22)}  ${fix.context.padEnd(19)}  ${String(fix.oldAvg).padStart(3)} → ${String(fix.newAvg).padStart(3)}   ${fix.source}`
    );

    if (apply) {
      // Verify the row exists with expected old value
      const check = await pool.request()
        .input("scoreID", fix.scoreID)
        .query("SELECT incomingAvg FROM scores WHERE scoreID = @scoreID");

      if (check.recordset.length === 0) {
        console.log(`  ⚠ scoreID ${fix.scoreID} NOT FOUND — skipping`);
        continue;
      }

      const currentAvg = parseFloat(check.recordset[0].incomingAvg);
      if (currentAvg !== fix.oldAvg) {
        console.log(`  ⚠ Current avg is ${currentAvg}, expected ${fix.oldAvg} — skipping`);
        continue;
      }

      await pool.request()
        .input("scoreID", fix.scoreID)
        .input("newAvg", fix.newAvg)
        .query("UPDATE scores SET incomingAvg = @newAvg WHERE scoreID = @scoreID");

      console.log(`  ✓ Updated`);
    }
  }

  if (apply) {
    console.log(`\n✓ ${fixes.length} rows updated.`);
    console.log("\nRemember to invalidate cached queries for affected bowlers:");
    console.log("  find .next/cache/sql/ -name '*RollingAvg*' -delete");
    console.log("  find .next/cache/sql/ -name '*CareerSummary*' -delete");
  } else {
    console.log(`\n${fixes.length} fixes pending. Run with --apply to execute.`);
  }

  await pool.close();
}

main().catch(err => { console.error(err); process.exit(1); });
