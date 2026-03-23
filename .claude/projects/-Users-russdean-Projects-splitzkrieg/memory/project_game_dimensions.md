---
name: Game world dimensions and real bowling proportions
description: Mapping between game world units and real bowling lane measurements, top-down view layout
type: project
---

## Real Bowling Proportions (scaled to 400-unit lane width)
- 1 world unit = 0.105 inches (400 units = 42" real lane width)
- Ball diameter: 82 units (real: 8.6")
- Pin diameter (widest): 44 units (real: 4.7")
- Gutter width: 88 units (real: 9.25")

## World Layout (top-down, Y axis)
- Y=1200: Ball start position (LANE_LENGTH)
- Y=1100: Ball launch position (LANE_LENGTH - 100)
- Y=1040: Foul line (LANE_LENGTH - 160)
- Y=800: Second arrow markers (2/3 lane)
- Y=400: First arrow markers (1/3 lane)
- Y=5: 10-pin position (PIN_Y)
- Y=0: Lane surface ends, pit begins
- Y=-80: Back wall (PIT_DEPTH)

## Current GAME_CONSTANTS
- LANE_WIDTH: 400
- LANE_LENGTH: 1200 (stretched for top-down, real ratio would be ~6800)
- BALL_RADIUS: 41
- PIN_RADIUS: 22
- GUTTER_WIDTH: 88
- PIT_DEPTH: 80
- PIN_Y: 5
- MAX_VELOCITY: 25

## View System
- **Top-down only** (perspective view shelved)
- All 3 renderers (Vector, Pixel, HandDrawn) use the same worldToScreen:
  - TOTAL_WIDTH = 576 (lane + 2 gutters)
  - TOTAL_HEIGHT = 1340 (pit + lane + margin)
  - SCALE ~= 0.60 (fit into ~500x832 canvas)
  - No perspective distortion, no Y-dependent object scaling

## 10-Pin Position
- X: LANE_WIDTH - PIN_RADIUS - 1 = 377
- Y: 5 (just before pit edge)
