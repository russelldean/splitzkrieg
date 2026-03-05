---
phase: 04-teams-and-seasons
plan: 04
subsystem: ui
tags: [recharts, react, weekly-results, standings-race, team-timeline, leaderboards, handicap]

requires:
  - phase: 04-teams-and-seasons/04-02
    provides: Team profile pages with hero, roster, all-time roster, head-to-head
  - phase: 04-teams-and-seasons/04-03
    provides: Season pages with standings, leaderboards, full stats
provides:
  - Weekly results box scores with match-by-match detail on season pages
  - Standings race chart with interactive team highlighting
  - Team timeline grid on /teams directory
  - Playoff-aware standings with last week points delta
  - Handicap eligibility leaderboard with full mixed-gender list
  - Season records section at page bottom
affects: []

tech-stack:
  added: []
  patterns: [interactive-recharts-with-state, clickable-legend, playoff-highlighting]

key-files:
  created:
    - src/components/season/WeeklyResults.tsx
    - src/components/season/StandingsRaceChart.tsx
    - src/components/season/SeasonRecordsSection.tsx
    - src/components/team/TeamTimeline.tsx
  modified:
    - src/lib/queries.ts
    - src/app/season/[slug]/page.tsx
    - src/components/season/Standings.tsx
    - src/components/season/SeasonLeaderboards.tsx
    - src/components/season/FullStatsTable.tsx
    - src/components/bowler/AverageProgressionChart.tsx

key-decisions:
  - "strikeX styling reserved for hero headings only -- removed from all lists, tables, charts, and timelines"
  - "Standings race chart defaults all lines muted, click to highlight one team"
  - "Handicap leaderboard shows full mixed-gender list until 10 eligible bowlers shown"
  - "Playoff highlighting: top 2 per division or top 8 overall with green dot and row shading"
  - "Established date uses teamNameHistory for full franchise trail instead of scores table"
  - "Average progression chart hides first league night (outlier data)"
  - "Season records moved to bottom of page, removed from leaderboards section"

patterns-established:
  - "Interactive Recharts: useState for active item, muted defaults, clickable legend buttons"
  - "Playoff highlighting: green dot + bg-green-50/50 row shading with legend text"

requirements-completed: [SEASN-03, SEASN-05]

duration: 11min
completed: 2026-03-05
---

# Phase 4 Plan 4: Weekly Results, Race Chart, Timeline, and Feedback Fixes Summary

**Weekly results box scores, interactive standings race chart, team timeline grid, plus 13-item user feedback overhaul covering bugs, strikeX reduction, playoff-aware standings, handicap eligibility leaderboards, and cross-page fixes**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-05T01:54:42Z
- **Completed:** 2026-03-05T02:06:10Z
- **Tasks:** 3 (2 auto + 1 checkpoint with 13 feedback items)
- **Files modified:** 22

## Accomplishments
- Weekly results accordion with match-by-match box scores, score color coding, team totals, and debut badges
- Interactive standings race chart -- all lines muted by default, click team to highlight with colored line
- Team timeline grid showing 41 teams across 35 seasons with clickable links
- Standings show last week's points delta (+N) and playoff position highlighting
- Handicap tab reworked: full mixed-gender list with eligible bowlers bolded/highlighted
- Scratch leaderboard tabs shade top 8 playoff qualifiers
- Reduced strikeX styling to hero headings only -- removed from 15 component files
- Fixed duplicate React keys and FullStatsTable sorting bug
- Team established date now traces full franchise history via teamNameHistory
- Average progression chart hides outlier first week

## Task Commits

Each task was committed atomically:

1. **Task 1: Build weekly results and add weekly scores query** - `fc0aae0` (feat)
2. **Task 2: Build standings race chart and team timeline** - `f76bb9f` (feat)
3. **Task 3 (feedback): Fix duplicate keys and reduce strikeX** - `d028765` (fix)
4. **Task 3 (feedback): Standings with last week pts and playoff highlighting** - `5dbe025` (feat)
5. **Task 3 (feedback): Rework leaderboards with playoff shading and hcp eligibility** - `ba91828` (feat)
6. **Task 3 (feedback): Interactive race chart and hero record styling** - `b164c49` (feat)
7. **Task 3 (feedback): Fix established date using teamNameHistory** - `9a4806d` (fix)
8. **Task 3 (feedback): Hide first league night from avg progression chart** - `4e416ae` (fix)

## Files Created/Modified
- `src/components/season/WeeklyResults.tsx` - Accordion with match-by-match box scores per week
- `src/components/season/StandingsRaceChart.tsx` - Interactive rank visualization with clickable legend
- `src/components/season/SeasonRecordsSection.tsx` - Standalone season records at page bottom
- `src/components/team/TeamTimeline.tsx` - Grid visualization of team existence across seasons
- `src/lib/queries.ts` - Added getSeasonWeeklyScores, getTeamSeasonPresence, lastWeekPts CTE, teamNameHistory established date
- `src/app/season/[slug]/page.tsx` - Wired up all new components and handicap eligibility logic
- `src/components/season/Standings.tsx` - Added playoff highlighting and last week delta
- `src/components/season/SeasonLeaderboards.tsx` - Playoff shading and handicap eligibility highlighting
- `src/components/season/FullStatsTable.tsx` - Fixed sorting, composite keys, tab order
- `src/components/bowler/AverageProgressionChart.tsx` - Skip first data point

## Decisions Made
- strikeX reserved for hero headings only: too much red everywhere when used on all names/lists
- Race chart uses click (not hover) for team highlighting: more usable on mobile
- Handicap tab shows full list until 10 eligible shown, rather than fixed top-10 cutoff
- Playoff highlighting uses green dot + subtle row shading (consistent in standings and leaderboards)
- Established date uses teamNameHistory for full franchise trail (fixes teams like Alley Oops)
- Season records moved to bottom of page to avoid duplication with hero stats
- FullStatsTable default tab changed to "All Bowlers" (most inclusive view first)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Duplicate React keys in FullStatsTable**
- **Found during:** Task 3 (checkpoint feedback)
- **Issue:** Bowlers on multiple teams had duplicate bowlerID keys causing sort corruption
- **Fix:** Composite key `${bowlerID}-${teamSlug}` ensures uniqueness
- **Files modified:** src/components/season/FullStatsTable.tsx
- **Committed in:** d028765

**2. [Rule 2 - Missing Critical] strikeX overuse across 15+ components**
- **Found during:** Task 3 (checkpoint feedback)
- **Issue:** Red X styling applied everywhere, losing visual impact and becoming distracting
- **Fix:** Removed strikeX imports and calls from 15 files, kept only on hero headings
- **Files modified:** 15 component files across season, team, bowler directories
- **Committed in:** d028765

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Bug fix was essential for correct table behavior. strikeX reduction was a design quality improvement explicitly requested by user feedback.

## Issues Encountered
None -- all feedback items were addressable without architectural changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 4 complete: all team and season pages fully functional with cross-linked three-entity graph
- Build passes with all 42 team pages, 35 season pages, and 619 bowler pages
- Ready for deployment to Vercel when hosting is configured

---
*Phase: 04-teams-and-seasons*
*Completed: 2026-03-05*
