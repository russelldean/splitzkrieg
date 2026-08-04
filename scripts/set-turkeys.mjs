#!/usr/bin/env node
/**
 * Apply turkey counts to a staging file from a "Name N, Name N" list.
 *
 * Matches against the resolved bowlerName first, then the raw LP name, so the
 * captain's spelling still lands. Refuses to write if ANY name is unmatched or
 * ambiguous — a silently-dropped turkey is invisible until the milestone
 * numbers are wrong weeks later.
 *
 * Usage:
 *   node scripts/set-turkeys.mjs --file=docs/pending/s36-week-2-2026-07-27.json \
 *     --turkeys="Matt Stansell 2, Glenn Boothe 1" [--commit]
 */
import { readFileSync, writeFileSync } from 'fs';

const arg = (k, d) => { const h = process.argv.find(a => a.startsWith(`--${k}=`)); return h ? h.split('=').slice(1).join('=') : d; };
const FILE = arg('file');
const LIST = arg('turkeys');
const COMMIT = process.argv.includes('--commit');
if (!FILE || !LIST) { console.error('need --file= and --turkeys="Name N, Name N"'); process.exit(1); }

// Captain-sheet spellings that differ from our DB. Confirmed by Russ.
const ALIAS = {};
const norm = s => String(s).toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const key = s => ALIAS[norm(s)] ?? norm(s);

const staged = JSON.parse(readFileSync(FILE, 'utf8'));

// Every bowler slot in the file, indexed by both resolved and LP name.
const slots = [];
for (const m of staged.matches) for (const b of m.bowlers) slots.push(b);
const find = (name) => slots.filter(b => key(b.bowlerName ?? '') === key(name) || key(b.lpName ?? '') === key(name));

const entries = LIST.split(',').map(s => s.trim()).filter(Boolean).map(s => {
  const m = s.match(/^(.*?)\s*(\d+)$/);
  if (!m) return { raw: s, bad: 'no count' };
  return { name: m[1].trim(), count: parseInt(m[2], 10) };
});

const problems = [], applied = [];
for (const e of entries) {
  if (e.bad) { problems.push(`"${e.raw}" — could not parse a count`); continue; }
  const hits = find(e.name);
  if (hits.length === 0) { problems.push(`"${e.name}" — not bowling on ${staged.matchDate}`); continue; }
  if (hits.length > 1) { problems.push(`"${e.name}" — ambiguous, ${hits.length} slots`); continue; }
  applied.push({ e, b: hits[0] });
}

console.log(`${FILE}  (${staged.matchDate})\n`);
for (const { e, b } of applied) {
  const note = key(b.bowlerName ?? '') !== key(e.name) ? `  <- sheet said "${e.name}"` : '';
  const g = [b.game1, b.game2, b.game3];
  console.log(`  ${String(b.bowlerName).padEnd(22)} ${e.count} turkey${e.count === 1 ? '' : 's'}   ${g.join('/')}${note}`);
}
if (problems.length) {
  console.log(`\n*** ${problems.length} PROBLEM(S) — nothing written ***`);
  for (const p of problems) console.log('   ' + p);
  process.exit(1);
}

if (!COMMIT) { console.log(`\nDRY RUN — ${applied.length} to apply. Re-run with --commit.`); process.exit(0); }
for (const { e, b } of applied) b.turkeys = e.count;
writeFileSync(FILE, JSON.stringify(staged, null, 2));
const total = staged.matches.flatMap(m => m.bowlers).reduce((n, b) => n + (b.turkeys || 0), 0);
console.log(`\nWROTE ${applied.length} bowlers. File now totals ${total} turkeys.`);
