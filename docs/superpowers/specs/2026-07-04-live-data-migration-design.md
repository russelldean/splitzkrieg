# Live Data Migration: Retire the Build-Time Cache for ISR

Date: 2026-07-04
Status: Design approved, pending spec review
Author: Russ + Claude

## Problem

Splitzkrieg is a static Next.js site that fetches from Azure SQL at build time.
To avoid a full rebuild hammering the 5-DTU DB past its 30-connection limit, a
bespoke disk cache (`cachedQuery` in `src/lib/db.ts`) was layered on top: MD5 of
the SQL string, per-season data versions in `.data-versions.json`, dependency
"channels", and `stable` flags.

That cache is the project's single largest source of friction and wasted time.
Evidence: renaming one bowler ("J Peters") took five commits (channel bump,
patch cached query files, fix invalidation, remove one-shot patch). The
CLAUDE.md's biggest section is a cache "NEVER DO THESE" list. Four separate
memory files exist solely to document cache rules.

The cache exists to solve a BUILD-TIME problem (thousands of pages querying a
tiny DB at once), not a serve-time one. A CDN already makes serving fast.

## Key Insight

At current traffic (~7,800 pageviews/month, baseline 30 to 80/day, spiking to
~1,400 on bowling night, under 1 pageview/minute average), serving data live
costs almost nothing in dollars. Moving from build-time queries to
request-time queries with a short cache TTL:

- Keeps monthly cost at ~$26 (no DB tier bump needed).
- Lets the DB be touched a trivial number of times (once per page per TTL
  window, regardless of crowd size), so a 5-DTU instance handles bowling night
  easily.
- Retires the entire bespoke cache system in favor of Next.js built-in ISR +
  tag-based revalidation.
- Solves the rename pain: an edit becomes one `revalidateTag` call instead of a
  cache-patch commit chain.

34 of 35 seasons are immutable history. Only the current season and week are
"live". This maps onto a tiered-TTL design.

## Goals

- Serve pages via ISR (Incremental Static Regeneration) instead of pure
  build-time static generation.
- Retire `cachedQuery`, `.data-versions.json`, channel hashes, and `stable`
  flags once the new path is proven.
- Make data edits (imports, renames, publishes) propagate via TTL or a single
  on-demand revalidation call, with no manual cache bookkeeping.
- Keep monthly cost at ~$26.
- Never expose visitors to "long delays". Target sub-300ms on cache-miss
  renders, instant on hits.

## Non-Goals

- No move to zero-staleness live serving (Option C: Azure S1/S2 or pooled
  Postgres at $50 to $95/month). Not needed for weekly-updating data.
- No DB engine change. Stay on Azure SQL Basic.
- No redesign of pages, features, or visual layout. This is a data-delivery
  change only.
- No change to the `/evillair` admin dashboard, which already runs live
  (`force-dynamic`) and is proof that live queries work in production.

## Target Architecture

### Rendering: tiered ISR

Every page becomes ISR (`export const revalidate = N`), with TTL tiered by how
fresh the data must be:

- Current season / current week pages: short TTL (60 to 120 seconds).
- Historical season pages (34 dead seasons): very long TTL (effectively
  infinite), behaving like static but revalidatable on demand.
- Home page: short TTL (updates on bowling night).

Stale-while-revalidate means a visitor always gets the cached page instantly
while a refresh happens in the background. The only genuinely slow request is a
page that has never been rendered (a brand-new bowler on first hit, or any page
right after a deploy clears cache). It pays the miss cost once, then is warm.

### Invalidation: tags replace channels

Wrap query functions so their results are tagged (`unstable_cache(fn, keys,
{ tags: [...] })` or route-level tags). Data edits call `revalidateTag`:

- `revalidateTag('scores-s36')` after a score import (replaces the scores
  channel bump).
- `revalidateTag('bowler-297')` after a rename (replaces the five-commit
  cache-patch saga).

This extends the existing `/api/revalidate` route, which already does
`revalidatePath` for current-season and per-bowler pages behind a secret.

### Connection handling for serverless

The current `mssql` pool (`max: 10`) assumes one long-lived build process. In
SSR each function instance owns its own pool, so a spike can exhaust Azure's
connection cap differently than a build does. Mitigations:

- Small pool max per instance (2 to 3).
- Enable Vercel Fluid Compute so warm instances are reused (fewer fresh pools
  and fresh TLS connects).
- Keep the `withRetry` backoff already in `db.ts`.

### Region colocation

Functions are pinned to `cle1` (Cleveland) in `vercel.json`. The Azure SQL
region is unverified from the hostname and MUST be confirmed in Phase 0.
Cross-region round trips are the difference between ~80ms and ~400ms of
per-page query time. If the DB is far from Cleveland, either move function
region or accept the higher (still sub-second) latency.

### Query parallelization

Pages that currently `await` queries sequentially should batch them with
`Promise.all` so N DB round trips collapse toward 1. This is the second-biggest
latency lever after colocation.

## What We Keep (safety)

- `cachedQuery` and `.data-versions.json` stay in place as the fallback path
  during migration. Deleted only after a full clean week + publish cycle.
- Vercel Preview Deployments: every branch gets a live URL hitting the real
  production DB. The new ISR site is validated on a preview URL (including a
  bowling-night load test) while `main` keeps serving the current static site
  to the public, untouched.
- Migration is incremental. Static and ISR pages coexist in one app, so we
  convert current-season pages first and leave history static until proven.

## Migration Phases

### Phase 0: Prove it (go/no-go gate)

- Confirm Azure SQL region; fix colocation if needed.
- Convert two representative pages (home page + one heavy bowler page) to ISR
  on a branch.
- Tune `mssql` pool for serverless; enable Fluid Compute.
- Deploy to a preview URL and measure real cache-miss latency against the real
  DB, including a simulated spike.
- Read the Vercel Usage numbers (invocations, GB-hours, ISR reads/writes)
  during the simulated spike and set a spend alert before going further.
- GO/NO-GO decision based on measured latency AND usage, not estimates.
  Target: sub-300ms typical miss, no errors under a simulated bowling-night
  load, and usage that projects to no material cost increase.

### Phase 1: Migrate live pages

- Convert current-season, current-week, home, stats, and playoff pages to ISR
  with short TTLs.
- Introduce tag-based caching on the query functions those pages use.
- History remains static (untouched) for now.

### Phase 2: Rewire edit workflows to revalidation

- Extend `/api/revalidate` and import/admin flows to call `revalidateTag` for
  scores and per-bowler edits.
- Replace the `/evillair` publish button's rebuild trigger with a revalidation
  trigger.
- Update the rename workflow to a single `revalidateTag` call.

### Phase 3: Retire the old system (decision point)

- After a clean full week + publish cycle on the new path, convert historical
  pages to long-TTL ISR (recommended) so renames revalidate on demand instead
  of forcing a rebuild.
- Delete `cachedQuery`, `.data-versions.json`, channel logic, `stable` flags,
  and the associated scripts and memory rule files.
- Relax the `cpus: 4` build limit in `next.config.ts` (its only purpose was
  protecting the DB during static builds).
- Fallback: if long-TTL ISR on history ever misbehaves, historical pages can
  stay pure-static instead. Pure-static history is a valid, less-ambitious end
  state.

## Vercel Usage Guardrails

Vercel usage can overshoot fast when misconfigured (reference: the 2026-04-06
Turbo build-machine incident burned $15.79 in 11 days). ISR moves the overshoot
risk from build minutes to function invocations and revalidation fan-out. The
specific failure modes and their guards:

- **TTL too short across many pages.** A low `revalidate` (especially sub-60s)
  on thousands of pages turns every crawler pass into a wave of function
  invocations + DB queries. Guard: never go below 60s; history at effectively
  infinite TTL; only current-season pages get short TTLs.
- **Revalidation storms.** A broad `revalidateTag` (e.g. revalidating all 600+
  bowlers on any score change) triggers mass regeneration: a single publish
  becomes hundreds of invocations and re-creates the connection-cap problem at
  request time. Guard: revalidate only the narrowest affected tag; preserve the
  existing "only bowlers who bowled this week" scoping already in
  `/api/revalidate`.
- **Self-referential or over-frequent revalidation.** A page that revalidates
  itself, or a cron hitting revalidate too often, burns compute in a loop.
  Guard: no self-referential revalidation; audit cron frequency.
- **Accidental per-request image transforms.** Image Optimization drives the
  edge-request count that already forced the Pro plan. Guard: no new per-request
  transforms; this migration touches data delivery only.

Note the offsetting win: ISR REDUCES build cost. No more generating thousands of
pages per deploy, so build minutes (the source of the prior overshoot) shrink.

Monitoring: watch the Vercel Usage tab (function invocations, GB-hours / active
CPU, edge requests, ISR reads/writes) and set a spend alert BEFORE Phase 1. The
Phase 0 preview deploy is the place to catch overshoot: run the simulated spike
and read the usage numbers there, before any of this reaches production.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Serverless connection exhaustion | Small pool max (2 to 3), Fluid Compute, retry backoff |
| Cross-region latency | Verify/fix region colocation in Phase 0 |
| Query fails at request time (no build-time catch) | Graceful empty-states, existing `cachedQuery` fallbacks, Vercel + PostHog monitoring |
| Cold-page first-render latency | Long TTLs on history; stale-while-revalidate; Basic tier is always-on (no serverless pause) |
| Regression we can't undo | Preview deploys + incremental migration + keep old code until proven; Vercel one-click rollback |
| Vercel usage/cost overshoot | Conservative TTLs (60s floor), narrow revalidation tags, no self-referential revalidation, spend alert, usage read on the Phase 0 preview before production |

## Costs

- Dollars: unchanged at ~$26/month. Function invocations at this traffic are
  negligible. The Vercel Pro $20 is driven by edge/asset requests, which do not
  change.
- Effort: the real cost. Estimated a few focused sessions across the four
  phases, front-loaded on Phase 0 proof.

## Open Questions to Resolve in Phase 0

1. What Azure region is `splitzkrieg-sql` in, and does it colocate with `cle1`?
2. Measured cache-miss latency for the home page and a heavy bowler page on a
   preview deploy?
3. Does Fluid Compute + a small pool hold up under a simulated spike without
   hitting the connection cap?

## Success Criteria

- Public site serves via ISR with visitor-perceived latency indistinguishable
  from today on cache hits, sub-300ms on typical misses.
- A score publish goes live via one revalidation call, no rebuild, no manual
  cache bookkeeping.
- A bowler rename is a single `revalidateTag` call, not a commit chain.
- The bespoke cache system and its rule files are deleted.
- Monthly cost stays ~$26.
