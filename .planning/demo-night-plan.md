# Demo Night Plan — March 9, 2026

Showing people the app tonight. Prioritized by impact-to-effort for mobile-first demo.

## Completed
- [x] **Fix hamburger menu on mobile** — CSS fixes to MobileNav.tsx
- [x] **Mobile polish pass** — spacing, font sizes, touch targets across key pages
- [x] **Bowling patches system** — "You Are a Star" section on bowler profiles with earned patches (BOTW, High Game, High Series, Playoff, Champion, SP/HP, Three of a Kind, Captain). Materialized into `patches` + `bowlerPatches` DB tables for fast builds. 2,409 patches across the league.

## Tonight / Tomorrow
- [ ] **Brainstorm more patch types** — see `memory/patch-ideas.md` for ideas list (Turkey Night, 200 Club, Ironman, Veteran, Mr./Ms. Consistent, etc.)
- [ ] **Patch visual redesign** — explore making patches look different (not just colored text badges)

## Tier 2: Worth Doing If Time Allows
- [ ] **Easter egg ticker messages** — add fun static items to MilestoneTicker data (~15 min)
- [ ] **Milestones in ticker** — define milestones (100th game, 10th season, etc.), query + display (~1-2 hrs)
- [ ] **More photos on pages** — use ParallaxBg component, drop images into key pages (~30-60 min)

## Tier 3: Cool But Not Urgent
- [ ] **Spoiler-free team roster reveal** — progressive reveal of who bowled on your team over the years (~2-3 hrs)
- [ ] **Individual playoff winners data** — schema ready, need source data + populate script (~2-3 hrs)
- [x] **Village Lanes page expansion** — placeholder "For another day" text
- [ ] **Schedule backfill (Seasons I-XXV)** — need source data for 25 seasons, big data entry (~varies)

## Other Todos (from backlog, not demo priority)
1. Add top-ten finishes to season stats ("3rd of 24")
2. Show most frequent bowling partners
3. Track bowling streaks (consecutive 200+, hot/cold)

## Key Files
- Patches: `scripts/populate-patches.mjs`, `scripts/create-patch-tables.sql`
- Patch ideas: `memory/patch-ideas.md`
- YouAreAStar: `src/components/bowler/YouAreAStar.tsx`
- GameLog patches: `src/components/bowler/GameLog.tsx`
- Patch queries: `src/lib/queries/bowlers.ts` (getBowlerPatches, getBowlerStarStats)
- MobileNav: `src/components/layout/MobileNav.tsx`
- Ticker: `src/components/home/MilestoneTicker.tsx`
- ParallaxBg: reusable component for photo heroes
