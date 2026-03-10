# Phase 3: Search and Home Page - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The front door to the site — bowlers land here, find themselves via search, and get a snapshot of what's happening in the league. Home page serves as a hub with multiple paths into the site. Search becomes a discovery tool, not just a text input. Placeholder pages for teams/seasons give the site structure before Phase 4. A links/resources page surfaces operational URLs bowlers are always hunting for.

</domain>

<decisions>
## Implementation Decisions

### Primary Audience
- Current bowlers are the main audience — they're the ones checking the site regularly
- Newcomer onboarding (About, Join) is secondary but should be visible
- Portfolio showcase is a side benefit, not a design driver

### Home Page Hero & First Impression
- Hub with multiple entry points, not a single-purpose search page
- Stats-forward personality with one big beautiful league photo as the emotional anchor
- Clear paths for different visitors: "Find your bowler" (search), "This week's results" (latest blog/recap), browse teams, check leaderboards
- Newcomer paths to About and Join visible but not dominating
- 1-2 good league photos on the landing page for now — no gallery, just intentional placement
- Instagram link in footer (not embedded feed or photos pulled from API)

### Discovery Search (Home Page Only)
- Home page search bar acts as a discovery hub — clicking into it shows category prompts (Bowlers, Teams, Seasons, Leaderboards) before the user types anything
- Teaches new visitors what's available while staying fast for returning users who know what they want
- Once typing starts, switches to fuzzy search results (existing Fuse.js behavior)
- Header SearchBar stays simple — no category prompts, just the existing text search
- Bowler directory/browse page at /bowlers — alphabetical listing of all 619 bowlers

### League Snapshot Content
- Quick stats ticker shows upcoming milestones and recently achieved milestones (not static totals like "619 bowlers")
- Current season section: placeholder for now — standings, individual playoff rankings, season records/best nights will populate once matchResults data is backfilled
- Placeholder should encourage the backfill to happen (motivation-driven design)

### Countdown to Next Bowling Night
- Days and hours countdown — solves the real "is it bowling night?" problem for biweekly schedule
- Off-season: switch to season wrap-up stats, push people toward historical records and leaderboards
- Unknown next date: league-voice humor instead of generic "TBD" (e.g., joke about not knowing)
- Schedule data exists for Seasons XXVI-XXXV — countdown pulls from this

### Placeholder Pages (Teams, Seasons)
- Teams and Seasons links work now, navigate to placeholder pages
- Each placeholder has league-voice personality, not generic "Coming Soon"
- Teams: "Yes, we have teams. No, this page is not ready yet."
- Seasons: "Winter is the best Season, and the season page is also not ready yet."
- Leaderboards placeholder too if needed

### Quick Links / Resources Page
- Dedicated page for operational links bowlers are always hunting for (Google Sheets DB, current season DB, lineup submission form, etc.)
- Surfaced from home page and navigation — people should know it exists
- Actual URLs to be provided later — build the structure now
- Solves the "where is that link again?" problem from group texts

### Claude's Discretion
- Home page layout and section ordering
- Photo placement and overlay treatment
- Discovery search prompt design and interaction
- Countdown visual treatment (make it look good, not cheesy)
- Milestone ticker format and animation
- Placeholder page layout and styling
- Quick links page display format
- Mobile responsive adaptations for all new components

</decisions>

<specifics>
## Specific Ideas

- The site is "a cool site for the league" — visitors arrive curious but don't know what they want to do yet. The home page guides them.
- Milestones in the ticker are more compelling than static totals — "Joe just hit 100 career games" beats "619 bowlers"
- The countdown solves a real problem — people forget if it's bowling night since the league bowls biweekly
- Placeholder pages should have the league's actual voice and humor, not corporate "coming soon" language
- Quick links page stops the "where's the lineup form?" question in group texts

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/layout/SearchBar.tsx`: Fuse.js fuzzy search with autocomplete, keyboard nav, accessible — can be extended or used as reference for the discovery version
- `src/components/layout/Header.tsx`: Already has SearchBar integrated, nav links with icons for Bowlers/Teams/Seasons/Leaderboards
- `src/components/layout/Footer.tsx`: Secondary nav links (About, Rules, Blog, Join) + three league logos + "Since 2007" branding — needs Instagram link added
- `src/components/ui/EmptyState.tsx`: Generic empty state component — could be used for placeholder pages
- `src/lib/search-index.ts`: Build-time search index generation (bowlerID, name, slug, seasonsActive) — already works
- `src/lib/queries.ts`: All SQL lives here — will need new queries for milestones, season leaders, countdown data

### Established Patterns
- Static generation with `generateStaticParams` + `dynamicParams = false`
- All SQL in `queries.ts`, components never use raw SQL
- React.cache wraps queries called by both generateMetadata and page component
- Tailwind CSS v4 with @theme tokens (cream/navy/red palette)
- DM Serif Display headings + Inter body text
- Score color coding: 200+ green, 250+ gold, 300 special (red accent)

### Integration Points
- `src/app/page.tsx`: Current placeholder home page — will be completely rebuilt
- Header nav links already point to /bowlers, /teams, /seasons, /leaderboards — need pages created
- Footer needs Instagram link added
- `/api/search-index` route already serves the bowler search JSON
- Schedule data in DB for countdown (Seasons XXVI-XXXV, 846 rows)
- Scores table for milestone calculations (22,817 rows, computed columns for handicap)

</code_context>

<deferred>
## Deferred Ideas

- Full Instagram photo integration (embedded feed, API pull) — future enhancement, just footer link for now
- Season standings from matchResults — data backfill needed, placeholder for now
- Individual playoff rankings — data backfill needed, placeholder for now
- Team pages with full content — Phase 4
- Season pages with full content — Phase 4
- Blog system for weekly recaps — Phase 6 (but home page will link to latest post once it exists)

</deferred>

---

*Phase: 03-search-and-home-page*
*Context gathered: 2026-03-02*
