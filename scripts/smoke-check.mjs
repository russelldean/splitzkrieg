#!/usr/bin/env node
/**
 * smoke-check.mjs
 *
 * Post-deploy check against a running site. Reads what visitors actually get.
 *
 * Run: node scripts/smoke-check.mjs [baseUrl]
 *      node scripts/smoke-check.mjs http://localhost:3000
 *
 * Exit code: 0 = clean, 1 = errors found.
 *
 * Two bugs motivated this, both of which lived a long time because nothing
 * ever inspected a served page:
 *
 *   1. Every title rendered the site name twice.
 *   2. An admin action invalidated all ~1179 prebuilt pages, so the next
 *      visitor to each one waited on a live render against Azure SQL. It was
 *      noticed only as a 15 second click.
 *
 * Deliberately small. The sample is about a dozen pages, fetched one at a
 * time. A smoke check that hammers every route would recreate the exact
 * Azure SQL load problem it is meant to detect, since a cold page costs a
 * full query batch on a 5 DTU tier.
 */

import { checkPage, checkCacheHealth } from './lib/smoke-assertions.mjs';

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? 'https://splitzkrieg.com')
  .replace(/\/$/, '');
const GAP_MS = 250;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(pathname) {
  const url = BASE + pathname;
  const started = Date.now();
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const html = await res.text();
    return {
      url: pathname,
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      html,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    return {
      url: pathname,
      status: 0,
      headers: {},
      html: '',
      durationMs: Date.now() - started,
      error: err.message,
    };
  }
}

/**
 * The current week is whatever the homepage points at, so the check follows
 * the season over without needing to be edited every publish.
 */
function discoverCurrentWeek(html) {
  const m = /href="(\/week\/[a-z0-9-]+\/\d+)"/i.exec(html ?? '');
  return m ? m[1] : null;
}

function firstLink(html, prefix) {
  const re = new RegExp(`href="(${prefix}[a-z0-9-]+)"`, 'i');
  const m = re.exec(html ?? '');
  return m ? m[1] : null;
}

async function main() {
  console.log(`\nSmoke check: ${BASE}\n`);

  const home = await get('/');
  if (home.status !== 200) {
    console.log(`  FAIL homepage returned ${home.status} ${home.error ?? ''}`);
    process.exit(1);
  }

  const currentWeek = discoverCurrentWeek(home.html);
  const aSeason = firstLink(home.html, '/season/') ?? '/seasons';
  const aTeam = firstLink(home.html, '/team/') ?? '/teams';
  const aBowler = firstLink(home.html, '/bowler/') ?? '/bowlers';

  const routes = [
    '/week',
    currentWeek,
    aSeason,
    aTeam,
    aBowler,
    '/seasons',
    '/teams',
    '/bowlers',
    '/stats/all-time',
    '/blog',
    '/rules',
  ].filter(Boolean);

  const results = [home];
  for (const r of routes) {
    await sleep(GAP_MS);
    results.push(await get(r));
  }

  const findings = [];
  for (const r of results) {
    if (r.error) {
      findings.push({ level: 'error', code: 'FETCH', message: `${r.url} failed: ${r.error}` });
      continue;
    }
    findings.push(...checkPage(r));
  }
  findings.push(...checkCacheHealth(results.filter((r) => !r.error)));

  for (const r of results) {
    const cache = r.headers?.['x-vercel-cache'] ?? 'n/a';
    console.log(
      `  ${String(r.status).padEnd(3)} ${String(r.durationMs + 'ms').padEnd(8)} ` +
      `${String(cache).padEnd(12)} ${r.url}`,
    );
  }

  const errors = findings.filter((f) => f.level === 'error');
  const warns = findings.filter((f) => f.level === 'warn');

  console.log('');
  if (errors.length === 0 && warns.length === 0) {
    console.log(`  All ${results.length} pages clean.\n`);
    process.exit(0);
  }
  for (const f of errors) console.log(`  FAIL [${f.code}] ${f.message}`);
  for (const f of warns) console.log(`  WARN [${f.code}] ${f.message}`);
  console.log(`\n${errors.length} error(s), ${warns.length} warning(s).\n`);
  process.exit(errors.length > 0 ? 1 : 0);
}

main();
