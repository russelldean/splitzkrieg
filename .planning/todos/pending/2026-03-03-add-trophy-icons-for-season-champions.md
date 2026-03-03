---
created: 2026-03-03T04:50:28.551Z
title: Add trophy icons for season champions
area: ui
files:
  - src/app/bowler/[slug]/page.tsx
  - src/lib/queries.ts
---

## Problem

Individual season champions aren't visually celebrated on the profile page. If a bowler won their season (highest average, playoff winner, etc.), there's no indication of that achievement. Trophies or icons next to championship seasons would add pride and recognition.

## Solution

Query seasonChampions table (currently empty — needs data backfill first) or derive from highest season average. Display a trophy icon next to seasons where the bowler was champion. May depend on data availability — the seasonChampions table is currently empty per known data gaps.
