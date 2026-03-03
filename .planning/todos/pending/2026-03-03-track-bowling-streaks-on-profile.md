---
created: 2026-03-03T05:05:00.000Z
title: Track bowling streaks on profile
area: ui
files:
  - src/app/bowler/[slug]/page.tsx
  - src/lib/queries.ts
---

## Problem

There's no way to see streaks — consecutive bowling nights attended, consecutive team wins, etc. Streaks are a fun competitive stat that adds engagement and bragging rights. Bowlers want to know their current streak and their personal best streak.

## Solution

Add a streaks section to the bowler profile. Potential streaks to track:

1. **Consecutive bowling nights** — most matchDates in a row without missing a week. Show current streak and all-time best. Requires checking for gaps in matchDate sequences per bowler.

2. **Consecutive team wins** — longest run of team wins in a row. Depends on matchResults data (currently empty — may need backfill first).

3. **Possible others** — consecutive games above average, consecutive 200+ games, consecutive weeks improving average, etc.

Query approach: order a bowler's scores by matchDate, detect consecutive sequences. For team wins, need matchResults data populated. Could be computed at build time since it's deterministic from historical data.
