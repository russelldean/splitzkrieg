# Phase 3: View-Model Page Reads (Consolidate Round-Trips)

Date: 2026-07-05
Status: Design approved (conversational). Ready to write the implementation plan.
Author: Russ + Claude
Part of the serving-model rebuild (`2026-07-05-serving-model-rebuild-design.md`), Phase 3.
Prior art: BaseHit `api-endpoint-design.md` (view-shaped reads), and the Track #2
"view models + read models" idea from `2026-07-04-live-data-migration-design.md`.

## Problem

The heavy content pages (bowler, team) are too slow to serve well on the $5 Azure
SQL DB. The bowler page renders in ~5-6s on demand (uncontended) and collapses
under load; prebuilding all of them melted the build (5:43 with 60s static-gen
timeouts). Phase 1 moved them fully on-demand to keep the build fast (34s), but
that just relocated the slowness to request time. These pages cannot go back to
the public until they are fast.

## Root Cause (measured, not assumed)

Profiling every bowler-page query against the live DB for the heaviest real bowler
(Amy Kostrewa, 302 games) showed **no slow query**: each runs in <200ms, and all
~9 bowler-specific SELECTs together are ~1 second of actual SQL. The 5-6s is not
database *work* — it is the **15 separate round-trips per page**, each carrying
connection + `cachedQuery` wrapper + 5-slot semaphore overhead, on a cold
serverless function. At build time the same structure means 134 pages × 15
round-trips overwhelmed the DB's *connection* limit (not its speed) — that was the
storm.

Two structural facts fall out:
1. ~6 of the 15 queries are **league-wide** (BOTW, weekly highlights, league
   milestones, league game averages, current-season lookups) and identical for
   every bowler, yet recomputed per page.
2. The remaining ~9 are bowler-specific but individually fast.

## Approach: consolidate round-trips into a per-page view model

Adopt BaseHit's convention: **one view-shaped read per page**. Each page gets a
single function that returns a flat DTO with exactly what the page renders, backed
by as few DB round-trips as possible. This is the target serving model and it
makes growth cheap ("new page = one view read + one route").

Crucially, the profiling says **we do NOT build precomputed read-model tables**.
The governing rule is "precompute only where measured slow," and nothing is slow.
The entire fix is collapsing round-trips. No new tables, no schema changes.

## Architecture

### `getBowlerPageView(bowlerID)` — one batched read
A new view-model function (proposed location `src/lib/views/bowler-page.ts`) that:
- Runs the page's ~9 bowler-specific SELECTs as a **single batched mssql request**
  returning multiple result sets (`result.recordsets[]`), i.e. **one round-trip**
  instead of nine. The SQL is **reused as-is** from the existing query modules
  (already correct and <200ms each); only the transport changes (one request).
- Is wrapped in a single `cachedQuery` with `dependsOn: ['scores']` and the
  per-bowler version tag, so the page has **one** cache entry instead of ~15.
- Computes the page's server-side derivations (isBowlerOfTheWeek, last-week deltas,
  team breakdown) internally and returns them on the DTO, so the page component
  stops deriving.
- Uses `throwOnError` semantics on the identity lookup so a DB failure is a
  retryable 500, never a cached 404 (consistent with the Phase 1 fragility fix).

### `getLeagueContext()` — fetched once, shared
A shared cached function returning the league-wide data (BOTW ids, weekly
highlights, league milestones, league game averages, current-season id/slug). One
cache entry reused across the whole site instead of recomputed per bowler. The
bowler page thus makes **~2 round-trips total** (bowler view + league context),
down from 15.

### The page becomes a flat read
`src/app/bowler/[slug]/page.tsx` collapses to roughly:
```
const bowler = await getBowlerBySlug(slug);   // gating lookup (throwOnError)
if (!bowler) notFound();
const [view, league] = await Promise.all([
  getBowlerPageView(bowler.bowlerID),
  getLeagueContext(),
]);
// render sections from view.* and league.*
```
No 15-way `Promise.all`, no in-page derivation.

### DTO shape
`getBowlerPageView` returns a single flat object whose fields map 1:1 to the
recordsets it fetches plus computed flags: `{ careerSummary, seasonStats, gameLog,
rollingAvgHistory, starStats, patches, facts, gameProfile, teams, lastWeekDelta,
... }`. The DTO is this page's contract — not shared with other pages' view models
(shared SQL is reused at the query layer, not by sharing DTOs).

## What stays the same (non-goals)
- **On-demand ISR** — bowler stays `generateStaticParams: []` for now. (With ~2
  round-trips it may later be cheap enough to prebuild; decide after measuring.)
- **The `cachedQuery` disk cache** and `dependsOn` channels — kept.
- **The existing SQL** — reused verbatim inside the batched request.
- **The DB schema** — untouched. No new tables, no views, no migrations.
- **What the page displays** — unchanged. (Trimming low-value sections is a
  separate product decision, not part of this perf work.)
- **The generic query functions** — kept; the home page and others still use them.
  We only stop composing 15 of them on the bowler page.
- **No precompute/read-model tables** — revisit only if a specific future query
  ever profiles slow.

## Pilot then rollout
1. **Bowler page pilot.** Build `getBowlerPageView` + `getLeagueContext`, convert
   the page, verify.
2. **Verify (evidence gate):** on-demand render drops from ~5-6s toward ~1s
   (measure via the `[QUERY_SLOW]` telemetry + direct timing behind the bypass),
   and confirm a batched build would not storm the DB (~2 round-trips × 134 pages).
3. **Roll the identical shape** to the team page, then season/week/stats, one at a
   time, each independently shippable behind the maintenance wall.
4. When the linked-together core (season/standings/stats/weeks + bowler + team) is
   all fast, relaunch the whole site from behind the wall together (avoids broken
   inter-page links).

## Testing / verification
- **Correctness:** the view-model must return the same data the page renders today.
  Verify by comparing a rendered bowler page before/after for several bowlers
  (heavy, light, current-season, historical, edge cases like penalty/ghost).
- **Performance:** time `getBowlerPageView` (one round-trip) vs the old 15-call
  path against the live DB; confirm the page renders <~1s behind the bypass.
- **Unit:** the DTO-assembly / derivation logic (deltas, team breakdown, flags)
  is pure and unit-testable from fixture recordsets.
- **Safety:** run `scripts/phase3/profile-bowler.mjs` (or a view-model variant) to
  confirm round-trip count and timing; use the on-demand-safe `smoke-404` checker
  (never crawl on-demand pages concurrently).

## Risks and mitigations
| Risk | Mitigation |
|------|------------|
| Batched multi-statement request shares params awkwardly | All bowler-specific SELECTs key on `@bowlerID`; league-wide data is a separate request. Split into 2 batched requests if param needs diverge. |
| View-model drifts from what the page shows | DTO is the page's contract; before/after render comparison in verification. |
| Round-trip consolidation doesn't reach ~1s | Measure at the pilot gate before rolling out; if per-request overhead dominates, investigate connection warmth/pooling next (still no precompute tables). |
| Regressions in reused SQL | SQL is copied verbatim, not rewritten; correctness comparison per bowler. |

## Success criteria
- Bowler page renders in roughly a second on demand behind the bypass.
- The page makes ~2 DB round-trips instead of 15.
- Bowler pages could be prebuilt without a connection storm (verified by a batched
  build, if we choose to prebuild).
- The same view-model shape is applied to team/season/week/stats.
- No new DB tables or schema changes; the bespoke `cachedQuery` cache still works.
