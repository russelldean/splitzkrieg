---
name: Phase 11 mini-game - top-down view pivot
description: Game pivoted to top-down only view, perspective code removed from all renderers
type: project
---

## Status
- Pivoted from perspective (down-the-lane) view to top-down only
- All 3 renderers (Vector, Pixel, HandDrawn) converted to flat top-down worldToScreen
- Perspective-specific code removed: PERSPECTIVE_POWER, TOP_WIDTH_RATIO, worldRadiusAtY
- Camera scrolling disabled (commented out in GameCanvas)
- Cheat effects stubbed out (TODO for top-down)
- Cheats disabled in game loop (gated behind `if (false)`)

## What was removed
- Trapezoidal lane rendering (perspective trapezoid -> flat rectangle)
- Y-dependent object scaling (objects no longer shrink near top)
- All 10 cheat effect animations in Pixel and HandDrawn renderers (kept as TODO stubs)

## What still works
- Physics engine (Matter.js, zero gravity, top-down)
- Slingshot aiming input
- Ball launch, gutter detection, pit mechanics
- Pin hit detection (proximity-based)
- Replay system, sound, haptics
- Score card, win celebration, hall of fame
- Debug overlay, recording, pause
- All 3 visual skins (vector/pixel/handdrawn)

## Next steps
- Evaluate if top-down view is fun enough to keep
- Re-implement cheat effects for top-down if proceeding
- DB migration for hall of fame (still needed)
