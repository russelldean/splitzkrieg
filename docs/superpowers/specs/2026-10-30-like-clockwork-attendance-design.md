# Like Clockwork badge (attendance)

Date: 2026-10-30

## What

A season-level patch for bowlers who showed up for at least 8 of a season's 9
league nights. Named "Like Clockwork": it says "shows up every week" without claiming
perfect, so the one-miss rule never needs explaining away. ("Perfect Enough
Attendance" was the working name for an hour on 2026-10-30.)

## Rule

- A bowler attended a night if they have a `scores` row for that season and
  week with `gamesBowled > 0`. Penalty rows (zero games) do not count.
  Prebowls count. Subbing for another team counts: they were there.
- Threshold: missed at most one of the season's available nights, where
  available nights = distinct weeks with scores. So 8 of 9 normally, 9 of 10
  for S3, 4 of 5 for the COVID seasons (S25, S27), 7 of 8 for the four seasons
  missing week 9 from the archive (S1, S5, S15, S18). Russ ruled on each
  2026-10-30.
- One override: S2 ran 17 weeks with a weekly bye (16 possible nights); the
  bar is 15. Encoded in `MIN_NIGHTS_OVERRIDES`.
- Only completed seasons qualify. The current season never gets it mid-season.

Across the 9-week seasons, 16% of bowler-seasons are 9 of 9 and 32% are
8 of 9 or better. The playoff-eligibility cutoff (6 of 9) would cover 57% and
was rejected as a participation marker.

## Data

- One new `patches` row: code `attendance`, name `Like Clockwork`,
  description `Missed at most one league night in a season`.
- Awards are `bowlerPatches` rows with `seasonID` set and `week` NULL, the same
  shape as Team Playoff. No schema change.

## Where it is awarded

- The rule lives once, in `src/lib/scoring/attendance.mjs`, following
  `above-average.mjs`, so the populate and audit scripts cannot drift apart.
- `scripts/populate-patches.mjs` gains an `attendance` section
  (`--patch=attendance --season=35` is the preview run).
- `scripts/audit-patches.mjs` diffs it in its SEASONAL set.
- It is NOT part of the weekly admin confirm flow (`runPatches`), which only
  handles weekly patches. Going forward it is awarded at the season changeover
  alongside the playoff badges.

## Display

- `PatchBadge.tsx` pill config: abbr `CLK`, full name on hover.
- `YouAreAStar.tsx`: a "Like Clockwork" line with the count of
  seasons earned, plus the matching `PATCH_STYLE` entry.
- `bowlers.ts`: `attendance` joins the `BowlerPatch` union and
  `BowlerStarStats` gains `perfectEnoughSeasons`; `bowler-page.ts` maps it.
- The collapsed season bar on the bowler page already renders NULL-week
  patches, so nothing new is needed there.
- `/specs` copy: 13 patch types becomes 14.

## Cache

No query SQL changes, so no hash busts. After inserting S35 rows, bump the
per-bowler cache by id for the awardees only (`bump-bowler-cache.mjs --ids`).

## Preview

Insert the catalog row, award S35, bump caches, review on localhost. History
rulings landed the same day; all 35 completed seasons are awarded (1433 rows).
