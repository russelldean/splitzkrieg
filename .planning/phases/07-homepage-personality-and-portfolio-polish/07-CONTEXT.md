# Phase 7: Homepage Personality and Portfolio Polish - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

The site looks good and works well — this phase is additive polish, not a redesign. The goal is to make it feel more "made" than "generated." Two league members specifically flagged the homepage as looking AI-generated. Fix that perception on the homepage and enhance the thinnest pages (directory pages), while keeping everything that's already working.

</domain>

<decisions>
## Implementation Decisions

### Homepage Card Grid
- Strip the description text from all 6 quick-link cards — keep only icon + label
- Keep the alternating red/navy left border accent pattern
- Icon style (emoji vs SVG) and layout treatment (grid vs inline vs pills) at Claude's discretion — pick what looks most intentional and least template-y

### Visual Warmth & Photos
- Extend the parallax photo hero treatment to more pages — it's been well-received where it exists
- User will supply additional Village Lanes / league photos during this phase (drop into docs/images/)
- Claude selects which pages benefit most from parallax heroes
- Directory pages (bowlers list, teams list, seasons list) are the thinnest — enhance these
- Enhancement level for directories at Claude's discretion (hero headers, richer list items, or both)

### Site Voice & Tone
- Professional with character — "Baseball Reference with a wink"
- Not a humor-forward site, but the league's personality (fun team names, social bowling culture) should show through naturally
- Don't try too hard — let the data and team names do the talking
- Additive only — build on what's working, don't overhaul

### AI-Made Audit
- Scope: homepage + directory pages (bowlers, teams, seasons)
- Homepage is the primary offender — the feedback was specifically about it
- Claude audits for common AI-generation patterns: uniform grids, emoji icons, descriptive helper text under every link, perfect symmetry, generic taglines, identical card structures
- Fix identified patterns with opinionated design choices that feel human-authored
- Inner pages (bowler profiles, team pages, season pages) are already data-driven and feel purposeful — leave them alone

### Portfolio Readiness
- Targeting senior IC / generalist roles — demonstrate breadth (architecture, data pipeline, UI craft, product thinking)
- No visible "built with" signals on the site — let the work speak for itself
- GitHub repo likely public — code quality matters but no special cleanup needed for this phase
- Include easy performance and accessibility wins if they're low-hanging fruit, but visual polish is the focus

### Claude's Discretion
- Card grid layout treatment (grid, inline row, pills)
- Whether to use emoji or SVG icons on homepage cards
- Which pages get parallax hero treatment
- Directory page enhancement approach
- Specific AI-pattern fixes beyond the card grid (tagline, symmetry, spacing)
- Performance/a11y quick wins to include

</decisions>

<specifics>
## Specific Ideas

- "I like the way the site looks and it has come together nicely" — this is polish, not a pivot
- The parallax photo treatment has been the standout visual element — extend it
- The perception problem is specifically the homepage, not the inner data pages
- User is comfortable with AI as a tool but wants the output to not *look* like AI output
- The distinction: "this feels made" vs "this feels generated"

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ParallaxBg` component (`src/components/ui/ParallaxBg.tsx`): Already handles desktop/mobile sources, focal points — ready to use on more pages
- `SectionHeading` component: Consistent heading treatment across pages
- `StrikeX` component: Custom typography element for hero headings
- SVG nav icons in `Header.tsx`: Custom bowling ball, calendar, bar chart, person, team icons — could replace emoji on homepage cards
- Footer already has league photos and logos with personality

### Established Patterns
- Metrograph design system: DM Serif Display + Inter, cream/navy/red palette — locked
- `ParallaxBg` accepts `src`, `mobileSrc`, `focalY`, `mobileFocalY` props for responsive photo placement
- Left border accents with alternating red/navy colors on cards
- Score color coding (200+ green, 250+ gold) — don't touch
- No em dashes anywhere

### Integration Points
- Homepage: `src/app/page.tsx` — quickLinks array with icon/label/description/accent
- Bowler directory: `src/app/bowlers/page.tsx`
- Team directory: `src/app/teams/page.tsx`
- Seasons directory: `src/app/seasons/page.tsx`
- Layout: `src/components/layout/Header.tsx`, `Footer.tsx`
- Photos: `docs/images/` (existing), `public/` (served)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-homepage-personality-and-portfolio-polish*
*Context gathered: 2026-03-11*
