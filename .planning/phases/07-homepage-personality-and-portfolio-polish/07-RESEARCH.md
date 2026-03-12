# Phase 7: Homepage Personality and Portfolio Polish - Research

**Researched:** 2026-03-11
**Domain:** UI/UX design polish, anti-template patterns, visual warmth
**Confidence:** HIGH

## Summary

This phase is a design polish pass, not a technical implementation phase. The codebase is mature (90+ commits, 70+ components), the design system is locked (Metrograph: DM Serif Display + Inter, cream/navy/red), and the inner pages are already data-driven and purposeful. The problem is narrowly scoped: the homepage triggers "AI-made" pattern recognition in league members, and the directory pages (bowlers, teams, seasons) feel thin.

After auditing the existing code, the specific AI-pattern triggers on the homepage are: (1) a uniform 2x3/6-col grid of cards with identical structure (emoji + label + description), (2) descriptive helper text under every nav link that reads like tooltip text, (3) perfect visual symmetry with no hierarchy or editorial opinion, and (4) a generic tagline ("Stats, records, and 19 years of league history"). The directory pages lack visual anchoring -- no hero images, no personality, just data lists.

The fix is editorial, not architectural. Strip the card descriptions (locked decision), replace emoji with the existing SVG nav icons from Header.tsx, break the grid symmetry, add parallax hero headers to directory pages, and inject voice through copy rather than layout complexity. The existing ParallaxBg component and Village Lanes photo library (12 photos in /public/) are the primary tools.

**Primary recommendation:** Treat this as 3 focused waves: (1) homepage card grid + hero personality, (2) directory page hero headers + enhancement, (3) AI-pattern audit + final polish.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Strip the description text from all 6 quick-link cards -- keep only icon + label
- Keep the alternating red/navy left border accent pattern
- Icon style (emoji vs SVG) and layout treatment (grid vs inline vs pills) at Claude's discretion
- Extend the parallax photo hero treatment to more pages
- User will supply additional Village Lanes / league photos during this phase
- Directory pages (bowlers list, teams list, seasons list) are the thinnest -- enhance these
- Professional with character -- "Baseball Reference with a wink"
- Not a humor-forward site, but the league's personality should show through naturally
- Additive only -- build on what's working, don't overhaul
- AI-Made audit scope: homepage + directory pages (bowlers, teams, seasons)
- Homepage is the primary offender
- Fix AI patterns with opinionated design choices that feel human-authored
- Inner pages (bowler profiles, team pages, season pages) already feel purposeful -- leave alone
- Targeting senior IC / generalist roles -- demonstrate breadth
- No visible "built with" signals on the site
- Performance and accessibility wins are low-hanging fruit, not the focus

### Claude's Discretion
- Card grid layout treatment (grid, inline row, pills)
- Whether to use emoji or SVG icons on homepage cards
- Which pages get parallax hero treatment
- Directory page enhancement approach
- Specific AI-pattern fixes beyond the card grid (tagline, symmetry, spacing)
- Performance/a11y quick wins to include

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core (already in place)
| Library | Purpose | Notes |
|---------|---------|-------|
| Next.js (App Router) | Framework | Static site, build-time data fetching |
| Tailwind CSS v4 | Styling | @theme inline tokens in globals.css |
| DM Serif Display | Heading font | Already configured |
| Inter | Body font | Already configured |

### Supporting (already in place)
| Component | Purpose | Status |
|-----------|---------|--------|
| `ParallaxBg` | Parallax photo backgrounds | Production-ready, handles desktop + mobile |
| `SectionHeading` | Consistent heading with red underline accent | Established pattern |
| `StrikeX` | Styled bowling-strike X characters | Used in hero headings |
| SVG nav icons in `Header.tsx` | Custom bowling ball, calendar, bar chart, person, team, blog icons | Ready to reuse on homepage |

### No New Dependencies
This phase requires zero new npm packages. Everything needed exists in the codebase.

## Architecture Patterns

### Existing Project Structure (relevant files)
```
src/
  app/
    page.tsx              # Homepage -- PRIMARY target
    bowlers/page.tsx       # Bowler directory -- needs hero
    teams/page.tsx         # Teams directory -- needs hero
    seasons/page.tsx       # Seasons directory -- needs hero
  components/
    home/
      MilestoneTicker.tsx  # Ticker bar with easter eggs
      CountdownClock.tsx   # Next bowling night countdown
      MiniStandings.tsx    # Current standings table
      SeasonSnapshot.tsx   # Season stats + leaders
      ThisWeekMatchups.tsx  # Upcoming matchups
    ui/
      ParallaxBg.tsx       # Reusable parallax photo component
      SectionHeading.tsx   # Heading with red underline
      StrikeX.tsx          # Strike-X character styling
    layout/
      Header.tsx           # SVG icons defined here
      Footer.tsx           # Photos + branding
    bowlers/
      BowlerDirectory.tsx  # Alphabetical bowler list
    team/
      TeamsDirectory.tsx   # Team cards grid
      TeamCard.tsx         # Individual team card
    season/
      SeasonDirectory.tsx  # Season list with featured current season
public/
  village-lanes-*.jpg      # 10 Village Lanes photos
  splitzkrieg-stickers.jpg # League stickers
  bowling-screen.jpg       # Bowling alley screen
```

### Pattern: ParallaxBg Usage
```tsx
// Source: existing codebase -- src/app/page.tsx
<div className="relative overflow-hidden h-40">
  <ParallaxBg
    src="/village-lanes-chairs.jpg"
    imgW={2048} imgH={1536}
    focalY={0.5}
    mobileSrc="/village-lanes-lanes.jpg"
    mobileFocalY={0.6}
    mobileImgW={3024} mobileImgH={4032}
  />
  <div className="absolute inset-0 bg-black/60" />
  <div className="relative z-10">Content on top</div>
</div>
```

### Pattern: SVG Icon Extraction
The Header.tsx file defines 6 custom SVG icons as JSX variables: `bowlersIcon`, `teamsIcon`, `seasonsIcon`, `leagueNightsIcon`, `blogIcon`, `statsIcon`. These should be extracted to a shared location so both Header.tsx and the homepage can reference them without duplication.

### Anti-Patterns to Avoid
- **Uniform grids with identical card structures:** The current 6-card grid where every card has the same emoji+label+description structure is the #1 AI tell. Break the symmetry.
- **Descriptive helper text under navigation links:** "Weekly matchups and scores" under "League Nights" reads like a generated tooltip. Real sites trust users to know what "League Nights" means.
- **Perfect visual symmetry:** Every section having the exact same padding, the same border treatment, the same visual weight reads as generated. Vary the rhythm.
- **Generic taglines:** "Stats, records, and 19 years of league history" could be on any stats site. Make it specific to this league.

## AI-Pattern Audit Findings

### Homepage Specific Issues (audited from source code)

| Issue | Location | Fix |
|-------|----------|-----|
| Uniform 6-card grid, identical structure | `quickLinks` array, lines 28-35 | Strip descriptions (locked), consider non-grid layout |
| Emoji icons feel generic | `quickLinks` icons: bowling, calendar, trophy, person, group, memo | Replace with SVG icons from Header.tsx -- they're custom and more intentional |
| Generic tagline | Line 108-109: "Stats, records, and {years} years of league history" | Write something with voice -- reference the league's personality |
| Perfect symmetry in card grid | 2x3 grid on mobile, 6-col on desktop, all identical | Consider asymmetric layout, varied card sizes, or non-grid treatment |
| Section divider pattern is generic | Gradient divider between hero and content grid | Consider removing or replacing with something more editorial |
| Content grid is perfectly symmetrical | 2-col grid: standings left, matchups+snapshot right | This is actually fine -- data displays should be orderly |

### Directory Page Issues

| Page | Issue | Fix |
|------|-------|-----|
| Bowlers (`/bowlers`) | No visual header, jumps straight to filter + alphabetical list | Add parallax hero with Village Lanes photo |
| Teams (`/teams`) | No visual header, jumps to filter + card grid | Add parallax hero, the card grid itself is fine |
| Seasons (`/seasons`) | No visual header, jumps to featured season card | Add parallax hero, existing layout is solid |

### Available Photos for Hero Treatment

| Photo | Good For | Notes |
|-------|----------|-------|
| `village-lanes-bowl-sign.jpg` | Seasons directory | Iconic venue signage |
| `village-lanes-panorama.jpg` | Bowlers directory | Wide shot showing the lanes |
| `village-lanes-group-photo.jpg` | Teams directory | Group/community feel |
| `village-lanes-outside.jpg` | About/general | Exterior establishing shot |
| `village-lanes-lanes.jpg` | Already used on homepage mobile | Lane perspective |
| `village-lanes-chairs.jpg` | Already used on homepage desktop | Blue chairs ambiance |
| `village-lanes-console.jpg` | Could work for stats pages | Scoring console |
| `village-lanes-brunswick-2000s.jpg` | Could work for seasons/history | Retro equipment |
| `village-lanes-party-zone.jpg` | Fun/casual context | Party zone area |
| `village-lanes-mp300.jpg` | Achievement/milestone context | Perfect 300 photo |
| `village-lanes-sign.png` | Established identity | Venue sign |
| `village-lanes-parking-lot.jpg` | Establishing shot | Outdoor/arrival |
| `splitzkrieg-stickers.jpg` | Brand personality | Custom stickers |
| `bowling-screen.jpg` | Scoring/results context | Bowling screen |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Parallax backgrounds | Custom scroll handlers | `ParallaxBg` component | Already handles desktop bg-fixed and mobile clip-path perfectly |
| Icon system | New icon library | Extract existing SVGs from Header.tsx to shared file | Consistency with nav, zero dependencies |
| Design tokens | New theme system | Existing `@theme inline` in globals.css | Cream/navy/red palette is locked |

## Common Pitfalls

### Pitfall 1: Over-designing the fix
**What goes wrong:** Adding too many design elements, animations, or decorative touches to "fix" the clinical feel, ending up with a different kind of AI look (the "overdesigned by AI" aesthetic).
**Why it happens:** The temptation is to add complexity. The fix is actually subtraction + editorial voice.
**How to avoid:** Each change should pass the "would a human designer have made this specific choice?" test. Real designers make opinionated choices -- not more choices, better choices.
**Warning signs:** If the number of unique visual elements increases significantly, that's a red flag.

### Pitfall 2: Breaking the established design system
**What goes wrong:** Introducing new colors, fonts, or spacing scales to create "personality" that actually creates inconsistency.
**Why it happens:** The Metrograph design system (cream/navy/red, DM Serif + Inter) is already well-established and the inner pages look good. Breaking it makes things worse.
**How to avoid:** Stay within the existing token palette. Personality comes from copywriting, layout choices, and photo treatment -- not new visual primitives.
**Warning signs:** Any new CSS custom properties or color values being added to globals.css.

### Pitfall 3: Forgetting mobile-first
**What goes wrong:** Hero photos look great on desktop but crop badly on mobile, or layout changes break the responsive grid.
**Why it happens:** ParallaxBg supports mobile, but each photo needs its own focal point tuning.
**How to avoid:** Test every photo with `mobileSrc`, `mobileFocalY` props. The component handles the rest.
**Warning signs:** Photos showing wrong part of image on narrow viewports.

### Pitfall 4: SVG icon extraction breaking Header
**What goes wrong:** Moving SVG icons to a shared file introduces import issues or breaks the Header component.
**Why it happens:** The icons are currently defined as `const` JSX expressions inline in Header.tsx.
**How to avoid:** Extract to `src/components/ui/icons.tsx` as named exports. Update Header.tsx imports. Test that the header still renders correctly.

### Pitfall 5: Cache invalidation during polish
**What goes wrong:** No SQL queries change in this phase, but modifying page.tsx or directory components triggers recompilation. The disk cache for queries should remain untouched.
**Why it happens:** This phase is purely UI -- no data fetching changes needed.
**How to avoid:** Don't modify any files in `src/lib/queries/`. No cache version bumps, no force rebuilds.

## Code Examples

### Homepage Card Grid - Current vs Recommended

**Current (AI-pattern):**
```tsx
// Uniform grid, identical structure, descriptive text
<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
  {quickLinks.map((link) => (
    <Link key={link.href} href={link.href} className="... border-l-4 ... p-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">{link.icon}</span>  {/* emoji */}
        <div className="text-sm font-medium">{link.label}</div>
      </div>
      <div className="text-xs mt-1 pl-7">{link.description}</div>  {/* AI tell */}
    </Link>
  ))}
</div>
```

**Recommended approach -- compact pill/chip row:**
```tsx
// Compact inline row, no descriptions, SVG icons, feels intentional
import { leagueNightsIcon, seasonsIcon, statsIcon, bowlersIcon, teamsIcon, blogIcon } from '@/components/ui/icons';

const quickLinks = [
  { label: 'League Nights', href: '/week', icon: leagueNightsIcon, accent: 'border-l-red-600/40' },
  { label: 'Seasons', href: '/seasons', icon: seasonsIcon, accent: 'border-l-navy/30' },
  // ...
];

<div className="flex flex-wrap gap-2 mt-6">
  {quickLinks.map((link) => (
    <Link
      key={link.href}
      href={link.href}
      className={`inline-flex items-center gap-2 bg-white rounded-lg border border-navy/10 border-l-4 ${link.accent} px-4 py-2.5 hover:border-navy/20 hover:shadow-sm transition-all group`}
    >
      <span className="text-navy/50 group-hover:text-red transition-colors">{link.icon}</span>
      <span className="font-body text-sm font-medium text-navy group-hover:text-red transition-colors">
        {link.label}
      </span>
    </Link>
  ))}
</div>
```

### Shared Icon Extraction
```tsx
// src/components/ui/icons.tsx
// Extract from Header.tsx -- same SVG definitions, now importable everywhere
export const leagueNightsIcon = (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <circle cx="10" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="10" cy="10" r="1.5" />
    <circle cx="8.5" cy="12.5" r="1" />
    <circle cx="11.5" cy="12.5" r="1" />
  </svg>
);
// ... etc for all 6 icons
```

### Directory Page Hero Pattern
```tsx
// Reusable hero header pattern for directory pages
<section className="relative overflow-hidden h-36 sm:h-48">
  <ParallaxBg
    src="/village-lanes-panorama.jpg"
    imgW={4032} imgH={3024}
    focalY={0.4}
    mobileSrc="/village-lanes-panorama.jpg"
    mobileFocalY={0.5}
    mobileImgW={4032} mobileImgH={3024}
  />
  <div className="absolute inset-0 bg-gradient-to-r from-navy/80 to-navy/40" />
  <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-6">
    <div>
      <h1 className="font-heading text-3xl sm:text-4xl text-white">Bowlers</h1>
      <p className="font-body text-white/70 text-sm mt-1">
        {count} bowlers across {years} years of Splitzkrieg history
      </p>
    </div>
  </div>
</section>
```

## Design Recommendations (Claude's Discretion Areas)

### Card Grid Layout: Inline pill/chip row (RECOMMENDED)
**Why:** A flex-wrap inline row feels more like a human-curated navigation than a generated grid. It naturally handles different label lengths without forcing uniformity. It takes up less vertical space, letting the real content (results CTA, standings) breathe.

### Icons: SVG from Header.tsx (RECOMMENDED)
**Why:** The custom SVG icons are already designed for this exact context. They match the nav, creating visual coherence. Emoji feel like placeholder decisions. SVGs at `w-4 h-4` in navy/50 feel intentional.

### Directory Hero Treatment: All 3 directories get heroes (RECOMMENDED)
- **Bowlers** -- `village-lanes-panorama.jpg` (wide lanes shot, community feel)
- **Teams** -- `village-lanes-group-photo.jpg` (group/team energy)
- **Seasons** -- `village-lanes-bowl-sign.jpg` or `village-lanes-brunswick-2000s.jpg` (history/legacy)

### AI-Pattern Fixes Beyond Cards
1. **Tagline:** Replace generic tagline with something specific. Example: "Durham's most stat-obsessed bowling league" or reference team names.
2. **Visual rhythm:** The homepage currently has a very even spacing pattern. Consider slightly larger gap before the content grid, or a subtle background color shift.
3. **Hero section:** The logo + tagline + results CTA sequence is good. The tagline just needs voice.

### Performance/A11y Quick Wins
- Add `alt` text to hero photos on directory pages (for screen readers and SEO)
- Ensure parallax heroes have `aria-hidden="true"` on decorative images
- Verify color contrast on white text over photo overlays (navy/80 overlay should be sufficient)
- Add `loading="lazy"` to below-fold images on directory pages

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Uniform card grids | Asymmetric, editorial layouts | Feels authored vs generated |
| Emoji as icons | Custom SVGs or curated icon sets | Feels intentional vs placeholder |
| Descriptive text under every link | Trust the label, let context speak | Less "helpful tooltip" energy |
| Perfect symmetry everywhere | Deliberate asymmetry + visual hierarchy | Feels designed by a person |
| Stock photo backgrounds | Actual venue/community photos | Authenticity is the antidote to "template" |

## Open Questions

1. **Photo focal points:** Each Village Lanes photo needs focal point testing for both desktop and mobile. This requires visual iteration during implementation -- can't be fully planned in advance.
   - What we know: ParallaxBg handles it with `focalY`/`mobileFocalY` props
   - Recommendation: Set initial values, iterate visually during dev

2. **Tagline copy:** The exact tagline replacement needs to feel natural, not forced.
   - What we know: Tone is "Baseball Reference with a wink" -- professional with character
   - Recommendation: Draft 3-4 options during implementation, pick the one that feels most genuine

3. **User photos:** User mentioned supplying additional photos during this phase. Implementation should work with existing photos first, add new ones when supplied.
   - Recommendation: Design with existing 12 photos, treat new photos as enhancement

## Sources

### Primary (HIGH confidence)
- Codebase audit: `src/app/page.tsx`, `Header.tsx`, `ParallaxBg.tsx`, all directory pages and components
- CONTEXT.md locked decisions and code_context section

### Secondary (MEDIUM confidence)
- [Figma - Web Design Trends 2026](https://www.figma.com/resource-library/web-design-trends/) -- asymmetric layouts, intentional design
- [Graphic Design Junction - Web Design Trends 2026](https://graphicdesignjunction.com/2025/12/web-design-trends-of-2026/) -- controlled maximalism, human touch
- [VIVI Creative - Web Design Trends 2025](https://www.vivicreative.com/blog/100/web-design-trends-of-2025-whats-in-whats-surprising-and-what-actually-works) -- anti-template patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already in codebase, zero new dependencies
- Architecture: HIGH -- patterns are established, this is additive polish
- AI-pattern diagnosis: HIGH -- audited source code directly, issues are specific and verifiable
- Design recommendations: MEDIUM -- discretion areas involve subjective judgment, will need visual iteration
- Pitfalls: HIGH -- based on direct codebase knowledge

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable -- no version-sensitive findings)
