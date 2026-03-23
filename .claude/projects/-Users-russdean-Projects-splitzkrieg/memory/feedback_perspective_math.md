---
name: Perspective view shelved - top-down only
description: Game uses flat top-down view now, perspective code was removed. This memory is historical context only.
type: feedback
---

The game originally used a perspective (down-the-lane) view with `PERSPECTIVE_POWER=2.5` that made Y positioning extremely non-linear. This was shelved in favor of a flat top-down view where worldToScreen is a simple linear scale.

**Why:** Perspective math was a constant source of positioning bugs and wasted time. The top-down pivot simplified all renderers to use a single linear worldToScreen function.

**How to apply:**
- All renderers now use flat linear mapping: `screenX = (worldX + GUTTER_WIDTH) * SCALE`, `screenY = (worldY + PIT_DEPTH) * SCALE`
- Object sizes are uniform (no Y-dependent scaling)
- If perspective is ever revisited, refer to git history for the old `worldRadiusAtY` and perspective `worldToScreen` implementations
