# Demo Night Plan — March 9, 2026

Showing people the app tonight. Prioritized by impact-to-effort for mobile-first demo.

## Completed
- [x] **Fix hamburger menu on mobile** — CSS fixes to MobileNav.tsx
- [x] **Mobile polish pass** — spacing, font sizes, touch targets across key pages
- [x] **Bowling patches system** — "You Are a Star" section on bowler profiles with earned patches. Materialized into `patches` + `bowlerPatches` DB tables. 6,500+ patches across the league.
- [x] **aboveAvg patch type** — nights where all 3 games are above your rolling average
- [x] **Career milestone tracking** — 100th game, 10th season, etc. with milestone badges on bowler profiles
- [x] **Milestones in ticker** — weekly highlights ticker now shows career milestones (wave emoji for debuts, alphabetical sort)
- [x] **Easter egg ticker messages** — fun messages appear at reduced frequency in ticker
- [x] **Individual playoff winners data** — seasonChampions populated, individual champions on all-time stats page
- [x] **Village Lanes page expansion** — added panorama, lanes, Brunswick 2000s, parking lot photos
- [x] **More photos on pages** — mobile parallax hero uses lanes-down-the-lane shot, desktop keeps blue chairs. MP300 easter egg on Mike DePasquale's profile.

## Remaining
- [ ] **Brainstorm more patch types** — see `memory/patch-ideas.md` for ideas list (Turkey Night, 200 Club, Ironman, Veteran, Mr./Ms. Consistent, etc.)
- [ ] **Schedule backfill (Seasons I-XXV)** — need source data for 25 seasons, big data entry

## Backlog
- [ ] **Patch visual redesign** — explore making patches look different (not just colored text badges)

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
