#!/usr/bin/env node
/**
 * pre-push-check.mjs
 *
 * Quick validation script to catch common mistakes before pushing.
 * Run: node scripts/pre-push-check.mjs
 *
 * Checks:
 *   1. Cache invariants (delegates to check-cache-invariants.mjs)
 *   2. No em dashes in src/ or content/ files
 *   3. .data-versions.json is staged/committed if query files changed
 *   4. .published-week exists and looks reasonable
 *   5. No stable: true on queries reading mutable tables (via invariant checker)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { findEmDashes, shouldScanFile } from './lib/em-dash.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

let failures = 0;
let warnings = 0;

function fail(check, msg) {
  console.log(`  FAIL [${check}] ${msg}`);
  failures++;
}

function warn(check, msg) {
  console.log(`  WARN [${check}] ${msg}`);
  warnings++;
}

function pass(check, msg) {
  console.log(`  OK   [${check}] ${msg}`);
}

console.log('\nPre-push checks\n');

// 1. Cache invariants
try {
  execSync('node scripts/check-cache-invariants.mjs', { cwd: ROOT, stdio: 'pipe' });
  pass('cache', 'All cache invariants pass');
} catch (e) {
  const output = e.stdout?.toString() || '';
  const violationLines = output.split('\n').filter(l => l.trim().startsWith('['));
  fail('cache', `Cache invariant violations found:`);
  violationLines.forEach(l => console.log(`         ${l.trim()}`));
}

// 2. Em dash check in src/ and content/
//
// Detection lives in scripts/lib/em-dash.mjs so it can be unit tested. It was
// inline here and matched only the em dash CHARACTER, which let source written
// as a \\u2014 escape straight through. Four of those were rendering in live
// page titles and meta descriptions while this check reported green.
//
// Standalone '\\u2014' string literals are the missing-value placeholder in the
// bowler, team and season tables. Those are reported as a count rather than a
// failure, so the check does not block every push over a deliberate convention.
function scanEmDashes(dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue;
        walk(full);
      } else if (shouldScanFile(entry.name)) {
        const rel = path.relative(ROOT, full);
        for (const hit of findEmDashes(fs.readFileSync(full, 'utf-8'))) {
          found.push({ ...hit, rel });
        }
      }
    }
  }
  walk(dir);
  return found;
}

const emDashHits = [
  ...scanEmDashes(path.join(ROOT, 'src')),
  ...scanEmDashes(path.join(ROOT, 'content')),
];
const emDashErrors = emDashHits.filter(h => h.severity === 'error');
const emDashPlaceholders = emDashHits.filter(h => h.severity === 'warn');

if (emDashErrors.length === 0) {
  pass('em-dash', `No em dashes in user-facing text (${emDashPlaceholders.length} placeholder literal(s), allowed by convention)`);
} else {
  fail('em-dash', `${emDashErrors.length} em dash(es) found in user-facing text:`);
  emDashErrors.forEach(h => console.log(`         ${h.rel}:${h.line} (${h.kind}) ${h.snippet}`));
}

// 3. Check if query files changed but .data-versions.json not committed
try {
  const diff = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf-8' });
  const staged = execSync('git diff --name-only --cached', { cwd: ROOT, encoding: 'utf-8' });
  const allChanged = (diff + '\n' + staged).split('\n').filter(Boolean);

  const queryFilesChanged = allChanged.some(f => f.startsWith('src/lib/queries/'));
  const dataVersionsChanged = allChanged.includes('.data-versions.json');

  if (queryFilesChanged && !dataVersionsChanged) {
    warn('data-versions', 'Query files changed but .data-versions.json was not modified. This is fine if only SQL text changed (hash auto-invalidates).');
  } else {
    pass('data-versions', 'No query/data-version mismatch');
  }
} catch {
  warn('data-versions', 'Could not check git diff');
}

// 4. .published-week sanity check
const publishedWeekPath = path.join(ROOT, '.published-week');
if (fs.existsSync(publishedWeekPath)) {
  const tag = fs.readFileSync(publishedWeekPath, 'utf-8').trim();
  const match = tag.match(/^s(\d+)-w(\d+)(?:-r\d+)?$/);
  if (!match) {
    fail('published-week', `.published-week has unexpected format: "${tag}" (expected sN-wN or sN-wN-rN)`);
  } else {
    const season = parseInt(match[1]);
    const week = parseInt(match[2]);
    if (season < 1 || season > 50 || week < 1 || week > 20) {
      warn('published-week', `.published-week = "${tag}" — season or week number looks unusual`);
    } else {
      pass('published-week', `.published-week = "${tag}"`);
    }
  }
} else {
  fail('published-week', '.published-week file not found');
}

// 5. The published tag's redundancy invariant.
//
// ~22 queries fold .published-week into their cache key. That is currently
// harmless dead weight rather than a live dependency, because the ONLY writer
// of the file is src/app/api/evillair/publish/route.ts, which commits it in the
// same commit as a bumped .data-versions.json. So the season/channel version
// already invalidates everything the tag would.
//
// That is what makes the tag safe to delete some day. If the marker ever moves
// WITHOUT a version bump, the invariant breaks, the tag silently becomes
// load-bearing again, and deleting it would serve stale pages. Flag it here
// rather than let that happen quietly.
try {
  const diff = execSync('git diff --name-only HEAD', { cwd: ROOT, encoding: 'utf-8' });
  const staged = execSync('git diff --name-only --cached', { cwd: ROOT, encoding: 'utf-8' });
  const allChanged = (diff + '\n' + staged).split('\n').filter(Boolean);

  const markerChanged = allChanged.includes('.published-week');
  const versionsChanged = allChanged.includes('.data-versions.json');

  if (markerChanged && !versionsChanged) {
    warn(
      'published-tag',
      '.published-week changed without .data-versions.json. Publishing normally moves both ' +
      'together; on its own it means the published tag is now the only thing invalidating ' +
      'those pages, so it can no longer be removed safely.',
    );
  } else {
    pass('published-tag', 'Marker and data versions move together');
  }
} catch {
  warn('published-tag', 'Could not check git diff');
}

// Summary
console.log(`\n${failures === 0 && warnings === 0 ? 'All checks passed.' : `${failures} failure(s), ${warnings} warning(s).`}\n`);
process.exit(failures > 0 ? 1 : 0);
