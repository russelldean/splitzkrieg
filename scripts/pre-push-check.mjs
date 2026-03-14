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
const EM_DASH_CHAR = '\u2014';
const EM_DASH_PATTERNS = [EM_DASH_CHAR, '&mdash;'];

function checkEmDashes(dir) {
  if (!fs.existsSync(dir)) return [];
  const hits = [];
  const extensions = ['.ts', '.tsx', '.css', '.js', '.jsx'];

  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.next') continue;
        walk(full);
      } else if (extensions.some(ext => entry.name.endsWith(ext))) {
        const content = fs.readFileSync(full, 'utf-8');
        for (const pattern of EM_DASH_PATTERNS) {
          if (content.includes(pattern)) {
            const rel = path.relative(ROOT, full);
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(pattern)) {
                const trimmed = lines[i].trim();
                // Skip code comments — only flag user-facing em dashes
                if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('{/*')) continue;
                // Skip inline comments: if em dash only appears after // in the line
                const commentIdx = lines[i].indexOf('//');
                const dashIdx = lines[i].indexOf(pattern);
                if (commentIdx !== -1 && dashIdx > commentIdx) continue;
                hits.push(`${rel}:${i + 1} contains "${pattern === EM_DASH_CHAR ? '\u2014 (em dash char)' : pattern}"`);
              }
            }
          }
        }
      }
    }
  }
  walk(dir);
  return hits;
}

const emDashHits = [
  ...checkEmDashes(path.join(ROOT, 'src')),
  ...checkEmDashes(path.join(ROOT, 'content')),
];

if (emDashHits.length === 0) {
  pass('em-dash', 'No em dashes found in src/ or content/');
} else {
  fail('em-dash', `${emDashHits.length} em dash(es) found:`);
  emDashHits.forEach(h => console.log(`         ${h}`));
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

// Summary
console.log(`\n${failures === 0 && warnings === 0 ? 'All checks passed.' : `${failures} failure(s), ${warnings} warning(s).`}\n`);
process.exit(failures > 0 ? 1 : 0);
