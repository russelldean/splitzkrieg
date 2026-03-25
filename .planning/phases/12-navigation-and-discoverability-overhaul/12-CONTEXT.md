# Phase 12: Navigation and Discoverability Overhaul - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Help users naturally find and explore the full depth of the site. Rethink the blog recap format (hub-and-spoke to guided paths), improve cross-page discovery, leverage PostHog analytics data to understand current usage patterns, and design navigation that leads people deeper without overwhelming them.

</domain>

<decisions>
## Implementation Decisions

### Blog Recap Format
- **D-01:** Recap stays as the primary content vehicle (replaces the old weekly email) but shifts from full hub to **condensed-headline hybrid**
- **D-02:** Each section (results, standings, leaderboards, milestones) shows a compact snapshot -- the headline, not the full data -- with an inline "see more" exit ramp right where interest is hot
- **D-03:** Exit ramps link to the actual pages (week results page, season standings page, stats page) so people learn those pages exist for future visits
- **D-04:** Russ's prose and bowler/team of the week awards remain unique to the recap -- that content doesn't exist elsewhere
- **D-05:** After the core weekly content, a discovery section with: a couple stable links (your bowler page, all-time leaderboards) + rotating highlights for whatever's new that week
- **D-06:** New features/content need deliberate callouts at the top of the recap, not just existence on the site

### Cross-Page Discovery
- **D-07:** Bowler profile page should be **reordered** -- move achievements (You Are a Star) and nightly bowling profile higher, push detailed season-by-season cards lower. The personality/universal content has broader appeal than stat tables.
- **D-08:** Pages need "keep going" signals -- currently people get what they came for and leave with no prompt to go deeper
- **D-09:** The updates feed is the intended discovery mechanism but is buried in Extras menu -- it needs to be surfaced prominently (exact placement TBD in planning)
- **D-10:** H2H records, playoff race chart, all-time stats, Splitzkrieg Shares animation, easter eggs -- all hidden gems that need discoverable paths, not just existence in the nav

### PostHog Analytics Enhancement
- **D-11:** Add scroll depth tracking to key pages (bowler profile especially -- do people reach achievements section?)
- **D-12:** Add click tracking on discovery elements (Keep Exploring links, inline exit ramps, nav items, cross-links)
- **D-13:** Add "feature seen" events for key content sections (nightly profile, milestones, You Are a Star, etc.)
- **D-14:** Enhanced tracking serves as before/after measurement for navigation changes -- deploy tracking first, then measure impact of redesign

### Email Distribution Strategy
- **D-15:** Weekly email format: pure teaser (short, funny, personality-driven like current style) + 2-3 bullet points from recent updates feed highlighting new things to discover
- **D-16:** Email links to the blog recap as the single entry point -- the recap then guides the sequential path
- **D-17:** Target publish time: Tuesday daytime (people at desks, bowling still fresh) -- not Monday night
- **D-18:** Friday pre-bowling email is a future opportunity for off-week content pushes (not in scope for this phase, but noted)

### Guided Path Design
- **D-19:** Core weekly path should feel sequential and obvious: recap prose/awards -> results snapshot -> standings update -> leaderboard highlights -> milestones/personal bests
- **D-20:** Each step gives the headline and creates curiosity for the detail, with a clear "next" prompt
- **D-21:** People should not need to backtrack to the recap hub to continue -- each destination page should have a forward path to the next logical stop
- **D-22:** The path design should work whether someone follows it linearly or drops in at any point

### Mobile Readability at the Bowling Alley
- **D-23:** Primary at-the-alley usage is on phones in a dark bowling alley by 50+ year old bowlers. All navigation, discovery UI, and recap content must be readable in that context -- high contrast, large tap targets, no tiny text.
- **D-24:** Consider a "dark bowling alley bad eyes" mode -- either auto-detect (time-based, bowling night hours 8-11pm ET Tuesday) or manual toggle. Larger fonts, higher contrast, simplified layout for at-the-alley consumption vs. next-day desk browsing.
- **D-25:** PostHog data already shows bowling night traffic spike (8-11pm ET). Any readability mode could key off that pattern.

### Claude's Discretion
- Exact component design for inline exit ramps and "next stop" nudges
- How scroll depth and click tracking are implemented (PostHog SDK methods)
- Which sections of bowler profile to reorder and exact layout
- Whether "keep going" nudges are contextual (based on what page you're on) or generic
- Technical approach for surfacing the updates feed

</decisions>

<specifics>
## Specific Ideas

- "It's like the people that take quizzes to see which Hogwarts house they are in" -- the nightly bowling profile has that viral potential. It's personal, universal, not skill-dependent. Should be easy to find.
- The old weekly email had everything in one place (results, leaderboards, standings, spreadsheet link). The dedicated diggers would click through to the spreadsheet. The recap should respect that same pattern: satisfy the casual reader, give the digger exit ramps.
- "I dreamed of telling people about the updates feed, and them using that to discover what has changed" -- the vision is right, the execution (buried in Extras) failed. Surface it.
- Instagram account is active and could cross-promote blog posts and new features (not in scope but worth noting for distribution)
- Easter eggs and fun touches (Splitzkrieg Shares animation, etc.) are rewards for exploration -- they need at least a hint that exploration is worth doing, not full spoilers

</specifics>

<canonical_refs>
## Canonical References

### PostHog Analytics Baseline (generated during this discussion)
- `scripts/posthog-analysis2.mjs` -- Production traffic analysis: top pages, session depth, daily traffic, entry pages, blog traffic, bowler/team pages, day-of-week patterns
- `scripts/posthog-flows.mjs` -- Session sequences showing actual user navigation paths (30 multi-page sessions)
- `scripts/posthog-today.mjs` -- Single-day traffic snapshot for bowling night patterns

### Key Data Points from Analysis
- 449 unique visitors, 1,018 sessions in 16 days (March 9-24)
- 46.4% bounce rate (472 of 1,018 sessions are single-page)
- Tuesday is peak traffic day (1,179 pageviews) -- day after bowling, not bowling night itself
- Blog post with email push: 257 views, 170 direct entries. Blog post without push: 2 views.
- Homepage is entry point for 380/1,018 sessions (37%)
- Top pages after homepage: week results, resources, seasons, league nights, bowlers, stats
- Deep/discovery pages: all-time stats (46 views), milestones (32 views), game profiles (28 views), village-lanes (39 views)
- Session depth: 546 sessions went 2+ pages, some go very deep (70-187 pages)
- Bowling night traffic confirms at-the-alley usage (8-11pm Eastern spike)

### Existing Navigation Components
- `src/components/layout/Header.tsx` -- Desktop nav with dropdown menus
- `src/components/layout/MobileNav.tsx` -- Hamburger menu with collapsible sections
- `src/components/layout/Footer.tsx` -- Secondary nav (About, Rules, Extras)
- `src/components/blog/WeekRecap.tsx` -- Current recap component with inline stat blocks and Keep Exploring section
- `src/components/blog/BlogPostLayout.tsx` -- Blog post layout with prev/next navigation
- `src/components/PostHogProvider.tsx` -- Current PostHog integration (pageviews only)
- `src/app/resources/page.tsx` -- Where the updates feed currently lives (buried)
- `content/updates.ts` -- Updates feed data source

### Blog and Content System
- `src/app/api/admin/blog/auto-draft/route.ts` -- Auto-draft template for new recap posts
- `src/components/blog/WeekRecap.tsx` -- WeekRecap component with WeekStats, WeekMatchSummary, standings, leaderboards, milestones, Keep Exploring

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WeekRecap` component already has modular sub-components (WeekStats, WeekMatchSummary, standings, leaderboards, milestones) -- can be refactored to show condensed versions with exit ramps
- `MilestoneTicker` on homepage -- proven animated discovery mechanism, could inform other discovery UI
- `PromotedBlogCard` on homepage -- already surfaces latest blog post
- PostHog provider already wired into app layout -- adding custom events is straightforward
- `content/updates.ts` -- updates feed data exists, just needs a more prominent home

### Established Patterns
- Static site with build-time data -- all discovery UI must work with pre-rendered content
- Blog posts are DB-backed with MDX support and React component embedding
- Cross-links between pages exist (week <-> blog, bowler profiles link to teams, etc.) but are passive, not guided

### Integration Points
- `WeekRecap` component is where the recap format changes happen
- PostHog provider is where enhanced tracking gets added
- Bowler profile page (`src/app/bowler/[slug]/page.tsx`) is where section reordering happens
- Each destination page (week, season, stats) needs "next stop" nudge components added

</code_context>

<deferred>
## Deferred Ideas

- Friday pre-bowling email as a second distribution touchpoint (content strategy, not code)
- Instagram cross-promotion strategy -- active Instagram channel run by a collaborator who is great at engagement. Russ can coordinate with her on promoting blog posts, new features, and driving site traffic. Worth a conversation about what would work best for that channel (stories, posts, link-in-bio, etc.)
- "You haven't seen this yet" personalized nudging (would require user identity/cookies beyond PostHog)
- Full redesign of the nav bar/menu structure (current nav works, discovery is the problem not navigation)
- Phase 11 mini-game integration with nav (already scoped in Phase 11 plan 07)

</deferred>

---

*Phase: 12-navigation-and-discoverability-overhaul*
*Context gathered: 2026-03-24*
