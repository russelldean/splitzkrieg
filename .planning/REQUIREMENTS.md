# Requirements: Splitzkrieg Bowling League

**Defined:** 2026-03-02
**Core Value:** Bowlers can look themselves up and explore their stats — career averages, personal records, season-by-season history. The bowler profile page must be amazing.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFRA-01**: Static site generation with on-demand revalidation after data syncs (data changes biweekly)
- [ ] **INFRA-02**: Build-time data fetching from Azure SQL (serverless free tier, only wakes during builds/admin)
- [x] **INFRA-03**: Pre-built search index for client-side bowler search (619 bowlers, no live DB needed)
- [ ] **INFRA-04**: Build/revalidation pipeline triggered after data updates
- [x] **INFRA-05**: Design system tokens defined (cream/navy/red palette, bold typography, DM Serif Display + Inter)

### Bowler Profiles

- [x] **BWLR-01**: User can view bowler profile with career summary header (name, seasons active, career average, total games, teams played for)
- [x] **BWLR-02**: Profile shows season-by-season stats table with career totals row
- [x] **BWLR-03**: Profile shows personal records panel (high game, high series, 200+ count, 600+ count, turkeys)
- [x] **BWLR-04**: Profile shows average progression line chart across seasons
- [x] **BWLR-05**: Profile shows game log with week-by-week scores expandable per season
- [ ] **BWLR-07**: Profile shows milestone tracker (approaching milestones)
- [ ] **BWLR-08**: Profile shows leaderboard context ("Ranked Nth in...") for top bowlers
- [ ] **BWLR-10**: Profile shows career timeline (teams played for, chronological)
- [x] **BWLR-11**: Color-coded performance in all score tables (200+ green, 250+ gold)
- [x] **BWLR-12**: Shareable URL with OG meta tags (splitzkrieg.org/bowler/russ-smith)
- [ ] **BWLR-15**: Achievement badges on profile (100 career games, first 200+ game, first 600+ series, etc.)

### Search

- [x] **SRCH-01**: User can search for bowlers from prominent search bar on home page
- [x] **SRCH-02**: Search includes autocomplete with fuzzy matching and name variant handling

### Teams

- [x] **TEAM-01**: User can view team profile with current roster linked to bowler profiles
- [x] **TEAM-02**: Team page shows team history (all-time record, past rosters by season)
- [x] **TEAM-03**: Team page shows head-to-head record vs every other team
- [x] **TEAM-04**: Shareable team URL (splitzkrieg.org/team/gutter-sluts)

### Seasons

- [x] **SEASN-01**: User can view season page with final standings and points breakdown
- [x] **SEASN-02**: Season page shows division alignment
- [x] **SEASN-03**: Season page shows weekly results archive
- [x] **SEASN-04**: Season page shows season leaderboards (top averages, high games, high series)
- [x] **SEASN-05**: Schedule display for current and past seasons

### Leaderboards

- [ ] **LEAD-01**: All-time leaderboards filterable by gender, active only, season range
- [ ] **LEAD-02**: Leaderboard categories: career avg, high game, high series, 200+ games, 600+ series, turkeys, total pins, total games
- [ ] **LEAD-03**: Sortable tables with links to bowler profiles
- [ ] **LEAD-04**: Scratch vs handicap toggle on all stats views
- [ ] **LEAD-05**: League-wide aggregate stats dashboard (total games, total pins, unique bowlers)
- [ ] **LEAD-06**: Progressive leaderboards showing who held the record at each league night (e.g., top male/female scratch average over time)

### Champions & Playoffs

- [ ] **CHMP-01**: Champions page showing all season winners across 5 championship categories
- [ ] **CHMP-02**: Playoff bracket display for current and past seasons
- [ ] **CHMP-03**: Playoff race tracker (who's in, who's on the bubble)

### Content

- [x] **CONT-01**: Blog system for weekly recaps (new content going forward)
- [x] **CONT-02**: Auto-generated weekly highlights from score data (personal bests, milestones)
- [ ] **CONT-03**: About / Join the League page with league info, FAQ, and interest form

### Home Page

- [x] **HOME-01**: Home page with league branding and Metrograph-inspired design
- [x] **HOME-02**: Prominent bowler search bar front and center
- [x] **HOME-03**: Current season snapshot (standings, recent results)
- [x] **HOME-04**: Countdown clock to next bowling night
- [x] **HOME-05**: Quick stats ticker (total bowlers, total games, league since 2007)

### Admin

- [x] **ADMN-01**: Score entry web interface (replaces spreadsheet workflow)
- [x] **ADMN-02**: Score validation (flags unusual scores, checks against known bowlers)

### Cross-Cutting

- [x] **XCUT-01**: Cross-linking everywhere (every name and team is a clickable link)
- [x] **XCUT-02**: Mobile-responsive layout (tables scroll/reflow, charts resize)
- [x] **XCUT-03**: Graceful handling of missing data (empty tables, sparse historical records)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Admin

- **ADMN-03**: Lineup submission system (replaces Google Form)
- **ADMN-04**: Auto-calculation engine (averages, handicaps, standings, achievements)
- **ADMN-05**: Season management (create seasons, divisions, schedules, rosters)

### Content

- **CONT-04**: Photo gallery (season-by-season collections)

### Bowler Profiles

- **BWLR-06**: Percentile rankings on bowler profiles (Baseball Savant-style bars)
- **BWLR-09**: Similar bowlers suggestions
- **BWLR-13**: Bowler comparison tool (side-by-side stats and chart overlay)
- **BWLR-14**: Privacy opt-out (hide profile from public visibility)

### Dream Features

- **DREAM-01**: User accounts for bowlers (customizable profiles, privacy controls)
- **DREAM-02**: Social sharing enhancements (share a monster night)
- **DREAM-03**: Photo tagging and season galleries
- **DREAM-04**: "New bowler" onboarding explainer
- **DREAM-05**: Close game analysis and advanced stats

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time score updates | League bowls once a week. No live game to follow. |
| Mobile native app | Responsive web covers 100% of the use case for 130 bowlers |
| Video content | Storage/bandwidth overkill, nobody is filming league nights |
| Discussion forums / comments | Community discussion belongs in existing channels (group texts, email) |
| Backfilling old email content | Diminishing returns — old recaps not interesting to current bowlers |
| Pin-by-pin / frame-by-frame scoring | Frame data was never collected. Three games per night is the granularity. |
| Gamification (badges, XP, levels) | Milestones and records ARE the achievements. No manufactured engagement. |
| Predictive analytics / ML | Overengineered for dataset size. Descriptive stats tell the story. |
| LeaguePals API integration | Defer investigation until admin tools are mature |
| OAuth / social login | Email/password sufficient if accounts ever needed |
| Customizable bowler profiles | Data IS the profile. This is a reference site, not a social network. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Pending |
| INFRA-05 | Phase 1 | Complete |
| BWLR-01 | Phase 2 | Complete |
| BWLR-02 | Phase 2 | Complete |
| BWLR-03 | Phase 2 | Complete |
| BWLR-04 | Phase 2 | Complete |
| BWLR-05 | Phase 2 | Complete |
| BWLR-07 | Phase 5 | Pending |
| BWLR-08 | Phase 5 | Pending |
| BWLR-10 | Phase 5 | Pending |
| BWLR-11 | Phase 2 | Complete |
| BWLR-12 | Phase 2 | Complete |
| SRCH-01 | Phase 3 | Complete |
| SRCH-02 | Phase 3 | Complete |
| TEAM-01 | Phase 4 | Complete |
| TEAM-02 | Phase 4 | Complete |
| TEAM-03 | Phase 4 | Complete |
| TEAM-04 | Phase 4 | Complete |
| SEASN-01 | Phase 4 | Complete |
| SEASN-02 | Phase 4 | Complete |
| SEASN-03 | Phase 4 | Complete |
| SEASN-04 | Phase 4 | Complete |
| SEASN-05 | Phase 4 | Complete |
| LEAD-01 | Phase 5 | Pending |
| LEAD-02 | Phase 5 | Pending |
| LEAD-03 | Phase 5 | Pending |
| LEAD-04 | Phase 5 | Pending |
| LEAD-05 | Phase 5 | Pending |
| CHMP-01 | Phase 6 | Pending |
| CHMP-02 | Phase 6 | Pending |
| CHMP-03 | Phase 6 | Pending |
| CONT-01 | Phase 6 | Complete |
| CONT-02 | Phase 6 | Complete |
| CONT-03 | Phase 6 | Pending |
| HOME-01 | Phase 3 | Complete |
| HOME-02 | Phase 3 | Complete |
| HOME-03 | Phase 3 | Complete |
| HOME-04 | Phase 3 | Complete |
| HOME-05 | Phase 3 | Complete |
| ADMN-01 | Phase 7 | Complete |
| ADMN-02 | Phase 7 | Complete |
| XCUT-01 | Phase 2 | Complete |
| XCUT-02 | Phase 1 | Complete |
| XCUT-03 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 47 total
- Mapped to phases: 47
- Unmapped: 0

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after roadmap creation*
