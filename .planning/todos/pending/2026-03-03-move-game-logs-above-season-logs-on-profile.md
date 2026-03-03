---
created: 2026-03-03T04:50:28.551Z
title: Move game logs above season logs on profile
area: ui
files:
  - src/app/bowler/[slug]/page.tsx
---

## Problem

Game logs are updated more frequently than season summaries (every bowling night vs. end of season). Currently season logs appear before game logs on the profile page. Since game logs are the most actively updated content, they should appear higher on the page so bowlers see their latest activity first.

## Solution

Reorder the profile page sections to put game logs above season logs. Simple layout change in page.tsx — swap the section render order.
