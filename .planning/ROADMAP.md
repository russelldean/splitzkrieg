# Roadmap: Splitzkrieg Bowling League

## Overview

A stats-driven site for the Splitzkrieg Bowling League (splitzkrieg.org) — 18 years of league history, 130+ bowlers, and a commissioner who wants to automate everything. The site is also a full-stack portfolio piece. Phases 1-5 built the core: bowler profiles, team pages, season pages, search, leaderboards, and the data pipeline. Phases 6+ shift focus to content, automation, polish, and depth.

## Phases

- [x] **Phase 1: Foundation** — Static generation, build-time data pipeline, design system (completed 2026-03-02)
- [x] **Phase 2: Bowler Profiles** — Career stats, records, charts, shareable URLs (completed 2026-03-02)
- [x] **Phase 3: Search and Home Page** — Search bar, countdown, season snapshot (completed 2026-03-03)
- [x] **Phase 4: Teams and Seasons** — Team profiles, season pages, three-entity graph (completed 2026-03-06)
- [x] **Phase 5: Polish and Team H2H** — Parallax, standings, match legend, H2H data (completed 2026-03-08)
- [ ] **Phase 6: Blog and Weekly Automation** — Blog infrastructure, first post, automated weekly pipeline
- [ ] **Phase 7: Homepage Personality and Portfolio Polish** — Reduce "AI-made" feel, visual warmth, portfolio readiness
- [ ] **Phase 8: Admin Tools** — Score entry UI, lineup submission, season management
- [ ] **Phase 9: Data Backfill and Tooling** — Old schedule imports, division data, reusable backfill scripts
- [ ] **Phase 10: Profile Depth** — Top-ten finishes, streaks, frequent partners, enhanced week reports

## Phase Details

### Phase 6: Blog and Weekly Automation
**Goal**: Bowlers get a weekly blog post with results and highlights. The commissioner's post-bowling workflow (scores → verify → blog → publish → email) is streamlined into a repeatable pipeline.
**Depends on**: Phase 5
**Timeline**: This week (by 2026-03-16)
**Requirements:** [CONT-01, CONT-02]
**What exists**:
  - Blog placeholder page at /blog
  - LeaguePals score pull working
  - Weekly import script exists
  - Patches auto-calculate
  - Week 4 data already in DB and on site
**What to build**:
  - Blog infrastructure — markdown-driven pages at /blog, list view, individual post pages
  - Weekly recap post format — structured stat display (not just prose), reusable across weeks
  - First blog post — site announcement + Week 4 results recap
  - League night page → blog post link (if a post exists for that week)
  - Publish gate — control when weekly results go "official" (latest published week config)
  - LP blind/penalty handling during import
  - Countdown animation — test and verify before next league night
  - Streamline: scores → verify → publish → blog → email as a documented repeatable process
**Success Criteria**:
  1. /blog shows a list of posts, /blog/[slug] renders a post with structured stat formatting
  2. Week 4 recap post is live with scores, highlights, and narrative
  3. League night page links to its blog post when one exists
  4. Commissioner can control which week is "published" without code changes
  5. Weekly import pipeline runs without rediscovering steps each time
**Plans:** 3 plans
Plans:
- [ ] 06-01-PLAN.md — MDX infrastructure, blog pages, nav/homepage integration
- [ ] 06-02-PLAN.md — Stat block components, first blog post, bidirectional cross-links
- [ ] 06-03-PLAN.md — Publish gate, email script, weekly runbook

### Phase 7: Homepage Personality and Portfolio Polish
**Goal**: The site feels authored, not generated. A hiring manager lands on it and sees craft. League members feel warmth and community, not a clinical data portal.
**Depends on**: Phase 6
**Timeline**: Two weeks (by 2026-03-24)
**The problem**: Two league members said "this looks like a site Claude made." The homepage is pretty but clinical — it lacks voice, personality, and opinionated design choices.
**What to address**:
  - Homepage card grid — ditch the descriptive text under nav cards, reduce "template" feel
  - Opinionated design touches — typography, color accents, layout choices that feel human-authored
  - Visual warmth — consider where photos, personality, and community feeling can come through
  - Ensure every page a hiring manager might visit holds up to scrutiny
  - Review site as portfolio piece — code quality, architecture, performance, design coherence
**Success Criteria**:
  1. Homepage feels warm and community-first, not like a data portal
  2. No page triggers "AI-made" pattern recognition
  3. Site demonstrates full-stack skills clearly (data pipeline, SSG, responsive design, data viz)
  4. Someone unfamiliar with the league understands what it is within 5 seconds of landing
**Plans**: TBD

### Phase 8: Admin Tools
**Goal**: The commissioner can manage scores, lineups, and seasons through the site instead of spreadsheets and Google Forms
**Depends on**: Phase 1
**What to build**:
  - Score entry web interface (replace spreadsheet workflow)
  - Lineup submission system (replace Google Form for captains)
  - Season management (create seasons, divisions, schedules, rosters)
**Success Criteria**:
  1. Commissioner can enter scores through a web form with validation
  2. Captains can submit lineups through the site
  3. New seasons can be set up without direct DB access
**Plans**: TBD

### Phase 9: Data Backfill and Tooling
**Goal**: Fill in historical gaps and build reusable tooling so backfill doesn't require rediscovering the process each time
**Depends on**: Phase 6
**Timeline**: Two weeks from start
**What to build**:
  - Schedule data for Seasons I-XXV (17 seasons missing)
  - Division data population (seasonDivisions table)
  - Reusable backfill scripts that handle different source file formats (CSV, TSV, PDF)
  - Documentation of the backfill process so it's repeatable
**Success Criteria**:
  1. All seasons have schedule data loaded
  2. Division data populated for seasons that had divisions
  3. Backfill process is documented and scriptable for future data
**Plans**: TBD

### Phase 10: Profile Depth
**Goal**: Bowler profiles gain context and personality — where they rank, who they bowl with, how they're trending
**Depends on**: Phase 5
**What to build**:
  - Top-ten finishes on season stats ("3rd of 24")
  - Bowling streaks (consecutive 200+, hot/cold streaks)
  - Most frequent bowling partners
  - Enhanced most recent week report (rank, above/below avg, fun judgment)
  - Leaderboard rank context on profiles ("Ranked 5th in career average")
**Success Criteria**:
  1. Season stats show rank finish
  2. Streaks section visible on profiles with data
  3. Frequent partners section shows top 5 with links
  4. Most recent week shows rank, delta from average, and personality text
**Plans**: TBD

## Later Bucket

Items to build when the time is right, not tied to a specific phase:

**Patches:**
- 200 Club, Ironman (perfect attendance), Veteran (5/10/15/20 seasons), Mr./Ms. Consistent
- Patch visual redesign

**Fun features:**
- Weekly animation archive (swap countdown takeover each week)
- Redo chronoNumber IDs after cleanup
- Ticker milestones phrasing ("Nth member of 50K Pins Club")

**Content:**
- Auto-generate blog draft from weekly data
- Join page contact form (on hold)

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Foundation | Complete | 2026-03-02 |
| 2. Bowler Profiles | Complete | 2026-03-02 |
| 3. Search and Home Page | Complete | 2026-03-03 |
| 4. Teams and Seasons | Complete | 2026-03-06 |
| 5. Polish and Team H2H | Complete | 2026-03-08 |
| 6. Blog and Weekly Automation | Not started | - |
| 7. Homepage Personality and Portfolio Polish | Not started | - |
| 8. Admin Tools | Not started | - |
| 9. Data Backfill and Tooling | Not started | - |
| 10. Profile Depth | Not started | - |
