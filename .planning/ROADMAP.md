# Roadmap: Splitzkrieg Bowling League

## Overview

Build a stats-driven reference site for the Splitzkrieg Bowling League, starting with infrastructure and the bowler profile page (the centerpiece), then expanding to search, teams, seasons, leaderboards, historical content, and finally admin tools. Each phase delivers a complete, verifiable capability. The bowler profile page is the product -- everything else orbits it.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Static generation, build-time data pipeline, design system, and project structure
- [x] **Phase 2: Bowler Profiles** - The centerpiece page with career stats, records, charts, and shareable URLs
- [x] **Phase 3: Search and Home Page** - Front door to the site with prominent search and league snapshot (completed 2026-03-03)
- [x] **Phase 4: Teams and Seasons** - Complete the three-entity browsable graph (bowlers, teams, seasons) (completed 2026-03-06)
- [ ] **Phase 5: Remaining Polish and Data Gaps** - Team H2H, standings polish, match legend, data backfill
- [ ] **Phase 6: All-Time Leaderboards and Profile Depth** - Career leaderboards with filters, bowler rank context, milestone trackers
- [ ] **Phase 7: Content and Community Pages** - Rules, blog/recaps, playoff brackets UI, contact integration
- [ ] **Phase 8: Admin Tools** - Score entry interface replacing the spreadsheet workflow

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
- [x] 02-01-PLAN.md -- Data layer: query functions (career, season, game log) and scoreColorClass utility
- [x] 02-02-PLAN.md -- Static components: BowlerHero, PersonalRecordsPanel, SeasonStatsTable, OG metadata
- [x] 02-03-PLAN.md -- Client components: AverageProgressionChart (Recharts 3), GameLog accordion, full page assembly

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
- [x] 03-01-PLAN.md -- Data layer: query functions (next bowling night, milestones, season snapshot, bowler directory)
- [ ] 03-02-PLAN.md -- Home page rebuild: DiscoverySearch, CountdownClock, MilestoneTicker, SeasonSnapshot, hero section
- [x] 03-03-PLAN.md -- Bowler directory, placeholder pages (teams/seasons/leaderboards), resources page, footer updates

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
**Plans**: 4 plans in 3 waves

Plans:
- [x] 04-01-PLAN.md — Data layer: all team and season query functions + TypeScript interfaces
- [x] 04-02-PLAN.md — Team profile page (/team/[slug]) with all sections + teams directory (/teams)
- [x] 04-03-PLAN.md — Season page (/season/[slug]) with standings, leaderboards, full stats + seasons directory (/seasons)
- [x] 04-04-PLAN.md — Weekly results box scores, standings race chart, team timeline visualization

### Phase 5: Remaining Polish and Data Gaps
**Goal**: Address remaining UI polish items and fill data gaps as source data becomes available
**Depends on**: Phase 4
**Already done** (from original Phase 5 scope):
  - ~~Nav restructure~~ — League Nights / Seasons / The Stats / Bowlers / Teams fully implemented
  - ~~Homepage layout~~ — Countdown in header, milestone ticker, mini standings, matchups, season snapshot all above fold
  - ~~Season page navigation~~ — Section jump links (Standings, Race Chart, Weekly Results, Records, Leaderboards)
  - ~~Season hero stripped down~~ — Shows just season name, period/year, champion/playoff bracket
  - ~~Playoff bracket UI~~ — Visual bracket component with connectors on season hero (semis + final)
  - ~~Season records/highlights~~ — SeasonHighlights component with high game/series records
  - ~~Remove IMG_2527.jpg~~ — Done
  - ~~Division-aware standings~~ — Standings component supports division grouping when seasonDivisions data exists
  - ~~PIN redesign~~ — Current design accepted
  - ~~Team timeline playoff overlay~~ — Champions (★), runner-up (blue), semifinalist (orange) with legend
**What remains**:
  - Standings title — add week number, e.g. "Standings (after Wk 3)"
  - Match results color legend/tooltip — green=win, red=loss, amber=tie not obvious to new visitors
  - Team standing rank clarity on TeamHero
  - Team head-to-head section — currently shows "coming soon" placeholder on team pages
**Data gaps** (backfill when source data available):
  - `seasonDivisions` table — needs population (schema supports it, standings code handles it)
  - Season champions / playoff results for remaining seasons
  - Team captains data
  - Schedule data for Seasons I-XXV (site handles missing gracefully)
**Success Criteria** (what must be TRUE):
  1. Standings show week number in title
  2. Match results have color legend or tooltip
  3. Team H2H section shows real data (at least for the 10 seasons with match results)
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: All-Time Leaderboards and Profile Depth
**Goal**: Users can browse all-time career leaderboards and bowler profiles gain depth with rankings context, milestone trackers, and career timelines
**Depends on**: Phase 5
**Already built**: Per-season leaderboards and full stats tables exist on /stats/[slug]. Championship history table on /stats/all-time. Bowler profiles have career summary, records, avg progression chart, season stats, game log.
**What remains**:
  - All-time career leaderboards (highest career avg, most career games, most 200+ games, most career pins, etc.) with gender and active-only filters
  - Bowler profile enrichments: leaderboard rank context ("Ranked 5th in career average"), milestone tracker ("3 games from 100 career games"), career timeline visualization
  - League-wide aggregate stats on /stats/all-time (total games, total pins, unique bowlers across all seasons)
  - Head-to-head stats hub: matchup frequency grid (how often every pair of teams has faced each other), H2H win/loss records, H2H scoring trends — a deep dive into team rivalries across all seasons
**Success Criteria** (what must be TRUE):
  1. /stats/all-time shows all-time career leaderboards (avg, games, pins, 200+ count, etc.) filterable by gender and active-only
  2. Leaderboard tables are sortable with every bowler name linking to their profile
  3. Bowler profiles show leaderboard rank context for top performers
  4. Bowler profiles show milestone tracker with approaching milestones
  5. League-wide aggregate stats appear on /stats/all-time
  6. Head-to-head stats page shows matchup frequency grid and H2H records between teams
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

### Phase 7: Content and Community Pages
**Goal**: Flesh out content pages and add community features
**Depends on**: Phase 5
**Already built**:
  - /about page with founding story (links to John Williams profile)
  - /join page with basic info (email list placeholder)
  - /rules page with scoring explanation and ruleset history
  - /resources page with Google Sheets links, social links, league calendar
  - Visual playoff bracket on season hero (semis + final with connectors)
  - Championship history table on /stats/all-time with running totals
  - /blog page (placeholder: "Weekly Stats emails will go here")
**What remains**:
  - Blog/recap system — auto-generated weekly recaps from score data (or email archive)
  - Polish about page (currently ends with "More to come")
  - Join page — working contact/signup mechanism (currently placeholder)
  - Expand rules page if needed
**Success Criteria** (what must be TRUE):
  1. Blog/recap page has real content (weekly highlights or email archive)
  2. Join page has a working contact mechanism
  3. About page tells the full league story
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD

### Phase 8: Admin Tools
**Goal**: The commissioner can enter scores through a web interface instead of spreadsheets, with validation to catch data entry errors
**Depends on**: Phase 1
**Success Criteria** (what must be TRUE):
  1. Commissioner can enter scores for a bowling night through a web form (team, bowlers, three games each)
  2. Score entry flags unusual values (e.g., scores over 300, duplicate entries) and validates against known bowlers
  3. Submitted scores appear on the live site after cache revalidation
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8
Phase 5 (data/polish) unblocks better standings and team pages for Phase 6. Phase 8 only depends on Phase 1.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-03-02 |
| 2. Bowler Profiles | 3/3 | Complete | 2026-03-02 |
| 3. Search and Home Page | 3/3 | Complete | 2026-03-03 |
| 4. Teams and Seasons | 4/4 | Complete | 2026-03-06 |
| 5. Remaining Polish and Data Gaps | 0/2 | Not started | - |
| 6. All-Time Leaderboards and Profile Depth | 0/2 | Not started | - |
| 7. Content and Community Pages | 0/2 | Not started | - |
| 8. Admin Tools | 0/2 | Not started | - |
