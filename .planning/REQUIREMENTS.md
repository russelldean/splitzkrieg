# Requirements: Splitzkrieg Bowling League

**Defined:** 2026-03-02
**Core Value:** Bowlers can look themselves up and explore their stats — career averages, personal records, season-by-season history. The bowler profile page must be amazing.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Infrastructure

- [ ] **INFRA-01**: Database connection pool singleton handles Azure SQL cold starts with 60s timeout
- [ ] **INFRA-02**: Server Components with streaming used for all data fetching (not API routes, due to Vercel timeout limits)
- [ ] **INFRA-03**: ISR caching with 1-hour revalidation and on-demand revalidation after data syncs
- [ ] **INFRA-04**: Loading skeletons at every route for cold start UX
- [ ] **INFRA-05**: Design system tokens defined (cream/navy/red palette, bold typography, DM Serif Display + Inter)

### Bowler Profiles

- [ ] **BWLR-01**: User can view bowler profile with career summary header (name, seasons active, career average, total games, teams played for)
- [ ] **BWLR-02**: Profile shows season-by-season stats table with career totals row
- [ ] **BWLR-03**: Profile shows personal records panel (high game, high series, 200+ count, 600+ count, turkeys)
- [ ] **BWLR-04**: Profile shows average progression line chart across seasons
- [ ] **BWLR-05**: Profile shows game log with week-by-week scores expandable per season
- [ ] **BWLR-07**: Profile shows milestone tracker (approaching milestones)
- [ ] **BWLR-08**: Profile shows leaderboard context ("Ranked Nth in...") for top bowlers
- [ ] **BWLR-10**: Profile shows career timeline (teams played for, chronological)
- [ ] **BWLR-11**: Color-coded performance in all score tables (200+ green, 250+ gold)
- [ ] **BWLR-12**: Shareable URL with OG meta tags (splitzkrieg.org/bowler/russ-smith)

### Search

- [ ] **SRCH-01**: User can search for bowlers from prominent search bar on home page
- [ ] **SRCH-02**: Search includes autocomplete with fuzzy matching and name variant handling

### Teams

- [ ] **TEAM-01**: User can view team profile with current roster linked to bowler profiles
- [ ] **TEAM-02**: Team page shows team history (all-time record, past rosters by season)
- [ ] **TEAM-03**: Team page shows head-to-head record vs every other team
- [ ] **TEAM-04**: Shareable team URL (splitzkrieg.org/team/gutter-sluts)

### Seasons

- [ ] **SEASN-01**: User can view season page with final standings and points breakdown
- [ ] **SEASN-02**: Season page shows division alignment
- [ ] **SEASN-03**: Season page shows weekly results archive
- [ ] **SEASN-04**: Season page shows season leaderboards (top averages, high games, high series)
- [ ] **SEASN-05**: Schedule display for current and past seasons

### Leaderboards

- [ ] **LEAD-01**: All-time leaderboards filterable by gender, active only, season range
- [ ] **LEAD-02**: Leaderboard categories: career avg, high game, high series, 200+ games, 600+ series, turkeys, total pins, total games
- [ ] **LEAD-03**: Sortable tables with links to bowler profiles
- [ ] **LEAD-04**: Scratch vs handicap toggle on all stats views
- [ ] **LEAD-05**: League-wide aggregate stats dashboard (total games, total pins, unique bowlers)

### Champions & Playoffs

- [ ] **CHMP-01**: Champions page showing all season winners across 5 championship categories
- [ ] **CHMP-02**: Playoff bracket display for current and past seasons
- [ ] **CHMP-03**: Playoff race tracker (who's in, who's on the bubble)

### Content

- [ ] **CONT-01**: Blog system for weekly recaps (new content going forward)
- [ ] **CONT-02**: Auto-generated weekly highlights from score data (personal bests, milestones)
- [ ] **CONT-03**: About / Join the League page with league info, FAQ, and interest form

### Home Page

- [ ] **HOME-01**: Home page with league branding and Metrograph-inspired design
- [ ] **HOME-02**: Prominent bowler search bar front and center
- [ ] **HOME-03**: Current season snapshot (standings, recent results)
- [ ] **HOME-04**: Countdown clock to next bowling night
- [ ] **HOME-05**: Quick stats ticker (total bowlers, total games, league since 2007)

### Admin

- [ ] **ADMN-01**: Score entry web interface (replaces spreadsheet workflow)
- [ ] **ADMN-02**: Score validation (flags unusual scores, checks against known bowlers)

### Cross-Cutting

- [ ] **XCUT-01**: Cross-linking everywhere (every name and team is a clickable link)
- [ ] **XCUT-02**: Mobile-responsive layout (tables scroll/reflow, charts resize)
- [ ] **XCUT-03**: Graceful handling of missing data (empty tables, sparse historical records)

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
| INFRA-01 | TBD | Pending |
| INFRA-02 | TBD | Pending |
| INFRA-03 | TBD | Pending |
| INFRA-04 | TBD | Pending |
| INFRA-05 | TBD | Pending |
| BWLR-01 | TBD | Pending |
| BWLR-02 | TBD | Pending |
| BWLR-03 | TBD | Pending |
| BWLR-04 | TBD | Pending |
| BWLR-05 | TBD | Pending |
| BWLR-07 | TBD | Pending |
| BWLR-08 | TBD | Pending |
| BWLR-10 | TBD | Pending |
| BWLR-11 | TBD | Pending |
| BWLR-12 | TBD | Pending |
| SRCH-01 | TBD | Pending |
| SRCH-02 | TBD | Pending |
| TEAM-01 | TBD | Pending |
| TEAM-02 | TBD | Pending |
| TEAM-03 | TBD | Pending |
| TEAM-04 | TBD | Pending |
| SEASN-01 | TBD | Pending |
| SEASN-02 | TBD | Pending |
| SEASN-03 | TBD | Pending |
| SEASN-04 | TBD | Pending |
| SEASN-05 | TBD | Pending |
| LEAD-01 | TBD | Pending |
| LEAD-02 | TBD | Pending |
| LEAD-03 | TBD | Pending |
| LEAD-04 | TBD | Pending |
| LEAD-05 | TBD | Pending |
| CHMP-01 | TBD | Pending |
| CHMP-02 | TBD | Pending |
| CHMP-03 | TBD | Pending |
| CONT-01 | TBD | Pending |
| CONT-02 | TBD | Pending |
| CONT-03 | TBD | Pending |
| HOME-01 | TBD | Pending |
| HOME-02 | TBD | Pending |
| HOME-03 | TBD | Pending |
| HOME-04 | TBD | Pending |
| HOME-05 | TBD | Pending |
| ADMN-01 | TBD | Pending |
| ADMN-02 | TBD | Pending |
| XCUT-01 | TBD | Pending |
| XCUT-02 | TBD | Pending |
| XCUT-03 | TBD | Pending |

**Coverage:**
- v1 requirements: 43 total
- Mapped to phases: 0
- Unmapped: 43 ⚠️

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after initial definition*
