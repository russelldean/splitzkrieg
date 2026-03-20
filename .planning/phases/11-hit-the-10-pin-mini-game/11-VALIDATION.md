---
phase: 11
slug: hit-the-10-pin-mini-game
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.0.18 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| Slingshot input | TBD | TBD | D-01/D-03/D-04 | unit | `npx vitest run src/components/game/__tests__/SlingshotInput.test.ts` | ❌ W0 | ⬜ pending |
| Cheat system | TBD | TBD | D-11/D-14/D-15 | unit | `npx vitest run src/components/game/__tests__/CheatSystem.test.ts` | ❌ W0 | ⬜ pending |
| Game state machine | TBD | TBD | D-17 | unit | `npx vitest run src/components/game/__tests__/GameState.test.ts` | ❌ W0 | ⬜ pending |
| Hall of Fame API | TBD | TBD | D-20 | integration | `npx vitest run src/app/api/game/__tests__/hall-of-fame.test.ts` | ❌ W0 | ⬜ pending |
| Camera tracking | TBD | TBD | D-07 | unit | `npx vitest run src/components/game/__tests__/Camera.test.ts` | ❌ W0 | ⬜ pending |
| Replay system | TBD | TBD | D-08 | unit | `npx vitest run src/components/game/__tests__/ReplaySystem.test.ts` | ❌ W0 | ⬜ pending |
| Renderer interface | TBD | TBD | D-22/D-24 | unit | `npx vitest run src/components/game/__tests__/VectorRenderer.test.ts` | ❌ W0 | ⬜ pending |
| Score card | TBD | TBD | D-18/D-19 | manual-only | Visual inspection | N/A | ⬜ pending |
| Canvas rendering | TBD | TBD | D-22/D-25 | manual-only | Visual inspection | N/A | ⬜ pending |
| Sound effects | TBD | TBD | D-10 | manual-only | Browser testing | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/game/__tests__/SlingshotInput.test.ts` -- slingshot vector math
- [ ] `src/components/game/__tests__/CheatSystem.test.ts` -- tier advancement, random selection
- [ ] `src/components/game/__tests__/GameState.test.ts` -- state machine transitions, win probability
- [ ] `src/components/game/__tests__/Camera.test.ts` -- camera tracking
- [ ] `src/components/game/__tests__/ReplaySystem.test.ts` -- frame recording/playback
- [ ] `src/app/api/game/__tests__/hall-of-fame.test.ts` -- API endpoint tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Score card display | D-18/D-19 | Visual layout quality | Load results page, verify attempt count and cheats list render correctly |
| Isometric lane rendering | D-22/D-25 | Visual perspective quality | Load game page, verify lane narrows toward pin with correct bowling alley palette |
| Sound effects playback | D-10 | Requires audio hardware + browser | Play game, verify ball roll, impact, cheat, and fanfare sounds trigger at correct moments |
| Haptic feedback | D-10 | Requires Android device | Test on Android Chrome, verify vibration on release and impact |
| Cheat animation quality | D-14/D-16 | Visual/comedic quality | Play through all tiers, verify animations are smooth and captions are readable |
| Slow-mo replay | D-08 | Visual timing quality | Trigger replay after cheat, verify smooth slow-motion with caption overlay |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
