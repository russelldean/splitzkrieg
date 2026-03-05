---
phase: 04-teams-and-seasons
verified: 2026-03-05T03:00:00Z
status: gaps_found
score: 9/11 must-haves verified
gaps:
  - truth: "Every bowler, team, and season links to every other (three-entity graph complete)"
    status: failed
    reason: "SeasonStatsTable on bowler profiles links to /season/${romanNumeral} (e.g., /season/XXXV) instead of the correct computed slug /season/fall-2025 -- results in 404 for all season links from bowler profile pages"
    artifacts:
      - path: "src/components/bowler/SeasonStatsTable.tsx"
        issue: "Line 61: href={`/season/${season.romanNumeral}`} should be href={`/season/${season.seasonSlug}`} -- seasonSlug is not currently returned by getBowlerSeasonStats query"
      - path: "src/lib/queries.ts"
        issue: "getBowlerSeasonStats query (line 197-278) does not compute seasonSlug -- needs LOWER(REPLACE(sn.displayName, ' ', '-')) AS seasonSlug added to SELECT and BowlerSeasonStats interface"
    missing:
      - "Add seasonSlug to BowlerSeasonStats interface in queries.ts"
      - "Add LOWER(REPLACE(sn.displayName, ' ', '-')) AS seasonSlug to getBowlerSeasonStats SELECT"
      - "Add seasonSlug to GROUP BY in getBowlerSeasonStats"
      - "Update SeasonStatsTable line 61: change season.romanNumeral to season.seasonSlug"
  - truth: "Team season-by-season accordion links season names to season pages"
    status: failed
    reason: "TeamSeasonByseason shows season names as text inside a button but does not link to /season/[seasonSlug]. The seasonSlug field exists in TeamSeasonRow (from the query) but is never used to render a Link."
    artifacts:
      - path: "src/components/team/TeamSeasonByseason.tsx"
        issue: "Lines 74-78: season name rendered as plain text inside accordion button, no Link to /season/[seasonSlug]. seasonSlug is available on the season object."
    missing:
      - "Add a Link to /season/[season.seasonSlug] from the season name in the accordion header row"
      - "Keep the accordion toggle behavior (the button) but add a separate Link element for the season name"
---

# Phase 4: Teams and Seasons Verification Report

**Phase Goal:** Users can browse team profiles and season pages, completing the three-entity reference graph where every bowler, team, and season links to every other

**Verified:** 2026-03-05T03:00:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All team and season query functions exist and return typed data | VERIFIED | 17+ query functions in queries.ts under Phase 4 sections; TypeScript compiles clean |
| 2 | Team queries cover roster, season-by-season, all-time roster, franchise history, directory | VERIFIED | getAllTeamSlugs, getTeamBySlug, getTeamCurrentRoster, getTeamSeasonByseason, getTeamSeasonBowlers, getTeamAllTimeRoster, getTeamFranchiseHistory, getAllTeamsDirectory all exist and query DB |
| 3 | Season queries cover standings, leaderboards, full stats, schedule, records, directory | VERIFIED | getAllSeasonSlugs, getSeasonBySlug, getSeasonStandings, getSeasonLeaderboard, getSeasonFullStats, getSeasonSchedule, getSeasonRecords, getSeasonHeroStats, getAllSeasonsDirectory, getSeasonWeeklyScores all exist |
| 4 | User visits /team/[slug] and sees complete team profile with all 6 sections | VERIFIED | team/[slug]/page.tsx has generateStaticParams + dynamicParams=false + generateMetadata; renders TeamHero, CurrentRoster, TeamSeasonByseason, AllTimeRoster, HeadToHead |
| 5 | Team page shows current roster with bowler names linked to profiles | VERIFIED | CurrentRoster.tsx line 33: href={`/bowler/${member.slug}`} |
| 6 | /teams directory shows active teams first then historical with cards | VERIFIED | teams/page.tsx splits teams on isActive flag; renders TeamCard grid; TeamTimeline at bottom |
| 7 | User visits /season/[slug] and sees hero, standings, leaderboards, records, full stats | VERIFIED | season/[slug]/page.tsx fetches all data in parallel; renders SeasonHero, Standings, StandingsRaceChart, SeasonLeaderboards, FullStatsTable, WeeklyResults, SeasonRecordsSection |
| 8 | Season shows standings with division grouping when divisions exist | VERIFIED | Standings.tsx checks hasDivisions prop; groups by divisionName with sub-section headings |
| 9 | Season page shows weekly results with expandable box scores for XXVI-XXXV | VERIFIED | WeeklyResults.tsx is 296 lines with full accordion, team box scores, score color coding, debut badges; archival note shown for pre-XXVI seasons |
| 10 | Every bowler, team, and season links to every other (three-entity graph) | FAILED | Two broken cross-links: (1) SeasonStatsTable uses /season/XXXV (romanNumeral) not /season/fall-2025 (slug) -- 404s on all bowler-to-season links. (2) TeamSeasonByseason accordion does not link season names to /season/[seasonSlug] |
| 11 | /seasons directory shows reverse chronological season list | VERIFIED | seasons/page.tsx calls getAllSeasonsDirectory; renders seasons with links to /season/[slug] |

**Score:** 9/11 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/queries.ts` | 15-20 new query functions for teams and seasons | VERIFIED | 17+ functions; 1,998 lines total; getDb(), isPenalty=0, season slug as LOWER(REPLACE(displayName,' ','-')) |
| `src/app/team/[slug]/page.tsx` | Team profile page with static generation | VERIFIED | generateStaticParams, dynamicParams=false, generateMetadata with OG tags |
| `src/app/teams/page.tsx` | Teams directory replacing placeholder | VERIFIED | Calls getAllTeamsDirectory, getTeamSeasonPresence; renders active/historical splits + TeamTimeline |
| `src/components/team/TeamHero.tsx` | Team hero with franchise identity emphasis | VERIFIED | 44 lines; shows team name, stat pills, FranchiseHistory, ShareButton |
| `src/components/team/TeamSeasonByseason.tsx` | Accordion with expandable bowler rows per season | PARTIAL | 149 lines; accordion works with bowler detail; BUT does not link season names to /season/[seasonSlug] |
| `src/components/team/CurrentRoster.tsx` | Current roster with linked bowler names | VERIFIED | 63 lines; links to /bowler/[slug] |
| `src/components/team/AllTimeRoster.tsx` | All-time roster sorted by games | VERIFIED | 67 lines; sorted by totalGames DESC; links to /bowler/[slug] |
| `src/components/team/HeadToHead.tsx` | Empty state (intentional per plan decision) | VERIFIED | Shows "Coming soon" EmptyState; matchResults not yet populated; intentional per 04-CONTEXT.md |
| `src/components/team/TeamCard.tsx` | Directory card with team info | VERIFIED | 58 lines; links to /team/[slug]; Ghost Team treatment |
| `src/components/team/FranchiseHistory.tsx` | Collapsible franchise name dropdown | VERIFIED | 47 lines; client component with expand/collapse |
| `src/components/team/TeamTimeline.tsx` | Grid of team existence across seasons | VERIFIED | 124 lines; season column headers link to /season/[slug]; team names link to /team/[slug] |
| `src/app/season/[slug]/page.tsx` | Season page with static generation | VERIFIED | generateStaticParams, dynamicParams=false, generateMetadata with OG tags; all sections wired |
| `src/app/seasons/page.tsx` | Seasons directory replacing placeholder | VERIFIED | Calls getAllSeasonsDirectory; reverse chronological list with season links |
| `src/components/season/SeasonHero.tsx` | Season hero with stat pills | VERIFIED | 95 lines; Roman numeral + display name; stat pills for league avg, top bowlers |
| `src/components/season/Standings.tsx` | Division-grouped or flat standings table | VERIFIED | 183 lines; division grouping, playoff highlighting, matchResults-based Total Pts/Wins/XP |
| `src/components/season/SeasonLeaderboards.tsx` | Tabbed leaderboards (Men's/Women's/Handicap) | VERIFIED | 187 lines; tabbed client component; playoff shading; handicap eligibility filtering |
| `src/components/season/FullStatsTable.tsx` | Sortable stats table with gender tabs | VERIFIED | 212 lines; client component; gender tabs; sortable all columns |
| `src/components/season/WeeklyResults.tsx` | Box scores accordion per week | VERIFIED | 296 lines; match-by-match detail, debut badges, score color coding, future weeks from schedule |
| `src/components/season/StandingsRaceChart.tsx` | Recharts rank visualization | VERIFIED | 220 lines; ResponsiveContainer + LineChart; inverted Y axis; clickable legend |
| `src/components/season/SeasonRecordsSection.tsx` | Season records at page bottom | VERIFIED | 56 lines; wired to SeasonRecords type from queries |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/app/team/[slug]/page.tsx` | `src/lib/queries.ts` | import of all team queries | WIRED | Lines 14-23: imports getAllTeamSlugs, getTeamBySlug, getTeamCurrentRoster, getTeamSeasonByseason, getTeamSeasonBowlers, getTeamAllTimeRoster, getTeamFranchiseHistory |
| `src/app/season/[slug]/page.tsx` | `src/lib/queries.ts` | import of all season queries | WIRED | Lines 11-21: imports all season query functions |
| `src/components/team/CurrentRoster.tsx` | `/bowler/[slug]` | Link href | WIRED | Line 33: href={`/bowler/${member.slug}`} |
| `src/components/team/AllTimeRoster.tsx` | `/bowler/[slug]` | Link href | WIRED | Line 38: href={`/bowler/${member.slug}`} |
| `src/components/team/TeamSeasonByseason.tsx` | `/season/[seasonSlug]` | Link href | NOT WIRED | Season names shown as plain text inside accordion button; seasonSlug field exists in TeamSeasonRow but no Link rendered |
| `src/components/season/Standings.tsx` | `/team/[slug]` | Link href | WIRED | Line 100: href={`/team/${row.teamSlug}`} |
| `src/components/season/SeasonLeaderboards.tsx` | `/bowler/[slug]` | Link href | WIRED | Line 78: href={`/bowler/${entry.slug}`} |
| `src/components/season/FullStatsTable.tsx` | `/bowler/[slug]` | Link href | WIRED | Line 159: href={`/bowler/${row.slug}`} |
| `src/components/season/WeeklyResults.tsx` | `/team/[slug]` | Link href | WIRED | Line 70: href={`/team/${teamSlug}`} |
| `src/components/season/WeeklyResults.tsx` | `/bowler/[slug]` | Link href | WIRED | Line 92: href={`/bowler/${b.bowlerSlug}`} |
| `src/components/team/TeamTimeline.tsx` | `/season/[slug]` | Link href | WIRED | Line 73: href={`/season/${s.slug}`} |
| `src/components/team/TeamTimeline.tsx` | `/team/[slug]` | Link href | WIRED | Line 91: href={`/team/${team.slug}`} |
| `src/components/bowler/SeasonStatsTable.tsx` | `/season/[slug]` | Link href | NOT WIRED | Line 61: href={`/season/${season.romanNumeral}`} uses romanNumeral (e.g., "XXXV") not slug (e.g., "fall-2025") -- results in 404; BowlerSeasonStats interface does not include seasonSlug |
| `src/components/season/StandingsRaceChart.tsx` | `recharts` | LineChart + ResponsiveContainer | WIRED | Lines 4-10: imports from recharts; Line 124-125: ResponsiveContainer + LineChart rendered |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TEAM-01 | 04-01, 04-02 | Team profile with current roster linked to bowler profiles | SATISFIED | /team/[slug] renders CurrentRoster with links to /bowler/[slug] |
| TEAM-02 | 04-01, 04-02 | Team history (all-time record, past rosters by season) | SATISFIED | AllTimeRoster (sorted by games), TeamSeasonByseason accordion with bowler detail per season |
| TEAM-03 | 04-02 | Head-to-head record vs every other team | PARTIAL | HeadToHead section renders with "Coming soon" EmptyState per documented plan decision (matchResults not yet surfaced). Section exists and is wired; data layer deferred. |
| TEAM-04 | 04-01, 04-02 | Shareable team URL with OG meta tags | SATISFIED | generateMetadata includes openGraph with title, description, url, siteName, type: 'profile' |
| SEASN-01 | 04-01, 04-03 | Season page with final standings and points breakdown | SATISFIED | Standings.tsx shows Total Pts, Wins, XP from matchResults |
| SEASN-02 | 04-01, 04-03 | Season page shows division alignment | SATISFIED | Standings.tsx groups by divisionName when hasDivisions=true |
| SEASN-03 | 04-01, 04-04 | Season page shows weekly results archive | SATISFIED | WeeklyResults.tsx accordion with full match-by-match box scores per week |
| SEASN-04 | 04-01, 04-03 | Season page shows season leaderboards | SATISFIED | SeasonLeaderboards.tsx with tabbed Men's/Women's/Handicap sections, top 10 per category |
| SEASN-05 | 04-01, 04-04 | Schedule display for current and past seasons | SATISFIED | WeeklyResults integrates schedule: played weeks show scores, future weeks show upcoming matchups |

**Orphaned requirements:** None. All 9 Phase 4 requirements are claimed by at least one plan.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/bowler/SeasonStatsTable.tsx` | 61 | `href={/season/${season.romanNumeral}}` -- uses romanNumeral as slug | Blocker | All season links from bowler profile pages return 404; breaks bowler-to-season cross-link |
| `src/components/team/TeamSeasonByseason.tsx` | 74-78 | Season name rendered as text only, no Link to /season/[seasonSlug] | Blocker | Team-to-season cross-link missing from accordion; complete navigation graph not achievable |
| `src/components/team/HeadToHead.tsx` | 10 | "Coming soon" empty state | Warning | TEAM-03 section exists but shows no data; intentional per plan (matchResults not surfaced) |

---

## Human Verification Required

### 1. Division-Grouped Standings

**Test:** Visit a season that has division data (check if any season has divisionName populated in DB).
**Expected:** Standings show separate sub-sections per division with division heading before each group.
**Why human:** Cannot determine programmatically if any season has non-null divisionName values -- the standings query supports it but the data population is unknown.

### 2. Team Profile Visual Completeness

**Test:** Visit /teams, click an active team, verify all 6 sections render: hero, franchise history dropdown, current roster, season-by-season accordion, all-time roster, head-to-head.
**Expected:** All sections present and navigable. Expanding accordion shows bowler rows.
**Why human:** Page structure is code-verified but visual layout and responsiveness at 375px requires browser inspection.

### 3. Season Leaderboard Gender Split

**Test:** Visit /season/fall-2025, view Men's and Women's tabs in leaderboards.
**Expected:** Men's and Women's tabs show separate top-10 lists. Playoff-qualifying bowlers have green dot and row shading.
**Why human:** Tab switching is client-side; can verify code exists but not rendered state.

### 4. Standings Race Chart Interactivity

**Test:** Visit /season/fall-2025, scroll to standings race chart, click a team name in the legend.
**Expected:** That team's line highlights in color; all others go muted.
**Why human:** Interactive recharts state cannot be verified from code inspection alone.

### 5. Weekly Results Box Scores

**Test:** Visit /season/fall-2025, expand Week 1 in the weekly results accordion.
**Expected:** Shows match-by-match box scores with individual bowler game lines, team totals, and score color coding (200+ green, 250+ gold).
**Why human:** Dynamic client component; score color visual requires browser.

---

## Gaps Summary

Two cross-link gaps prevent the phase goal of "every bowler, team, and season links to every other" from being fully achieved.

**Gap 1 -- Bowler-to-Season link is broken (SeasonStatsTable):**
The bowler profile's season stats table (a Phase 2 component) links seasons using the romanNumeral field (e.g., `/season/XXXV`). Season pages are routed by slug computed from displayName (e.g., `/season/fall-2025`). This means every click from a bowler's stats table to a season page results in a 404.

The fix requires two changes: (a) add `LOWER(REPLACE(sn.displayName, ' ', '-')) AS seasonSlug` to the `getBowlerSeasonStats` query in `queries.ts` and update the `BowlerSeasonStats` interface; (b) update `SeasonStatsTable.tsx` to use `season.seasonSlug` instead of `season.romanNumeral` in the href.

**Gap 2 -- Team-to-Season link missing (TeamSeasonByseason):**
The season accordion on team profile pages shows season names as clickable-looking accordion headers but they are `<button>` elements for toggling, not links. The `seasonSlug` field is already returned by `getTeamSeasonByseason` (defined in `TeamSeasonRow` interface) but is never used to render a `<Link>`. A small Link element beside or within the season name header needs to be added.

Both gaps involve the same root concern: the cross-link wiring for the season direction of the three-entity graph was incompletely implemented. Team→Season and Bowler→Season links are both missing; Season→Team and Season→Bowler and all Bowler→Team links work correctly.

---

_Verified: 2026-03-05T03:00:00Z_
_Verifier: Claude (gsd-verifier)_
