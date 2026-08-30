#!/usr/bin/env node
/**
 * check-data-integrity.mjs
 *
 * Asserts the data invariants in scripts/lib/data-invariants.mjs against the
 * live database. Exits 1 on any violation, so it can gate.
 *
 * Run: node scripts/check-data-integrity.mjs
 *      node scripts/check-data-integrity.mjs --quiet   # only report failures
 *
 * Why this exists as a NEW script rather than exit codes bolted onto the
 * existing ones: of the 15 guards in scripts/, only a handful actually fail on
 * findings. Most print a report and exit 0, and several of those are
 * deliberately heuristic (fuzzy name matching, week-over-week average jumps
 * above a threshold) where findings are expected and need a human to judge
 * them. Forcing those to gate would make a scheduled run noisy, and a noisy
 * check is one everybody learns to ignore. They stay review tools. This holds
 * only conditions that are always a bug.
 *
 * Every query was run against production and confirmed to return zero before
 * being included. See the notes in data-invariants.mjs for the three
 * plausible-looking checks that did NOT hold and were dropped.
 *
 * Deliberately light on the database: 17 counting queries on one connection,
 * sequentially. Azure SQL Basic is 5 DTU, and a scheduled check that puts the
 * database under load is a check that causes outages instead of catching them.
 */

import sql from 'mssql';
import { loadEnv } from './lib/load-env.mjs';
import { INVARIANTS, evaluate } from './lib/data-invariants.mjs';

const QUIET = process.argv.includes('--quiet');

async function main() {
  const pool = await sql.connect(loadEnv());
  const findings = [];

  console.log(`\nData integrity: ${INVARIANTS.length} invariants\n`);

  try {
    for (const invariant of INVARIANTS) {
      let count;
      try {
        const res = await pool.request().query(invariant.sql);
        count = res.recordset[0]?.n ?? 0;
      } catch (err) {
        findings.push({
          name: invariant.name,
          message: `${invariant.name}: query failed: ${err.message}`,
        });
        console.log(`  ERR  ${invariant.name}`);
        continue;
      }

      const finding = evaluate(invariant, count);
      if (finding) {
        findings.push(finding);
        console.log(`  FAIL ${invariant.name.padEnd(38)} ${finding.actual}`);
      } else if (!QUIET) {
        console.log(`  ok   ${invariant.name}`);
      }
    }
  } finally {
    await pool.close();
  }

  if (findings.length === 0) {
    console.log(`\nAll ${INVARIANTS.length} invariants hold.\n`);
    process.exit(0);
  }

  console.log(`\n${findings.length} violation(s):\n`);
  for (const f of findings) console.log(`  ${f.message}`);
  console.log('');
  process.exit(1);
}

main().catch((err) => {
  // A connection or credential failure must not look like clean data.
  console.error(`\ncheck-data-integrity failed to run: ${err.message}\n`);
  process.exit(2);
});
