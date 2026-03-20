# Phase 11: Hit the 10 Pin Mini-Game - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-03-20
**Phase:** 11-hit-the-10-pin-mini-game
**Areas discussed:** Throw mechanic, Cheat escalation, Visual style, Where it lives

---

## Throw Mechanic

| Option | Description | Selected |
|--------|-------------|----------|
| Drag-and-release slingshot | Pull back, aim trajectory, release. Like Angry Birds. Works mobile + desktop. | ✓ |
| Swipe/flick gesture | Swipe up to throw. Natural bowling feel but awkward on desktop. | |
| DeviceMotion throw | Physical swing gesture. Wow factor but iOS permission, no desktop equivalent. | |
| Tap-timing power meter | Aim left/right, tap to stop power bar. Classic golf game mechanic. | |

**User's choice:** Drag-and-release slingshot
**Notes:** Intuitive, works on both platforms

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full predicted path | Dotted line shows full arc. Makes cheats funnier ("I aimed perfectly!") | |
| Short direction arrow | Only initial direction. Adds uncertainty about skill vs sabotage. | ✓ |
| No trajectory line | Pure feel. Harder to tell if game cheated. | |

**User's choice:** Short direction arrow

---

| Option | Description | Selected |
|--------|-------------|----------|
| No spin, straight only | Simpler. Focus on comedy over controls. | |
| Slight curve on release angle | Off-center drag hooks the ball. Skill element bowlers appreciate. | ✓ |
| Spin control (drag sideways) | Separate spin gesture. Realistic but fiddly. | |

**User's choice:** Slight curve based on release angle

---

| Option | Description | Selected |
|--------|-------------|----------|
| Pull-back distance = power | Further drag = harder throw. Intuitive slingshot feel. | ✓ (preferred) |
| Fixed power, aim only | Same speed always. Fewer variables. | (fallback) |
| Speed based on release velocity | Flick speed = power. Dynamic but harder to control. | |

**User's choice:** Pull-back distance if not too complex, otherwise fixed power

---

| Option | Description | Selected |
|--------|-------------|----------|
| Semi-realistic | Believable weight/friction. Cheat moments jarring by contrast. | ✓ |
| Cartoony/exaggerated | Bouncy, exaggerated before cheats. Comedy tone from throw 1. | |
| You decide | | |

**User's choice:** Semi-realistic

---

| Option | Description | Selected |
|--------|-------------|----------|
| Learn by doing | First throw IS the tutorial. | |
| One-line hint | Small text hint, disappears after first throw. | |
| Animated demo | 2-3 second animation of hand pulling back and releasing. | ✓ |

**User's choice:** Animated demo

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed center position | Always starts same spot. Simple. | |
| Draggable starting position | Slide ball left/right before throwing. Strategy element. | |
| You decide | | ✓ |

**User's choice:** Claude's discretion

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sound effects only | Ball rolling, pin clatter, cheat sounds. No vibration. | |
| Sound + vibration | Haptic buzz on release and impact. Android Vibration API. | ✓ |
| Silent by default | No sound unless enabled. Respect public players. | |

**User's choice:** Sound + vibration

---

| Option | Description | Selected |
|--------|-------------|----------|
| Instant release | Ball launches on let-go. Snappy. | ✓ |
| Brief wind-up animation | 0.3-0.5s acceleration after release. Adds weight. | |
| You decide | | |

**User's choice:** Instant release

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed top-down view | See whole lane at once. Simple. | (fallback) |
| Camera tracks the ball | View follows ball down lane. Cinematic, builds tension. | ✓ (preferred) |
| You decide | | |

**User's choice:** Camera tracking if feasible, fixed view as fallback

---

| Option | Description | Selected |
|--------|-------------|----------|
| No replay, real-time only | See cheats live. Fast pace. | |
| Optional slow-mo replay | Slo-mo with funny caption after each cheat. Tap to dismiss. | ✓ |
| You decide | | |

**User's choice:** Optional slow-mo replay

---

## Cheat Escalation

| Option | Description | Selected |
|--------|-------------|----------|
| Scripted sequence | Fixed order. Same escalation for everyone. Easier comedic arc. | |
| Random from tiered pools | Bucketed by absurdity. Random within tier, advance after N throws. | ✓ |
| Hybrid: scripted milestones + random fill | Key moments scripted, random between. | |

**User's choice:** Random from tiered pools

---

| Option | Description | Selected |
|--------|-------------|----------|
| 3 tiers | Subtle, obvious, absurd. | |
| 4 tiers | Subtle, suspicious, ridiculous, cosmic. More gradual. | |
| You decide | | ✓ |

**User's choice:** Claude's discretion on tier count

---

| Option | Description | Selected |
|--------|-------------|----------|
| Every 2-3 throws | Fast escalation. Full range in ~10 throws. | ✓ |
| Every 4-5 throws | Slower burn. ~15-20 throws for everything. | |
| You decide | | |

**User's choice:** Every 2-3 throws

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, near misses are key | First throws almost hit. Pin wobbles. Builds frustration. | ✓ |
| No, always clear miss | Subtle cheats still clearly deflect. Player knows from throw 1. | |
| Mix of both | Some near misses, some clear. Keeps guessing. | |

**User's choice:** Yes, near misses are key

---

| Option | Description | Selected |
|--------|-------------|----------|
| Physics cheats | Ball curves, gutter widens, lane tilts, invisible bumper, ball slows. | ✓ |
| Character interruptions | Cat, janitor, hand from gutter, pigeon. | ✓ |
| Reality-breaking | Pin grows legs, black hole, teleporting, watermelon ball. | |
| Bowling-specific comedy | Wrong pin set, 7-10 split appears, pin machine scoops ball. | ✓ |

**User's choice:** Physics cheats, character interruptions, bowling-specific comedy. NO reality-breaking.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Branded card with attempt count + cheats list | Splitzkrieg branding, attempts, laundry list of cheats. OG shareable. | ✓ (modified) |
| Attempt count + closest shot | Emphasizes near-miss frustration. | |
| Both + branded card | Full card with all stats. | |

**User's choice:** Branded card with attempt count and laundry list of cheats. No closest-shot distance.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, every cheat gets a caption | One-liner during or after each cheat. | ✓ |
| Only on replay | Captions in slo-mo only. | |
| No captions | Visual comedy only. | |

**User's choice:** Every cheat gets a caption

---

**User's choice on leaderboard:** Track winners only (the ~1-in-1000 hits), not general attempt counts globally.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Confetti + disbelief text | Explosion, shaking, "WAIT... DID YOU JUST...?!" | ✓ |
| Understated anticlimactic | Pin falls quietly. "...huh." Then slow confetti. | |
| You decide | | |

**User's choice:** Confetti + disbelief text

---

| Option | Description | Selected |
|--------|-------------|----------|
| Name prompt on win | "Enter your name for the Hall of Fame" | ✓ |
| Anonymous count only | Just increment counter, no names. | |
| Optional name | Prompt but allow skip. | |

**User's choice:** Name prompt on win

---

| Option | Description | Selected |
|--------|-------------|----------|
| 8-10 unique cheats | Manageable scope. ~3 per tier. | |
| 15-20 unique cheats | More variety, more work. | |
| You decide | | |

**User's choice:** Start with 10, architecture supports adding more later.

---

## Visual Style

| Option | Description | Selected |
|--------|-------------|----------|
| Top-down (bird's eye) | Flat rectangle. Simplest. | |
| Angled/isometric | Elevated angle with depth. Lane narrows toward pin. | ✓ |
| Behind-the-bowler | Looking down the lane. Most immersive, hardest. | |

**User's choice:** Angled/isometric

---

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-drawn/sketchy | Loose, illustrated. Napkin doodles. | (future skin) |
| Clean vector/flat | Crisp shapes, solid colors. Google Doodle style. | ✓ (default) |
| Pixel art / retro | 8/16-bit. Nostalgic arcade. | (future skin) |
| Semi-realistic | Realistic lane, cartoony cheats. | |

**User's choice:** ALL THREE as switchable skins (no semi-realistic). Vector is default, built first. Visible toggle to switch.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Site palette (cream/navy/red) | Integrated with Splitzkrieg brand. | |
| Bowling alley palette | Polished wood, dark gutters, white pin. | ✓ |
| Each skin own palette | Part of what makes skins distinct. | |

**User's choice:** Bowling alley palette

---

| Option | Description | Selected |
|--------|-------------|----------|
| Portrait (mobile-first) | Lane vertical. Natural phone hold. Desktop centered strip. | ✓ |
| Landscape | Lane horizontal. Better desktop, phone must rotate. | |
| Responsive (adapts) | Portrait on mobile, landscape on desktop. | |

**User's choice:** Portrait (mobile-first)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sprite-based | Pre-drawn frames. Higher quality, more assets per cheat. | |
| Procedural/code-driven | CSS/JS tweens. Easier to add cheats, limited expression. | |
| Hybrid | Core procedural, cheat characters sprite-based. | |
| You decide | | ✓ |

**User's choice:** Claude's discretion based on rendering tech

---

| Option | Description | Selected |
|--------|-------------|----------|
| Lane only, dark background | Focus on lane. Cheats striking against void. | ✓ |
| Bowling alley atmosphere | Seats, other lanes. Immersive but more art. | |
| Minimal hints | Gutter edges, foul line, arrows. Grounded. | |

**User's choice:** Lane only, dark background

---

| Option | Description | Selected |
|--------|-------------|----------|
| Generated OG image | Server-rendered. Rich social previews. Needs API route. | |
| Styled HTML page | Pretty results page. Users screenshot. Simpler. | ✓ |
| Both | HTML + OG image. Best sharing, more work. | |

**User's choice:** Styled HTML page with screenshot prompt

---

| Option | Description | Selected |
|--------|-------------|----------|
| Visible toggle/menu | Clear UI to switch skins. | ✓ |
| Unlockable skins | Earn skins by playing. 10 attempts = pixel, 25 = hand-drawn. | |
| You decide | | |

**User's choice:** Visible toggle/menu

---

## Where It Lives

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone /game | Dedicated route. Linked from nav. | |
| Easter egg on 404 | Bad URL triggers game. | |
| Hidden on existing page | Konami code, secret link. | |
| Multiple entry points | Primary at /game + 404 easter egg + other triggers. | ✓ |

**User's choice:** Multiple entry points

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, in nav bar | Full nav link. First-class feature. | ✓ |
| Footer link only | Subtle. Doesn't compete with stats nav. | |
| No nav link | Direct URL/easter egg only. Word of mouth. | |

**User's choice:** Yes, in the nav bar

---

| Option | Description | Selected |
|--------|-------------|----------|
| Completely standalone | No bowler/league data connection. Pure fun. | ✓ |
| Light flavor text | Cheat captions reference real bowlers from DB. | |
| Personalized if logged in | Use logged-in name. | |

**User's choice:** Completely standalone

---

| Option | Description | Selected |
|--------|-------------|----------|
| Replace 404 entirely | Bad URL = you're playing now. | |
| 404 with game invite | Normal 404 + prominent game button. | |
| Animated pin on 404 | Lonely wobbling pin. Click to launch game. | ✓ |

**User's choice:** Animated wobbling pin on 404

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full site chrome | Normal header/nav/footer. Game in a component. | |
| Minimal chrome | Small Splitzkrieg logo corner. Game fills viewport. | ✓ |
| No chrome, full immersion | No nav/footer. X to return. | |

**User's choice:** Minimal chrome

---

## Claude's Discretion

- Starting ball position (fixed center vs draggable)
- Number of absurdity tiers and exact pacing
- Animation approach (sprite/procedural/hybrid)
- Physics engine / rendering technology
- Win mechanic implementation (~1-in-1000)
- Persistence for winners Hall of Fame
- Attempt count before score card
- Slow-mo replay details

## Deferred Ideas

- DeviceMotion throw gesture as alternate input
- DeviceOrientation tilt parallax on lane
- Global attempt count leaderboard
- Generated OG image for sharing
- Connection to bowler data
- Additional art skins beyond initial three
