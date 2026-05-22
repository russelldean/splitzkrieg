#!/usr/bin/env node
// One-shot cache patch for bowler 297 rename (Jenny Peters → J Peters).
// Runs BEFORE next build during the Vercel deploy. Walks .next/cache/sql/
// JSON files and string-replaces the old name/slug. Cache keys (filenames)
// are untouched, so cachedQuery() reads patched values without re-querying.
// Remove from package.json after this deploy completes successfully.

import fs from 'fs';
import path from 'path';

const REPLACEMENTS = [
  ['"Jenny Peters"', '"J Peters"'],
  ['"jenny-peters"', '"j-peters"'],
];

const dirs = [
  '.next/cache/sql/v1',
  '.next/cache/sql/stable',
];

let scanned = 0;
let patched = 0;
let totalReplacements = 0;

for (const dir of dirs) {
  if (!fs.existsSync(dir)) {
    console.log(`[patch-cache-rename] skip ${dir} — does not exist`);
    continue;
  }
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.json')) continue;
    scanned++;
    const filePath = path.join(dir, file);
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
      console.warn(`[patch-cache-rename] read failed: ${filePath}`, err.message);
      continue;
    }
    let changed = false;
    let fileReplacements = 0;
    for (const [from, to] of REPLACEMENTS) {
      const parts = content.split(from);
      if (parts.length > 1) {
        fileReplacements += parts.length - 1;
        content = parts.join(to);
        changed = true;
      }
    }
    if (changed) {
      try {
        fs.writeFileSync(filePath, content);
        patched++;
        totalReplacements += fileReplacements;
      } catch (err) {
        console.warn(`[patch-cache-rename] write failed: ${filePath}`, err.message);
      }
    }
  }
}

console.log(`[patch-cache-rename] scanned ${scanned} files, patched ${patched}, ${totalReplacements} string replacements`);
