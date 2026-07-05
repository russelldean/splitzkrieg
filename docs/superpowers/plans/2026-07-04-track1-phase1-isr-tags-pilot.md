# Track #1, Phase 1: ISR + Tags Mechanism Pilot

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the native-cache mechanism end to end on one contained slice — a `taggedQuery` helper (backed by `unstable_cache`), one migrated query, the home page as ISR, and a `revalidateTag` refresh — validated on a Vercel preview, before rolling out to all queries/pages.

**Architecture:** Add a `taggedQuery` wrapper next to `cachedQuery` in `src/lib/db.ts` that caches via Next's Data Cache with entity/channel tags instead of the MD5-of-SQL disk cache. Migrate exactly one home-page query to it, make the home page ISR, and extend `/api/revalidate` to call `revalidateTag`. Leave `cachedQuery` and every other query untouched (fallback path intact). This is a pilot: prove the loop, measure, then plan the rollout (Phase 1b).

**Tech Stack:** Next.js 16.1.6 (`unstable_cache`, `revalidateTag` from `next/cache`), React 19, Azure SQL (mssql), Vitest, Vercel preview deploys.

**Reference spec:** `docs/superpowers/specs/2026-07-04-live-data-migration-design.md`

**Note on verification:** cache behavior is integration-level, so most steps verify by observing dev/preview behavior (DB-hit logging, timing, tag refresh) rather than pure unit tests. Task 1 does unit-test the helper's key/tag construction. Nothing merges to `main` until the pilot passes and Russ signs off.

---

### Task 1: Add the `taggedQuery` helper (next to `cachedQuery`)

**Files:**
- Modify: `src/lib/db.ts` (add `taggedQuery`; reuse existing `withRetry`, `acquireSlot`, `releaseSlot`)
- Test: `src/lib/tagged-query.test.ts`

- [ ] **Step 1: Write the failing test for tag/key construction**

The helper delegates caching to `unstable_cache`, so the unit test covers the pure part we own: it returns the fn result on success and the fallback on throw, and forwards the exact tags. Create `src/lib/tagged-query.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// Mock next/cache so unstable_cache just invokes the fn (no real Data Cache in unit tests)
const cacheCalls: { keyParts: string[]; options: unknown }[] = [];
vi.mock('next/cache', () => ({
  unstable_cache: (fn: () => unknown, keyParts: string[], options: unknown) => {
    cacheCalls.push({ keyParts, options });
    return fn;
  },
}));

import { taggedQuery } from './db';

describe('taggedQuery', () => {
  it('returns the query result and forwards key + tags', async () => {
    const result = await taggedQuery('snapshot-36', async () => ({ ok: true }), { ok: false }, {
      tags: ['scores-36'],
      revalidate: 120,
    });
    expect(result).toEqual({ ok: true });
    const call = cacheCalls.at(-1)!;
    expect(call.keyParts).toEqual(['snapshot-36']);
    expect((call.options as { tags: string[] }).tags).toEqual(['scores-36']);
  });

  it('returns the fallback when the query throws', async () => {
    const result = await taggedQuery('snapshot-36', async () => { throw new Error('db down'); }, { ok: false }, {
      tags: ['scores-36'],
    });
    expect(result).toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/tagged-query.test.ts`
Expected: FAIL — `taggedQuery` is not exported from `./db`.

- [ ] **Step 3: Implement `taggedQuery` in `src/lib/db.ts`**

Add after `cachedQuery` (reuses `withRetry`, `acquireSlot`, `releaseSlot`, all already in the file):

```ts
import { unstable_cache } from 'next/cache';

/**
 * Native-cache sibling of cachedQuery. Caches the result in Next's Data Cache
 * (persisted across deploys on Vercel), keyed by `key`, invalidated by `tags`
 * via revalidateTag. No SQL-hash keying, no .data-versions.json bookkeeping.
 *
 * - key: stable identifier including any params (e.g. `snapshot-36`)
 * - tags: entity/channel tags this result depends on (e.g. ['scores-36'])
 * - revalidate: TTL seconds, or false for tag-only invalidation
 * Preserves cachedQuery's semantics: build-time concurrency slot + retry, and
 * returns `fallback` on DB failure (never caches a failure).
 */
export function taggedQuery<T>(
  key: string,
  fn: () => Promise<T>,
  fallback: T,
  options: { tags: string[]; revalidate?: number | false },
): Promise<T> {
  const runner = unstable_cache(
    async () => {
      await acquireSlot();
      try {
        return await withRetry(fn, key);
      } finally {
        releaseSlot();
      }
    },
    [key],
    { tags: options.tags, revalidate: options.revalidate ?? false },
  );
  return runner().catch((err) => {
    console.warn(`taggedQuery ${key}: DB unavailable`, err);
    return fallback;
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/tagged-query.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/lib/tagged-query.test.ts
git commit -m "feat: add taggedQuery (unstable_cache + tags) alongside cachedQuery"
```

---

### Task 2: Define the tag taxonomy

**Files:**
- Create: `src/lib/cache-tags.ts`
- Test: `src/lib/cache-tags.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/cache-tags.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { tags } from './cache-tags';

describe('cache-tags', () => {
  it('builds channel + entity tags', () => {
    expect(tags.scoresForSeason(36)).toBe('scores-36');
    expect(tags.scheduleForSeason(36)).toBe('schedule-36');
    expect(tags.bowler(297)).toBe('bowler-297');
    expect(tags.team(12)).toBe('team-12');
    expect(tags.season(36)).toBe('season-36');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/cache-tags.test.ts`
Expected: FAIL — `./cache-tags` does not exist.

- [ ] **Step 3: Implement `src/lib/cache-tags.ts`**

```ts
/**
 * Central tag vocabulary for taggedQuery + revalidateTag. One place so tag
 * strings never drift between where they are set and where they are revalidated.
 */
export const tags = {
  scoresForSeason: (seasonId: number) => `scores-${seasonId}`,
  scheduleForSeason: (seasonId: number) => `schedule-${seasonId}`,
  bowler: (bowlerId: number) => `bowler-${bowlerId}`,
  team: (teamId: number) => `team-${teamId}`,
  season: (seasonId: number) => `season-${seasonId}`,
} as const;
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/cache-tags.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cache-tags.ts src/lib/cache-tags.test.ts
git commit -m "feat: central cache-tag vocabulary for taggedQuery/revalidateTag"
```

---

### Task 3: Migrate one home-page query to `taggedQuery`

Pilot target: `getCurrentSeasonSnapshot` (the home page's headline current-season read). This is the single migrated query for the pilot; everything else stays on `cachedQuery`.

**Files:**
- Modify: the file defining `getCurrentSeasonSnapshot` (find it first)

- [ ] **Step 1: Locate the function**

Run: `grep -rn "export .*getCurrentSeasonSnapshot" src/lib/queries`
Expected: one definition (likely in `src/lib/queries/home.ts` or `src/lib/queries/seasons/`).

- [ ] **Step 2: Read its current body**

Note its `cachedQuery(...)` call: the key, the SQL, the `dependsOn`/`seasonID` options, and the current-season id it resolves. The snapshot reads current-season scores, so its tag is `scores-<currentSeasonId>`.

- [ ] **Step 3: Swap `cachedQuery` -> `taggedQuery` for this one function**

Replace the `cachedQuery(key, fn, fallback, { seasonID / dependsOn ... })` call with:

```ts
import { taggedQuery } from '@/lib/db';
import { tags } from '@/lib/cache-tags';

// ...inside getCurrentSeasonSnapshot, after resolving currentSeasonId:
return taggedQuery(
  `current-season-snapshot-${currentSeasonId}`,
  async () => { /* the EXACT same query body that was inside cachedQuery's fn */ },
  /* the same fallback value cachedQuery used, e.g. */ null,
  { tags: [tags.scoresForSeason(currentSeasonId)], revalidate: 120 },
);
```

Keep the SQL and fallback identical to the current implementation — only the caching wrapper changes.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries
git commit -m "feat: migrate getCurrentSeasonSnapshot to taggedQuery (scores-<season> tag)"
```

---

### Task 4: Make the home page ISR

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add the revalidate export**

After the `metadata` export in `src/app/page.tsx`:

```ts
// Track #1 pilot: ISR. Data Cache + tags handle freshness; revalidateTag
// refreshes on publish. 120s TTL is a backstop.
export const revalidate = 120;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: home page ISR (revalidate 120) for tags pilot"
```

---

### Task 5: Extend `/api/revalidate` to call `revalidateTag`

**Files:**
- Modify: `src/app/api/revalidate/route.ts`

- [ ] **Step 1: Add tag revalidation alongside the existing path revalidation**

The route already resolves `seasonID` and the current season. Add `revalidateTag` (import from `next/cache`) for the pilot tag, without removing any existing `revalidatePath` calls:

```ts
import { revalidatePath, revalidateTag } from 'next/cache';
import { tags } from '@/lib/cache-tags';

// ...after seasonID is resolved, alongside the existing revalidatePath('/') block:
revalidateTag(tags.scoresForSeason(seasonID));
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/revalidate/route.ts
git commit -m "feat: /api/revalidate also revalidates scores-<season> tag (pilot)"
```

---

### Task 6: Verify the loop locally (dev)

- [ ] **Step 1: Start dev**

Run: `npm run dev` (or `npm run dev:fresh` if data looks stale). Note the terminal for DB query logs.

- [ ] **Step 2: Confirm first load queries the DB, second serves from cache**

Load `http://localhost:3000/` twice. Expected: the `current-season-snapshot` query hits the DB on the first cold load; on an immediate reload within the TTL there is no repeat DB log for that query (served from the Data Cache). Record the observation.

- [ ] **Step 3: Confirm `revalidateTag` forces a fresh query**

With the dev `REVALIDATION_SECRET`, POST to the revalidate route:
```bash
curl -s -X POST "http://localhost:3000/api/revalidate?secret=$REVALIDATION_SECRET" | head
```
Then reload `/`. Expected: the snapshot query hits the DB again (tag was invalidated). Record the observation.

- [ ] **Step 4: Confirm nothing else changed**

Load a bowler page and a season page locally. Expected: they render normally (still on `cachedQuery`). No regressions.

---

### Task 7: Validate on a Vercel preview

NOTE FOR RUSS: previews have Vercel Authentication on. Before this task, generate a fresh **Protection Bypass for Automation** secret (Vercel -> splitzkrieg -> Settings -> Deployment Protection) and hand it over; revoke it again after. (The Phase 0 one was revoked, by design.)

**Files:**
- Reuse: `scripts/phase0/curl-format.txt`

- [ ] **Step 1: Push the pilot branch**

```bash
git push -u origin <pilot-branch-name>
```
Expected: a Vercel preview build starts. Get the preview URL from the GitHub commit status (`gh api repos/russelldean/splitzkrieg/commits/$(git rev-parse HEAD)/statuses --jq '[.[]|select(.context=="Vercel")][0]'`) once state is `success`.

- [ ] **Step 2: Time the home page (with the fresh bypass header)**

```bash
URL="https://PREVIEW_URL"; H=(-H "x-vercel-protection-bypass: BYPASS")
curl -s -o /dev/null "${H[@]}" -w "home ttfb=%{time_starttransfer}s code=%{http_code}\n" "$URL/"
curl -s -o /dev/null "${H[@]}" -w "home ttfb=%{time_starttransfer}s code=%{http_code}\n" "$URL/"
```
Expected: 200, ttfb comparable to the Phase 0 home baseline (~150ms), no regression.

- [ ] **Step 3: Prove tag revalidation on the preview**

```bash
curl -s -X POST "$URL/api/revalidate?secret=REVALIDATION_SECRET" "${H[@]}" | head
```
Expected: `{ "revalidated": true, ... }`. Reload `/` and confirm it still serves 200 and correct data (a background refresh occurred; visitor never blocked).

- [ ] **Step 4: Read Vercel usage**

Confirm the pilot adds no material invocations/GB-hours (spend alert already set). Record.

---

### Task 8: Record findings and decide rollout

**Files:**
- Create: `docs/superpowers/plans/2026-07-04-track1-phase1-RESULTS.md`

- [ ] **Step 1: Write results** — dev loop observations, preview latency, tag-refresh confirmation, usage. State whether the mechanism is proven.

- [ ] **Step 2: Decision** — GO to Phase 1b (roll `taggedQuery` + tags out to the rest of current-season queries and pages, then history) or fix issues first.

- [ ] **Step 3: Commit and report to Russ.** Do not start Phase 1b without sign-off. Merge decision for the pilot branch is Russ's call.

---

## Self-Review Notes

- **Spec coverage:** implements the Track #1 Phase 1 intent (introduce `unstable_cache` + tags, convert a page to ISR, keep `cachedQuery` as fallback) as a proving pilot rather than a mass migration; the spec's full Phase 1 rollout becomes Phase 1b, gated on this.
- **Safety:** exactly one query and one page change; `cachedQuery` and all other queries untouched; nothing merges to `main` until proven; preview-only validation.
- **Placeholder scan:** `PREVIEW_URL`, `BYPASS`, `REVALIDATION_SECRET`, and `<pilot-branch-name>` are runtime values filled at execution, not unspecified logic. Task 3 Steps 1-2 locate the exact function/SQL before editing rather than guessing a path.
- **Type consistency:** `taggedQuery(key, fn, fallback, { tags, revalidate })` signature is used identically in Task 1 (definition), Task 3 (call), and the tests. `tags.*` helpers match between `cache-tags.ts` and their callers.
