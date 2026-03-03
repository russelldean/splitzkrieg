---
created: 2026-03-03T04:50:28.551Z
title: Show current team name near bowler name
area: ui
files:
  - src/app/bowler/[slug]/page.tsx
  - src/lib/queries.ts
---

## Problem

Bowlers are proud of their teams, but the profile page doesn't show team affiliation near the bowler's name. People identify with their team and want to see it prominently. Challenge: the DB only has current franchise names (no per-season team names), so some inference may be needed — e.g., showing the franchise name the bowler most recently bowled for.

## Solution

Query the bowler's most recent team/franchise from scores or roster data. Display it as a subtitle under the bowler name (e.g., "Leo DeLuca — Team Strikeforce"). Note: only current franchise name is available, not historical per-season team names. May need to infer from most recent season's team assignment.
