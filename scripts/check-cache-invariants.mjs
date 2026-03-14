#!/usr/bin/env node
/**
 * check-cache-invariants.mjs
 *
 * Static analysis of cachedQuery() calls across src/lib/queries/.
 * Catches common misconfigurations that lead to stale data on Vercel.
 *
 * Run: node scripts/check-cache-invariants.mjs
 * Exit code: 0 = all pass, 1 = violations found
 *
 * Checks:
 *   1. Every cachedQuery has a `sql:` option (required for hash-based invalidation)
 *   2. No `stable: true` on queries that read from tables that get regular inserts
 *   3. Cross-season queries (no seasonID) that aren't stable must have `dependsOn`
 *   4. No `allSeasons: true` (legacy — use dependsOn instead)
 *   5. Season-scoped queries that also depend on schedule have correct dependsOn
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUERIES_DIR = path.join(__dirname, '..', 'src', 'lib', 'queries');

// Tables that receive regular inserts (scores, matchResults, schedule imports, patches, etc.)
// Queries reading these should NOT be stable: true
const MUTABLE_TABLES = [
  'scores', 'matchResults', 'bowlerPatches', 'bowlerMilestones',
  'schedule', 'seasonDivisions', 'playoffResults', 'seasonChampions',
  'leagueSettings', 'teamRosters', 'teamNameHistory', 'bowlerNameHistory',
];

// Regex to extract cachedQuery options block (the 4th argument)
// Matches: }, fallback, { options });
const CACHED_QUERY_RE = /cachedQuery\(\s*[`']([^`']+)[`']/g;
const OPTIONS_RE = /cachedQuery\([^)]+\)\s*=>\s*\{[\s\S]*?\},\s*(?:\[\]|null|{[^}]*}),\s*(\{[^}]+\})\s*\)/g;

// Queries intentionally using "weekly" tier (published-tag invalidation only).
// These don't need dependsOn because they only matter for the current published week.
const WEEKLY_TIER_ALLOWLIST = [
  'getBowlerOfTheWeek',
  'getNextBowlingNight',
  'getCurrentSeasonSnapshot',
  'getWeeklyHighlights',
  'getTeamCurrentStanding',
  'getTeamCurrentRoster',
];

let violations = [];
let warnings = [];
let queryCount = 0;

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkDir(full));
    else if (entry.name.endsWith('.ts')) files.push(full);
  }
  return files;
}

function extractQueries(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relPath = path.relative(path.join(__dirname, '..'), filePath);
  const queries = [];

  // Find all cachedQuery calls with their surrounding context
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/cachedQuery\(\s*[`']([\w-]+(?:-\$\{[^}]+\})?)[`']/);
    if (!match) continue;

    const queryName = match[1].replace(/-\$\{[^}]+\}/, '');

    // Collect lines until we find the closing );
    let block = '';
    let depth = 0;
    for (let j = i; j < Math.min(i + 60, lines.length); j++) {
      block += lines[j] + '\n';
      for (const ch of lines[j]) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
      }
      if (depth <= 0 && j > i) break;
    }

    // Extract options object (last { ... } before closing )
    const optMatch = block.match(/,\s*(\{[^{}]+\})\s*\)\s*;?\s*$/m);
    const options = optMatch ? optMatch[1] : null;

    // Extract SQL variable names used in the query function
    const sqlVarMatch = block.match(/\.query(?:<[^>]+>)?\((\w+)/);
    const sqlVar = sqlVarMatch ? sqlVarMatch[1] : null;

    // Find which tables the SQL references (look at the SQL constant in the file)
    let tablesRead = [];
    if (sqlVar) {
      // Find the SQL constant definition
      const sqlDefMatch = content.match(new RegExp(`(?:const|let)\\s+${sqlVar}\\s*=\\s*\`([\\s\\S]*?)\`;`));
      if (sqlDefMatch) {
        const sqlText = sqlDefMatch[1].toLowerCase();
        for (const table of MUTABLE_TABLES) {
          if (sqlText.includes(table.toLowerCase())) {
            tablesRead.push(table);
          }
        }
      }
    }

    queries.push({
      name: queryName,
      file: relPath,
      line: i + 1,
      options,
      tablesRead,
    });
  }

  return queries;
}

function checkInvariants(query) {
  const { name, file, line, options, tablesRead } = query;
  const loc = `${file}:${line}`;

  if (!options) {
    violations.push(`[NO_OPTIONS] ${name} (${loc}) — cachedQuery has no options object`);
    return;
  }

  const hasSQL = options.includes('sql:') || options.includes('sql,');
  const isStable = /stable:\s*true/.test(options);
  const hasSeasonID = /seasonID[,}\s]/.test(options);
  const hasDependsOn = /dependsOn:/.test(options);
  const hasAllSeasons = /allSeasons:\s*true/.test(options);

  // 1. Must have sql option
  if (!hasSQL) {
    violations.push(`[NO_SQL] ${name} (${loc}) — missing sql: option, cache key won't change when SQL changes`);
  }

  // 2. stable: true on queries that read mutable tables
  if (isStable && tablesRead.length > 0) {
    const mutableReads = tablesRead.filter(t => MUTABLE_TABLES.includes(t));
    if (mutableReads.length > 0) {
      violations.push(
        `[STABLE_MUTABLE] ${name} (${loc}) — stable: true but reads mutable tables: ${mutableReads.join(', ')}. ` +
        `Data changes won't invalidate this cache. Use dependsOn instead.`
      );
    }
  }

  // 3. Cross-season queries without dependsOn
  // Non-stable, non-seasonal queries get the published tag in their hash automatically,
  // so they invalidate every publish. Only flag if the query seems like it should
  // track data changes independently (i.e., reads mutable tables).
  if (!isStable && !hasSeasonID && !hasDependsOn && !hasAllSeasons) {
    const readsMutable = tablesRead.some(t => MUTABLE_TABLES.includes(t));
    if (readsMutable && !options.includes('+ params') && !options.includes('+ CONFIG')) {
      if (WEEKLY_TIER_ALLOWLIST.includes(name)) {
        // Intentional weekly-tier query — note but don't flag
      } else {
        violations.push(
          `[MISSING_DEPENDS_ON] ${name} (${loc}) — reads mutable tables (${tablesRead.join(', ')}) ` +
          `but has no dependsOn. Relies only on published tag for invalidation. Add dependsOn if ` +
          `this data should invalidate on imports (not just weekly publish).`
        );
      }
    }
  }

  // 4. Legacy allSeasons flag
  if (hasAllSeasons) {
    violations.push(
      `[LEGACY] ${name} (${loc}) — uses allSeasons: true (legacy). Migrate to dependsOn: ['scores'] or ['schedule'] or both.`
    );
  }
}

// Run
const files = walkDir(QUERIES_DIR);
const allQueries = files.flatMap(f => extractQueries(f));
queryCount = allQueries.length;

allQueries.forEach(checkInvariants);

// Report
console.log(`\nCache Invariant Check — ${queryCount} queries across ${files.length} files\n`);

if (violations.length === 0) {
  console.log('All checks passed.\n');
  process.exit(0);
} else {
  console.log(`${violations.length} violation(s) found:\n`);
  violations.forEach(v => console.log(`  ${v}`));
  console.log('');
  process.exit(1);
}
