# Phase 12: Navigation and Discoverability Overhaul - Research

**Researched:** 2026-03-24
**Domain:** UX navigation patterns, PostHog analytics, blog/content architecture
**Confidence:** HIGH

## Summary

This phase transforms how users discover and navigate Splitzkrieg's deep content. The site has 449 unique visitors and 1,018 sessions in 16 days, but 46.4% bounce rate and nearly invisible discovery pages (all-time stats: 46 views, milestones: 32, game profiles: 28). Blog posts without email pushes get 2 views vs 257 with pushes, confirming email is the primary traffic driver and the recap is the single entry point that must guide users deeper.

The technical work falls into four domains: (1) refactoring the WeekRecap component from full-data hub to condensed-headline format with inline exit ramps, (2) adding PostHog custom event tracking for scroll depth, click tracking, and section visibility, (3) reordering the bowler profile page to surface personality/universal content higher, and (4) adding "next stop" navigation nudges to destination pages so users continue exploring instead of dead-ending.

**Primary recommendation:** Deploy PostHog tracking enhancements first (D-14 says measure before/after), then implement the recap redesign and cross-page nudges. All work is client-side React components and server-rendered page layout changes -- no database changes, no new queries, no cache implications.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Recap stays as the primary content vehicle but shifts from full hub to condensed-headline hybrid
- **D-02:** Each section shows compact snapshot with inline "see more" exit ramp
- **D-03:** Exit ramps link to actual pages (week results, season standings, stats)
- **D-04:** Russ's prose and bowler/team of the week awards remain unique to recap
- **D-05:** After core weekly content, a discovery section with stable links + rotating highlights
- **D-06:** New features/content need deliberate callouts at top of recap
- **D-07:** Bowler profile page reordered -- achievements and nightly profile higher, season-by-season cards lower
- **D-08:** Pages need "keep going" signals
- **D-09:** Updates feed surfaced prominently (currently buried in Extras menu)
- **D-10:** Hidden gems need discoverable paths, not just nav existence
- **D-11:** Add scroll depth tracking to key pages (bowler profile especially)
- **D-12:** Add click tracking on discovery elements
- **D-13:** Add "feature seen" events for key content sections
- **D-14:** Deploy tracking first, then measure impact of redesign
- **D-15:** Weekly email: pure teaser + 2-3 bullet points from updates feed
- **D-16:** Email links to blog recap as single entry point
- **D-17:** Target publish time: Tuesday daytime
- **D-18:** Friday pre-bowling email is future opportunity (not in scope)
- **D-19:** Core weekly path should feel sequential: recap -> results -> standings -> leaderboards -> milestones
- **D-20:** Each step gives headline + creates curiosity + clear "next" prompt
- **D-21:** Users should not need to backtrack to recap to continue
- **D-22:** Path design works whether followed linearly or dropped in at any point

### Claude's Discretion
- Exact component design for inline exit ramps and "next stop" nudges
- How scroll depth and click tracking are implemented (PostHog SDK methods)
- Which sections of bowler profile to reorder and exact layout
- Whether "keep going" nudges are contextual or generic
- Technical approach for surfacing the updates feed

### Deferred Ideas (OUT OF SCOPE)
- Friday pre-bowling email
- Instagram cross-promotion strategy
- "You haven't seen this yet" personalized nudging (requires user identity)
- Full nav bar/menu structure redesign
- Phase 11 mini-game integration with nav
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| posthog-js | ^1.359.1 (installed), 1.363.4 (latest) | Analytics, custom events, scroll tracking | Already integrated in project |
| Next.js | 16.1.6 | App Router, server components, static generation | Already the framework |
| React | 19.2.3 | UI components, hooks | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| posthog-js/react | (bundled with posthog-js) | usePostHog hook for client components | Custom event capture in click handlers and visibility tracking |

### No New Dependencies Needed
This phase requires zero new npm packages. All tracking uses the already-installed PostHog SDK. All UI components use existing Tailwind CSS + project design tokens. Intersection Observer is a native browser API -- no library needed.

## Architecture Patterns

### Recommended Component Structure
```
src/
  components/
    tracking/
      TrackClick.tsx          # Wrapper component for click tracking
      TrackVisibility.tsx     # IntersectionObserver-based section visibility
      useTrackClick.ts        # Hook for click tracking on interactive elements
    blog/
      WeekRecap.tsx           # MODIFY: condensed-headline format
      DiscoverySection.tsx    # NEW: replaces current Keep Exploring
      RecapCallout.tsx        # NEW: top-of-recap new feature callout
    ui/
      NextStopNudge.tsx       # NEW: "keep going" component for destination pages
      TrailNav.tsx            # MODIFY: enhanced with contextual links
    resources/
      SiteUpdates.tsx         # MOVE: from resources-only to shared component
```

### Pattern 1: PostHog Custom Event Tracking (Client Components)
**What:** Use `usePostHog` hook in client components to fire custom events
**When to use:** Click tracking on exit ramps, nudges, and discovery elements
**Example:**
```typescript
// Source: PostHog React docs
'use client';
import { usePostHog } from 'posthog-js/react';

function ExitRamp({ href, section, linkText }: Props) {
  const posthog = usePostHog();

  const handleClick = () => {
    posthog.capture('discovery_link_clicked', {
      section,
      destination: href,
      link_text: linkText,
      source_page: window.location.pathname,
    });
  };

  return (
    <Link href={href} onClick={handleClick}>
      {linkText}
    </Link>
  );
}
```

### Pattern 2: Section Visibility Tracking (IntersectionObserver)
**What:** Track when key content sections scroll into view using native IntersectionObserver
**When to use:** "Feature seen" events (D-13) for bowler profile sections, recap sections
**Example:**
```typescript
'use client';
import { useEffect, useRef } from 'react';
import { usePostHog } from 'posthog-js/react';

function useTrackVisibility(sectionName: string, page: string) {
  const ref = useRef<HTMLDivElement>(null);
  const posthog = usePostHog();
  const tracked = useRef(false);

  useEffect(() => {
    if (!ref.current || tracked.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !tracked.current) {
          tracked.current = true;
          posthog.capture('section_viewed', {
            section: sectionName,
            page,
          });
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [sectionName, page, posthog]);

  return ref;
}
```

### Pattern 3: Condensed Recap Section (Server Component with Client Exit Ramp)
**What:** Show headline/snapshot data with inline exit ramp link
**When to use:** Each recap section (results, standings, leaderboards, milestones)
**Example:**
```typescript
// Server component renders the condensed data
function RecapStandings({ standings, seasonSlug, weekNum }) {
  // Show top 3-4 teams only, not full table
  const topTeams = standings.slice(0, 4);
  return (
    <div>
      <h3>Standings</h3>
      {/* Condensed snapshot */}
      <CompactStandingsPreview teams={topTeams} week={weekNum} />
      {/* Exit ramp -- client component for tracking */}
      <ExitRamp
        href={`/season/${seasonSlug}`}
        section="standings"
        linkText="Full standings with XP breakdown"
      />
    </div>
  );
}
```

### Pattern 4: NextStopNudge on Destination Pages
**What:** A "keep going" component at the bottom of destination pages
**When to use:** Week results, season standings, stats, milestones pages
**Example:**
```typescript
// Contextual based on which page the user is on
function NextStopNudge({ currentPage, seasonSlug, weekNum }: Props) {
  // D-19 sequential path: results -> standings -> leaderboards -> milestones
  const nextStops = {
    week: { href: `/season/${seasonSlug}`, label: 'Season Standings', desc: 'See where every team stands' },
    season: { href: `/stats/${seasonSlug}`, label: 'Season Stats', desc: 'Leaderboards for this season' },
    stats: { href: '/milestones', label: 'Milestones', desc: 'Who just hit a career landmark?' },
    milestones: { href: '/stats/all-time', label: 'All-Time Records', desc: 'Career stats across all 35 seasons' },
  };
  // ...
}
```

### Anti-Patterns to Avoid
- **Don't make every page section a client component just for tracking:** Wrap the section in a thin client `<TrackVisibility>` wrapper around server-rendered content, not the other way around.
- **Don't fire tracking events on every scroll event:** Use IntersectionObserver with fire-once pattern (disconnect after first trigger).
- **Don't duplicate data between recap and destination pages:** The recap shows a condensed preview; the destination page shows the full data. No new queries needed.
- **Don't use PostHog autocapture for discovery tracking:** Custom events with semantic names (section_viewed, discovery_link_clicked) are far more useful for analysis than generic autocapture click events.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll depth tracking | Custom scroll event listeners | PostHog's built-in `$pageleave` event | Already capturing `capture_pageleave: true` in PostHogProvider. PostHog auto-captures `$prev_pageview_last_scroll` and `$prev_pageview_max_scroll` properties on pageview/pageleave events. |
| Element visibility detection | Manual scroll position calculations | Native IntersectionObserver API | Browser-native, performant, handles edge cases (resize, tab switch). No library needed. |
| Click tracking wrappers | Custom analytics middleware | `posthog.capture()` via `usePostHog` hook | Already installed, well-tested, handles batching and retries. |
| "What's new" badge/indicator | Custom date comparison logic | Existing `NewBlogBadge` pattern in Header.tsx | Already have the badge component and `getNewBlogBadgeId` query. |

## Common Pitfalls

### Pitfall 1: Client/Server Component Boundary for Tracking
**What goes wrong:** Trying to use `usePostHog` hook in a server component (the bowler profile page, WeekRecap, destination pages are all server components).
**Why it happens:** Next.js App Router defaults to server components. PostHog hooks require 'use client'.
**How to avoid:** Create thin client wrapper components (`<TrackVisibility>`, `<TrackClick>`) that wrap server-rendered children. The tracking component is client-side, the content it wraps stays server-rendered.
**Warning signs:** "usePostHog is not a function" or "useState is not a function" errors.

### Pitfall 2: Hydration Mismatch with Conditional Discovery Content
**What goes wrong:** If discovery sections show different content based on client-side state (e.g., "what's new this week"), server and client HTML won't match.
**Why it happens:** Static site pre-renders at build time. Any content that varies per-visit causes hydration errors.
**How to avoid:** All discovery content should be deterministic at build time. The "rotating highlights" (D-05) should rotate per-build (based on content/updates.ts data), not per-visit.
**Warning signs:** React hydration mismatch warnings in console.

### Pitfall 3: Over-Tracking Causing PostHog Quota Issues
**What goes wrong:** Firing too many custom events per pageview burns through PostHog's free tier event quota.
**Why it happens:** Adding visibility tracking to every section on every page.
**How to avoid:** Track only the specific sections listed in D-13 (nightly profile, milestones, You Are a Star, game profile). Use fire-once per page load. PostHog free tier is generous (1M events/month) and this site has ~1K sessions/16 days, so quota isn't a real risk, but be intentional.
**Warning signs:** PostHog dashboard showing unexpected event volume spikes.

### Pitfall 4: Cache Implications of Recap Changes
**What goes wrong:** Modifying WeekRecap component breaks cached blog pages.
**Why it happens:** Blog posts embed `<WeekRecap>` as an MDX component. Changing its output changes rendered HTML.
**How to avoid:** WeekRecap changes affect all blog posts that use it. This is fine -- they'll re-render on next build. But don't change the WeekRecap props interface without updating the MDX blog posts that reference it. The auto-draft template also uses these props.
**Warning signs:** Blog posts showing broken layouts after deploy.

### Pitfall 5: Text Opacity Below 60%
**What goes wrong:** "Keep going" nudges and discovery links use light/subtle text that Russ can't read.
**Why it happens:** UX instinct to make secondary navigation subtle.
**How to avoid:** Per CLAUDE.md: NEVER use text opacity below 60%. Discovery nudges should be visible and inviting, not whispered.
**Warning signs:** Any Tailwind class with `/50`, `/40`, `/30` etc. on text elements. (Note: existing code has some `/65` which is fine.)

## Code Examples

### Existing PostHog Integration (verified from codebase)
```typescript
// src/components/PostHogProvider.tsx
// Already initialized with:
posthog.init('phc_...', {
  api_host: 'https://us.i.posthog.com',
  capture_pageview: false,    // manual on route change
  capture_pageleave: true,    // AUTO scroll depth via $pageleave
  persistence: 'localStorage',
});
```

**Key insight:** `capture_pageleave: true` means PostHog already tracks scroll depth on every page. The `$pageleave` event includes `$prev_pageview_last_scroll` and `$prev_pageview_max_scroll` percentage properties. D-11 (scroll depth tracking) is partially solved already -- you can query this data in PostHog right now. The custom tracking work is for D-12 (click tracking) and D-13 (section visibility).

### Existing TrailNav Pattern (verified from codebase)
```typescript
// src/components/ui/TrailNav.tsx
// Already provides prev/next navigation between page types:
// Week -> Season -> Stats -> Bowlers -> Teams -> Blog
// Appears on: bowler, team, stats, week, season, blog, milestones pages
```

**Key insight:** TrailNav already provides the structural backbone for D-21 (forward path without backtracking). The enhancement is to make it contextual to the recap's guided path (D-19) and add descriptive text that creates curiosity (D-20) rather than just page names.

### Existing WeekRecap Structure (verified from codebase)
```typescript
// Current order in WeekRecap.tsx:
// 1. Awards (Bowler/Team of Week) -- unique to recap (D-04)
// 2. Weekly Results -- full WeekMatchSummary component
// 3. Standings -- full Standings component
// 4. Leaderboards -- LeaderboardSnapshot
// 5. Milestones & Personal Bests -- WeekStats records
// 6. Keep Exploring -- 4 static ExploreLink cards
// 7. Next League Night
```
The refactor condenses sections 2-5 from full components to headline previews + exit ramps. Section 6 becomes the discovery section with stable + rotating highlights (D-05).

### Current Bowler Profile Section Order (verified from codebase)
```typescript
// src/app/bowler/[slug]/page.tsx current order:
// 1. BowlerHero (name, avg, teams, BOTW badge)
// 2. LastWeekHighlight (week delta)
// 3. PersonalRecordsPanel (high game, series, 200+, 600+, turkeys)
// 4. MilestoneWatch (approaching milestones)
// 5. AverageProgressionChart (rolling avg over time)
// 6. SeasonStatsTable (season-by-season breakdown)
// 7. GameLog (week-by-week scores per season)
// 8. YouAreAStar (nightly bowling profile/personality)
// 9. GameProfile (fast starter, late bloomer, etc.)
```
Per D-07, move YouAreAStar and GameProfile higher (after PersonalRecordsPanel or MilestoneWatch). These are the personality/universal content with broader appeal.

### Updates Feed Current Location (verified from codebase)
```typescript
// src/app/resources/page.tsx -- titled "Extras"
// Updates feed is the FIRST section on the Extras page
// Component: <SiteUpdates> from src/components/resources/SiteUpdates.tsx
// Data source: getSiteUpdates() from src/lib/queries/updates.ts
// Original data: content/updates.ts
```
Per D-09, this needs to be surfaced prominently. Options: add to homepage, add to blog page sidebar, add condensed version to recap discovery section.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual scroll listeners | IntersectionObserver API | Supported in all modern browsers | No polyfill needed, better performance |
| PostHog autocapture only | PostHog custom events + autocapture | Always supported | Semantic event names enable meaningful analysis |
| Hub-and-spoke content | Guided sequential paths | Content strategy trend | Higher engagement, lower bounce rate |

## Open Questions

1. **How condensed should recap sections be?**
   - What we know: D-02 says "headline, not the full data." Current sections show full components.
   - What's unclear: Exact cutoff -- top 3 teams in standings? Just the leaders in leaderboards? One-line milestone summary?
   - Recommendation: Start with top 3-4 items per section. This is a design decision best iterated with Russ during implementation.

2. **Where exactly to surface the updates feed?**
   - What we know: D-09 says surfaced prominently, currently buried in Extras. D-05 says recap discovery section should include rotating highlights.
   - What's unclear: Should updates appear on homepage? On every page footer? In the blog index?
   - Recommendation: Add a condensed "What's New" component to the blog index page (where recap readers might browse) and to the recap discovery section. The homepage already has the MilestoneTicker and PromotedBlogCard -- adding more risks clutter.

3. **Email template changes (D-15, D-16, D-17)**
   - What we know: The project uses Resend for email (package installed). D-15 defines the email format.
   - What's unclear: Whether there's an existing email template/workflow or if this is net new.
   - Recommendation: Research existing email infrastructure during planning. The email changes are content/copy work more than code changes.

## Project Constraints (from CLAUDE.md)

- **Static site** -- all discovery UI must work with pre-rendered content. No runtime DB queries.
- **No em dashes** -- sweep all new text for em dashes. Use commas, periods, or colons instead.
- **Text opacity minimum 60%** -- all nudge/discovery text must be readable.
- **Cache system** -- this phase doesn't modify queries, so no cache implications. But changing WeekRecap output will cause blog pages to re-render on next build (expected, not a problem).
- **Commit frequently** at natural stopping points.
- **Remind Russ to update content/updates.ts** after visible changes.
- **Verify file paths with Glob** before reading.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vitest.config.ts) |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map

This phase is primarily UI/UX refactoring and analytics integration. Most changes are visual layout changes and event-firing behavior that are best validated through manual browser testing and PostHog dashboard verification. However, some unit-testable logic exists:

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-11 | Scroll depth tracking fires on key pages | manual | Verify in PostHog dashboard | N/A |
| D-12 | Click tracking on discovery elements | manual | Verify in PostHog dashboard | N/A |
| D-13 | Section visibility events fire once per load | unit | `npx vitest run src/components/tracking/` | Wave 0 |
| D-19 | NextStopNudge shows correct sequential destination | unit | `npx vitest run src/components/ui/NextStopNudge.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run` + manual browser check on `next dev`
- **Phase gate:** Full suite green + PostHog dashboard confirms events flowing

### Wave 0 Gaps
- [ ] `src/components/tracking/__tests__/useTrackVisibility.test.ts` -- covers fire-once behavior
- [ ] `src/components/ui/__tests__/NextStopNudge.test.ts` -- covers sequential path logic

## Sources

### Primary (HIGH confidence)
- Codebase analysis: PostHogProvider.tsx, WeekRecap.tsx, bowler/[slug]/page.tsx, Header.tsx, TrailNav.tsx, resources/page.tsx, SiteUpdates.tsx, content/updates.ts, BlogPostLayout.tsx
- PostHog analytics data from CONTEXT.md canonical references (449 visitors, 1,018 sessions, 46.4% bounce, Tuesday peak)
- [PostHog React docs](https://posthog.com/docs/libraries/react) -- usePostHog hook API
- [PostHog custom events](https://posthog.com/docs/product-analytics/capture-events) -- capture() API
- [PostHog Next.js docs](https://posthog.com/docs/libraries/next-js) -- App Router integration

### Secondary (MEDIUM confidence)
- [PostHog scroll depth tutorial](https://posthog.com/tutorials/scroll-depth) -- confirmed $pageleave auto-captures scroll depth
- [PostHog event tracking guide](https://posthog.com/tutorials/event-tracking-guide) -- event naming conventions ([object] [verb] format)
- npm registry: posthog-js latest version 1.363.4 (project has ^1.359.1, will auto-update)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, everything already installed
- Architecture: HIGH -- patterns verified against existing codebase structure
- Pitfalls: HIGH -- based on known project constraints (CLAUDE.md, server/client boundaries)
- PostHog integration: HIGH -- existing code inspected, API verified against docs

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable domain, no fast-moving dependencies)
