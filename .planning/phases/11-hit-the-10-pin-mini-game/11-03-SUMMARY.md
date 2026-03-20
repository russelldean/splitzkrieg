---
phase: 11-hit-the-10-pin-mini-game
plan: 03
subsystem: game
tags: [canvas, pointer-events, physics, matter-js, animation, slingshot]

requires:
  - phase: 11-01
    provides: "SlingshotInput, GameState, Camera modules"
  - phase: 11-02
    provides: "GameEngine with Matter.js physics, VectorRenderer, GameCanvas game loop"
provides:
  - "Playable throw mechanic with drag-aim-release input"
  - "Camera tracking during ball roll"
  - "Lying aim predictor (D-35)"
  - "First-load demo animation with session skip"
  - "Ball-pin collision detection and dynamic pin switching"
affects: [11-04, 11-05, 11-06]

tech-stack:
  added: []
  patterns: ["pointer event handlers with preventDefault for mobile", "sessionStorage for one-time-per-session UI"]

key-files:
  created:
    - src/components/game/AimPredictor.ts
    - src/components/game/DemoAnimation.tsx
  modified:
    - src/components/game/GameCanvas.tsx
    - src/components/game/GameEngine.ts

key-decisions:
  - "Pin switches from static to dynamic when ball is within 100px"
  - "Result phase has 1s delay before reset to idle"
  - "Aim predictor uses 30px miss distance threshold for good/bad classification"

patterns-established:
  - "Lying predictor: pure function returns opposite feedback based on aim quality"
  - "Demo animation: canvas overlay with phase-based timing"

requirements-completed: [D-01, D-02, D-03, D-04, D-06, D-07, D-09, D-13, D-35]

duration: 4min
completed: 2026-03-20
---

# Phase 11 Plan 03: Throw Mechanic Summary

**Slingshot drag-aim-release input with camera tracking, lying aim predictor, and first-load demo animation**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T20:40:05Z
- **Completed:** 2026-03-20T20:44:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Playable throw mechanic: drag back on ball, see aim arrow, release to launch
- Ball rolls with friction/damping, camera follows smoothly up the lane
- Lying aim predictor shows always-wrong feedback during aiming (D-35)
- Pin switches from static to dynamic as ball approaches, collision detection via Matter.Events
- First-load demo animation teaches the drag-release gesture, skippable by tap, plays once per session

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire pointer input and ball launch into game loop** - `6d0b8ed` (feat)
2. **Task 2: First-load demo animation** - `027aa39` (feat)

## Files Created/Modified
- `src/components/game/AimPredictor.ts` - Lying aim feedback: good aim gets discouraging text, bad aim gets encouraging text
- `src/components/game/DemoAnimation.tsx` - 3-second canvas overlay tutorial with hand animation
- `src/components/game/GameCanvas.tsx` - Full input handling, game loop integration, demo overlay rendering
- `src/components/game/GameEngine.ts` - frictionAir, makePinDynamic, collision detection, pin reset

## Decisions Made
- Pin switches from static to dynamic body when ball Y is within 100px of pin Y, preventing accidental physics interactions before the ball arrives
- Result phase uses a 1-second timeout before resetting to idle, giving visual feedback that the throw is complete
- Aim predictor classifies aim as "good" when trajectory would pass within 30px of pin AND direction is toward pin (negative Y)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Throw mechanic fully functional, ready for cheat system integration (Plan 04)
- Pin hit detection working, ready for win/loss flow
- State machine transitions tested through idle -> aiming -> rolling -> result -> idle cycle

---
*Phase: 11-hit-the-10-pin-mini-game*
*Completed: 2026-03-20*
