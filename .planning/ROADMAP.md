# Roadmap: Splitzkrieg Bowling League

## Overview

Build a stats-driven reference site for the Splitzkrieg Bowling League, starting with infrastructure and the bowler profile page (the centerpiece), then expanding to search, teams, seasons, leaderboards, historical content, and finally admin tools. Each phase delivers a complete, verifiable capability. The bowler profile page is the product -- everything else orbits it.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Static generation, build-time data pipeline, design system, and project structure
- [ ] **Phase 2: Bowler Profiles** - The centerpiece page with career stats, records, charts, and shareable URLs
- [ ] **Phase 3: Search and Home Page** - Front door to the site with prominent search and league snapshot
- [ ] **Phase 4: Teams and Seasons** - Complete the three-entity browsable graph (bowlers, teams, seasons)
- [ ] **Phase 5: Leaderboards and Profile Depth** - All-time leaderboards and enriched bowler profile features
- [ ] **Phase 6: Champions, Content, and Community** - Historical recognition, blog system, and league info pages
- [ ] **Phase 7: Admin Tools** - Score entry interface replacing the spreadsheet workflow

## Phase Details

### Phase 1: Foundation
**Goal**: A statically generated Next.js site with build-time Azure SQL data fetching, Metrograph design system, pre-built search index, and on-demand revalidation pipeline -- the foundation every feature inherits
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, XCUT-02, XCUT-03
**Success Criteria** (what must be TRUE):
  1. Build process connects to Azure SQL, fetches data, and generates static pages (handles DB cold start with retry/timeout at build time, not visitor time)
  2. Every generated page loads instantly for visitors with zero database round-trips -- fully pre-rendered HTML
  3. Design system is visible -- cream/navy/red palette, DM Serif Display headings, Inter body text render correctly
  4. Layout is mobile-responsive at 375px width (nav, footer, page shell all reflow correctly)
  5. On-demand revalidation endpoint triggers static regeneration after data syncs (build runs, new pages deploy, visitors always see fresh static content)
**Plans**: 3 plans in 2 waves

Plans:
- [x] 01-01-PLAN.md — Design system tokens, fonts, responsive page shell (Header/Footer/MobileNav)
- [x] 01-02-PLAN.md — Azure SQL data pipeline, static bowler page generation, revalidation endpoint
- [x] 01-03-PLAN.md — Pre-built search index and client-side fuzzy search with Fuse.js

### Phase 2: Bowler Profiles
**Goal**: A bowler can visit their profile page and see their complete career -- stats by season, personal records, average progression chart, and game scores -- all cross-linked and shareable
**Depends on**: Phase 1
**Requirements**: BWLR-01, BWLR-02, BWLR-03, BWLR-04, BWLR-05, BWLR-11, BWLR-12, XCUT-01
**Success Criteria** (what must be TRUE):
  1. User visits /bowler/russ-smith and sees career summary header (name, seasons active, career average, total games, teams played for)
  2. Profile shows season-by-season stats table with a career totals row, and every team name is a clickable link
  3. Profile shows personal records panel (high game, high series, 200+ count, 600+ count) with color-coded scores (200+ green, 250+ gold)
  4. Profile shows an average progression line chart across all seasons bowled
  5. Profile has expandable game log showing week-by-week scores per season
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

### Phase 3: Search and Home Page
**Goal**: Bowlers can find any bowler by name from the home page and see a current-season snapshot of the league
**Depends on**: Phase 2
**Requirements**: SRCH-01, SRCH-02, HOME-01, HOME-02, HOME-03, HOME-04, HOME-05
**Success Criteria** (what must be TRUE):
  1. User visits splitzkrieg.org and sees a prominent search bar front and center with Metrograph-inspired branding
  2. Typing a bowler name shows autocomplete suggestions with fuzzy matching (e.g., "deluca" finds "Leo DeLuca")
  3. Selecting a search result navigates to that bowler's profile page
  4. Home page shows current season snapshot (standings, recent results) and a quick stats ticker (total bowlers, total games, league since 2007)
  5. Home page shows a countdown clock to the next bowling night
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Teams and Seasons
**Goal**: Users can browse team profiles and season pages, completing the three-entity reference graph where every bowler, team, and season links to every other
**Depends on**: Phase 2
**Requirements**: TEAM-01, TEAM-02, TEAM-03, TEAM-04, SEASN-01, SEASN-02, SEASN-03, SEASN-04, SEASN-05
**Success Criteria** (what must be TRUE):
  1. User visits /team/gutter-sluts and sees current roster with clickable links to bowler profiles, plus team history (all-time record, past rosters by season)
  2. Team page shows head-to-head record vs every other team (or graceful "coming soon" if matchResults data is not yet populated)
  3. User visits /season/xxxv and sees final standings with points breakdown, division alignment, and season leaderboards (top averages, high games)
  4. Season page shows weekly results archive with scores linked to bowler profiles
  5. Schedule display works for current and past seasons
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD

### Phase 5: Leaderboards and Profile Depth
**Goal**: Users can browse all-time leaderboards with filters and bowler profiles gain depth with milestones, rankings context, and career timelines
**Depends on**: Phase 4
**Requirements**: LEAD-01, LEAD-02, LEAD-03, LEAD-04, LEAD-05, BWLR-07, BWLR-08, BWLR-10
**Success Criteria** (what must be TRUE):
  1. User can view all-time leaderboards filterable by gender, active-only, and season range with scratch/handicap toggle
  2. Leaderboard tables are sortable with every bowler name linking to their profile
  3. Bowler profiles show leaderboard context ("Ranked 5th in career average among active bowlers") for top performers
  4. Bowler profiles show milestone tracker (e.g., "3 games away from 100 career games") and career timeline (teams played for, chronological)
  5. League-wide aggregate stats dashboard shows total games, total pins, unique bowlers across all seasons
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD
- [ ] 05-03: TBD

### Phase 6: Champions, Content, and Community
**Goal**: Users can explore league history through champions pages and playoff brackets, read weekly recaps, and find information about joining the league
**Depends on**: Phase 4
**Requirements**: CHMP-01, CHMP-02, CHMP-03, CONT-01, CONT-02, CONT-03
**Success Criteria** (what must be TRUE):
  1. Champions page shows all season winners across 5 championship categories (or graceful empty state where data is not yet populated)
  2. Playoff bracket display works for current and past seasons (or graceful empty state)
  3. Blog system supports creating and displaying weekly recaps with auto-generated highlights from score data
  4. About / Join the League page shows league info, FAQ, and a working interest form
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD
- [ ] 06-03: TBD

### Phase 7: Admin Tools
**Goal**: The commissioner can enter scores through a web interface instead of spreadsheets, with validation to catch data entry errors
**Depends on**: Phase 1
**Requirements**: ADMN-01, ADMN-02
**Success Criteria** (what must be TRUE):
  1. Commissioner can enter scores for a bowling night through a web form (team, bowlers, three games each)
  2. Score entry flags unusual values (e.g., scores over 300, duplicate entries) and validates against known bowlers
  3. Submitted scores appear on the live site after cache revalidation
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7
Note: Phases 3 and 4 both depend on Phase 2. Phases 5 and 6 both depend on Phase 4. Phase 7 only depends on Phase 1.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-03-02 |
| 2. Bowler Profiles | 0/3 | Not started | - |
| 3. Search and Home Page | 0/3 | Not started | - |
| 4. Teams and Seasons | 0/3 | Not started | - |
| 5. Leaderboards and Profile Depth | 0/3 | Not started | - |
| 6. Champions, Content, and Community | 0/3 | Not started | - |
| 7. Admin Tools | 0/2 | Not started | - |
