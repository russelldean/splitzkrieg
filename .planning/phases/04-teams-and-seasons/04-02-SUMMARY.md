---
phase: 04-teams-and-seasons
plan: 02
subsystem: ui
tags: [next.js, team-profiles, static-generation, react, sql]

requires:
  - phase: 04-01
    provides: Team and season query functions (getAllTeamSlugs, getTeamBySlug, etc.)
provides:
  - Complete /team/[slug] route with hero, franchise history, current roster, season-by-season accordion, all-time roster, head-to-head
  - /teams directory with active/historical team card grid
  - Ghost Team special treatment pattern
affects: [04-03, 04-04]

tech-stack:
  added: []
  patterns: [team profile static generation, accordion season-by-season with pre-fetched bowler data, ghost team detection]

key-files:
  created:
    - src/app/team/[slug]/page.tsx
    - src/app/teams/page.tsx
    - src/components/team/TeamHero.tsx
    - src/components/team/TeamCard.tsx
    - src/components/team/CurrentRoster.tsx
    - src/components/team/AllTimeRoster.tsx
    - src/components/team/HeadToHead.tsx
    - src/components/team/FranchiseHistory.tsx
    - src/components/team/TeamSeasonByseason.tsx
  modified:
    - src/lib/queries.ts

key-decisions:
  - "strikeX styling reserved for team names, season names, and zero-value indicators -- never applied to people's names"
  - "Renamed 'Roster' to 'Bowlers' on directory cards since count represents all-time bowlers, not current roster"
  - "Ghost Team gets emoji treatment instead of numeric stats on directory cards"
  - "Added tenure (first/last season) to roster tables for historical context"
  - "No captain data available in DB -- skipped captain feature"

patterns-established:
  - "Ghost team detection: compare teamName === 'Ghost Team' for special UI treatment"
  - "strikeX name policy: team names, season names, roman numerals get red X styling; bowler names do not"

requirements-completed: [TEAM-01, TEAM-02, TEAM-03, TEAM-04]

duration: 5min
completed: 2026-03-04
---

# Phase 04 Plan 02: Team Profile Pages Summary

**Complete team profile pages with 6 sections (hero, franchise history, roster, season accordion, all-time roster, head-to-head) and teams directory with established dates and Ghost Team treatment**

## Performance

- **Duration:** 5 min (feedback fixes only -- initial build in prior tasks)
- **Started:** 2026-03-05T00:54:50Z
- **Completed:** 2026-03-05T01:00:23Z
- **Tasks:** 3 (2 from prior session + 1 feedback fix)
- **Files modified:** 8

## Accomplishments
- Team profile page at /team/[slug] with hero, franchise history dropdown, current roster, season-by-season accordion, all-time roster, head-to-head empty state
- Teams directory at /teams with active/historical sections, established dates, bowler counts
- Ghost Team special treatment with emoji instead of stats
- Bowler name tenure (first/last season with team) on both roster tables
- Removed strikeX from all bowler names across team and season components (project-wide styling decision)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create team profile page with all components** - `f408241` (feat)
2. **Task 2: Create TeamSeasonByseason accordion and teams directory** - `b7e07ce` (feat)
3. **Task 3: Apply user feedback fixes** - `63bbafa` (fix)

## Files Created/Modified
- `src/app/team/[slug]/page.tsx` - Team profile page with static generation and OG metadata
- `src/app/teams/page.tsx` - Teams directory with active/historical sections
- `src/components/team/TeamHero.tsx` - Hero with team name, stat pills, franchise history
- `src/components/team/TeamCard.tsx` - Directory card with bowler count, established date, Ghost Team handling
- `src/components/team/CurrentRoster.tsx` - Current season roster with tenure since first season
- `src/components/team/AllTimeRoster.tsx` - All-time roster sorted by games with tenure column
- `src/components/team/HeadToHead.tsx` - Empty state with clear "coming soon" messaging
- `src/components/team/FranchiseHistory.tsx` - Collapsible franchise name history dropdown
- `src/components/team/TeamSeasonByseason.tsx` - Accordion with expandable bowler detail per season
- `src/lib/queries.ts` - Added establishedSeason to directory query, first/last season to roster queries
- `src/components/season/SeasonLeaderboards.tsx` - Removed strikeX from bowler names, kept on team names
- `src/components/season/FullStatsTable.tsx` - Removed strikeX from bowler names, kept on team names

## Decisions Made
- **strikeX policy:** Red X styling reserved for team names, season names, and zero-value indicators. Never applied to people's actual names -- user feedback that people get tired of seeing red letters in their own name.
- **"Bowlers" vs "Roster":** Directory card label changed from "Roster" to "Bowlers" since the count represents all-time unique bowlers, not current roster size.
- **Ghost Team:** Detected by teamName === 'Ghost Team' and shown with ghost emoji instead of numeric stats.
- **Captain data:** No captain/isCaptain field exists in bowlers or scores tables. Feature skipped per user instruction.
- **Head-to-head messaging:** Changed from vague "file cabinet" message to explicit "Coming soon" with description of what will appear.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Removed strikeX from bowler names in season components**
- **Found during:** Task 3 (feedback fixes)
- **Issue:** User feedback that strikeX should not apply to people's names was a project-wide decision, but season components (SeasonLeaderboards, FullStatsTable) also had strikeX on bowler names
- **Fix:** Removed strikeX from bowlerName in SeasonLeaderboards and FullStatsTable, restored strikeX on teamName references that were auto-removed by linter
- **Files modified:** src/components/season/SeasonLeaderboards.tsx, src/components/season/FullStatsTable.tsx
- **Committed in:** 63bbafa

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Extended strikeX name policy to season components for consistency. No scope creep.

## Issues Encountered
- Linter auto-removed strikeX import from SeasonLeaderboards when all direct usages were edited, which also removed strikeX from team name rendering. Fixed by re-adding import and restoring team name strikeX call.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Team profiles complete and ready for cross-linking from season pages (Plan 04-03)
- Head-to-head section is empty shell, ready to populate when matchResults data is surfaced
- Ghost Team pattern established for any future special team handling

---
*Phase: 04-teams-and-seasons*
*Completed: 2026-03-04*
