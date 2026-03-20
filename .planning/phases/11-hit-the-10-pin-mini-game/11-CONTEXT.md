# Phase 11: Hit the 10 Pin Mini-Game - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

An interactive bowling mini-game where the player tries to convert a 10-pin spare. The twist: it's rigged to be impossible (with an astronomically rare ~1-in-1000 win chance). The game cheats with increasingly absurd interventions. The fun is in the escalating ridiculousness, shareable results, and the rare legendary win.

</domain>

<decisions>
## Implementation Decisions

### Throw Mechanic
- **D-01:** Drag-and-release slingshot mechanic (like Angry Birds). Pull back on the ball, aim, release.
- **D-02:** Short direction arrow shows initial aim direction only (not full predicted path). Player isn't sure if they missed or got cheated.
- **D-03:** Slight curve based on release angle. Dragging slightly off-center during release hooks the ball. Adds skill element real bowlers appreciate.
- **D-04:** Pull-back distance determines power IF not too complex to implement. Otherwise fixed power, aim only. Claude's discretion on complexity call.
- **D-05:** Semi-realistic ball physics. Ball rolls with believable weight and friction. Makes cheat moments more jarring and funny by contrast.
- **D-06:** Instant release on let-go. Snappy, responsive. No wind-up animation.
- **D-07:** Camera tracks the ball down the lane if achievable without major work. Fall back to fixed view if too complex.
- **D-08:** Optional slow-mo replay after each cheat with a funny caption explaining what happened. Player taps to dismiss.
- **D-09:** Animated demo on first load (2-3 seconds showing a hand pulling back and releasing) before player starts.
- **D-10:** Sound effects + haptic vibration feedback. Ball rolling, pin clatter/woosh, cheat sounds, buzz on release and impact (Android vibration API).

### Cheat Escalation
- **D-11:** Random cheats drawn from tiered pools of escalating absurdity. Game picks randomly within current tier, advances tiers after every 2-3 throws.
- **D-12:** Claude's discretion on number of tiers. Fast escalation (2-3 throws per tier).
- **D-13:** Early throws (tier 1) feature near-misses. Ball grazes past, pin wobbles but doesn't fall. Builds frustration that makes later cheats funnier.
- **D-14:** Three categories of cheats: physics cheats (ball curves impossibly, gutter widens, lane tilts), character interruptions (cat walks across, janitor sweeps pin, hand from gutter, pigeon), and bowling-specific comedy (wrong pin set drops, 7-10 split appears, pin machine scoops ball, another bowler's ball invades). NO reality-breaking cheats (no black holes, teleporting, etc).
- **D-15:** Start with 10 unique cheat animations. Architecture must support adding more later without major refactoring.
- **D-16:** Every cheat gets a funny one-liner caption during or after it plays. E.g., "The lane seems... wider than before" or "Sir, this is a bowling alley."
- **D-17:** Astronomically rare win chance (~1 in 1000). When it happens: confetti explosion, screen shakes, disbelief text ("WAIT... DID YOU JUST...?!"). Then a name prompt for the Hall of Fame.

### Score Card & Sharing
- **D-18:** Score-based end state after a set number of attempts. Shows a branded Splitzkrieg score card with attempt count and laundry list of cheats encountered (no closest-shot distance).
- **D-19:** Styled HTML results page with screenshot prompt (not server-generated OG image). Simple, no image generation API needed.
- **D-20:** Winners Hall of Fame. When someone hits the rare win, prompt for a name. Track winners on a public list ("1 of 7 humans to ever hit the 10 pin"). Needs a lightweight persistence mechanism (API route or external service).
- **D-21:** Local leaderboard in localStorage for personal best attempt count.

### Visual Style
- **D-22:** Angled/isometric perspective. Elevated view with depth, lane narrows toward the pin. Retro sports game feel.
- **D-23:** Clean vector/flat design as the default (built first). Matches modern web aesthetics, easy to animate with SVG/CSS.
- **D-24:** Multiple art style skins: vector (default), pixel art, and hand-drawn. Visible toggle/menu to switch. Architecture must separate game logic from visual rendering to support this.
- **D-25:** Bowling alley color palette (polished wood lane, dark gutters, white pin). NOT the site's cream/navy/red palette.
- **D-26:** Portrait orientation (mobile-first). Lane runs vertically. Desktop gets a centered vertical strip.
- **D-27:** Lane only against a dark background. No bowling alley environment. Cheats are more visually striking against the void.
- **D-28:** Claude's discretion on animation approach (sprite-based vs procedural vs hybrid) based on rendering tech chosen.

### Where It Lives
- **D-29:** Multiple entry points. Primary home at /game route. Also triggered from 404 page easter egg.
- **D-30:** In the main nav bar alongside Bowlers, Teams, Seasons. First-class site feature.
- **D-31:** 404 easter egg: the 404 page shows a single lonely 10 pin with a wobble animation. Clicking/tapping it launches/navigates to the game.
- **D-32:** Minimal chrome on the game page. Small Splitzkrieg logo in the corner. Game takes up most of the viewport. No full nav/footer.
- **D-33:** Completely standalone. No connection to bowler profiles, scores, or league data.

### Admin Mode
- **D-34:** Secret admin mode where the game is rigged TO win (always hits the pin). Accessible when logged in as admin or via a secret URL parameter/code. For demo purposes, showing off to league members, or just having fun as the commissioner.

### Claude's Discretion
- Starting ball position (fixed center vs draggable left/right)
- Number of absurdity tiers and exact pacing
- Animation approach (sprite-based, procedural, or hybrid)
- Physics engine / rendering technology choice
- How to implement the ~1-in-1000 win mechanic
- Persistence approach for the winners Hall of Fame
- Number of attempts before showing the score card
- Slow-mo replay implementation details
- How admin mode is activated (admin auth check, secret URL param, Konami code, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs -- requirements fully captured in decisions above.

### Existing code patterns
- `src/components/home/CountdownClock.tsx` -- Most complex client-side interaction in the codebase. Phase-based state machine with animations. Reference for client-side interactivity patterns.
- `src/components/ui/` -- Existing UI component library (EmptyState, icons, PatchBadge, etc.)
- `src/app/layout.tsx` -- Root layout for understanding how to add nav items and minimal-chrome pages

### Ideas reference
- `memory/ideas.md` lines 18-27 -- Original game concept and Mobile Device API notes (DeviceMotion, DeviceOrientation, Vibration API, Web Audio)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CountdownClock.tsx`: Phase-based state machine pattern (countdown/final/takeover/bowling/results/past) -- model for game state management
- `PageTransition.tsx`: Existing page transition animations
- `ParallaxBg.tsx`: Background effects pattern
- `StrikeX.tsx`: Bowling-themed visual component
- `icons.tsx`: SVG icon system -- could extend for game assets
- `EmptyState.tsx`: Empty state pattern -- reference for 404 page redesign

### Established Patterns
- Tailwind CSS for all styling
- Client components use 'use client' directive
- SVG-based graphics (Recharts charts, icon system)
- No canvas or WebGL usage anywhere in the codebase -- this will be the first

### Integration Points
- `src/app/` -- New /game route needed
- Nav components (`DesktopNav.tsx`, `MobileNav.tsx`, `HomeNavBar.tsx`) -- Add game link
- 404 page (likely `src/app/not-found.tsx`) -- Add wobbling pin easter egg

</code_context>

<specifics>
## Specific Ideas

- The game is fundamentally a comedy product. The throw mechanic should feel good enough to make the player THINK they can win, but the cheats are the star.
- Near-misses in early tiers are critical for the emotional arc: hope, frustration, disbelief, laughter.
- The slow-mo replay with captions is where the comedy writing lives. Each cheat caption should be genuinely funny.
- The winners Hall of Fame creates a community moment -- league members will talk about who hit it.
- Multiple art skins (vector/pixel/hand-drawn) showcase technical range for the portfolio. Start with vector, add others iteratively.
- Portrait mobile-first means the lane runs top-to-bottom, ball at bottom, pin at top.

</specifics>

<deferred>
## Deferred Ideas

- DeviceMotion throw gesture as an alternate input mode (from ideas.md) -- could be a future skin/mode
- DeviceOrientation tilt parallax effects on the lane
- Global leaderboard for attempt counts (currently just local + winners list)
- Generated OG image for richer social sharing
- Connection to bowler data (personalized flavor text, logged-in names)
- Additional art skins beyond the initial three

</deferred>

---

*Phase: 11-hit-the-10-pin-mini-game*
*Context gathered: 2026-03-20*
