#!/usr/bin/env node
/**
 * Scaffold a weekly blog recap post.
 *
 * Usage:
 *   node scripts/create-weekly-post.mjs --week=5
 *   node scripts/create-weekly-post.mjs --week=5 --season=35
 */

import sql from 'mssql';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// Load env
const envContent = readFileSync(resolve(PROJECT_ROOT, '.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

// Parse args
const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v];
  })
);

const week = parseInt(args.week, 10);
if (!week || isNaN(week)) {
  console.error('Usage: node scripts/create-weekly-post.mjs --week=5');
  process.exit(1);
}

const dbConfig = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false },
};

const pool = await sql.connect(dbConfig);

// Get season info (use --season or default to current)
const seasonFilter = args.season
  ? `WHERE seasonID = ${parseInt(args.season, 10)}`
  : `WHERE isCurrentSeason = 1`;

const { recordset: seasons } = await pool.request().query(
  `SELECT TOP 1 seasonID, romanNumeral, displayName, period, year FROM seasons ${seasonFilter} ORDER BY seasonID DESC`
);

if (!seasons.length) {
  console.error('No season found.');
  await pool.close();
  process.exit(1);
}

const season = seasons[0];
const seasonSlug = season.displayName.toLowerCase().replace(/ /g, '-');

// Get match date for this week
const { recordset: schedule } = await pool.request().query(
  `SELECT TOP 1 matchDate FROM schedule WHERE seasonID = ${season.seasonID} AND week = ${week} ORDER BY matchDate`
);

const matchDate = schedule[0]?.matchDate;
const postDate = matchDate
  ? matchDate.toISOString().split('T')[0]
  : new Date().toISOString().split('T')[0];

await pool.close();

// Build the file
const slug = `season-${season.romanNumeral.toLowerCase()}-week-${week}-recap`;
const filePath = resolve(PROJECT_ROOT, 'content', 'blog', `${slug}.mdx`);

if (existsSync(filePath)) {
  console.error(`Post already exists: ${filePath}`);
  process.exit(1);
}

const content = `---
title: "Season ${season.romanNumeral} Week ${week} Recap"
date: "${postDate}"
slug: "${slug}"
season: "${season.romanNumeral}"
seasonSlug: "${seasonSlug}"
week: ${week}
excerpt: "Week ${week} recap from Season ${season.romanNumeral}."
type: "recap"
---

Words needed for Week ${week}, stats ready.

<WeekRecap season="${season.romanNumeral}" seasonSlug="${seasonSlug}" week="${week}" />
`;

writeFileSync(filePath, content, 'utf8');
console.log(`Created: content/blog/${slug}.mdx`);
console.log(`Open in VS Code and replace the placeholder text with your intro.`);
