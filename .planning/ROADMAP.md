# Roadmap: Splitzkrieg Bowling League

## Overview

A stats-driven site for the Splitzkrieg Bowling League (splitzkrieg.org) — 19 years of league history, 620+ bowlers, and a commissioner who wants to automate everything. The site is also a full-stack portfolio piece. Phases 1-5 built the core: bowler profiles, team pages, season pages, search, leaderboards, and the data pipeline. Phases 6+ shift focus to content, automation, polish, and depth.

## Phases

- [x] **Phase 1: Foundation** — Static generation, build-time data pipeline, design system (completed 2026-03-02)
- [x] **Phase 2: Bowler Profiles** — Career stats, records, charts, shareable URLs (completed 2026-03-02)
- [x] **Phase 3: Search and Home Page** — Search bar, countdown, season snapshot (completed 2026-03-03)
- [x] **Phase 4: Teams and Seasons** — Team profiles, season pages, three-entity graph (completed 2026-03-06)
- [x] **Phase 5: Polish and Team H2H** — Parallax, standings, match legend, H2H data (completed 2026-03-08)
- [ ] **Phase 6: Blog and Weekly Automation** — Blog infrastructure, first post, automated weekly pipeline
- [x] **Phase 7: Homepage Personality and Portfolio Polish** — Reduce "AI-made" feel, visual warmth, portfolio readiness (completed 2026-03-12)
- [ ] **Phase 8: Admin Tools** — Score entry UI, lineup submission, blog editor, scoresheet PDF, admin dashboard
- [x] **Phase 9: Data Backfill and Tooling** — Old schedule imports, division data, reusable backfill scripts (completed 2026-03-14)
- [ ] **Phase 10: Profile Depth** — Top-ten finishes, streaks, frequent partners, enhanced week reports
- [ ] **Phase 11: Hit the 10 Pin Mini-Game** — Interactive rigged bowling mini-game with comedy cheats, skins, and Hall of Fame

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
- [x] 06-01-PLAN.md — MDX infrastructure, blog pages, nav/homepage integration
- [x] 06-02-PLAN.md — Stat block components, first blog post, bidirectional cross-links
- [x] 06-03-PLAN.md — Publish gate, email script, weekly runbook

### Phase 7: Homepage Personality and Portfolio Polish
**Goal**: The site feels authored, not generated. A hiring manager lands on it and sees craft. League members feel warmth and community, not a clinical data portal.
**Depends on**: Phase 6
**Timeline**: Two weeks (by 2026-03-24)
**Requirements:** [HOME-PERSONALITY, DIR-HEROES, AI-AUDIT]
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
**Plans:** 2/2 plans complete
Plans:
- [x] 07-01-PLAN.md — Extract shared icons, homepage card grid redesign, tagline voice
- [x] 07-02-PLAN.md — Directory page parallax heroes, visual checkpoint

### Phase 8: Admin Tools
**Goal**: The commissioner can manage the full weekly pipeline through a web-based admin dashboard: pull scores, review/adjust, confirm, write blog posts, publish, and send recap emails. Captains submit lineups through the site. Printable scoresheets are auto-generated.
**Depends on**: Phase 1
**Requirements:** [ADMN-01, ADMN-02]
**What to build**:
  - Auth system (admin password + captain magic links)
  - Score entry web interface with LP pull and manual fallback
  - Score validation (unusual scores, unmatched bowlers)
  - Lineup submission for captains
  - Scoresheet PDF generation
  - Blog editor (DB-backed, markdown with preview)
  - Publish + email flow from admin UI
  - Admin dashboard overview
**Success Criteria**:
  1. Commissioner can enter/review scores through a web form with validation
  2. Captains can submit lineups through the site
  3. Blog posts can be written and published from admin UI
  4. Printable scoresheets generated from lineup data
  5. Full weekly pipeline managed from admin dashboard
**Plans:** 5 plans
Plans:
- [ ] 08-01-PLAN.md — Auth system, DB schema, admin layout, shared types
- [ ] 08-02-PLAN.md — Score pipeline (LP pull, review UI, validation, confirm)
- [ ] 08-03-PLAN.md — Lineup submission (captain auth, form, admin management)
- [ ] 08-04-PLAN.md — Blog editor (DB-backed, markdown preview, migration)
- [ ] 08-05-PLAN.md — Scoresheets, publish/email flow, admin dashboard

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

### Phase 11: Hit the 10 Pin Mini-Game
**Goal**: An interactive bowling mini-game where the player tries to convert a 10-pin spare. The game is rigged to be impossible (~1-in-1000 win chance) with comedy cheats that escalate in absurdity. Features slingshot throw mechanic, three art skins, slow-mo replay, sound/haptics, score card, winners Hall of Fame, and 404 easter egg.
**Depends on**: None (standalone)
**Requirements:** [D-01 through D-34]
**What to build**:
  - Slingshot drag-and-release throw mechanic with aim arrow and ball curve
  - Matter.js physics engine with ball, pin, and gutter bodies
  - Canvas rendering with isometric perspective and bowling alley palette
  - 10 comedy cheats across 3 categories (physics, character, bowling) with tiered escalation
  - Slow-mo replay system with funny captions after each cheat
  - Sound effects (Howler.js) and haptic vibration feedback
  - Score card with attempt count, cheats encountered, screenshot prompt
  - Rare win celebration (confetti, screen shake, disbelief text, Hall of Fame name prompt)
  - Winners Hall of Fame persisted in Azure SQL via API route
  - Three art skins (vector, pixel art, hand-drawn) with visible toggle
  - Game page with minimal chrome layout (no site header/footer)
  - Nav integration and 404 wobbling pin easter egg
  - Admin mode (game always wins) via URL param or admin cookie
  - First-load tutorial demo animation
  - Local leaderboard in localStorage
**Success Criteria**:
  1. /game renders a full-viewport mini-game with slingshot throw mechanic
  2. 10 unique cheats escalate from near-misses to absurd comedy
  3. Every cheat has a slow-mo replay with funny caption
  4. Score card shows attempt summary, Hall of Fame persists rare winners
  5. Three art skins switchable via toggle
  6. Game accessible from nav bar and 404 easter egg
  7. Admin mode guarantees a win for demo purposes
**Plans:** 6/7 plans executed
Plans:
- [x] 11-01-PLAN.md — Type contracts, game state machine, slingshot input math, camera tracking (TDD)
- [x] 11-02-PLAN.md — Game page layout, Matter.js physics engine, vector renderer, canvas game loop
- [x] 11-03-PLAN.md — Pointer input wiring, ball launch, camera follow, demo animation
- [x] 11-04-PLAN.md — Cheat system: registry, 10 cheats, tier escalation, renderer integration
- [x] 11-05-PLAN.md — Sound effects (Howler.js), haptic feedback, slow-mo replay system
- [x] 11-06-PLAN.md — Score card, win celebration, Hall of Fame API + UI, admin mode
- [ ] 11-07-PLAN.md — Nav integration, 404 easter egg, pixel art + hand-drawn skins, final checkpoint

### Phase 12: Navigation and Discoverability Overhaul

**Goal:** Help users naturally find and explore the full depth of the site. Rethink the blog recap format (hub-and-spoke to guided paths), improve cross-page discovery, leverage PostHog analytics data to understand current usage patterns, and design navigation that leads people deeper without overwhelming them.
**Requirements**: [D-01 through D-25]
**Depends on:** Phase 6
**Plans:** 3/4 plans executed

Plans:
- [x] 12-01-PLAN.md — Tracking components (ExitRamp, TrackVisibility) + bowler profile reorder
- [x] 12-02-PLAN.md — WeekRecap condensed redesign with exit ramps + DiscoverySection
- [x] 12-03-PLAN.md — NextStopNudge component + destination page integration
- [ ] 12-04-PLAN.md — Email template update, updates feed surfacing, visual checkpoint

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
| 6. Blog and Weekly Automation | Complete | 2026-03-10 |
| 7. Homepage Personality and Portfolio Polish | Complete | 2026-03-12 |
| 8. Admin Tools | Not started | - |
| 9. Data Backfill and Tooling | Complete | 2026-03-14 |
| 10. Profile Depth | Not started | - |
| 11. Hit the 10 Pin Mini-Game | Not started | - |
| 12. Navigation and Discoverability Overhaul | Not started | - |
