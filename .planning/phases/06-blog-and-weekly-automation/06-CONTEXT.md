# Phase 6: Blog and Weekly Automation - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Bowlers get weekly blog posts with results and highlights. The commissioner's post-bowling workflow (scores → verify → blog → publish → email) becomes a repeatable pipeline. Blog infrastructure, first post, publish gate, email automation via Resend, and countdown animation verification.

</domain>

<decisions>
## Implementation Decisions

### Blog Post Format
- Hybrid sections: narrative intro/highlights paragraph, then distinct stat blocks
- Narrative section is optional — write it when there's time, skip when there isn't
- All four stat blocks in every weekly recap:
  1. Top performers (highest scratch series, scratch game, hcp series — top 3-5 each)
  2. Milestones & personal bests (new career highs, first 200+, first 600+, patches)
  3. Match results summary (team wins, series totals, sweeps, upsets)
  4. Standings snapshot (current standings with movement arrows from last week)
- Score color coding in stat blocks: same as rest of site (200+ green, 250+ gold)
- All bowler names link to profile pages (in stat blocks AND narrative)
- No image support for v1 — text and stat blocks only
- First blog post: combined site launch announcement + Week 4 recap

### Publish Gate
- DB flag (column or settings row) controls which week is "published"
- Updated via standalone script: `node scripts/publish-week.mjs --week=5`
- Gates: homepage latest week display + bowler profile stats (career stats, game logs)
- NOT gated: league night pages (accessible for any week with data) and blog posts (visible once MDX file exists)
- Unpublished weeks can be in DB but won't affect the high-traffic surfaces

### Blog Infrastructure
- MDX files in repo (content/blog/ directory) — supports React components inline for stat tables, score cards
- YAML frontmatter: title, date, slug, season, week, excerpt, type
- `type` field for simple categorization: "recap" or "announcement"
- Slug-based URLs: `/blog/season-xxxv-week-4-recap` for recaps, `/blog/welcome-to-splitzkrieg` for one-offs
- Blog list page (/blog): cards with title, date, excerpt, and stat highlight teaser
- Prev/next post navigation at bottom of each post
- Top-level nav item ("Blog" in main navigation)
- Blog replaces the Resources card on the homepage

### Weekly Pipeline Flow
- Hybrid approach: scripts handle mechanical parts, blog writing is conversational
- Scripted: LP score pull, DB import, patch calculation, publish-week flag
- Conversational: blog post writing/editing with Claude
- Living runbook doc (docs/weekly-runbook.md) with step-by-step instructions
- Email via Resend to Google Group address (one recipient reaches everyone)
- Email format: teaser with highlights + "Read the full recap" link to blog post
- Countdown animation: test-and-verify only, no design decisions needed

### Bidirectional Cross-Linking
- Blog posts link to the league night page for that week
- League night pages link to the blog post (when one exists for that week)

### Claude's Discretion
- MDX parsing library choice and build-time rendering approach
- Blog card design and stat teaser formatting
- Prev/next navigation styling
- Email trigger mechanism (separate script vs flag on publish-week)
- Email template design (React Email with Resend)
- Runbook structure and level of detail
- Standings movement arrow design
- Blog list page responsive layout

</decisions>

<specifics>
## Specific Ideas

- Blog replaces the Resources card on the homepage — this is the new content surface
- Weekly recap slugs include season and week because "week 4 comes around every season"
- Google Group for email distribution — simple, already in use, everyone gets it
- Email should drive traffic to the site (teaser, not full content)
- First post sets the tone — launch announcement + actual week results shows what the blog will be

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/app/blog/page.tsx`: Placeholder blog page — replace with MDX-powered list
- `src/components/ui/`: Established component library (cards, tables, etc.)
- Score color coding utilities in `src/lib/score-utils.ts` — reuse for blog stat blocks
- `gameWinClass()` in WeeklyResults for green/amber/navy — reuse for match results
- Countdown components (7 files) — test existing implementation, may not need changes

### Established Patterns
- Static generation with `generateStaticParams` + `dynamicParams = false`
- All SQL in `src/lib/queries/` — components never use raw SQL
- `cachedQuery()` for build-time DB caching
- Cross-linking everywhere (names → profiles, teams → team pages)
- Reverse chronological ordering (newest first)
- Metrograph-inspired design (DM Serif Display + Inter, cream/navy/red palette)

### Integration Points
- `latestWeek` CTE in `src/lib/queries/home.ts` — needs publish gate integration
- League night pages at `/week/[seasonSlug]/[weekNum]` — add blog post link
- Main navigation in layout components — add Blog entry
- Homepage card grid — replace Resources card with Blog card
- `import-week-scores.mjs` — existing two-phase pull/import pipeline
- `populate-patches.mjs` — patch calculation after import

</code_context>

<deferred>
## Deferred Ideas

- Subscriber signup form on site (opt-in email list) — future phase
- Auto-generated blog draft from weekly data — Later Bucket item
- Photo gallery in blog posts — future phase (images v1 excluded)
- Fancier email list management (beyond Google Group) — revisit later
- Email automation with per-bowler personalization — future enhancement

</deferred>

---

*Phase: 06-blog-and-weekly-automation*
*Context gathered: 2026-03-10*
