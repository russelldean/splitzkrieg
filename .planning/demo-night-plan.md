# Demo Night Plan — March 8, 2026

Showing people the app tomorrow night (March 9). Prioritized by impact-to-effort for mobile-first demo.

## Tier 1: Do These First
- [ ] **Fix hamburger menu on mobile** — CSS fixes to MobileNav.tsx, currently a mess (~30 min)
- [ ] **Mobile polish pass** — spacing, font sizes, touch targets across key pages (~1-2 hrs)
- [ ] **Easter egg ticker messages** — add fun static items to MilestoneTicker data (~15 min)

## Tier 2: Worth Doing If Time Allows
- [ ] **Milestones in ticker** — define milestones (100th game, 10th season, etc.), query + display (~1-2 hrs)
- [ ] **More photos on pages** — use ParallaxBg component, drop images into key pages (~30-60 min)
- [ ] **"Search your name" index** — promote/expand DiscoverySearch so people can find themselves (~1-2 hrs)

## Tier 3: Cool But Risky for Tomorrow
- [ ] **Spoiler-free team roster reveal** — progressive reveal of who bowled on your team over the years (~2-3 hrs)
- [ ] **Individual playoff winners data** — schema ready, need source data + populate script (~2-3 hrs)
- [ ] **Village Lanes page expansion** — currently minimal hero + one photo, open-ended (~1-2 hrs)
- [ ] **Schedule backfill (Seasons I-XXV)** — need source data for 25 seasons, big data entry (~varies)

## Other Todos (from backlog, not demo priority)
1. Add top-ten finishes to season stats ("3rd of 24")
2. Show most frequent bowling partners
3. Track bowling streaks (consecutive 200+, hot/cold)

## Key Files
- MobileNav: `src/components/layout/MobileNav.tsx`
- Header: `src/components/layout/Header.tsx`
- Ticker: `src/components/home/MilestoneTicker.tsx`
- Ticker data: `src/lib/queries/home.ts` → `getWeeklyHighlights()`
- Village Lanes: `src/app/village-lanes/page.tsx`
- Search: `src/components/home/DiscoverySearch.tsx`
- ParallaxBg: reusable component for photo heroes
