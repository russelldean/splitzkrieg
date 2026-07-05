# Serving-Model Rebuild — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the codebase on a clean `cachedQuery` baseline, put the public site behind a maintenance page, and cut the build from prebuilding ~1167 pages to only the current season + index pages, then measure the build time as the gate before any further work.

**Architecture:** Three sequenced changes. (1) Revert the half-finished taggedQuery migration to the exact pre-migration tree. (2) An env-gated middleware that serves a self-contained 503 maintenance page for all public traffic while leaving `/evillair` and `/api` open. (3) Scope every historical `generateStaticParams` to the current season and flip `dynamicParams = true` so frozen seasons render on demand instead of at build. Evidence is a Vercel build-time and static-page-count comparison, measured on a preview deploy so production is never at risk until Russ approves.

**Tech Stack:** Next.js 16 App Router, TypeScript, Azure SQL (mssql), Vitest, Vercel (preview + production deploys).

---

## Pinned Baseline

**Pre-migration clean baseline commit: `9e64ef2`** (`docs: Track #1 Phase 1 ISR+tags pilot plan`).

This is the last commit before the first taggedQuery code commit (`5f7705e feat: add taggedQuery`). Everything between the last real code commit (`e2f4830`) and `9e64ef2` is docs-only (verified: `git diff --stat e2f4830 9e64ef2` touches only `docs/` and `scripts/phase0/*.txt`). Restoring the migration-touched files to their `9e64ef2` state yields a tree whose application code is byte-identical to the pre-migration baseline, while keeping all the design/plan docs and the reverted `cpus` state that already live on `main`.

Current `main` HEAD at plan time: `23e0f62`. Production is serving Batch A (`d15f7a6`).

## The migration surface (what gets reverted)

Files **modified** by the migration (restore from `9e64ef2`):
- `src/lib/db.ts` (adds `taggedQuery` + `unstable_cache` import)
- `src/lib/queries/home.ts` (snapshot, milestones, highlights → taggedQuery)
- `src/lib/queries/bowlers.ts` (BOTW → taggedQuery; imports cache-tags)
- `src/lib/queries/milestones.ts` (→ taggedQuery; imports cache-tags)
- `src/app/page.tsx` (adds `export const revalidate = 120`)
- `src/app/api/revalidate/route.ts` (adds `revalidateTag` calls)

Files **created** by the migration (delete):
- `src/lib/cache-tags.ts`
- `src/lib/cache-tags.test.ts`
- `src/lib/tagged-query.test.ts`

Verified: every `taggedQuery` / `cache-tags` / `revalidateTag` / `unstable_cache` reference in `src/` lives inside one of these files, so the revert leaves no dangling imports.

## Guardrails (from `memory/feedback_build_safety_incident.md` — do not violate)

- **NO** taggedQuery / Next Data Cache mechanism. This plan removes it.
- **NO** `cpus` increase in `next.config.ts`. Leave at `cpus: 4`.
- **NO** DB tier bump. Stay on Azure SQL Basic.
- **NO** from-scratch query rewrite. Reuse working SQL; only change serving.
- **Never stack builds.** Confirm Vercel auto-cancel is ON. One build at a time. If the DB looks saturated, stop and let it drain ~15 min.
- **No em dashes** anywhere (`—`, `&mdash;`, `—`).
- New mutable-table query helpers must **never** be `stable: true` — use `dependsOn`.

## Testing approach (read before starting)

The existing query functions have **no** unit tests (the only query-layer tests were `cache-tags.test.ts` / `tagged-query.test.ts`, which this plan deletes). DB-backed query helpers cannot be meaningfully unit-tested without a live Azure connection, and `next build` is run on Vercel, not locally (per CLAUDE.md). So:

- **TDD** applies to the one genuinely pure unit: the maintenance gate predicate (`shouldServeMaintenance`). Write the failing test first.
- **DB-backed helpers** (current-season slug queries) are verified with a throwaway `node -e` script that runs the query against the real DB and asserts it returns only current-season slugs.
- **Build reduction** is verified on a **Vercel preview deploy** (build duration + `Generating static pages (N/N)` count), never a local `next build`.

---

## Task 1: Revert the taggedQuery migration to the clean cachedQuery baseline

**Files:**
- Modify (restore from `9e64ef2`): `src/lib/db.ts`, `src/lib/queries/home.ts`, `src/lib/queries/bowlers.ts`, `src/lib/queries/milestones.ts`, `src/app/page.tsx`, `src/app/api/revalidate/route.ts`
- Delete: `src/lib/cache-tags.ts`, `src/lib/cache-tags.test.ts`, `src/lib/tagged-query.test.ts`

- [ ] **Step 1: Create the Phase 1 branch**

```bash
cd /Users/russdean/Projects/splitzkrieg
git switch -c phase1/serving-model-rebuild
```

- [ ] **Step 2: Restore the six modified files to their pre-migration state**

```bash
git checkout 9e64ef2 -- \
  src/lib/db.ts \
  src/lib/queries/home.ts \
  src/lib/queries/bowlers.ts \
  src/lib/queries/milestones.ts \
  src/app/page.tsx \
  src/app/api/revalidate/route.ts
```

- [ ] **Step 3: Delete the three migration-only files**

```bash
git rm src/lib/cache-tags.ts src/lib/cache-tags.test.ts src/lib/tagged-query.test.ts
```

- [ ] **Step 4: Verify no taggedQuery/cache-tags references remain**

Run:
```bash
grep -rn "taggedQuery\|cache-tags\|revalidateTag\|unstable_cache" src/ || echo "CLEAN"
```
Expected: `CLEAN` (no matches).

- [ ] **Step 5: Verify the tree matches the pre-migration baseline exactly**

Run:
```bash
git diff --stat 9e64ef2 -- src/lib/db.ts src/lib/queries/home.ts src/lib/queries/bowlers.ts src/lib/queries/milestones.ts src/app/page.tsx src/app/api/revalidate/route.ts
```
Expected: no output (these files are now identical to `9e64ef2`).

- [ ] **Step 6: Run the test suite (deleted tests should be gone, rest green)**

Run: `npm test`
Expected: PASS. No references to `cache-tags` or `tagged-query`. (If any surviving test imports a deleted module, that is a missed reference — stop and re-check Step 4.)

- [ ] **Step 7: Run the cache invariant + pre-push checks**

Run:
```bash
node scripts/check-cache-invariants.mjs
node scripts/pre-push-check.mjs
```
Expected: both pass (or report only the known pre-existing violations already tracked in `memory/project_cache_invariants_backlog.md` — do not fix those here).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "revert: unwind half-finished taggedQuery migration to clean cachedQuery baseline

Restores db.ts, home/bowlers/milestones queries, page.tsx, and the
revalidate route to their pre-migration state (9e64ef2). Deletes the
cache-tags vocabulary and taggedQuery tests. No taggedQuery / Data Cache
mechanism remains; the disk cache (cachedQuery) is the sole cache path.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0126jX3qkNnUBEVPWQNYz7dE"
```

---

## Task 2: Maintenance gate (env-gated middleware + self-contained 503 page)

The maintenance response is a complete, self-contained HTML string returned directly from middleware. It does **not** route through the app tree, so it renders zero DB queries and shows none of the site chrome (Header/Footer/AnnouncementBanner). It is gated by `MAINTENANCE_MODE === 'on'`, so it is inert until deliberately switched on in Vercel.

**Files:**
- Create: `src/lib/maintenance.ts`
- Create: `src/lib/maintenance.test.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Write the failing test for the gate predicate**

Create `src/lib/maintenance.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { shouldServeMaintenance } from './maintenance';

describe('shouldServeMaintenance', () => {
  it('does nothing when mode is not "on"', () => {
    expect(shouldServeMaintenance('/', undefined)).toBe(false);
    expect(shouldServeMaintenance('/', 'off')).toBe(false);
    expect(shouldServeMaintenance('/bowler/john-doe', 'off')).toBe(false);
  });

  it('gates public pages when mode is on', () => {
    expect(shouldServeMaintenance('/', 'on')).toBe(true);
    expect(shouldServeMaintenance('/season/spring-2026', 'on')).toBe(true);
    expect(shouldServeMaintenance('/bowler/john-doe', 'on')).toBe(true);
  });

  it('always lets admin and api through', () => {
    expect(shouldServeMaintenance('/evillair', 'on')).toBe(false);
    expect(shouldServeMaintenance('/evillair/playoffs', 'on')).toBe(false);
    expect(shouldServeMaintenance('/api/revalidate', 'on')).toBe(false);
    expect(shouldServeMaintenance('/api/cron/lineup-reminder', 'on')).toBe(false);
  });

  it('lets asset-like paths (with a file extension) through', () => {
    expect(shouldServeMaintenance('/favicon.ico', 'on')).toBe(false);
    expect(shouldServeMaintenance('/robots.txt', 'on')).toBe(false);
    expect(shouldServeMaintenance('/og.png', 'on')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npm test -- maintenance`
Expected: FAIL with "Cannot find module './maintenance'" (or "shouldServeMaintenance is not a function").

- [ ] **Step 3: Implement the gate predicate and maintenance HTML**

Create `src/lib/maintenance.ts`:
```ts
/**
 * Maintenance gate used by middleware. Kept as a pure, dependency-free module
 * so the predicate is unit-testable and the HTML has zero runtime/DB coupling.
 *
 * Turn on by setting MAINTENANCE_MODE=on in the Vercel environment.
 */

// Prefixes that must stay reachable while the public site is gated:
// the admin console and every API route (revalidate, cron, admin actions).
const ALLOW_PREFIXES = ['/evillair', '/api', '/_next'];

export function shouldServeMaintenance(
  pathname: string,
  mode: string | undefined,
): boolean {
  if (mode !== 'on') return false;
  if (ALLOW_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return false;
  }
  // Let static assets through (any path whose last segment has a file extension).
  const lastSegment = pathname.split('/').pop() ?? '';
  if (lastSegment.includes('.')) return false;
  return true;
}

export const MAINTENANCE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Splitzkrieg is getting ready for the new season</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #0b0b0f; color: #f5f5f5; text-align: center; padding: 2rem;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  }
  .wrap { max-width: 32rem; }
  h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 1rem; letter-spacing: 0.01em; }
  p { font-size: 1.05rem; line-height: 1.6; color: #c9c9d1; margin: 0.5rem 0; }
  .mark { font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #ff5a4d; font-size: 0.8rem; margin-bottom: 1.5rem; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="mark">Splitzkrieg</div>
    <h1>We are getting ready for the new season.</h1>
    <p>The site is briefly offline while we roll out something better.</p>
    <p>Check back soon.</p>
  </div>
</body>
</html>`;
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npm test -- maintenance`
Expected: PASS (all four cases).

- [ ] **Step 5: Create the middleware**

Create `src/middleware.ts`:
```ts
import { NextResponse, type NextRequest } from 'next/server';
import { shouldServeMaintenance, MAINTENANCE_HTML } from '@/lib/maintenance';

export function middleware(req: NextRequest) {
  if (shouldServeMaintenance(req.nextUrl.pathname, process.env.MAINTENANCE_MODE)) {
    return new NextResponse(MAINTENANCE_HTML, {
      status: 503,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'retry-after': '86400',
        'cache-control': 'no-store',
      },
    });
  }
  return NextResponse.next();
}

// Run on everything except Next internals and image optimizer; the predicate
// makes the final allow/deny decision (so /api and /evillair pass through).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 6: Verify locally with the gate OFF (default) — site works normally**

Run: `npm run dev` (in a separate shell), then:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
```
Expected: `200` (MAINTENANCE_MODE unset → gate inert, normal site).

- [ ] **Step 7: Verify locally with the gate ON — public gated, admin open**

Stop dev, restart with the flag:
```bash
MAINTENANCE_MODE=on npm run dev
```
Then in another shell:
```bash
curl -s -o /dev/null -w "home: %{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "bowler: %{http_code}\n" http://localhost:3000/bowler/anyone
curl -s -o /dev/null -w "admin: %{http_code}\n" http://localhost:3000/evillair/login
```
Expected: `home: 503`, `bowler: 503`, `admin: 200` (or a redirect to login, not 503). Confirm the home 503 body is the "getting ready for the new season" page:
```bash
curl -s http://localhost:3000/ | grep -c "getting ready for the new season"
```
Expected: `1`. Stop the dev server when done.

- [ ] **Step 8: Run em-dash + pre-push checks**

Run:
```bash
node scripts/pre-push-check.mjs
```
Expected: pass (confirms no em dashes were introduced in the new files).

- [ ] **Step 9: Commit**

```bash
git add src/lib/maintenance.ts src/lib/maintenance.test.ts src/middleware.ts
git commit -m "feat: env-gated maintenance page (MAINTENANCE_MODE=on)

Middleware returns a self-contained 503 'getting ready for the new
season' page for all public traffic while leaving /evillair and /api
open. Inert unless MAINTENANCE_MODE=on. No app-tree or DB coupling.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0126jX3qkNnUBEVPWQNYz7dE"
```

---

## Task 3: Cut prebuild to current season + index pages only

Add two current-season slug helpers, then scope each historical `generateStaticParams` to the current season and flip `dynamicParams = true` so unknown/historical slugs render on demand. Every one of these pages already calls `notFound()` for an unresolved slug (verified), so `dynamicParams = true` stays safe: an unknown slug still 404s at render.

Current-season detection uses the existing `isCurrentSeason = 1` flag on `seasons`, matching the codebase convention.

**Files:**
- Modify: `src/lib/queries/bowlers.ts` (add `getCurrentSeasonBowlerSlugs`)
- Modify: `src/lib/queries/teams/profile.ts` (add `getCurrentSeasonTeamSlugs`)
- Modify: `src/app/bowler/[slug]/page.tsx`
- Modify: `src/app/team/[slug]/page.tsx`
- Modify: `src/app/season/[slug]/page.tsx`
- Modify: `src/app/stats/[slug]/page.tsx`
- Modify: `src/app/week/[seasonSlug]/[weekNum]/page.tsx`
- Modify: `src/app/playoffs/[seasonSlug]/[round]/page.tsx`

- [ ] **Step 1: Add `getCurrentSeasonBowlerSlugs` to `src/lib/queries/bowlers.ts`**

Insert directly after `getAllBowlerSlugs` (after line 33). `scores.bowlerID` and `scores.seasonID` are confirmed columns; `seasons.isCurrentSeason` is a bit flag.
```ts
const GET_CURRENT_SEASON_BOWLER_SLUGS_SQL = `
  SELECT DISTINCT b.slug
  FROM bowlers b
  JOIN scores sc ON sc.bowlerID = b.bowlerID
  JOIN seasons se ON se.seasonID = sc.seasonID
  WHERE se.isCurrentSeason = 1
    AND sc.isPenalty = 0
    AND b.slug IS NOT NULL
  ORDER BY b.slug
`;

export async function getCurrentSeasonBowlerSlugs(): Promise<BowlerSlug[]> {
  return cachedQuery('getCurrentSeasonBowlerSlugs', async () => {
    const db = await getDb();
    const result = await db.request().query<{ slug: string }>(GET_CURRENT_SEASON_BOWLER_SLUGS_SQL);
    return result.recordset;
  }, [], { sql: GET_CURRENT_SEASON_BOWLER_SLUGS_SQL, dependsOn: ['scores'] });
}
```

- [ ] **Step 2: Add `getCurrentSeasonTeamSlugs` to `src/lib/queries/teams/profile.ts`**

Insert directly after `getAllTeamSlugs`. `schedule` uses `team1ID` / `team2ID` (confirmed from `db-schema.md` — NOT homeTeamID/awayTeamID).
```ts
const GET_CURRENT_SEASON_TEAM_SLUGS_SQL = `
  SELECT DISTINCT t.slug
  FROM teams t
  JOIN schedule sch ON sch.team1ID = t.teamID OR sch.team2ID = t.teamID
  JOIN seasons se ON se.seasonID = sch.seasonID
  WHERE se.isCurrentSeason = 1
    AND t.slug IS NOT NULL
  ORDER BY t.slug
`;

export async function getCurrentSeasonTeamSlugs(): Promise<TeamSlug[]> {
  return cachedQuery('getCurrentSeasonTeamSlugs', async () => {
    const db = await getDb();
    const result = await db.request().query<TeamSlug>(GET_CURRENT_SEASON_TEAM_SLUGS_SQL);
    return result.recordset;
  }, [], { sql: GET_CURRENT_SEASON_TEAM_SLUGS_SQL, dependsOn: ['schedule'] });
}
```

- [ ] **Step 3: Verify both helpers against the live DB**

Run (single-quoted per CLAUDE.md):
```bash
node --experimental-vm-modules -e '
  import("./src/lib/queries/bowlers.js").catch(()=>{});
' 2>/dev/null || true
```
The query modules are TypeScript, so run the assertions through a small tsx-free check instead: write `scripts/phase1/verify-current-slugs.mjs` that connects with the same env-loading pattern as an existing script in `scripts/` (copy `getDb` env setup) and prints the row counts. Concretely:
```bash
ls scripts/*.mjs | head    # find a script to copy the mssql env-loading pattern from
```
Then create `scripts/phase1/verify-current-slugs.mjs` mirroring that pattern, running the two SQL strings above, and asserting: bowler slug count > 0, team slug count is between 1 and ~24 (one current-season division set), and every returned team slug also appears in the full `getAllTeamSlugs` set. Run:
```bash
node scripts/phase1/verify-current-slugs.mjs
```
Expected: prints `current-season bowlers: N` (N > 0) and `current-season teams: M` (1 <= M <= 24), and `all current-season teams exist in full team set: true`.

- [ ] **Step 4: Scope `bowler/[slug]` to current-season bowlers**

In `src/app/bowler/[slug]/page.tsx`:
- Change the import `getAllBowlerSlugs` to also import `getCurrentSeasonBowlerSlugs` (line ~14).
- Change `export const dynamicParams = false;` (line 57) to `export const dynamicParams = true;`
- Replace the `generateStaticParams` body (lines 59-62):
```ts
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  // Prebuild only current-season bowlers; historical bowlers render on demand.
  const slugs = await getCurrentSeasonBowlerSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}
```
Leave the `notFound()` guard in the page body untouched (it already 404s unknown slugs).

- [ ] **Step 5: Scope `team/[slug]` to current-season teams**

In `src/app/team/[slug]/page.tsx`:
- Import `getCurrentSeasonTeamSlugs` alongside `getAllTeamSlugs` (line ~15).
- Change `export const dynamicParams = false;` (line 102) to `export const dynamicParams = true;`
- Replace the `generateStaticParams` body (lines 104-107):
```ts
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  // Prebuild only current-season teams; historical teams render on demand.
  const slugs = await getCurrentSeasonTeamSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}
```

- [ ] **Step 6: Scope `season/[slug]` to the current season**

In `src/app/season/[slug]/page.tsx`:
- Ensure `getCurrentSeasonSlug` is imported from `@/lib/queries/seasons/core` (it lives alongside `getAllSeasonNavList`, already imported line ~24). Add `getCurrentSeasonSlug` to that import.
- Change `export const dynamicParams = false;` (line 39) to `export const dynamicParams = true;`
- Replace the `generateStaticParams` body (lines 41-44):
```ts
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  // Prebuild only the current season; historical seasons render on demand.
  const slug = await getCurrentSeasonSlug();
  return slug ? [{ slug }] : [];
}
```

- [ ] **Step 7: Scope `stats/[slug]` to the current season**

In `src/app/stats/[slug]/page.tsx`:
- Add `getCurrentSeasonSlug` to the `@/lib/queries/seasons/core` import (near line ~15).
- Change `export const dynamicParams = false;` (line 27) to `export const dynamicParams = true;`
- Replace the `generateStaticParams` body (lines 29-32):
```ts
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  // Prebuild only the current season's stats; historical render on demand.
  const slug = await getCurrentSeasonSlug();
  return slug ? [{ slug }] : [];
}
```

- [ ] **Step 8: Scope `week/[seasonSlug]/[weekNum]` to the current season's weeks**

In `src/app/week/[seasonSlug]/[weekNum]/page.tsx`:
- Add `getCurrentSeasonSlug` to the `@/lib/queries/seasons/core` import (near line ~16).
- Change `export const dynamicParams = false;` (line 33) to `export const dynamicParams = true;`
- Replace the `generateStaticParams` body (lines 35-56) — keep the same week-derivation logic, but restrict the season loop to the current season only:
```ts
export async function generateStaticParams(): Promise<{ seasonSlug: string; weekNum: string }[]> {
  // Prebuild only the current season's weeks; historical weeks render on demand.
  const currentSlug = await getCurrentSeasonSlug();
  if (!currentSlug) return [];

  const season = await getSeasonBySlug(currentSlug);
  if (!season) return [];

  const scores = await getSeasonWeeklyScores(season.seasonID);
  const schedule = await getSeasonSchedule(season.seasonID);

  const weeks = new Set<number>();
  scores.forEach((s) => weeks.add(s.week));
  schedule.forEach((s) => weeks.add(s.week));

  return Array.from(weeks).map((week) => ({
    seasonSlug: currentSlug,
    weekNum: String(week),
  }));
}
```
(The now-unused `getAllSeasonSlugs` import may remain if used elsewhere in the file; if the linter flags it as unused, remove it.)

- [ ] **Step 9: Make `playoffs/[seasonSlug]/[round]` fully on-demand**

Playoffs are the least-visited, most-historical route and the current season may have no playoff data yet. In `src/app/playoffs/[seasonSlug]/[round]/page.tsx`:
- Change `export const dynamicParams = false;` (line 38) to `export const dynamicParams = true;`
- Replace the `generateStaticParams` body (lines 51-67):
```ts
export async function generateStaticParams(): Promise<{ seasonSlug: string; round: string }[]> {
  // Playoff pages render fully on demand; none prebuilt.
  return [];
}
```
(If this leaves `getSeasonsWithPlayoffData` / `getAllSeasonSlugs` imports unused, remove them only if the linter flags them.)

- [ ] **Step 10: Run lint + tests**

Run:
```bash
npm run lint
npm test
```
Expected: lint passes (fix any unused-import warnings introduced above), tests pass.

- [ ] **Step 11: Run cache invariant + pre-push checks**

Run:
```bash
node scripts/check-cache-invariants.mjs
node scripts/pre-push-check.mjs
```
Expected: pass. Confirm the two new helpers are **not** flagged (they use `dependsOn`, not `stable: true`, and are not consumed by a `/* vN */`-commented query).

- [ ] **Step 12: Commit**

```bash
git add src/lib/queries/bowlers.ts src/lib/queries/teams/profile.ts \
  src/app/bowler/\[slug\]/page.tsx src/app/team/\[slug\]/page.tsx \
  src/app/season/\[slug\]/page.tsx src/app/stats/\[slug\]/page.tsx \
  src/app/week/\[seasonSlug\]/\[weekNum\]/page.tsx \
  src/app/playoffs/\[seasonSlug\]/\[round\]/page.tsx \
  scripts/phase1/verify-current-slugs.mjs
git commit -m "perf(build): prebuild current season + index pages only; historical on demand

generateStaticParams for bowler/team/season/stats/week now emit only
current-season slugs; playoffs emit none. All six flip to
dynamicParams=true so historical slugs render on demand (each page
already notFound()s unknown slugs). Adds current-season slug helpers.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0126jX3qkNnUBEVPWQNYz7dE"
```

---

## Task 4: Deploy, measure, and gate

This task produces the **number Russ demanded**. Measurement happens on Vercel **preview** deploys so production stays on the last good build until Russ approves the cutover.

- [ ] **Step 1: Confirm Vercel auto-cancel is ON**

In the Vercel project settings (Git → "Auto-cancel"), confirm stacked builds auto-cancel. Do not push again while a build is running. (If Russ needs to check this, ask him to confirm before pushing.)

- [ ] **Step 2: Push the branch and capture the BASELINE full-prebuild build**

Push **only Task 1's commit** first, so the baseline is measured on the clean revert with full prebuild still intact:
```bash
git push -u origin phase1/serving-model-rebuild
```
Wait for the Vercel **preview** build to finish. From the preview deployment's Build Logs, record:
- **Baseline build duration** (total "Build Completed in ...").
- **Baseline static page count** (the `Generating static pages (N/N)` line — expect ~1167).

Do not push the next commits until this build has fully completed and ~15 min have passed to let the DB drain (safety rule: never stack builds).

> **Decision (locked with Russ): option (a) — clean same-infra before/after.** Push a temporary branch pinned at the Task 1 commit to trigger a full-prebuild baseline preview build, record its number, then push the full `phase1/serving-model-rebuild` branch for the reduced build. Concretely: `git branch phase1/baseline <task1-commit-sha> && git push origin phase1/baseline`, measure that preview, then continue with Step 3.

- [ ] **Step 3: Ensure the full branch (Tasks 1-3) is on the preview and capture the REDUCED build**

With all three commits pushed, wait for the preview build. Record:
- **Reduced build duration**.
- **Reduced static page count** (expect a small number: current-season bowler/team/week/season/stats pages + all static index/landing pages, roughly one to two hundred, not ~1167).

- [ ] **Step 4: Present the gate to Russ — STOP here**

Report the before/after as a table:

| Metric | Baseline (full prebuild) | Reduced (current season only) |
|--------|--------------------------|-------------------------------|
| Static pages generated | ~1167 | (measured) |
| Build duration | (measured) | (measured) |

**Gate criterion:** the reduced build duration must drop from ~12-15 min to a few minutes. If it does **not** drop meaningfully, STOP and rethink before proceeding to Phase 2 — do not cut over. This is the evidence gate the whole approach is staked on.

- [ ] **Step 5: (Only after Russ approves the number) Cut over to production**

- In Vercel, set `MAINTENANCE_MODE=on` for the **Production** environment.
- Merge the branch to `main`:
```bash
git switch main
git merge --ff-only phase1/serving-model-rebuild
git push origin main
```
- Wait for the production build. Verify the public site now serves the 503 maintenance page and `/evillair` still loads:
```bash
curl -s -o /dev/null -w "home: %{http_code}\n" https://<production-domain>/
curl -s -o /dev/null -w "admin: %{http_code}\n" https://<production-domain>/evillair/login
```
Expected: `home: 503`, `admin: 200`/redirect.

- [ ] **Step 6: Update `content/updates.ts` and memory**

- Add an internal note (not user-facing, since the site is down) or skip the public update per Russ.
- Update `memory/project_serving_model_rebuild.md`: record the measured build numbers, mark Phase 1 complete, and set the next action to Phase 2 (bring back current-season core on ISR).

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-07-05-serving-model-rebuild-design.md`, Phase 1):
- Design step 1 (maintenance page redirects all public traffic) → Task 2. ✓
- Design step 2 (revert taggedQuery to clean cachedQuery, one green build) → Task 1 (+ green build confirmed on the Task 2/3 preview and the baseline preview). ✓
- Design step 3 (cut prebuild to current season + index; historical on-demand; measure build time) → Task 3 + Task 4. ✓
- Non-goals honored: no taggedQuery (removed), no cpus change, no DB tier bump, no query rewrite. ✓ (See Guardrails.)

**Placeholder scan:** No "TBD"/"handle appropriately". The one soft spot is Task 3 Step 3 (DB verification script), which points to copying an existing script's env-loading pattern rather than reproducing it verbatim — deliberate, because CLAUDE.md mandates copying the established env pattern rather than inventing one, and the exact pattern lives in `scripts/`. The executor must open one existing `scripts/*.mjs`, copy its mssql connection setup, and run the two SQL strings given above.

**Type consistency:** `getCurrentSeasonBowlerSlugs` returns `BowlerSlug[]` (matches `getAllBowlerSlugs`); `getCurrentSeasonTeamSlugs` returns `TeamSlug[]` (matches `getAllTeamSlugs`). `getCurrentSeasonSlug` returns `string | undefined` (existing), handled with `slug ? [{ slug }] : []`. `shouldServeMaintenance(pathname, mode)` signature is identical across the test, the helper, and the middleware call site. `MAINTENANCE_HTML` and `shouldServeMaintenance` are the only two exports consumed by `middleware.ts`.

**Baseline decision (locked):** option (a) — clean same-infra before/after via a temporary `phase1/baseline` branch pinned at the Task 1 commit. Russ wants hard evidence.
