---
created: 2026-03-04T23:33:27.021Z
title: Rules history page with rounding impact story
area: ui
files:
  - docs/standings-comparison.csv
  - scripts/playoff-impact.mjs
  - scripts/generate-standings-comparison-csv.mjs
  - scripts/fix-ghost-team-matches.mjs
---

## Problem

The league has evolved its rules over 35 seasons but there's no page telling that story. One compelling example: when handicap rounding changed from round-up to floor, it created small point differences that in 6 out of 21 division-seasons would have changed which teams made the playoffs.

## Solution

Create a Rules History page that chronicles rule changes across seasons, including:

- Handicap calculation changes (rounding method)
- XP/bonus point bucket rules (XXVI used different rules historically)
- Ghost team / forfeit handling (Bowl'd Peanuts in XXXI/XXXII replaced with ghost team, wins computed by team scratch vs avg-20 threshold)
- Game tie scoring rules
- Playoff qualification (top 2 per division)

Feature the rounding impact analysis as a data story:
- 6/21 divisions had different playoff teams when recomputed
- Pin-Ups Season XXX: 4 extra handicap pins flipped a game result, cost them a playoff spot
- Hot Shotz Season XXXI: dropped 3 points, fell from tied-2nd to 4th
- Include the standings-comparison.csv data as supporting evidence

Reference scripts: `playoff-impact.mjs`, `generate-standings-comparison-csv.mjs`
