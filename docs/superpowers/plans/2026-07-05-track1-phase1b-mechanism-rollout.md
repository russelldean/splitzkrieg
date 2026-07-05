# Track #1 Phase 1b: Mechanism Rollout (taggedQuery + tags, incremental, no previews)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate every `cachedQuery` call to the proven `taggedQuery` (Next Data Cache + tags), convert pages to ISR, and wire `revalidateTag` into the edit/import flows — rolled out in bounded batches on `main`, each validated locally and on production behavior, with **no preview dependency** and **no DB tier bump**.

**Architecture:** The pilot (2026-07-04) proved `taggedQuery` + `revalidateTag('max')` + ISR integrate cleanly. Phase 1b is the *rollout*, not new mechanism. The one real hazard is the cold-build cost: migrating a query abandons its warm `.next/cache/sql` disk entry, so on the first deploy after migration every page calling that query re-executes it against the 5-DTU DB. We keep that cost bounded per deploy (≤ ~80 page-executions, the proven publish-week ceiling) by batching by **page fan-out**, sequencing low-fan-out/current-season first, and **gating the heavy bowler-career queries on Track #2** (a read model) rather than melting the DB. `cachedQuery` stays in the tree as the untouched fallback until a later retire phase.

**Tech Stack:** Next.js 16.1.6 (`unstable_cache`, `revalidateTag(tag, 'max')`), React 19, Azure SQL (mssql, 5-DTU Basic, 30-connection cap), Vitest, Vercel (Data Cache persists across deploys; auto-cancel should be ON).

**Reference spec:** `docs/superpowers/specs/2026-07-04-live-data-migration-design.md`
**Pilot results:** `docs/superpowers/plans/2026-07-04-track1-phase1-RESULTS.md`

---

## Design: how a query maps to tags

Every migrated query declares tags by these rules. This is the whole taxonomy — no query needs a bespoke decision beyond applying the matching rule.

| Rule | When | Tags | Example |
|------|------|------|---------|
| **A — entity-scoped** | fn takes a `bowlerID` or `teamID` | `bowler-<id>` or `team-<id>` | `getBowlerGameLog` → `[bowler-<id>]` |
| **B — season-scoped** | fn takes a `seasonID` | the channel tag(s) for that season | `getSeasonSchedule` → `[schedule-<seasonID>]` |
| **C — cross-season** | no scope param; reads all seasons | the **coarse** channel tag | `getAllTimeLeaderboard` → `[scores]` |
| **D — identity/stable** | current `stable: true` (identity/lookup) | the entity/season it identifies, long TTL | `getBowlerBySlug` → `[bowler-<id>]`, `revalidate:false` |

**Channel → tag translation** (from the current `dependsOn` value):

- `dependsOn: ['scores']` + seasonID → `scores-<seasonID>`; no seasonID → coarse `scores`
- `dependsOn: ['schedule']` + seasonID → `schedule-<seasonID>`; no seasonID → coarse `schedule`
- `dependsOn: ['playoffScores']` + seasonID → `playoffs-<seasonID>`; no seasonID → coarse `playoffs`
- `dependsOn: ['scores','schedule']` → both season (or both coarse) tags
- entity-scoped queries **also** get their `bowler-<id>`/`team-<id>` tag so a rename/edit refreshes them precisely

**Revalidation contract** (the mirror image — wired in Task 3):

- Score import for season N → `revalidateTag('scores-N')` **and** `revalidateTag('scores')` (coarse busts cross-season boards) **and** `revalidateTag('bowler-<id>')` for each bowler who bowled that week (the route already computes this set)
- Schedule import for season N → `revalidateTag('schedule-N')` + `revalidateTag('schedule')`
- Playoff import for season N → `revalidateTag('playoffs-N')` + `revalidateTag('playoffs')`
- Bowler rename id X → `revalidateTag('bowler-X')` + `revalidateTag('scores')` (kills the five-commit ritual — see spec Problem section)
- Team rename id X → `revalidateTag('team-X')` + `revalidateTag('scores')`

---

## Deploy safety model (why the batches are shaped this way)

**The cost:** first deploy after migrating query Q re-executes Q once per page that calls it. Warm-cache deploys of unmigrated queries stay free (disk cache restored). After Q's first deploy its Data Cache is warm and future deploys restore it.

**The ceiling:** publish-week already busts ~80 bowler pages + current-season queries and survives. Treat **~80 page-executions per deploy** as the safe bound. Cheap reads (single season-week rows, ~200ms) tolerate higher counts; the killers are the **heavy bowler career aggregations (4-6s each, Phase 0-measured)**.

**Page fan-outs** (confirm exact counts from `generateStaticParams` output during execution):
- Home: 1 page
- All-time / stats / directories: a handful of pages
- Season pages: ~35 (one per season)
- Team pages: ~40-60 (all franchises)
- Week pages: ~385 (35 seasons × 11 weeks) — cheap queries only
- Bowler pages: ~297 × 14 queries — **the hazard**

**The bowler gate:** cheap bowler queries (identity, patches, star stats, game log, rolling avg) migrate safely one-per-deploy (~297 cheap executions, tolerable). The expensive career-aggregation queries (`getBowlerCareerSummary`, `getBowlerSeasonStats`, `getBowlerGameProfile`) are **NOT migrated in Phase 1b** — 297 × 4-6s cold is the exact meltdown the pilot warned about. They wait for Track #2's `bowlerCareerStats` read model (spec Phase 4), which makes them cheap first. This is the deliberate handoff between tracks; the governing principle ("precompute only when measured") is satisfied because we measured.

---

## Task 0: Establish a clean Phase 1b branch off `main`

The pilot proved 5 clean feature commits that are NOT on `main` and NOT the throwaway prebuild-skip. Re-land exactly those onto a fresh branch; the bowler page stays as `main`'s (prebuilt) because we do not bring `f1360ab`.

**Files:** (none edited directly — git operations)

- [ ] **Step 1: Create the branch from `main`**

```bash
git checkout main
git pull --ff-only
git checkout -b track1/phase1b
```

- [ ] **Step 2: Cherry-pick the 5 proven foundation commits, in order**

```bash
git cherry-pick dddcaa6 c762453 76e43bc 1f44285 2d5f781
```

These are: `taggedQuery` helper, `cache-tags` vocabulary, `getCurrentSeasonSnapshot` migration, home-page ISR, `/api/revalidate` scores tag. Expected: clean (intervening pilot commits were docs only; the throwaway `f1360ab` is deliberately excluded, so `src/app/bowler/[slug]/page.tsx` keeps `main`'s `generateStaticParams` + `dynamicParams = false`).

- [ ] **Step 3: Confirm the bowler page still prebuilds**

Run: `grep -n "dynamicParams\|generateStaticParams" src/app/bowler/[slug]/page.tsx`
Expected: `dynamicParams = false` present and a `generateStaticParams` export (i.e. NOT the pilot's `dynamicParams = true` with the prebuild removed). If the pilot version leaked in, revert that file to `main`'s: `git checkout main -- 'src/app/bowler/[slug]/page.tsx'`.

- [ ] **Step 4: Run the existing pilot tests + typecheck**

Run: `npx vitest run src/lib/tagged-query.test.ts src/lib/cache-tags.test.ts && npx tsc --noEmit`
Expected: PASS, exit 0.

- [ ] **Step 5: Confirm Vercel auto-cancel is ON (RUSS — one-time, not code)**

RUSS: Vercel → splitzkrieg → Settings → Git → **Auto-cancel** = enabled, so a new push kills the prior build (RESULTS decision #1). No code change; confirm and note in the batch log.

---

## Task 1: Extend the tag taxonomy (coarse channels + playoffs + pointers)

**Files:**
- Modify: `src/lib/cache-tags.ts`
- Test: `src/lib/cache-tags.test.ts`

- [ ] **Step 1: Add the failing assertions**

Append inside the existing `describe('cache-tags')` block in `src/lib/cache-tags.test.ts`:

```ts
it('exposes coarse channel tags for cross-season queries', () => {
  expect(tags.scoresAll).toBe('scores');
  expect(tags.scheduleAll).toBe('schedule');
  expect(tags.playoffsAll).toBe('playoffs');
});

it('builds per-season playoff tags and the current-season pointer', () => {
  expect(tags.playoffsForSeason(36)).toBe('playoffs-36');
  expect(tags.currentSeasonPointer).toBe('current-season');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/cache-tags.test.ts`
Expected: FAIL — `scoresAll` etc. undefined.

- [ ] **Step 3: Extend `src/lib/cache-tags.ts`**

```ts
/**
 * Central tag vocabulary for taggedQuery + revalidateTag. One place so tag
 * strings never drift between where they are set and where they are revalidated.
 *
 * Per-season tags scope invalidation to one season (Rule B). Coarse channel
 * tags (scoresAll/scheduleAll/playoffsAll) cover cross-season queries (Rule C):
 * an import revalidates BOTH the per-season tag and the coarse tag. Entity tags
 * (bowler/team) let a rename or single-bowler edit refresh precisely (Rule A/D).
 */
export const tags = {
  // per-season channel tags (Rule B)
  scoresForSeason: (seasonId: number) => `scores-${seasonId}`,
  scheduleForSeason: (seasonId: number) => `schedule-${seasonId}`,
  playoffsForSeason: (seasonId: number) => `playoffs-${seasonId}`,
  // coarse channel tags for cross-season reads (Rule C)
  scoresAll: 'scores',
  scheduleAll: 'schedule',
  playoffsAll: 'playoffs',
  // entity tags (Rule A / rename ritual killer)
  bowler: (bowlerId: number) => `bowler-${bowlerId}`,
  team: (teamId: number) => `team-${teamId}`,
  // identity / pointers (Rule D)
  season: (seasonId: number) => `season-${seasonId}`,
  currentSeasonPointer: 'current-season',
} as const;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/cache-tags.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/cache-tags.ts src/lib/cache-tags.test.ts
git commit -m "feat: extend cache-tag taxonomy (coarse channels, playoffs, current-season pointer)"
```

---

## Task 2: Define the migration transform + the per-batch validation loop

This task writes NO product code. It pins down the exact mechanical transform (applied verbatim in every batch task) and the validation loop (run after every batch deploy). Batch tasks reference this by name instead of repeating it — the transform is genuinely identical; only the key/tags/fallback vary, and those are tabulated per query.

- [ ] **Step 1: The transform (apply to one `cachedQuery` call at a time)**

Given an existing call:
```ts
return cachedQuery(KEY, async () => { /* BODY */ }, FALLBACK, { sql: SQL, dependsOn: [...] , seasonID?, stable? });
```
Rewrite as:
```ts
import { taggedQuery } from '@/lib/db';        // if not already imported
import { tags } from '@/lib/cache-tags';        // if not already imported

return taggedQuery(
  KEY,                                          // keep the SAME key string (params included)
  async () => { /* the EXACT same BODY */ },
  FALLBACK,                                     // the SAME fallback value
  { tags: [ /* per the Design table */ ], revalidate: REVALIDATE },
);
```
Rules:
- **Drop** `sql`, `dependsOn`, `stable`, `seasonID`, `includePublishedTag` — the tag system replaces all of them.
- **Keep** key, body, fallback byte-for-byte.
- `REVALIDATE`: current-season/home = `120`; season-scoped historical = `false` (tag-only); cross-season boards = `3600`; identity/stable = `false`.
- The per-query `tags` array comes straight from the Design rules; each batch task lists them.

- [ ] **Step 2: The per-batch validation loop (run after EACH batch's deploy — no preview)**

1. **Local, before commit:** `npm run dev` (or `dev:fresh` if data looks stale). Load each affected page once (cold → 1 DB log per migrated query), reload within TTL (warm → no repeat DB log). Record the observation.
2. **Local revalidate:** `curl -s -X POST "http://localhost:3000/api/revalidate?secret=$REVALIDATION_SECRET" | head` → reload the affected page → the migrated query hits the DB again. Confirms the tag path.
3. **Typecheck + invariants:** `npx tsc --noEmit && node scripts/check-cache-invariants.mjs`.
4. **Deploy (push to `main` after Russ signs off the batch):** watch the Vercel build. **Abort criterion:** if the build's DB time balloons or a page times out (60s), the batch was too large / a query too heavy — roll back that batch (`git revert`), shrink it, and if it's a heavy bowler-career query, STOP and route to Track #2.
5. **Post-deploy:** load the affected production pages, confirm 200 + correct data; watch the Vercel Usage tab for an invocation spike (spend alert already set ~$30).

- [ ] **Step 3: No commit** (documentation-only task; nothing to build).

---

## Task 3: Wire `revalidateTag` for every tag family (edit/import flows)

Do this BEFORE the bulk query migrations so that as each batch lands, its tags are already invalidated correctly by the existing publish/import flows. The route already fires `revalidateTag(scores-<current>)`; extend it to the full contract.

**Files:**
- Modify: `src/app/api/revalidate/route.ts`
- Modify: `scripts/import-week-scores.mjs`, `scripts/import-schedule-csv.mjs` (add tag calls after a successful import — or, if they only touch the DB, have them POST `/api/revalidate`; match each script's existing pattern)

- [ ] **Step 1: Extend `/api/revalidate` to fire coarse + entity tags**

In `src/app/api/revalidate/route.ts`, after `seasonID` resolves and `bowlerSlugs` (and their ids) are computed, add alongside the existing `revalidateTag(tags.scoresForSeason(seasonID), 'max')`:

```ts
// Coarse channel bust so cross-season boards (all-time, directories) refresh.
revalidateTag(tags.scoresAll, 'max');
// Per-bowler tags for only the bowlers who bowled this week (scoping preserved).
// bowlerRes already selects slug; also select bowlerID:
//   SELECT DISTINCT b.slug, b.bowlerID FROM scores s JOIN bowlers b ...
for (const { bowlerID } of bowlerRows) {
  revalidateTag(tags.bowler(bowlerID), 'max');
}
```
(Adjust the `bowlerRes` query to also return `bowlerID`; keep the `slug` list for the existing `revalidatePath` loop unchanged.)

- [ ] **Step 2: Add a rename/schedule/playoff revalidation entrypoint**

Extend the route to accept an optional JSON body `{ tags: string[] }` (still behind the secret) that fires `revalidateTag(t, 'max')` for each — this is what the rename workflow and schedule/playoff imports call. Guard: reject any tag not matching `/^(scores|schedule|playoffs|bowler|team|season)(-\d+)?$|^current-season$/` so the endpoint can't be used to bust arbitrary tags.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/api/revalidate/route.ts scripts/import-week-scores.mjs scripts/import-schedule-csv.mjs
git commit -m "feat: revalidate full tag contract (coarse scores + per-bowler + rename/import entrypoint)"
```

---

## Batches 4-11: query migrations (each = apply Task 2 transform, validate, deploy)

Each batch below lists its queries with **file:line (at plan time)**, **tags** (Design rules), and **revalidate**. For each batch: apply the Task 2 transform to every listed call, run the Task 2 validation loop, get Russ's sign-off, deploy. One batch per deploy.

### Task 4 — Batch A: Home + current-season singletons (fan-out: ~1 page)

Lowest risk; proves the loop end-to-end on `main`. `getCurrentSeasonSnapshot` is already migrated.

| Query | File | Tags | revalidate |
|-------|------|------|-----------|
| `getRecentMilestones` | `home.ts:83` | `[tags.scoresAll]` | 120 |
| `getWeeklyHighlights` | `home.ts:361` | `[tags.scoresForSeason(current)]` | 120 |
| `getBowlerOfTheWeek` | `bowlers.ts:384` | `[tags.scoresForSeason(current)]` | 120 |
| `getLeagueMilestones` | `milestones.ts:242` | `[tags.scoresAll]` | 120 |

- [ ] Apply transform to all four. `getWeeklyHighlights`/`getBowlerOfTheWeek` resolve the current season internally — tag with that resolved id.
- [ ] Run Task 2 validation loop. Commit `feat: migrate home/current-season singleton queries to taggedQuery`. Deploy after sign-off.

### Task 5 — Batch B: All-time / stats / directories (fan-out: handful of pages, all coarse `scores`)

| Query | File | Tags | revalidate |
|-------|------|------|-----------|
| `getAllTimeLeaderboard` | `alltime.ts:92` | `[tags.scoresAll]` | 3600 |
| `getHighGameProgression` | `alltime.ts:257` | `[tags.scoresAll]` | 3600 |
| `getGameProfiles` | `alltime.ts:388` | `[tags.scoresAll]` | 3600 |
| `getLeagueGameAvgs` | `alltime.ts:443` | `[tags.scoresAll]` | 3600 |
| `getAllBowlersDirectory` | `bowlers.ts:416` | `[tags.scoresAll]` | 3600 |
| `getAllTeamsDirectory` | `teams/history.ts:219` | `[tags.scoresAll]` | 3600 |
| `getTeamSeasonPresence` | `teams/history.ts:244` | `[tags.scoresAll]` | 3600 |
| `getDataCompleteness` | `seasons/core.ts:177` | `[tags.scoresAll]` | 3600 |
| `getTotalPinsKnockedDown` | `seasons/core.ts:196` | `[tags.scoresAll]` | 3600 |
| `getRandomFacts` | `facts.ts:119` | `[tags.scoresAll]` | 3600 |

- [ ] Apply, validate, commit `feat: migrate all-time/directory queries to taggedQuery (coarse scores tag)`, deploy.

### Task 6 — Batch C: Season identity + nav (fan-out: ~35 pages, but cheap; generateStaticParams feeders)

**Caution:** `getAllSeasonSlugs` / `getAllBowlerSlugs` / `getAllTeamSlugs` feed `generateStaticParams` (CLAUDE.md: never add version comments to these). Migrating them to `taggedQuery` is safe (no SQL-hash keying at all), but set `revalidate: 3600` and coarse tags — never a short TTL on a params feeder.

| Query | File | Tags | revalidate |
|-------|------|------|-----------|
| `getAllSeasonSlugs` | `seasons/core.ts:52` | `[tags.currentSeasonPointer]` | 3600 |
| `getSeasonBySlug` | `seasons/core.ts:73` | `[tags.season(id)]` (resolve id in body) | false |
| `getAllSeasonsDirectory` | `seasons/core.ts:111` | `[tags.currentSeasonPointer]` | 3600 |
| `getAllSeasonNavList` | `seasons/core.ts:131` | `[tags.currentSeasonPointer]` | 3600 |
| `getCurrentSeasonID` | `bowlers.ts:361` | `[tags.currentSeasonPointer]` | 3600 |
| `getSeasonIDByRoman` | `blog.ts:15` | `[tags.currentSeasonPointer]` | false |
| `getAllBowlerSlugs` | `bowlers.ts:27` | `[tags.currentSeasonPointer]` | 3600 |
| `getAllTeamSlugs` | `teams/profile.ts:124` | `[tags.currentSeasonPointer]` | 3600 |

- [ ] Apply, validate, commit `feat: migrate season/nav identity queries to taggedQuery`, deploy.
- [ ] Confirm the season rollover admin action (new `isCurrentSeason`) fires `revalidateTag('current-season')` — add it to whatever flips the flag (or note it as a follow-up if that flow is manual).

### Task 7 — Batch D: Season-page data, per-season (fan-out: ~35 pages; split into D1/D2 across two deploys)

~12 season-scoped queries × 35 pages. Split into two deploys of ≤6 queries each so each deploy is ≤ ~35 pages × the migrated subset. Standings/match-results depend on the schedule channel; scoring reads on the scores channel.

**Deploy D1 (scores channel):**

| Query | File | Tags | revalidate |
|-------|------|------|-----------|
| `getSeasonWeeklyScores` | `seasons/weekly.ts:163` | `[tags.scoresForSeason(id)]` | false |
| `getSeasonWeekSummaries` | `seasons/weekly.ts:287` | `[tags.scoresForSeason(id)]` | false |
| `getSeasonRecords` | `seasons/records.ts:97` | `[tags.scoresForSeason(id)]` | false |
| `getSeasonHeroStats` | `seasons/records.ts:191` | `[tags.scoresForSeason(id)]` | false |
| `getSeasonFullStats` | `seasons/standings.ts:464` | `[tags.scoresForSeason(id)]` | false |
| `getStandingsRaceData` | `seasons/standings.ts:512` | `[tags.scoresForSeason(id)]` | false |

**Deploy D2 (schedule + leaderboard):**

| Query | File | Tags | revalidate |
|-------|------|------|-----------|
| `getSeasonSchedule` | `seasons/weekly.ts:100` | `[tags.scheduleForSeason(id)]` | false |
| `getSeasonMatchResults` | `seasons/weekly.ts:198` | `[tags.scheduleForSeason(id), tags.scoresForSeason(id)]` | false |
| `getSeasonStandings` | `seasons/standings.ts:224` | `[tags.scheduleForSeason(id), tags.scoresForSeason(id)]` | false |
| `getPlayoffTeamIDs` | `seasons/standings.ts:247` | `[tags.scheduleForSeason(id)]` | false |
| `getSeasonLeaderboard` | `seasons/standings.ts:316,387` | `[tags.scoresForSeason(id)]` | false |

- [ ] **Note:** `getSeasonSchedule` is the **S36-schedule reference query** — the near-term schedule-upload task exercises exactly this path. When the current season is S36, its `schedule-36` tag is what the schedule import revalidates. (The upload task itself ships separately on the current system; this just makes its query tag-native.)
- [ ] Apply D1, validate, commit `feat: migrate season scores-channel queries to taggedQuery`, deploy. Then D2, validate, commit `feat: migrate season schedule-channel queries to taggedQuery`, deploy.

### Task 8 — Batch E: Playoffs (fan-out: ~35 season pages + a few index pages)

| Query | File | Tags | revalidate |
|-------|------|------|-----------|
| `getSeasonPlayoffBracket` | `seasons/playoffs.ts:79` | `[tags.playoffsForSeason(id)]` | false |
| `getSeasonIndividualChampions` | `seasons/playoffs.ts:250` | `[tags.playoffsForSeason(id)]` | false |
| `getSeasonChampionsCard` | `seasons/playoffs.ts:289` | `[tags.playoffsForSeason(id)]` | false |
| `getAllPlayoffHistory` | `seasons/playoffs.ts:193` | `[tags.playoffsAll]` | 3600 |
| `getAllIndividualChampions` | `seasons/playoffs.ts:312` | `[tags.playoffsAll]` | 3600 |
| `getTeamChampionshipWins` | `seasons/playoffs.ts:327` | `[tags.playoffsAll]` | 3600 |
| `getIndividualChampionshipWins` | `seasons/playoffs.ts:349` | `[tags.playoffsAll]` | 3600 |
| `getTeamPlayoffScoresheet` | `playoffs/scores.ts:42` | `[tags.playoffsForSeason(id)]` | false |
| `getIndividualBracket` | `playoffs/scores.ts:94` | `[tags.playoffsForSeason(id)]` | false |
| playoffs/page.ts (3 calls) | `playoffs/page.ts:71,147,191` | `[tags.playoffsForSeason(id)]` / `[tags.playoffsAll]` | false / 3600 |

- [ ] Apply, validate, commit `feat: migrate playoff queries to taggedQuery`, deploy.

### Task 9 — Batch F: Team pages, per-team (fan-out: ~40-60 pages; split F1/F2 if needed)

| Query | File | Tags | revalidate |
|-------|------|------|-----------|
| `getTeamBySlug` | `teams/profile.ts:142` | `[tags.team(id)]` | false |
| `getTeamCurrentStanding` | `teams/profile.ts:109` | `[tags.team(id), tags.scoresForSeason(current)]` | 120 |
| `getTeamCurrentRoster` | `teams/roster.ts:66` | `[tags.team(id)]` | false |
| `getTeamSeasonBowlers` | `teams/roster.ts:97` | `[tags.team(id), tags.scoresForSeason(seasonID)]` | false |
| `getTeamAllTimeRoster` | `teams/roster.ts:143` | `[tags.team(id)]` | false |
| `getTeamSeasonBySeason` | `teams/history.ts:139` | `[tags.team(id)]` | false |
| `getTeamFranchiseHistory` | `teams/history.ts:161` | `[tags.team(id)]` | false |
| `getTeamPlayoffFinishes` | `teams/history.ts:268` | `[tags.team(id)]` | false |
| `getTeamH2H` | `teams/h2h.ts:116` | `[tags.team(id)]` | false |
| `getTeamPlayoffH2H` | `teams/h2h.ts:256` | `[tags.team(id)]` | false |
| `getTeamH2H` (compound) | `teams/h2h.ts:293` | `[tags.team(id)]` | false |
| `getGhostTeamH2H` | `teams/h2h.ts:194` | `[tags.scoresAll]` | 3600 |
| `getActiveTeamIDs` | `teams/h2h.ts:215` | `[tags.currentSeasonPointer]` | 3600 |

- [ ] Apply (F1 = profile+roster, F2 = history+h2h if you want two smaller deploys), validate, commit, deploy.

### Task 10 — Batch G: Week pages, per-season-week (fan-out: ~385 pages — CHEAP queries only)

385 pages is above the ~80 ceiling, but every query here reads a single season-week (~200ms). Migrate **one query per deploy** so each deploy is 385 cheap executions, not 385 × several. Watch the build closely (Task 2 abort criterion); if a single week query strains the build, that's the signal it isn't as cheap as assumed — split by reducing week-page prebuild is NOT allowed (changes behavior), so instead accept a slower build with retry, or defer that one query.

One query per deploy, in this order (cheapest first):

| Order | Query | File | Tags | revalidate |
|-------|-------|------|------|-----------|
| 1 | `getMatchResultsSummary` | `blog.ts:296` | `[tags.scheduleForSeason(seasonID)]` | false |
| 2 | `getStandingsSnapshot` | `blog.ts:357` | `[tags.scheduleForSeason(seasonID)]` | false |
| 3 | `getLeaderboardSnapshot` | `blog.ts:438` | `[tags.scoresForSeason(seasonID)]` | false |
| 4 | `getTopPerformers` | `blog.ts:79` | `[tags.scoresForSeason(seasonID)]` | false |
| 5 | `getWeekMilestones` | `blog.ts:171` | `[tags.scoresForSeason(seasonID)]` | false |
| 6 | `getWeekCareerMilestones` | `milestones.ts:278` | `[tags.scoresForSeason(seasonID)]` | false |

- [ ] For each: apply, validate, commit `feat: migrate <query> to taggedQuery (week pages)`, deploy, confirm the build stayed healthy before starting the next.

### Task 11 — Batch H: Bowler pages — CHEAP queries only (fan-out: ~297 pages; heavy queries GATED)

Migrate only the cheap per-bowler queries, **one per deploy**. The expensive career aggregations are **excluded** and tracked as the Track #2 handoff.

**Migrate (cheap, one per deploy):**

| Query | File | Tags | revalidate |
|-------|------|------|-----------|
| `getBowlerBySlug` | `bowlers.ts:45` | `[tags.bowler(id)]` (resolve id in body) | false |
| `getBowlerPatches` | `bowlers.ts:466` | `[tags.bowler(id)]` | false |
| `getBowlerStarStats` | `bowlers.ts:492` | `[tags.bowler(id)]` | false |
| `getBowlerGameLog` | `bowlers.ts:310` | `[tags.bowler(id)]` | false |
| `getBowlerRollingAvgHistory` | `bowlers.ts:345` | `[tags.bowler(id)]` | false |
| `getBowlerFacts` | `facts.ts:88` | `[tags.bowler(id)]` (when bowler-scoped) | false |

**DO NOT MIGRATE in Phase 1b (Track #2 gated — 297 × 4-6s cold = meltdown):**
- `getBowlerCareerSummary` (`bowlers.ts:159`)
- `getBowlerSeasonStats` (`bowlers.ts:241`)
- `getBowlerGameProfile` / `getLeagueGameAvgs` career-agg path (`alltime.ts`)

- [ ] Migrate each cheap query one-per-deploy; validate; watch the build. Commit `feat: migrate cheap bowler queries to taggedQuery`.
- [ ] **Record the gate:** these three heavy queries stay on `cachedQuery` until Track #2 Phase 4 builds `bowlerCareerStats`. Note it in the batch log and in the Track #2 spec section. This is the correct, measured stopping point — not a failure.

---

## Task 12: Convert remaining prebuilt pages to ISR

Queries are now tag-native; add `export const revalidate = N` per template so tags actually drive refresh (home already done in Task 0). Keep `generateStaticParams` + `dynamicParams = false` (prebuild stays; spec "heavy pages stay prebuilt").

**Files (one commit per template, low risk — no DB cost, just ISR flags):**

- [ ] `src/app/season/[slug]/page.tsx`: `export const revalidate = 120` (current season is short-TTL; historical seasons rarely change but the tag handles correctness — 120 is a safe backstop). Also `standings`/`stats` sub-routes.
- [ ] `src/app/week/[seasonSlug]/[weekNum]/page.tsx`: `export const revalidate = 300`.
- [ ] `src/app/team/[slug]/page.tsx`: `export const revalidate = 300`.
- [ ] `src/app/bowler/[slug]/page.tsx`: `export const revalidate = 300` (prebuild intact; heavy career queries still `cachedQuery` until Track #2).
- [ ] Typecheck, commit `feat: ISR revalidate on season/week/team/bowler pages`, deploy, confirm production pages still 200 and refresh on tag bust.

---

## Task 13: Verify the loop end-to-end + record the retire decision

- [ ] **Step 1: Prove a live publish via tags only.** Run a real score publish (or dry-run against dev): confirm the affected current-season pages + the bowlers-who-bowled refresh from ONE `/api/revalidate` call, no cache-file work, no `.data-versions.json` bump needed for migrated queries.
- [ ] **Step 2: Prove the rename ritual is dead.** Rename a test bowler; confirm `revalidateTag('bowler-<id>')` + `revalidateTag('scores')` refreshes their page + the boards, replacing the five-commit string-patch ritual ([[feedback_rename_workflow]]).
- [ ] **Step 3: Write results** to `docs/superpowers/plans/2026-07-05-track1-phase1b-RESULTS.md`: which batches landed, build health per deploy, the bowler-heavy gate, and whether `cachedQuery` is now dead (only the 3 gated queries + any missed call sites still use it).
- [ ] **Step 4: Retire decision (do NOT execute here).** Deleting `cachedQuery` / `.data-versions.json` / channels / `stable` flags / `.published-week` is **spec Phase 3**, gated on (a) the 3 heavy bowler queries migrating after Track #2, and (b) a clean full week + publish cycle on the new path (spec "What We Keep"). List remaining `cachedQuery` callers so Phase 3 has an exact worklist.
- [ ] **Step 5: Commit and report to Russ.** Merge/keep decisions per batch are Russ's; nothing here forces a big-bang.

---

## Self-Review Notes

- **Spec coverage:** Implements spec Track #1 Phase 1 (introduce `unstable_cache`+tags on the query layer, convert pages to ISR, keep `cachedQuery` as fallback) and Phase 2 (rewire `/api/revalidate` + import/rename flows to `revalidateTag`), batched for the 5-DTU cold-build constraint the pilot surfaced. Spec Phase 3 (retire old system) is explicitly deferred to Task 13 Step 4, not executed. Track #2 (view models/read models) is out of scope; the heavy bowler queries are the documented handoff.
- **Cold-build safety:** every batch is sized against the ~80-page publish-week ceiling; the one over-ceiling batch (week pages, ~385) is cheap-read-only and migrated one query per deploy with an explicit abort criterion; the genuine hazard (297 heavy bowler pages) is gated on Track #2, not attempted.
- **No preview dependency:** all validation is local + production-behavior (Task 2 loop). Previews are never required, per RESULTS decision 2(d).
- **Placeholder scan:** `current`/`id`/`seasonID` are runtime values resolved in each query body, not unspecified logic; every batch tabulates the exact key-bearing function, file:line, tag expression, and TTL. `f1360ab`/the 5 cherry-pick SHAs are real commits verified present on the pilot branch and absent from `main`.
- **Type consistency:** `taggedQuery(key, fn, fallback, { tags, revalidate })` and the `tags.*` helpers (incl. the Task 1 additions `scoresAll`/`scheduleAll`/`playoffsAll`/`playoffsForSeason`/`currentSeasonPointer`) are used identically across Tasks 1-12. Line numbers are plan-time snapshots — Task 2 Step 1 relocates each call by name before editing, so drift is self-correcting.
