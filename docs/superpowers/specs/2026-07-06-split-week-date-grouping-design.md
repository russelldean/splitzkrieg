# Split-week date grouping on the week page

**Date:** 2026-07-06
**Status:** Approved (design)

## Problem

Some league weeks are "split": a single competitive week is bowled across two
Mondays by two halves of the field (e.g. Season XXXVI weeks 1-3, first six
calendar weeks). In the `schedule` table these are one `week` with the same
`nightNumber`, but the ten matches carry two distinct `matchDate` values (five
per date).

The week page (`/week/[seasonSlug]/[weekNum]`) currently takes the FIRST match's
date as the week's date (`weekScores[0]?.matchDate ?? weekSchedule[0]?.matchDate`)
and lists all ten matches flat. For a split week this is misleading: it labels
the whole week with one date and gives no indication that half the matches were
bowled a week later.

This has now happened twice (Fall seasons), so it is worth a general solution
rather than a one-off.

## Goals

- On the week page, when a week spans more than one date, group the matches by
  date under clear date headings, on the same page (still "Week N").
- Apply the grouping to BOTH the upcoming-matchups preview and the played
  results/box-score view.
- Generalize: detect split weeks from the data (multiple distinct `matchDate`s),
  never hardcode week numbers.
- Preserve the current appearance exactly for normal single-date weeks.

## Non-goals

- No change to the `schedule` table, imports, or any query.
- Week-level stats/leaderboards stay whole-week (they are aggregates; splitting
  them would be odd).
- No changes to other surfaces (season page week list, hero, nav). Out of scope
  for now.

## Approach

Presentation-only, driven by the per-match `matchDate` already present on
`SeasonScheduleWeek` (and on `WeeklyMatchScore`). "Split week" = the week has
more than one distinct `matchDate`.

### Shared unit

`groupMatchesByDate(matches)` — a pure helper added to `src/lib/week-utils.ts`
(alongside `organizeByWeek`, `indexMatchResults`, `findMatchMVP`).

- Input: an array of matches that each have a `matchDate` (string | null).
- Output: an ordered array of groups `[{ date: string | null, matches: T[] }]`,
  sorted by date ascending; matches keep their existing order (matchNumber)
  within a group.
- A single-date week returns one group; a split week returns two.
- Generic over the match element type so both the schedule-preview
  (`SeasonScheduleWeek`) and results (schedule row) consumers can use it.

`SplitDateHeading` — a small shared presentational component rendering the date
divider, e.g. `Monday, July 13 · 5 matches`. Rendered only when there is more
than one group. Uses the existing `formatMatchDate` helper from
`@/lib/bowling-time` for the `{ weekday: 'long', month: 'long', day: 'numeric' }`
format already used on the page.

### Edits

1. **`src/components/season/WeekSchedulePreview.tsx`** (upcoming matchups)
   - Group `schedule` via `groupMatchesByDate`.
   - If one group: render the MatchCards exactly as today.
   - If more than one: render each group under a `SplitDateHeading`.

2. **`src/components/season/WeekMatchSummary.tsx`** (played results / box scores)
   - Group `matchups` (`schedule.filter(s => s.week === week)`) via the same
     helper, around the existing per-match rows.
   - One group -> unchanged; more than one -> date headings between groups.

3. **`src/app/week/[seasonSlug]/[weekNum]/page.tsx`** (header subtitle)
   - Compute distinct `matchDate`s for the week from `weekSchedule`.
   - One date: keep the current single-date subtitle
     (`Week N · <Season> · Monday, July 13`).
   - More than one: show both dates compactly, e.g.
     `Week 1 · Fall 2026 · Jul 13 & Jul 20`. (Exact wording is easy to tune; the
     per-group headings carry the full weekday+date.)

### Data

No new query. `weekSchedule`/`weekScores` already carry `matchDate` per row.
Grouping is done in the components from data already fetched.

## Edge cases

- **Combined (single-date) week:** one group -> renders identically to today, no
  date headings, no split wording. This is the common case and must not regress.
- **Ghost-team matches / byes:** carry a `matchDate`, fall into their date group
  naturally.
- **Playoff weeks:** single date -> one group -> unchanged.
- **Null `matchDate`:** grouped under a single null-date group; falls back to the
  current flat rendering (no heading).

## Testing

- Unit tests for `groupMatchesByDate` in `week-utils`:
  - single distinct date -> one group,
  - two distinct dates -> two groups in date order,
  - preserves within-group order,
  - null dates handled.
- Visual check on `next dev`:
  - `/week/fall-2026/1` (split) shows two date groups of five in both the
    upcoming preview and, once seeded/played, the results view.
  - a combined week (e.g. `/week/fall-2026/4`) renders unchanged (no headings).

## Files touched

- `src/lib/week-utils.ts` (new `groupMatchesByDate` + tests)
- `src/components/season/WeekSchedulePreview.tsx`
- `src/components/season/WeekMatchSummary.tsx`
- `src/app/week/[seasonSlug]/[weekNum]/page.tsx`
- new small `SplitDateHeading` component (location: `src/components/season/`)
