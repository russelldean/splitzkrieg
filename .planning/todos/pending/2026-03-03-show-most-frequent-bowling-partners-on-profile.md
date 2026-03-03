---
created: 2026-03-03T04:55:00.000Z
title: Show most frequent bowling partners on profile
area: ui
files:
  - src/app/bowler/[slug]/page.tsx
  - src/lib/queries.ts
---

## Problem

Bowlers want to see who they've shared the most nights with — their most frequent teammates/opponents over the years. This is a social/nostalgia feature that adds depth to the profile. The data exists in the scores table (bowlers who bowled on the same matchDate share a night together).

## Solution

Query scores table to find bowlers who appeared on the same matchDate most frequently. Could be framed as "Most Nights Together" — a simple COUNT of shared matchDates grouped by partner bowlerID. Display as a small section on the profile, e.g., top 5 partners with count ("Joe Smith — 127 nights"). Links to their profiles. Could also distinguish teammates vs. opponents if team data is reliable enough.
