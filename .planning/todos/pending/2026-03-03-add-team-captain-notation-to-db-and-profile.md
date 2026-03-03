---
created: 2026-03-03T05:05:00.000Z
title: Add team captain notation to DB and profile
area: database
files:
  - src/app/bowler/[slug]/page.tsx
  - src/lib/queries.ts
---

## Problem

There's no way to identify team captains in the database or on the site. Captains put in extra work organizing their teams and deserve recognition. This data doesn't currently exist in any table.

## Solution

Two parts:

1. **Database** — add a captain flag or role to the appropriate table. Could be a boolean `isCaptain` on a roster/team-members table, or a separate `teamCaptains` table mapping bowlerID + seasonID + teamID. Need to figure out the right schema since captain status can change season to season.

2. **Site** — display captain notation on the bowler profile (e.g., a "C" badge or "Captain" label near their name/team). Could also show on team pages once those are built out. Historical captain data would need to be sourced/entered manually.
