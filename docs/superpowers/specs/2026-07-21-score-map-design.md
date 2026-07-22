# Score Map - Design

**Date:** 2026-07-21
**Status:** Design approved, ready for implementation planning
**Prototype:** https://claude.ai/code/artifact/3be5923b-5e40-4245-963b-00f1ce13f9f0

## What it is

A per-bowler "score map": a collapsible section on every `/bowler/[slug]` page that
shows, as a color-coded grid, every game score the bowler has ever rolled and how
often, which scores they have hit again this current season, and (for the two
bowlers who have one) a gold medallion for a perfect 300.

It plays like a personal bingo card. Empty squares inside your range are scores you
have somehow never bowled; warm squares are the ones you have re-rolled this season;
your most-rolled score wears a gold star. Every score you fill is satisfying whoever
you are, so there is no eligibility gate - everyone gets a card on day one.

## Why this, and how we got here

This came out of a season-kickoff brainstorm: give members something fun and
personal to discover about themselves, in the spirit of the well-liked league-pattern
analysis. We explored several directions (a 16-type "bowling personality" archetype,
a teammate-graph "Oracle", statistical twins, a lane-conditions report) against the
real data before landing here.

Key findings that steered us to the score map:

- **The archetype** was statistically valid (four independent axes, 16 naturally
  occupied types) but felt like an incremental upgrade to the existing GameProfile,
  and the median-split labels produced wrong-sounding descriptions for people near
  the middle. Parked, not killed - see Alternatives.
- **The lane report is impossible.** There is no lane column anywhere in the DB
  (`schedule` has no lane assignments), and the alley changed a few years ago, so
  historical lanes would not be comparable even if we had them.
- **The Oracle lookup fell flat** - 52.6% of all bowler pairs are exactly 3 teammate-
  hops apart, so half the league would get the same answer. Its byproducts (longest
  partnerships, most-connected bowler) are good but belong elsewhere.
- **The score map tested well on real data** and delivers the "I've never seen that
  about myself" hook cheaply: bowling scores are not continuous, so everyone has
  surprising gaps inside their own range. Russ has bowled a 279 but never a 214, 219,
  227, 228, 229, 230 or 232 (56 gaps inside his 90-279 range).

## Data reality (verified against the live DB)

- 69,837 individual games in `scores` (regular season) + a handful in `playoffScores`.
- 247 of 301 possible scores have ever been rolled leaguewide.
- Most common score leaguewide is 124 (992 times); the 120s dominate.
- **Exactly one 300 is in the data: Mike DePasquale, S22 (Fall 2018), week 6, a
  161-201-300 night.** Geoffrey Berry's playoff 300 is NOT in `playoffScores` (zero
  300s there) but IS recorded elsewhere on the site (all-time chart and a couple of
  other places). The perfect-game honor roll must therefore come from an explicit
  source, not an auto-scan of `playoffScores` (which would wrongly show only one name).
- Only one bowler has never broken 60 (Anna Wilson, 3 games total), so a 60 floor
  costs nothing real.
- 9-week regular seasons + 2 playoff weeks. Playoff games live in `playoffScores`,
  separate from `scores`. **The map uses regular-season `scores` only. Playoff games
  are excluded from everything except the 300 honor roll** (Berry's perfect game).

Russ's numbers, used throughout the prototype: ~843 games, 134 distinct scores, range
90-279, most-rolled 159 (19x), high game 279. (The prototype figures fold in a few
playoff games; under the regular-season-only rule the totals drop slightly.) Current
season (S36) so far: one night, games 146/194/204 - all repeats of scores he had
rolled before.

## The board

### Layout

- Grid of squares, one per possible score. **Columns are the ones digit (0-9)** across
  the top; **rows are groups of ten** (the 150s, the 160s...) labeled down the left
  with the tens value. A square's score = row label + column header. This makes
  position self-describing with no hover required - critical for mobile.
- **The board is clipped to each bowler's own range**: it runs from their lowest
  ten-row to their highest. (We considered a shared 60-300 board for cross-person
  comparability but dropped it - maps never look identical anyway given different
  fills, and clipping gives back significant vertical height.) Rows run from
  `floor(minScore/10)*10` to `floor(maxScore/10)*10`, contiguous.
- **60 is the practical floor**; scores below 60 are not shown. Safe per the data
  (one 3-game bowler affected).
- **300 is pulled out** of the grid into its own medallion below the board (see below).

### Square states and color

- **Rolled** - filled with a **career-frequency heat shade**, light (rolled rarely)
  to dark (rolled often), navy hue. Bins are **absolute, not per-bowler-normalized**,
  so a given shade means the same thing on everyone's card. Current bins:
  `1x=1, 2-3x=2, 4-6x=3, 7-10x=4, 11+=5`.
- **This-season overlay** - a rolled square the bowler has hit **at least once this
  season** uses a **warm (amber/orange) hue instead of navy**. The *shade* is still
  the all-time frequency; only the *hue* changes, so it reads like a fresh card
  filling in over navy career history. Gate is binary (bowled this season or not),
  NOT this-season count.
- **Gap in range** - a score inside the bowler's range they have never rolled: a
  hollow dashed red square. These are the bingo blanks.
- **Most-rolled square** - marked with a **gold star, black outline**
  (`-webkit-text-stroke`; SVG is the bulletproof fallback if a rendering quirk shows
  up). Chosen over a plain ring, white star, corner star, crown (emoji inconsistency)
  and gold-without-outline. Black border won for legibility across navy, mid and warm
  cells. FINAL BORDER (black vs white) to be confirmed on a real phone during build.
- **"Not yet"** (faint outline, a score above the bowler's max within the top row) -
  the *style* still exists for the few cells that can appear above someone's best in
  their top ten-row, but it is **no longer in the legend**. Deliberate: with clipping
  it barely occurs. Build may either leave these faint-and-unlabeled or restyle them
  as gaps; either is acceptable.

### The 300 medallion

- Rendered **only for bowlers who have a 300 on record** (currently Mike DePasquale
  and Geoffrey Berry). Everyone else's map simply ends at the grid; the medallion is
  hidden.
- A gold, glowing rounded medallion reading "300 / PERFECT", centered below the board
  and visually separated so it reads as a trophy, not a grid cell. No write-up text.
- **Source of truth is an explicit perfect-game honor roll, not an auto-scan** (see
  Data reality). Geoffrey Berry's 300 must be included even though it is absent from
  `playoffScores`.

### Interaction

- **Hover (desktop):** floating tooltip on each square - `159 - rolled 19x`, plus
  `- your most-rolled` on the star. No "this season" text in the readout (the color
  already conveys it; showing "3x - this season" misread as "3 times this season").
- **Tap (mobile):** a persistent readout line under the board updates on tap with the
  same text. This is the mobile answer to "what does this square mean" alongside the
  self-describing row/column labels.
- **Collapsible section.** Big graphic, so it is **collapsed by default** on the
  bowler page, using the existing `CollapsibleSection` component. Collapsed header
  shows a teaser.

### Teaser (collapsed state)

`134 scores rolled - 3 this season - tap to open`

- `N scores rolled` - distinct scores filled.
- `N this season` - count of squares hit this season (neutral wording; these are
  usually repeats).
- **`N new square(s)!`** (highlighted, only when > 0) - a genuinely new fill, i.e. a
  score whose **first-ever roll happened this season** (a previously-empty square now
  filled). This is the real bingo payoff and is called out specifically. "New" is
  reserved for true first-times; repeats are never called new. Russ currently has 0.
  Definition for the query: a score is "new this season" iff `MIN(seasonID)` across
  all of that bowler's rolls of that score equals the current season.
- Does NOT repeat games-played or range - those already appear elsewhere on the
  bowler page.

## Component boundaries

- **ScoreMap query** (`src/lib/queries/`, likely a new function): given a bowlerID,
  returns per-score career counts, the set of scores rolled this season, the set of
  scores whose first-ever roll is this season, min/max, most-rolled score, and a
  perfect-game flag. Must follow the `cachedQuery()` + cache-channel conventions;
  this is per-bowler data on the `scores` channel. **Regular-season `scores` only -
  playoff games (`playoffScores`) are excluded from every count, shade, overlay, min/
  max and most-rolled calculation.** The *sole* exception is the perfect-game honor
  roll (next bullet), because Geoffrey Berry's 300 was bowled in a playoff.
- **ScoreMap component** (`src/components/bowler/`): pure render from the query
  result. Builds the clipped ten-row grid, applies the four square states, the star,
  the medallion (gated on the perfect-game flag), the hover/tap readouts, wrapped in
  `CollapsibleSection` with the teaser.
- **Perfect-game honor roll**: a small explicit source (hardcoded list or a tiny
  table) of bowlerIDs with a 300, since the DB is incomplete. DePasquale + Berry.

## Visual integration and mobile (hard requirements)

The prototype uses its own cream/navy/dark theme for illustration only. **It does not
represent how this must look on the bowler page.** The real page is light, and every
sibling section is a white card:

```
bg-white rounded-lg border border-navy/10 shadow-sm p-...   (+ optional border-l-4 accent)
```
(See `GameProfile.tsx`, `PersonalRecordsPanel.tsx`.)

Requirements:

1. **Match the page card.** The ScoreMap section must use the same white-card container
   and Tailwind tokens as its siblings, on the light page background - not a dark
   surface. Wrap in the existing `CollapsibleSection`.
2. **Re-validate all colors against a WHITE card background**, not the prototype's dark
   surface. The navy heat ramp, the warm (amber) this-season ramp, the dashed-red gap
   outline, and the gold+black star must all read correctly on white. The palest bins
   (career-`1` navy and season-`1` amber) are the ones most at risk of washing out on
   white - check them specifically.
3. **Mobile visibility is a first-class requirement, not a polish step.** At ~26-30px
   cells on a phone: the dashed-red gaps must be distinguishable from filled cells, the
   gold star must be legible, the warm/navy hues must be tellable apart, and the row/
   column labels must be readable. Verify on a real device.
4. **Verification method:** build the component into an actual bowler page and view it
   via `next dev` on **both desktop and a phone** before finalizing any color or size.
   Do not finalize palette from the standalone prototype.
5. Follow the site's contrast/opacity rules - **never text opacity below 60%** (hard
   rule), and no em dashes anywhere.

## Open items for the build (not blockers)

1. **Star border color** - gold+black vs gold+white, decided on a real phone.
2. **Mobile cell size** - 10 columns gives ~26-30px cells; confirm the gap/gold-star
   still read at that size on an actual device.
3. **"Not yet" edge cells** - leave faint-unlabeled or restyle as gaps.
4. **New-square visual distinction** - a genuinely-new fill is currently just warm
   like a repeat; consider a small extra mark (dot/sparkle) on first-time fills.
   Optional, post-v1.
5. **Board height on desktop** - single column of ten-rows can be tall; a two-column
   (low tens beside high tens) variant is possible if it feels too long. Deferred.

## Alternatives considered

- **Shared 60-300 board** - dropped for per-bowler clipping (height, and maps never
  matched anyway).
- **16-type bowling personality archetype** - parked. Four independent axes (night
  shape, season shape, range, predictability) verified against data. Could return as
  a separate feature; would need per-axis confidence gating so near-median bowlers get
  true copy, and careful wording on the "predictability" axis.
- **Oracle / teammate graph, statistical twins, lane report** - see "how we got here".

## Non-goals

- Not a shared/comparable canvas across bowlers.
- No eligibility gate; no fallback "league story" view for light bowlers (the bingo
  framing makes a sparse card aspirational, not sad).
- No frame-level stats (strikes/spares/splits) - the data does not exist.
