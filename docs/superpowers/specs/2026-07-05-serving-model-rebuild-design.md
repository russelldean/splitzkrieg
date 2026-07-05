# Serving-Model Rebuild: Escape the Full-Prebuild Ceiling

Date: 2026-07-05
Status: Design approved (conversational). Ready to plan Phase 1.
Author: Russ + Claude
Supersedes the active rollout in `2026-07-04-live-data-migration-design.md` (that plan's
taggedQuery mechanism swap is PARKED — see Non-Goals).

## Problem

Two problems, one acute and one structural.

**Acute:** every deploy re-renders ~1167 statically pre-rendered pages (~12-15 min),
even for a one-line change. The disk cache (`cachedQuery`) keeps those re-renders from
re-querying the DB, but Next still regenerates every page's HTML each build. A 12-minute
feedback loop makes the site nearly impossible to iterate on. (Two attempts to swap the
cache mechanism to `taggedQuery` made this worse and melted the DB — see the RESULTS docs.)

**Structural:** the model itself has a ceiling. Nearly every page is keyed by season, and
~34 of ~35 seasons are FROZEN historical data that can never change. Yet the build treats
them exactly like the one live season, rebuilding all of them every time. Worse, adding a
new stats/analysis page — the thing Russ actually wants to grow — *adds* to the build and
the cache ledger. Cost rises as you add. That is backwards: growth should be cheap.

## Root Cause

The architecture pre-bakes all data at build time and treats immutable historical content
identically to live current-season content. The bespoke cache exists to survive that model,
not to fix it. The fix is to stop rebuilding frozen content and serve pages on demand,
cached — so build cost tracks what is *live*, not what *exists*, and new pages cost ~nothing.

## Target Model

Move from "prebuild everything, cache to survive it" to "prebuild only what's live, serve
the rest on demand and cache it."

- **Tiered rendering.** Prebuild only the current season + index/landing pages. Historical
  pages render on-demand (ISR, `dynamicParams`) and cache after first visit. Frozen seasons
  are never rebuilt on a code deploy.
- **Growth is cheap.** A new stats/analysis page = one query + one ISR route that renders on
  demand and caches itself. No build-time explosion, no cache-ledger entry. Marginal cost of
  a new "cut of the data" approaches zero.
- **Efficient per-page reads (later).** Heavy pages (the bowler page fires ~14 generic
  queries) get consolidated, single-purpose reads — and precomputed summary tables where an
  aggregate proves expensive — so on-demand render is fast enough on the $5 DB. This is the
  one part that touches query logic, done last and page-by-page.
- **Keep the SQL.** The queries mostly work; the rot is in the serving + caching model, not
  the data logic. We change how pages are served, not (mostly) what they compute. No
  from-scratch query rewrite.

## Approach: relief first, rebuild behind a maintenance page

Sequencing rule: **a fast build loop is a prerequisite for everything else.** You cannot
rebuild a data layer at 12 min/iteration. So the fast loop comes first — not as a patch, but
as step one of the target model (reduced prebuild IS the destination).

Russ takes the site fully offline behind a "getting ready for the new season" page during
the rebuild. This is leverage, not defeat: no visitors to serve, no on-demand latency to
manage, no pressure to keep production green. We can prebuild almost nothing and iterate fast.

**Phase 1 — Stabilize + prove the fast loop.**
1. Maintenance page: redirect all public traffic to a static "getting ready" page (middleware).
2. Untangle: revert the half-finished taggedQuery migration to a clean, fully-`cachedQuery`
   baseline. One green build to confirm stability.
3. Cut prebuild hard (current season + index pages only; historical on-demand), deploy, and
   **measure the build time.** This is the proof point: the number must drop from ~12 min to
   a few. If it doesn't, stop and rethink before proceeding. Evidence, not promises.

**Phase 2 — Bring the site back, section by section, on the new model.**
Current-season core first (home, current season/standings/stats/weeks, current-season
bowlers/teams), each on ISR. Verify each section, bring it online. Historical sections follow.

**Phase 3 — The growth capability + cleanup.**
Establish and prove the "new stats page = query + ISR route" recipe. Convert the heavy pages
to efficient reads (consolidated view queries; precomputed summary tables only where measured
slow). Retire the bespoke cache complexity (`.data-versions.json`, channels, `stable` flags,
published-week, rename-patch scripts) as pages move off `cachedQuery`.

## Non-Goals

- **No taggedQuery / Data-Cache mechanism swap right now.** It broke the warm-cache property
  the disk cache provides and melted the DB twice. Parked. The already-shipped Batch A is
  reverted in Phase 1. Tag-based invalidation may return later, deliberately, once the serving
  model is sound — but it is not part of this effort.
- **No DB tier bump.** Stay on Azure SQL Basic, ~$26/mo.
- **No from-scratch query rewrite.** Reuse working SQL; change serving, not data logic.
- **No `cpus` build-parallelism increase.** Confirmed to overload the 5-DTU DB (per-process
  pools + session storms). Build speed comes from fewer pages, not more workers.

## Success Criteria

- A code change deploys in a few minutes, not ~12-15.
- Adding a new stats/analysis page does not increase build time or require cache bookkeeping.
- The site serves correctly, section by section, from the new ISR model.
- The bespoke cache system and its rule files are eventually deleted (Phase 3).
- Monthly cost stays ~$26.

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| "Relief" fails to materialize again | Phase 1 step 3 is a measured build time, shown before proceeding; small and reversible |
| On-demand historical pages slow on first hit | Site is behind the maintenance page during rebuild; heavy pages get efficient reads (Phase 3) before broad exposure |
| DB overload during builds | Fewer prebuilt pages = far fewer build-time queries; never stack builds; Vercel auto-cancel ON |
| Rebuild drags on | Each section is independently shippable behind the maintenance page; fast loop keeps iteration cheap |
| Losing the working site | Production stays on the last good build until each new section is verified; maintenance page is a deliberate, reversible switch |
