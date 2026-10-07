# Weekly writeup draft

**Date:** 2026-10-07
**Status:** design approved in conversation, awaiting spec review

## Problem

Writing the weekly recap post is the slowest part of Russ's week. The format is
fixed (Bowler of the Week, Team of the Week, Personal Bests, Career Milestones),
but every line carries context he looks up by hand: season rank, club number,
how fast someone reached a milestone. Today "Write one" on the week page creates
an empty post on purpose.

## Goal

"Write one" creates the post with all four sections already written, context
included. Russ adds an intro or trims a clause if he wants to, and publishes.
Untouched, the draft is a complete post.

## The draft

```
**Bowler of the Week**: <bowler>Name</bowler> (Team) - 741 handicap series (3rd best of the season)

**Team of the Week**: <team>Team</team> - 2,813 handicap series (best of the season so far)

**Personal Bests**: 6 all-time high games, 7 all-time high series, see below

**Career Milestones**

   - <bowler>Name</bowler> - 250 career games, #91 in the club
   - <bowler>Name</bowler> - 100,000 career pins, #14 in the club, 9th fastest
   - <bowler>Name</bowler> - 25,000 career pins, #240 in the club, tied for 4th fastest
```

The numbers are illustrative. Wording rules:

- **Bowler of the Week.** Name, team, handicap series. Season rank appended only
  when it is top 10 among all bowler-nights in the season so far. A tie for BOTW
  lists every bowler ("X and Y"), matching the week page.
- **Team of the Week.** Team and handicap series. Season rank appended only when
  top 10 among all team-nights in the season so far.
- **Season rank wording.** 1st reads "best of the season so far"; otherwise
  "3rd best of the season"; equal values read "tied for 3rd best of the season".
- **Personal Bests.** The counts of all-time high games and all-time high series,
  then "see below". Zero of one kind drops that clause; zero of both drops the
  line.
- **Career Milestones.** One bullet per milestone recorded for the week, in the
  week page's order. Every bullet gets the club number. Every bullet except a
  games milestone also gets the fastest rank, whatever the rank (Russ decides
  what to cut). No milestones drops the whole section.
- **No intro line.** The post starts at Bowler of the Week; Russ writes above it.
- Bowler and team names use the existing `<bowler>` and `<team>` tags.
- No em dashes (site rule). Separators are a plain hyphen, as in Russ's posts.

## Definitions

- **Club number.** Position among everyone who has reached the same category and
  threshold, ordered by (season, week). Bowlers who reached it the same week share
  a number and read "tied for #N in the club".
  `bowlerMilestones.ordinal` is NOT used: it is NULL for every S36 row because
  `record-milestones.mjs` stopped writing it. The computed number must agree with
  the stored `ordinal` on historical rows that have one (that is the test).
- **Fastest rank.** Career games bowled (`SUM(gamesBowled)`, never `COUNT * 3`)
  through the night of the crossing, ranked ascending among every member of that
  club. Equal counts read "tied for Nth fastest". Night-level, not game-level:
  turkeys are only recorded per night, so one granularity for every category.
- **Categories.** totalGames (club number only), totalPins, totalTurkeys,
  games200Plus, series600Plus.
- **BOTW, TOTW, personal-best counts** come from `computeWeeklyAwards()` in
  `src/components/season/weekStatsUtils.ts`, the same function the week page
  uses, so the draft and the page cannot disagree.

## Where it runs

At click time only, inside `POST /api/evillair/week-writeup`, when it creates a
post. The draft becomes the post's initial `content`; from then on it is ordinary
post text, never regenerated, so Russ's edits are never overwritten. Existing
posts are untouched.

- **`src/lib/writeup/draft.ts`**: pure functions, data in, markdown out. No DB.
  Unit tests cover ties, the top-10 cutoff, ordinals (1st/2nd/3rd/11th/12th/13th/
  21st/22nd/23rd), clause and section omission, and the games-milestone rule.
- **`src/lib/writeup/draft-data.ts`**: gathers the inputs with direct queries at
  click time: week scores (the existing `getWeekScores`), season rank inputs,
  club numbers, and fastest ranks. Nothing here runs at build time and no
  existing cached query changes, so it adds no build or publish-week risk.
- **Failure.** If gathering the draft fails, the route still creates the post
  with empty content (today's behaviour) and logs the error. A broken draft must
  never block writing a post.

## Cleanup

Delete `scripts/create-weekly-post.mjs`. It writes MDX files to `content/blog/`
that nothing has read since posts moved to the `blogPosts` table.

## Out of scope

- An intro sentence or any generated prose beyond the four sections.
- Regenerating the draft for an existing post.
- Restoring `bowlerMilestones.ordinal` in `record-milestones.mjs` (worth doing,
  separate change).
- Team of the Week ties: the week page picks one team, and the draft follows it.
