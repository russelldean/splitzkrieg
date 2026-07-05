# Phase 0: Live Data Proof Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove, on a Vercel preview deploy against the real production DB, that serving Splitzkrieg via ISR gives sub-300ms typical cache-miss latency with no cost/connection blowup, so we can make an evidence-based go/no-go on the full migration.

**Architecture:** Convert two representative pages (home + a heavy bowler page) to ISR on a throwaway branch. Deploy to a Vercel preview URL (production stays on `main`, untouched). Measure single-request latency (miss vs hit), then a simulated bowling-night spike, then read Vercel usage and Azure connection behavior. Record findings and decide.

**Tech Stack:** Next.js App Router (ISR via `export const revalidate`), Azure SQL Basic (mssql), Vercel (preview deploys, Fluid Compute, Usage dashboard), curl + jq for measurement.

**Note on verification:** Phase 0 is a measurement spike, not feature code. "Tests" here are real commands whose observed output is compared against a target threshold. No unit tests are added. Nothing merges to `main`.

**Reference spec:** `docs/superpowers/specs/2026-07-04-live-data-migration-design.md`

---

### Task 1: Set up the spike branch and results doc

**Files:**
- Create: `docs/superpowers/plans/2026-07-04-phase0-RESULTS.md`

- [ ] **Step 1: Create the branch**

Run:
```bash
git checkout -b spike/live-data-phase0
```
Expected: `Switched to a new branch 'spike/live-data-phase0'`

- [ ] **Step 2: Create the results doc with the target thresholds pre-filled**

Create `docs/superpowers/plans/2026-07-04-phase0-RESULTS.md`:
```markdown
# Phase 0 Results

## Go/No-Go thresholds
- Typical cache-miss render: < 300ms (home and bowler)
- Cache-hit render: < 80ms
- Simulated spike (50 distinct bowler pages, ~5 concurrent): zero 5xx, zero DB connection errors
- Vercel usage under spike: projects to no material monthly cost increase

## Findings (fill in as tasks complete)
- Azure SQL region: TBD
- cle1 <-> DB colocation: TBD
- Home miss latency: TBD
- Home hit latency: TBD
- Bowler miss latency: TBD
- Bowler hit latency: TBD
- Spike errors: TBD
- Vercel invocations / GB-hours during spike: TBD
- Azure peak connections during spike: TBD

## Decision: TBD (GO / NO-GO / GO-with-fixes)
```

- [ ] **Step 3: Commit**

Run:
```bash
git add docs/superpowers/plans/2026-07-04-phase0-RESULTS.md
git commit -m "chore: phase 0 spike branch + results skeleton"
```
Expected: one file committed.

---

### Task 2: Verify Azure SQL region and colocation

This is the single biggest latency lever. `cle1` is Vercel Cleveland (US East-ish). We need the DB region.

- [ ] **Step 1: Get the DB region via Azure CLI**

Run:
```bash
az sql server show --name splitzkrieg-sql --query "location" -o tsv
```
Expected: a region string like `eastus`, `eastus2`, or `centralus`.

If `az` is not installed or not logged in, get it from the Azure Portal:
SQL servers -> `splitzkrieg-sql` -> Overview -> Location.

- [ ] **Step 2: Record the colocation verdict**

Edit `docs/superpowers/plans/2026-07-04-phase0-RESULTS.md`, set:
- `Azure SQL region:` to the value found.
- `cle1 <-> DB colocation:` to GOOD if the DB is in an East/Central US region (near Cleveland), or FAR if it is West US / Europe / etc.

No commit needed yet (results doc updated again later).

---

### Task 3: Convert the home page to ISR

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add the revalidate export**

In `src/app/page.tsx`, immediately after the `metadata` export (around line 39), add:
```ts
// Phase 0: serve via ISR with a short TTL instead of pure build-time static.
export const revalidate = 120;
```

- [ ] **Step 2: Verify it compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: no new errors referencing `src/app/page.tsx`.

- [ ] **Step 3: Commit**

Run:
```bash
git add src/app/page.tsx
git commit -m "spike: home page ISR (revalidate 120)"
```

---

### Task 4: Convert the bowler page to on-demand ISR

We want to measure the WORST case: a bowler page rendered fresh at request time (pure cache miss). We do that by rendering nothing at build and letting all bowler pages render on demand.

**Files:**
- Modify: `src/app/bowler/[slug]/page.tsx:56-62`

- [ ] **Step 1: Replace the static-params block**

In `src/app/bowler/[slug]/page.tsx`, replace:
```ts
// Unknown slugs return 404 -- never attempt to render or hit the DB at runtime.
export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await getAllBowlerSlugs();
  return slugs.map(({ slug }) => ({ slug }));
}
```
with:
```ts
// Phase 0 spike: render bowler pages on demand so we can measure real
// cache-miss latency. dynamicParams=true lets any valid slug render at
// request time; revalidate caches the result for 120s (stale-while-revalidate).
// RESTORE the generateStaticParams prebuild after the proof.
export const dynamicParams = true;
export const revalidate = 120;

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}
```

Note: `getAllBowlerSlugs` is now unused in this file. Leave the import for now (it will be restored after the spike); if `tsc` complains about an unused import, that is expected and non-blocking for a spike branch.

- [ ] **Step 2: Verify it compiles**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors other than possibly an unused-import notice for `getAllBowlerSlugs`.

- [ ] **Step 3: Commit**

Run:
```bash
git add src/app/bowler/[slug]/page.tsx
git commit -m "spike: bowler page on-demand ISR for cache-miss measurement"
```

---

### Task 5: Enable Fluid Compute and set a spend alert (Vercel dashboard)

These are dashboard settings, not code. Do them before deploying so the preview reflects the target runtime.

- [ ] **Step 1: Enable Fluid Compute**

In the Vercel dashboard: Project (splitzkrieg) -> Settings -> Functions -> enable **Fluid Compute**. This reuses warm instances so DB pools and TLS connections are reused across requests (fewer cold connects).

- [ ] **Step 2: Set a spend alert**

In the Vercel dashboard: Account/Team -> Settings -> Billing -> set a usage/spend alert (e.g. notify at $30). This is the guardrail against the overshoot Russ flagged.

- [ ] **Step 3: Record in results doc**

Note in `2026-07-04-phase0-RESULTS.md` that Fluid Compute is ON and a spend alert is set.

---

### Task 6: Deploy the preview

Pushing this branch creates a Vercel **preview** deployment. It does NOT touch production (only `main` auto-deploys to prod). The preview hits the real production DB.

- [ ] **Step 1: Push the branch**

Run:
```bash
git push -u origin spike/live-data-phase0
```
Expected: Vercel starts a preview build. Get the preview URL from the Vercel dashboard (Deployments -> the new one -> Visit) or from the `vercel` CLI output. It looks like `https://splitzkrieg-git-spike-live-data-phase0-<team>.vercel.app`.

- [ ] **Step 2: Confirm the preview is live**

Run (substitute the real preview URL):
```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://PREVIEW_URL/"
```
Expected: `200`.

- [ ] **Step 3: Record the preview URL** in `2026-07-04-phase0-RESULTS.md`.

---

### Task 7: Measure single-request latency (miss vs hit)

**Files:**
- Create: `scripts/phase0/curl-format.txt`

- [ ] **Step 1: Create the curl timing format file**

Create `scripts/phase0/curl-format.txt`:
```
   dns:  %{time_namelookup}s
connect:  %{time_connect}s
   tls:  %{time_appconnect}s
 ttfb:  %{time_starttransfer}s
 total:  %{time_total}s
```

- [ ] **Step 2: Measure a home-page cache MISS**

First force a miss by revalidating, then time the next hit. Simplest reliable miss: append a cache-busting query the first time is not enough (ISR keys on path, not query). Instead, measure the FIRST request after deploy (cold) and treat subsequent as warm. Run twice back-to-back:
```bash
curl -w "@scripts/phase0/curl-format.txt" -o /dev/null -s "https://PREVIEW_URL/"
curl -w "@scripts/phase0/curl-format.txt" -o /dev/null -s "https://PREVIEW_URL/"
```
Expected: first `total` is the miss (target < 300ms once warm-instance; may be higher on the very first cold function), second `total` is the hit (target < 80ms).
Record both `ttfb` values as Home miss / Home hit.

- [ ] **Step 3: Measure a bowler-page cache MISS**

Pick a real slug (e.g. `russ-dean`). Because the page renders on demand with 120s TTL, the first hit after any 120s gap is a miss:
```bash
curl -w "@scripts/phase0/curl-format.txt" -o /dev/null -s "https://PREVIEW_URL/bowler/russ-dean"
curl -w "@scripts/phase0/curl-format.txt" -o /dev/null -s "https://PREVIEW_URL/bowler/russ-dean"
```
Expected: first `ttfb` is the miss (target < 300ms warm-instance), second is the hit (target < 80ms).
Record both as Bowler miss / Bowler hit.

- [ ] **Step 4: Commit the tooling**

Run:
```bash
git add scripts/phase0/curl-format.txt
git commit -m "chore: phase 0 curl timing format"
```

---

### Task 8: Simulate a bowling-night spike and read usage

Bowling night peaks around 1,400 pageviews/day with brief bursts. We simulate 50 DISTINCT bowler pages (all cache misses) at ~5 concurrent, which is heavier than a real burst and directly stresses on-demand render + DB connections.

**Files:**
- Create: `scripts/phase0/spike.sh`

- [ ] **Step 1: Pull real bowler slugs from the production search index**

The prod search index is a static JSON endpoint. Inspect its shape, then extract bowler slugs:
```bash
curl -s "https://splitzkrieg.com/api/search-index" | jq '.[0]'
```
Expected: one entry object. Identify the field holding the bowler URL/slug (likely `url` or `slug`, with a `type` of `bowler`).

Then dump 50 bowler slugs to a file (adjust the jq filter to the real shape, e.g. if entries have `{type, url}`):
```bash
curl -s "https://splitzkrieg.com/api/search-index" \
  | jq -r '.[] | select(.type=="bowler") | .url' \
  | sed 's|^/bowler/||' | head -50 > scripts/phase0/slugs.txt
wc -l scripts/phase0/slugs.txt
```
Expected: `50 scripts/phase0/slugs.txt` (or however many bowlers exist, if fewer).

- [ ] **Step 2: Create the spike script**

Create `scripts/phase0/spike.sh`:
```bash
#!/usr/bin/env bash
# Usage: PREVIEW_URL=https://... bash scripts/phase0/spike.sh
# Fires all slugs in slugs.txt at the preview, 5 concurrent, records HTTP codes.
set -euo pipefail
: "${PREVIEW_URL:?set PREVIEW_URL}"
DIR="$(dirname "$0")"
xargs -P 5 -I {} \
  curl -s -o /dev/null -w "%{http_code} %{time_total}s {}\n" \
  "${PREVIEW_URL}/bowler/{}" \
  < "${DIR}/slugs.txt" | tee "${DIR}/spike-results.txt"
echo "--- non-200 responses ---"
grep -v '^200 ' "${DIR}/spike-results.txt" || echo "none"
```

- [ ] **Step 3: Run the spike**

Run (substitute the real preview URL):
```bash
PREVIEW_URL="https://PREVIEW_URL" bash scripts/phase0/spike.sh
```
Expected: 50 lines, every one starting `200 `. The `--- non-200 responses ---` block prints `none`.
Record any non-200s and the slowest `time_total` in the results doc.

- [ ] **Step 4: Read Vercel usage**

Immediately after the spike, in the Vercel dashboard: Project -> Usage (or Observability). Record: function invocations, GB-hours / active CPU, and ISR reads/writes attributable to the spike window.
Sanity check: 50 misses should be ~50 invocations, a rounding error against the plan's included quota. If it is dramatically higher, that signals a revalidation-fan-out bug to investigate before Phase 1.

- [ ] **Step 5: Read Azure connections (optional but recommended)**

In the Azure Portal during/just after the spike: SQL database -> Monitoring -> Metrics -> "Successful Connections" and "Sessions". Confirm peak stayed well under 30.
Record peak connections.

- [ ] **Step 6: Commit the tooling**

Run:
```bash
git add scripts/phase0/spike.sh scripts/phase0/slugs.txt
git commit -m "chore: phase 0 spike harness"
```

---

### Task 9: Record findings and make the go/no-go call

**Files:**
- Modify: `docs/superpowers/plans/2026-07-04-phase0-RESULTS.md`

- [ ] **Step 1: Fill in every TBD** in the results doc with the measured values from Tasks 2, 7, 8.

- [ ] **Step 2: Write the decision** using this rubric:
  - **GO** if: bowler + home miss < 300ms, hit < 80ms, zero spike errors, usage negligible.
  - **GO-with-fixes** if: thresholds met only after an obvious lever (e.g. colocation FAR -> move function region; or misses high due to sequential queries -> parallelize in Phase 1). Note the required fix.
  - **NO-GO** if: misses are seconds even warm, or the spike causes DB connection errors that pooling/Fluid Compute cannot resolve. Document why; the static architecture stays and we pivot to bulletproofing the existing cache instead.

- [ ] **Step 3: Commit**

Run:
```bash
git add docs/superpowers/plans/2026-07-04-phase0-RESULTS.md
git commit -m "docs: phase 0 results and go/no-go decision"
```

- [ ] **Step 4: Report to Russ** with the numbers and the recommendation. Do NOT proceed to Phase 1 without his sign-off. The spike branch is never merged to `main`; the bowler-page change reverts to `generateStaticParams` prebuild in Phase 1's real work.

---

## Self-Review Notes

- **Spec coverage:** Phase 0 in the spec maps to Tasks 2-9. Region colocation (Task 2), ISR conversion (Tasks 3-4), Fluid Compute + spend alert guardrail (Task 5), latency measurement (Task 7), spike + usage read (Task 8), go/no-go on latency AND usage (Task 9). Covered.
- **Reversibility:** Nothing merges to `main`; production is untouched throughout. The bowler `dynamicParams`/`generateStaticParams` change is explicitly flagged for restoration.
- **Guardrails:** Spend alert (Task 5), usage read after spike (Task 8), non-200 detection in the spike script (Task 8).
- **Known soft spot:** the search-index JSON field name for slugs is confirmed at runtime in Task 8 Step 1 before the extraction runs, not assumed.
