---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 07-homepage-personality-and-portfolio-polish
current_plan: 2 of 5
status: phase-complete
last_updated: "2026-03-12T04:12:04.737Z"
progress:
  total_phases: 5
  completed_phases: 1
  total_plans: 5
  completed_plans: 4
---

# Session State

## Project Reference

See: .planning/PROJECT.md

## Position

**Milestone:** v1.0 milestone
**Current phase:** 07-homepage-personality-and-portfolio-polish
**Current plan:** 2 of 5
**Status:** In Progress

## Session Log

- 2026-03-03: Phases 1-3 completed
- 2026-03-04: Phase 4 plans 01-02 completed
- 2026-03-05: Phase 4 plans 03-04 completed (13-item feedback overhaul)
- 2026-03-06: Phase 4 verified complete
- 2026-03-06–07: Nav restructure, homepage layout, season hero, playoff bracket UI, PIN redesign
- 2026-03-08: Weekly highlights ticker shipped (replaced milestone ticker)
- 2026-03-08: Planning review — dropped 6 todos, updated roadmap, parked PIN formula
- 2026-03-08: Phase 5 Plan 01 — Standings week context, TeamHero W-L record, collapsible season stats
- 2026-03-08: Phase 5 Plan 02 — Team H2H with real matchResults data, summary table + drill-down
- 2026-03-10: Phase 6 Plan 01 — MDX blog infrastructure, /blog and /blog/[slug] pages, nav integration
- 2026-03-10: Phase 6 Plan 03 — Publish gate (leagueSettings), email script (Resend), weekly runbook
- 2026-03-12: Phase 7 Plan 01 — Shared SVG icons, homepage pill nav, league-specific tagline
- 2026-03-12: Phase 7 Plan 02 — Directory parallax heroes shipped; homepage changes reverted per user feedback

## Decisions

- **[Phase 05 planning]** PIN formula parked — current version accepted, revisit much later
- **[Phase 05 planning]** Nav restructure considered done — League Nights / Seasons / The Stats / Bowlers / Teams
- **[Phase 05 planning]** Dropped 6 profile todos (game log reorder, current team name, collapsible sections, trophy icons, team captain notation, rules history page)
- **[Phase 05 planning]** Playoff/champion data confirmed populated — removed from data gaps
- **[Phase 05 planning]** Weekly highlights ticker committed as standalone feature
- **[Phase 05-01]** Losses computed as (matchWeeks * 3 - wins) to handle ties as half-values
- **[Phase 05-01]** TeamHero links to /week/ league nights page per CONTEXT.md locked decisions
- **[Phase 05-01]** SeasonStatsTable converted to client component for expand/collapse
- **[Phase 05-02]** Single flat H2H query per team; component groups by opponent client-side with useMemo
- **[Phase 05-02]** Ghost Team included naturally in H2H records (no special filtering)
- **[Phase 06-01]** Added @content/* tsconfig path alias for MDX dynamic imports from content/ directory
- **[Phase 06-01]** Blog uses Promise<params> pattern matching Next.js 16 conventions
- **[Phase 06-01]** Prev/next nav labeled Newer/Older to match reverse chronological ordering
- **[Phase 06-03]** Publish gate uses leagueSettings table with settingKey/settingValue pattern
- **[Phase 06-03]** HIGHLIGHTS query uses publishedSeasonID + publishedWeek instead of MAX(week) ORDER BY
- **[Phase 06-03]** Email script uses inline HTML (not templates) with navy/cream/red palette
- **[Phase 06-03]** Runbook includes match results step between import and patches
- **[Phase 07-01]** Tagline: "Since 2007. 100+ bowlers. One very specific website." -- dry/understated tone
- **[Phase 07-01]** SVG icons exported as JSX elements from shared icons.tsx, not component functions
- **[Phase 07-02]** User rejected homepage pill nav and tagline -- reverted to original layout; directory parallax heroes approved

## Pending Todos

5 todos in `.planning/todos/pending/`:
1. **Add top-ten finishes to profile season stats** — ui
2. **Show most frequent bowling partners** — ui
3. **Track bowling streaks** — ui
4. **Enhance most recent week report with context** — ui
5. **Data backfill** — older season schedules (I-XXV), divisions
