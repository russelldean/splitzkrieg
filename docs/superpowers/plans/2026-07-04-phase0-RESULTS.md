# Phase 0 Results

## Go/No-Go thresholds
- Typical cache-miss render: < 300ms (home and bowler)
- Cache-hit render: < 80ms
- Simulated spike (50 distinct bowler pages, ~5 concurrent): zero 5xx, zero DB connection errors
- Vercel usage under spike: projects to no material monthly cost increase

## Findings (fill in as tasks complete)
- Azure SQL region: North Central US (Chicago) [via DNS CNAME dataslice9.northcentralus.database.windows.net]
- cle1 <-> DB colocation: GOOD - Cleveland <-> Chicago, both Midwest US, ~8-15ms apart. No region fix needed.
- Fluid Compute enabled: YES
- Spend alert set: YES (~$30 notify)
- Preview URL: https://splitzkrieg-6jms23kt7-charlesrusselldean-6293s-projects.vercel.app (build SUCCESS)
- Note: preview has Vercel Authentication (Deployment Protection) ON -> requests 302 to vercel.com/sso-api. Need automation bypass secret or protection disabled to measure.
- Home hit latency (ttfb): ~130-205ms (prebuilt ISR page, served from cache). GOOD.
- Bowler cold first render (ttfb): 7.65s (cold function + cold DB connection).
- Bowler warm on-demand fresh renders (5 distinct slugs, ttfb): 3.97 / 4.25 / 5.75 / 4.98 / 5.61s. Avg ~4.9s.
- Bowler cache hit (repeat within TTL, ttfb): ~490-520ms.
- Root cause: bowler page is ALREADY fully parallelized (Promise.all, 14 queries, page.tsx:108). Bottleneck is the 5-DTU Azure Basic tier - 14 concurrent career-aggregation queries cannot render fast on demand. Parallelization is maxed; DTU is the ceiling.
- Measurements taken from residential network (adds some fixed latency), but multi-second renders are server-side, not network noise.

## Spike test (Task 8): NOT RUN - deliberately
- The preview hits the REAL production DB (splitzkriegDB, shared with the live site).
- 50 concurrent never-rendered bowler pages = ~700 concurrent heavy queries at a 5-DTU / 30-connection DB. That would likely saturate connections and degrade the LIVE site during the test.
- The single-page numbers already answer the question, so the aggressive spike adds risk without adding signal. Skipped.

## Decision: GO - two-track plan approved (Russ signed off 2026-07-04)

Pure "render everything on demand" is NO-GO on 5-DTU for heavy pages (4-6s). Prebuilt/cached pages are fast (~150ms). Agreed path:

**Track #1 (do first, near-free): mechanism swap.**
- Keep heavy pages PREBUILT; serve from cache. On-demand render only as backgrounded revalidation (stale-while-revalidate hides it).
- Replace bespoke cachedQuery / .data-versions.json / channels / stable flags / .published-week with native Next ISR + revalidateTag.
- Kills the rename ritual: an edit becomes one revalidateTag('bowler-N') call. No cache-file patching.

**Track #2 (incremental, unlocks true live on the $5 DB): view models + read models.**
- Apply basehit's view-shaped-reads lesson: each page gets one deliberate view model (e.g. getBowlerPageView) instead of composing ~14 generic queries.
- Back expensive aggregates with precomputed read-model summary tables, populated by the import pipeline (extends the pattern already used by matchResults / bowlerPatches / bowlerMilestones / incomingAvg).
- Bowler page: ~14 live aggregations -> 1-2 cheap indexed reads -> ~150ms on-demand -> true live becomes possible without a DB tier bump.
- Governing rule (prevents handcuffing): cheap query in the view model by DEFAULT; promote to a precomputed table ONLY when a path proves slow. YAGNI on read models.

**Rejected:** #3 (bump DB tier, +$30-75/mo) - not doing it. #4 (pause) - moot.

Spike branch (spike/live-data-phase0) is throwaway: never merged, deleted after this. Findings + measurement scripts ported to main.
