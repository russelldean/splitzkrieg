---
phase: 12
slug: navigation-and-discoverability-overhaul
status: draft
nyquist_compliant: true
created: 2026-03-24
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via vitest.config.ts) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`
- **After every plan wave:** Run `npx vitest run` + manual browser check on `next dev`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

Each task has an `<automated>` verify command using grep-based checks (file existence, expected patterns, correct event names). These provide immediate automated feedback without requiring dedicated test files.

| Task ID | Plan | Wave | Requirement | Automated Command | Status |
|---------|------|------|-------------|-------------------|--------|
| 12-01-01 | 01 | 1 | D-07, D-12, D-13 | `grep -n "exit_ramp_clicked" src/components/tracking/ExitRamp.tsx && grep -n "section_viewed" src/components/tracking/TrackVisibility.tsx` | ⬜ pending |
| 12-01-02 | 01 | 1 | D-07 | `node -e` script checking YouAreAStar line < AverageProgressionChart line + TrackVisibility count >= 6 | ⬜ pending |
| 12-02-01 | 02 | 2 | D-01, D-02, D-05 | `ls -la` on 4 component files + `grep -l "export"` on each | ⬜ pending |
| 12-02-02 | 02 | 2 | D-01, D-02, D-03 | `node -e` script checking ExitRamp, RecapCallout, DiscoverySection imports + no ExploreLink | ⬜ pending |
| 12-03-01 | 03 | 2 | D-08, D-19 | `grep -n "next_stop_clicked" src/components/ui/NextStopNudge.tsx && grep -n "Keep exploring"` | ⬜ pending |
| 12-03-02 | 03 | 2 | D-21, D-22 | `grep -rn "NextStopNudge" src/app/week/ src/app/season/ src/app/stats/ src/app/milestones/` | ⬜ pending |
| 12-04-01 | 04 | 3 | D-15, D-16, D-09 | `grep -n "bullet" scripts/send-recap-email.mjs && grep -n "SiteUpdates" src/app/blog/page.tsx` | ⬜ pending |
| 12-04-02 | 04 | 3 | D-14, D-23 | Visual checkpoint (human-verify) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scroll depth tracking fires on key pages | D-11 | PostHog SDK auto-captures via $pageleave | Check PostHog dashboard for scroll_depth property on $pageleave events |
| Click tracking on discovery elements | D-12 | Custom events require browser interaction | Click exit ramps, NextStopNudge, discovery links; verify events in PostHog live view |
| Recap condensed format readable on mobile | D-23 | Visual layout, dark environment readability | Open on phone in dark room, verify tap targets and text legibility |
| Bowler profile section reorder | D-07 | Layout order is visual | Load bowler profile, verify achievements/nightly profile appear above season cards |
| Updates feed surfaced prominently | D-09 | Placement is visual/UX | Verify updates feed is accessible without navigating to Extras menu |
| PostHog tracking data accumulating | D-14 | Requires production deployment + time | Confirm events appear in PostHog live view after using site; establish baseline before next phase |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands (grep-based pattern checks)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No Wave 0 test file dependencies required
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
