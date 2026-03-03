---
created: 2026-03-03T04:50:28.551Z
title: Collapsible season sections on profile page
area: ui
files:
  - src/app/bowler/[slug]/page.tsx
---

## Problem

The profile page lists every season a bowler has participated in. For long-tenured bowlers this creates a very long page. If someone expands old seasons to browse history, they then have to scroll a long way to get back to other sections. The page needs a way to collapse seasons the user is done looking at.

## Solution

Make each season section collapsible (accordion-style). Could default to most recent 2-3 seasons expanded, older ones collapsed. Use a `<details>`/`<summary>` or a client-side toggle component. Consider a "collapse all" / "expand all" control as well.
