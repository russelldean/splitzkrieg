---
phase: 6
slug: blog-and-weekly-automation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (if installed) or manual verification via `next dev` |
| **Config file** | none — primarily SSG output verification |
| **Quick run command** | `next dev` + browser check |
| **Full suite command** | `next build` (validates SSG generation) |
| **Estimated runtime** | ~120 seconds (full build) |

---

## Sampling Rate

- **After every task commit:** Run `next dev` and verify affected pages
- **After every plan wave:** Run `next build` to validate SSG
- **Before `/gsd:verify-work`:** Full build must succeed
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | CONT-01 | manual | `next dev` → /blog | N/A | ⬜ pending |
| 06-01-02 | 01 | 1 | CONT-01 | manual | `next dev` → /blog/[slug] | N/A | ⬜ pending |
| 06-02-01 | 02 | 1 | CONT-02 | manual | `next dev` → /blog/season-xxxv-week-4 | N/A | ⬜ pending |
| 06-03-01 | 03 | 2 | SC-04 | script | `node scripts/publish-week.mjs --week=4` | ❌ W0 | ⬜ pending |
| 06-04-01 | 04 | 2 | SC-05 | manual | Review docs/weekly-runbook.md | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers most phase requirements (Next.js SSG, cachedQuery)
- MDX package installation (@next/mdx, @mdx-js/react) needed in Wave 1
- No test framework changes needed — validation is primarily visual/manual for blog content

*Existing infrastructure covers framework requirements. MDX packages are implementation dependencies, not test dependencies.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Blog list renders cards | CONT-01 | Visual layout | Visit /blog, verify card layout with title/date/excerpt |
| Blog post renders MDX | CONT-01 | Content rendering | Visit /blog/[slug], verify stat blocks render correctly |
| Score color coding in blog | CONT-02 | Visual styling | Verify 200+ scores show green, 250+ show gold in stat blocks |
| Bidirectional cross-links | SC-03 | Navigation flow | Click blog→league night and league night→blog links |
| Publish gate controls homepage | SC-04 | Data gating | Change published week, verify homepage updates |
| Email teaser format | SC-05 | Email rendering | Run send script, verify email preview |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions or automated checks
- [ ] Sampling continuity: visual check after each task commit via `next dev`
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
