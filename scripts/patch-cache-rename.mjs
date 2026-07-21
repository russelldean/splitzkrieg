#!/usr/bin/env node
/**
 * ONE-SHOT cache patch: "Allan Fast" -> "Alan Fast" (bowlerID 16).
 *
 * The DB was renamed 2026-07-20 (bowlerName + slug, with "Allan Fast" recorded in
 * bowlerNameHistory). Cached query JSON still carries the old spelling, because
 * cachedQuery() denormalizes names and slugs into per-season payloads that a plain
 * rebuild will not re-fetch.
 *
 * Per memory/feedback_rename_workflow.md: string-replace the cache in place rather
 * than bumping data versions. Bumping would force wide re-querying and risks the
 * Azure 30-connection cap.
 *
 * TO RUN IT (during the next publish deploy):
 *   1. package.json  "build": "node scripts/patch-cache-rename.mjs --write && next build"
 *      (the --write is required; without it the script only reports and changes nothing)
 *   2. commit + push, wait for the Vercel build to succeed, spot-check the live site
 *   3. follow-up commit: restore "build": "next build" and delete this file
 *
 * Safe to run repeatedly and safe when it matches nothing.
 * Dry run by default; pass --write to modify files.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const WRITE = process.argv.includes('--write');
const CACHE_DIRS = ['.next/cache/sql/v1', '.next/cache/sql/stable'];

// Quoted so we only ever hit whole JSON string values, never a substring of
// some longer name. Both strings are distinctive enough to be collision-free.
const REPLACEMENTS = [
  ['"Allan Fast"', '"Alan Fast"'],
  ['"allan-fast"', '"alan-fast"'],
];

let filesScanned = 0, filesChanged = 0, totalHits = 0;

for (const dir of CACHE_DIRS) {
  if (!existsSync(dir)) { console.log(`skip (missing): ${dir}`); continue; }
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    const path = join(dir, name);
    const before = readFileSync(path, 'utf8');
    let after = before, hits = 0;
    for (const [from, to] of REPLACEMENTS) {
      const n = after.split(from).length - 1;
      if (n) { after = after.split(from).join(to); hits += n; }
    }
    filesScanned++;
    if (!hits) continue;
    filesChanged++; totalHits += hits;
    console.log(`${WRITE ? 'patched' : 'would patch'}  ${name}  (${hits} replacement${hits === 1 ? '' : 's'})`);
    if (WRITE) {
      JSON.parse(after); // fail loudly rather than write corrupt JSON
      writeFileSync(path, after);
    }
  }
}

console.log(`\n${filesScanned} file(s) scanned, ${filesChanged} changed, ${totalHits} replacement(s).`);
if (!WRITE) console.log('DRY RUN. Pass --write to apply (the build hook should pass it).');
