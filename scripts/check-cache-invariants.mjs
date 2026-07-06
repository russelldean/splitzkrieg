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
  'playoffScores',
];

// Matches the cachedQuery key so we can find each call + its name. The full
// call (fn body + options) is then parsed with a string-aware scanner below,
// NOT a fixed line window — long function bodies used to truncate and produce
// false NO_OPTIONS / NO_SQL reports.
const CACHED_QUERY_NAME_RE = /cachedQuery\(\s*[`']([\w-]+(?:-\$\{[^}]+\})?)[`']/g;

// Skip a string/template literal starting at index i (s[i] is the quote).
// Returns the index of the closing quote. Template ${...} exprs are treated as
// opaque text, which is safe here (no nested backticks in these query files).
function skipString(s, i) {
  const q = s[i];
  for (let k = i + 1; k < s.length; k++) {
    if (s[k] === '\\') { k++; continue; }
    if (s[k] === q) return k;
  }
  return s.length - 1;
}

// Given the index of an opening '(', return the index of its matching ')',
// skipping strings and comments so parens inside SQL/text don't miscount.
function findMatchingParen(s, open) {
  let depth = 0;
  for (let k = open; k < s.length; k++) {
    const c = s[k];
    if (c === "'" || c === '"' || c === '`') { k = skipString(s, k); continue; }
    if (c === '/' && s[k + 1] === '/') { const e = s.indexOf('\n', k); k = e === -1 ? s.length : e; continue; }
    if (c === '/' && s[k + 1] === '*') { const e = s.indexOf('*/', k + 2); k = e === -1 ? s.length : e + 1; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return k; }
  }
  return -1;
}

// Split a cachedQuery argument list into top-level arguments, respecting
// nested (), {}, [], strings, and comments.
function splitTopLevelArgs(s) {
  const args = [];
  let depth = 0, start = 0;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (c === "'" || c === '"' || c === '`') { k = skipString(s, k); continue; }
    if (c === '/' && s[k + 1] === '/') { const e = s.indexOf('\n', k); k = e === -1 ? s.length : e; continue; }
    if (c === '/' && s[k + 1] === '*') { const e = s.indexOf('*/', k + 2); k = e === -1 ? s.length : e + 1; continue; }
    if (c === '(' || c === '{' || c === '[') depth++;
    else if (c === ')' || c === '}' || c === ']') depth--;
    else if (c === ',' && depth === 0) { args.push(s.slice(start, k).trim()); start = k + 1; }
  }
  args.push(s.slice(start).trim());
  return args;
}

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

  const re = new RegExp(CACHED_QUERY_NAME_RE.source, 'g');
  let match;
  while ((match = re.exec(content)) !== null) {
    const queryName = match[1].replace(/-\$\{[^}]+\}/, '');

    // Parse the whole cachedQuery(...) call, however long its body is.
    const openIdx = content.indexOf('(', match.index);
    const closeIdx = findMatchingParen(content, openIdx);
    if (closeIdx === -1) continue;
    const callText = content.slice(openIdx + 1, closeIdx);

    // Options is the last argument, iff it's an object literal. Ignore any
    // empty trailing arg from a trailing comma (multi-line call style).
    const args = splitTopLevelArgs(callText).filter((a) => a.length > 0);
    const lastArg = args[args.length - 1] || '';
    const options = lastArg.startsWith('{') ? lastArg : null;

    const line = content.slice(0, match.index).split('\n').length;

    // Collect every SQL constant this call references: from .query(VAR) in the
    // body AND from the sql: option (handles multi-statement queries).
    const sqlVars = new Set();
    for (const qm of callText.matchAll(/\.query(?:<[^>]+>)?\(\s*(\w+)/g)) sqlVars.add(qm[1]);
    if (options) for (const sm of options.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*_SQL)\b/g)) sqlVars.add(sm[1]);

    const tablesRead = [];
    for (const sqlVar of sqlVars) {
      const sqlDefMatch = content.match(new RegExp(`(?:const|let)\\s+${sqlVar}\\s*=\\s*\`([\\s\\S]*?)\``));
      if (sqlDefMatch) {
        const sqlText = sqlDefMatch[1].toLowerCase();
        for (const table of MUTABLE_TABLES) {
          if (sqlText.includes(table.toLowerCase()) && !tablesRead.includes(table)) {
            tablesRead.push(table);
          }
        }
      }
    }

    queries.push({ name: queryName, file: relPath, line, options, tablesRead });
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
  const hasBowlerID = /bowlerID[,}\s]/.test(options);

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
  if (!isStable && !hasSeasonID && !hasDependsOn && !hasAllSeasons && !hasBowlerID) {
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
