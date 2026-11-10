# Frame by Frame for bowlers who skipped the latest season

Date: 2026-11-10. Approved by Russ in conversation.

## Problem

`/bowler/[slug]/frame-by-frame` builds the recap for the latest scored season.
A bowler with no nights in it gets four cards (cover, seasons, nights, close).
492 of the 627 public bowlers with a scored night are in that state. Russ wants
their page to carry the full stack, built from the last season they bowled.
Frame by Frame is an end-of-season product; weekly publishes never rebuild it.

## Decisions

1. **Season choice.** The page keeps the latest scored season. If the bowler
   has no non-penalty score in it, it uses the bowler's most recent season
   with one (`MAX(seasonID)` over their non-penalty rows). New query
   `getBowlerLatestSeasonID(bowlerID)`, cached per bowler (`bowlerID` option,
   no `dependsOn`), lives in `src/lib/queries/bowlers/`.
2. **No change to the view assembly.** `getBowlerWrapped(bowlerID, seasonID)`
   already builds any season. League context for an old season is one
   `getWrappedSeasonContext` batch, cached per season on that season's
   `scores` version, so it is fetched once and never touched by a weekly
   publish of the current season.
3. **`past` flag.** `SeasonWrapped` gains a `past: boolean` prop, true when
   the recap season is not the latest scored season. The page sets it, since
   only the page knows both IDs. The `BowlerWrapped` view type is unchanged.
4. **Wording.** In `SeasonWrapped.tsx` a single `ts = past ? 'that season'
   : 'this season'` replaces every "this season" in card copy and aria
   labels. Specific lines:
   - Nights card: "You bowled N nights that season." Keep the "Your last
     night on the lanes was ..." line. "You are missed." shows whenever the
     last night was over a year ago, regardless of night count.
   - Among your seasons: "Last season you averaged" becomes "The season
     before you averaged" when past.
   - Close card: headline stays "That was your Season XX, Name." The thanks
     line when past: "Thank you, sincerely, for the time you spent with
     Splitzkrieg. The lanes are right where you left them." The party and
     parade invite stays for everyone.
   - Cover subtitle already names the season; unchanged.
   - The existing zero-night branches (career-only cover line, "Your last
     night on the lanes was" headline, "That is your bowling life so far")
     remain for a bowler who has scores but somehow no nights in any
     season; in practice unreachable once the fallback exists.
5. **Entry points.**
   - `FrameByFrameBanner`: "See your season" when the bowler is in the
     latest season, otherwise "See your bowling history".
   - `FrameByFrameCallout` on the homepage: "If you ever bowled here, you
     have one. Find your name and see yours."
6. **Build.** `generateStaticParams` under `BUILD_ALL` returns every public
   bowler with a non-penalty score (627 today) instead of the latest
   season's 135. New query `getScoredBowlerSlugs()` next to
   `getLatestScoredSeasonBowlerSlugs()`.

## Testing

- `bowler-wrapped.test.ts`: no assembler change, no new assembler test.
- A component-level check is manual in `next dev`: John Williams (S35),
  Outtama Tulachanh (S33), Justin Faerber (S25), plus one current bowler to
  confirm nothing moved.
- `node scripts/pre-push-check.mjs` and `tsc --noEmit` before commit.

## Cost

Per-bowler batch for 492 more bowlers (7 to 15 s each warm) plus up to 35
old-season context batches, once. Everything is cached on disk and keyed so a
weekly publish does not invalidate it.

## Out of scope

Changelog row (Russ adds to `siteUpdates`), any card redesign, renaming
internal "wrapped" identifiers.

## Revisions during review (2026-11-10)

- "that season" was ambiguous after the career cards name Season I, so a past
  recap says "in Season XX" every time, and the Nights headline frames it:
  "You bowled N nights in the last season you bowled, Season XX."
- Among your seasons names both seasons: "Season XX was your Nth best season
  of M. In Season YY you averaged A, B pins ahead of Season XX."
- Past recaps skip the Milestones and Your impact cards.
