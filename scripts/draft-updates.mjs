#!/usr/bin/env node
/**
 * Dumps recent git commits as update entry candidates.
 * Usage: node scripts/draft-updates.mjs [--days=7]
 */

import { execSync } from 'child_process';

const days = parseInt(process.argv.find(a => a.startsWith('--days='))?.split('=')[1] ?? '7', 10);
const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

const log = execSync(`git log --oneline --since="${since}" --format="%ai|%s"`, { encoding: 'utf8' }).trim();

if (!log) {
  console.log('No commits found in the last', days, 'days.');
  process.exit(0);
}

console.log(`// Commits from last ${days} days — edit these into content/updates.ts\n`);

for (const line of log.split('\n')) {
  const [datePart, ...rest] = line.split('|');
  const date = datePart.trim().split(' ')[0];
  const msg = rest.join('|').trim();
  const tag = msg.startsWith('fix') ? 'fix' : 'feat';
  console.log(`  { date: '${date}', text: '${msg.replace(/'/g, "\\'")}', tag: '${tag}' },`);
}
