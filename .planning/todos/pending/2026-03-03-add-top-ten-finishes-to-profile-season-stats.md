---
created: 2026-03-03T04:50:28.551Z
title: Add top-ten finishes to profile season stats
area: ui
files:
  - src/app/bowler/[slug]/page.tsx
  - src/lib/queries.ts
---

## Problem

Season-by-season averages on the bowler profile don't show how the bowler ranked relative to the league that season. Bowlers want to see where they placed — e.g., "3rd of 24" — next to their season average. This adds competitive context that raw averages alone don't convey.

## Solution

Add a query to compute each bowler's rank within their season (likely a RANK() or DENSE_RANK() window function over season averages). Display the finish position next to the season average in the profile's season stats section — something like "185.2 (3rd of 24)".
