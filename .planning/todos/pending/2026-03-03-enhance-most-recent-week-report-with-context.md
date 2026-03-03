---
created: 2026-03-03T05:00:00.000Z
title: Enhance most recent week report with context
area: ui
files:
  - src/app/bowler/[slug]/page.tsx
  - src/lib/queries.ts
---

## Problem

The most recent week section on the bowler profile just shows the raw scores. It doesn't tell you how you actually did — were those games good or bad for you? How did you stack up against everyone else that night? There's no emotional payoff or context to make the numbers meaningful.

## Solution

Add several contextual elements to the most recent week report:

1. **Above/below average indicators** — compare each game to the bowler's current rolling average. Mark games above average (green/up arrow?) and below (red/down arrow?). Could also show the delta (e.g., "+12" or "-8").

2. **Weekly rank** — "You ranked 5th of 22 bowlers this week." Query all bowlers who bowled on that matchDate, rank by series or average of the 3 games.

3. **Fun judgment** — an emoji or adjective summarizing the week relative to the bowler's average. Examples:
   - Way above average: "On fire" or a fire emoji
   - Slightly above: "Solid" or thumbs up
   - Right at average: "Steady" or neutral
   - Below average: "Rough night" or grimace
   - Way below: "We don't talk about this one" or skull

   Thresholds TBD — maybe based on percentage deviation from average (e.g., >10% above = "on fire").
