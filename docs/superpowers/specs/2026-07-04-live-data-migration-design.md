# Live Data + Mature Data Model: Retire the Build-Time Cache

Date: 2026-07-04
Status: Phase 0 complete (GO). Two-track plan approved. Ready to plan Track #1.
Author: Russ + Claude

## Problem

Splitzkrieg is a static Next.js site that fetches from Azure SQL at build time.
To avoid a full rebuild hammering the 5-DTU DB past its 30-connection limit, a
bespoke disk cache (`cachedQuery` in `src/lib/db.ts`) was layered on top: MD5 of
the SQL string, per-season data versions in `.data-versions.json`, dependency
"channels", and `stable` flags.

That cache is the project's single largest source of friction and wasted time.
Renaming one bowler ("J Peters") took five commits (channel bump, patch cached
query files, fix invalidation, remove one-shot patch). The CLAUDE.md's biggest
section is a cache "NEVER DO THESE" list. Four memory files exist solely to
document cache rules.

Separately, the query layer grew organically: ~55 generic, model-shaped query
functions that each page composes ad hoc. No page has a defined data contract.
The bowler page alone fires 14 generic career-aggregation queries. This is the
"everything available to everybody, patched on over time" design Russ wants to
mature.

## Phase 0 Findings (measured 2026-07-04)

Full detail in `docs/superpowers/plans/2026-07-04-phase0-RESULTS.md`. Measured on
a real Vercel preview against the production DB:

- Region colocation is GOOD: DB is North Central US (Chicago), Vercel functions
  pin to `cle1` (Cleveland), ~8-15ms apart. No region fix needed.
- Prebuilt / cached pages serve in ~150ms. Great.
- A heavy bowler page rendered ON DEMAND takes 4 to 6 seconds. The page is
  ALREADY fully parallelized (14 queries in one `Promise.all`), so this is not a
  code problem: the 5-DTU Azure Basic tier is the ceiling. Career-wide
  aggregations across 35 seasons cannot render fast on demand on that DB.

Conclusion: "serve everything live on demand" is NOT viable for heavy pages on
the current DB tier. But two independent wins are: (1) swap the cache mechanism,
and (2) make heavy pages cheap enough to eventually serve live. Hence two tracks.

## Key Insight

The bespoke cache solves a BUILD-TIME problem (thousands of pages querying a tiny
DB at once), not a serve-time one. Two levers replace it:

1. Native Next ISR + tag-based invalidation removes the manual version ledger and
   the rename ritual. This is nearly free and independent of query cost.
2. Per-page view models backed by precomputed read-model tables make each page's
   read cheap and deliberate, which (later) unlocks true live-on-demand on the
   $5 DB with no tier bump.

## The Two-Track Plan

### Track #1: Mechanism swap (do first, near-free)

Replace the bespoke cache with native Next primitives. Heavy pages stay PREBUILT
and served from cache; on-demand render happens only as backgrounded
revalidation (stale-while-revalidate hides its cost).

- Cache query results with `unstable_cache(fn, keys, { tags: [...] })` in Next's
  Data Cache (persisted across deploys on Vercel, same benefit the disk cache
  gives today) instead of `cachedQuery`.
- Each cached query declares TAGS for what it depends on
  (`bowler-297`, `scores-36`, `season-36`).
- Invalidate with `revalidateTag('bowler-297')`: every result and page carrying
  that tag purges and re-renders from the DB (which already holds the truth). No
  cache-file patching, no version file.
- Outcome: kills the rename ritual (edit -> one `revalidateTag` call), deletes
  `cachedQuery` / `.data-versions.json` / channels / `stable` flags /
  `.published-week`. Does NOT change page data-fetching or remove build-time
  prerender.

### Track #2: View models + read models (incremental, unlocks true live)

Apply basehit's proven "view-shaped reads" lesson (Mike retired a generic
`?components=` pattern for exactly the reasons Russ describes; see
`~/projects/basehit/.claude/rules/api-endpoint-design.md`):

- Each page gets ONE deliberate view model (e.g. `getBowlerPageView(id)`) that
  returns exactly what the page renders, instead of composing ~14 generic
  queries. The view model is the page's data contract, owned in one place, cost
  auditable in one place.
- Back expensive aggregates with precomputed read-model summary tables (e.g.
  `bowlerCareerStats`), populated by the import pipeline. This extends the
  pattern the codebase already uses informally (`matchResults`, `bowlerPatches`,
  `bowlerMilestones`, `incomingAvg`, computed `hcpGame*` columns).
- Bowler page: ~14 live aggregations become 1 to 2 cheap indexed reads. On-demand
  render drops toward ~150ms, making true live-on-demand possible on the $5 DB.
- Read models are DERIVED from `scores` (source of truth), so they are
  regenerable and disposable. Changing what is precomputed is a rewrite-and-
  rebuild, never a data-loss risk.

## Governing Principle (keeps future work unhandcuffed)

Default to a cheap query in the view model. Promote a metric to a precomputed
read-model table ONLY when that path proves slow. YAGNI on read models. New
page ideas ship as cheap reads first; precomputation is a performance backstop
applied when measured, never a prerequisite for a feature. Eagerly precomputing
everything is the one way to make this design rigid; we do not do that.

## Goals

- Retire `cachedQuery`, `.data-versions.json`, channel hashes, `stable` flags,
  `.published-week`, and the rename-patch scripts (Track #1).
- Data edits propagate via a single `revalidateTag` call, no manual bookkeeping.
- Give each page a deliberate view model backed by read models where needed, so
  the data layer is mature and efficient (Track #2).
- Keep monthly cost at ~$26 (no DB tier bump).
- Never expose visitors to long delays: heavy pages stay cache-fast; on-demand
  render is backgrounded until Track #2 makes it cheap.

## Non-Goals

- No zero-staleness live serving via a DB tier bump (Option C, +$30 to $75/mo).
  Rejected explicitly.
- No DB engine change. Stay on Azure SQL Basic.
- No visual / feature redesign of pages. Track #2 changes the DATA layer (view
  models, read-model tables), not the rendered UI.
- No change to the `/evillair` admin dashboard, which already runs live
  (`force-dynamic`) and proves live queries work in production.

## Target Architecture

### Rendering: tiered ISR, heavy pages prebuilt

- Pages are ISR (`export const revalidate = N`). Current season/week/home get
  short TTLs (60 to 120s). Historical seasons get very long TTLs.
- Heavy pages keep `generateStaticParams` prebuild until Track #2 makes their
  view model cheap; then they can flip to on-demand ISR if desired.
- Stale-while-revalidate: visitors always get the cached page instantly while a
  refresh runs in the background.

### Invalidation: tags replace channels

- Query results tagged via `unstable_cache`; edits call `revalidateTag`.
- `revalidateTag('scores-36')` after a score import. `revalidateTag('bowler-297')`
  after a rename. Extends the existing `/api/revalidate` route (already does
  `revalidatePath` for current-season and per-bowler pages behind a secret).

### View models + read models

- One view-model query function per page, returning a flat page-shaped result.
- Precomputed summary tables for proven-expensive aggregates, maintained by the
  import pipeline alongside the normalized write tables.

### Serverless connection handling

- The current `mssql` pool (`max: 10`) assumes one long-lived build process. In
  SSR each function instance owns its own pool. Set a small pool max (2 to 3),
  keep Fluid Compute on (reuses warm instances), keep the `withRetry` backoff.

## What We Keep (safety)

- `cachedQuery` and `.data-versions.json` stay as the fallback path during Track
  #1, deleted only after a clean full week + publish cycle on the new path.
- Vercel Preview Deployments validate each change on a real-DB preview URL while
  `main` keeps serving production untouched. (Note: previews have Vercel
  Authentication on; use a Protection Bypass for Automation secret to measure
  them via curl.)
- Both tracks are incremental. Native-ISR and legacy pages coexist; view models
  roll out one page at a time.

## Migration Phases

### Phase 0: Prove it - DONE (GO)

See Phase 0 Findings above and the RESULTS doc.

### Track #1 - Mechanism swap

- Phase 1: Introduce `unstable_cache` + tags on the query layer. Convert pages to
  ISR (keep prebuild). Legacy `cachedQuery` remains as fallback.
- Phase 2: Rewire edit workflows. Extend `/api/revalidate` and import/admin flows
  to call `revalidateTag` for scores and per-bowler edits. Replace the
  `/evillair` publish button's rebuild trigger with revalidation. Rename becomes
  one `revalidateTag` call.
- Phase 3: Retire the old system. Delete `cachedQuery`, `.data-versions.json`,
  channel logic, `stable` flags, the rename-patch scripts, the CLAUDE.md cache
  section, and the obsolete cache memory files. Relax the `cpus: 4` build limit
  in `next.config.ts`.

### Track #2 - View models + read models (incremental)

- Phase 4: Pilot on the bowler page (worst offender). Design the
  `bowlerCareerStats` read model, populate it in the import pipeline, build
  `getBowlerPageView`, prove ~150ms on-demand render on a preview.
- Phase 5: Roll view models to team / season / week / stats pages, one at a time.
  Each is independently shippable.
- Phase 6: Where a page's view model is now cheap, optionally flip it to true
  on-demand ISR (drop prebuild) so genuinely-live pages need no rebuild at all.

## Vercel Usage Guardrails

Vercel usage can overshoot fast when misconfigured (reference: the 2026-04-06
Turbo build-machine incident burned $15.79 in 11 days). ISR moves the overshoot
risk from build minutes to function invocations and revalidation fan-out:

- TTL too short across many pages: never below 60s; history at very long TTL;
  only current-season pages get short TTLs.
- Revalidation storms: revalidate only the narrowest affected tag; preserve the
  existing "only bowlers who bowled this week" scoping in `/api/revalidate`.
- Self-referential / over-frequent revalidation: none; audit cron frequency.
- Accidental per-request image transforms: none; this touches data delivery.

Offsetting win: ISR reduces build cost (fewer pages generated per deploy).
Monitoring: watch the Vercel Usage tab and keep the spend alert set (done in
Phase 0, ~$30 notify).

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Serverless connection exhaustion | Small pool max (2 to 3), Fluid Compute, retry backoff |
| Query fails at request time (no build-time catch) | Graceful empty-states, `cachedQuery` fallbacks during migration, Vercel + PostHog monitoring |
| Cold never-rendered page latency (heavy pages, pre-Track-#2) | Keep heavy pages prebuilt; stale-while-revalidate; Basic tier is always-on (no serverless pause) |
| Read model drifts from source of truth | Read models are derived + regenerable; import pipeline updates them atomically with the write tables; a rebuild reconciles |
| Over-precomputation makes iteration rigid | Governing principle: cheap-by-default, precompute-when-measured |
| Regression we can't undo | Preview deploys + incremental rollout + keep old code until proven; Vercel one-click rollback |
| Vercel usage/cost overshoot | 60s TTL floor, narrow tags, no self-referential revalidation, spend alert |

## Costs

- Dollars: unchanged at ~$26/month. Function invocations at this traffic are
  negligible. The Vercel Pro $20 is edge/asset-driven and does not change.
- Effort: the real cost. Track #1 is a few focused sessions. Track #2 is ongoing
  and incremental, one page at a time, at whatever pace suits.

## Success Criteria

- A score publish goes live via one `revalidateTag` call, no rebuild, no manual
  cache bookkeeping.
- A bowler rename is a single `revalidateTag` call, not a commit chain.
- The bespoke cache system and its rule files are deleted (Track #1 complete).
- Each migrated page reads through one deliberate view model; the bowler page
  renders on demand in roughly the same time as a cached page (Track #2 pilot).
- Monthly cost stays ~$26.
