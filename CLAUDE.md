# Claude Code Instructions — Splitzkrieg

## Architecture

- **Static site** — Next.js with build-time Azure SQL data fetching. Visitors never hit the DB.
- **Azure SQL** — Provisioned tier (not serverless). 30 concurrent request limit.
- All SQL queries live in `src/lib/queries/` (split by domain). Components never use raw SQL.
- `scores` table has computed columns (hcpGame1/2/3, handSeries, incomingHcp, scratchSeries) — never INSERT these.
- DB schema documented in `memory/db-schema.md` — ALWAYS check before writing raw SQL.
- Vercel auto-deploys on push to main.

## Cache System — FOLLOW THIS EXACTLY

The #1 source of bugs and wasted time. Full details in `memory/caching.md` and `memory/feedback_cache_rules.md`.

- All ~55 query functions use `cachedQuery()` — disk cache in `.next/cache/sql/`
- `cachedQuery()` hashes the SQL string (MD5) into the cache key
- Per-season data versions in `.data-versions.json` — included in hash
- Import scripts auto-bump `.data-versions.json` — no manual cache work needed
- Run `node scripts/check-cache-invariants.mjs` before pushing query changes

### NEVER DO THESE
- **NEVER** use `vercel --prod --force` — nukes ALL cache, causes 15+ minute full rebuilds
- **NEVER** bump `DB_CACHE_VERSION` — same effect as force, full rebuild
- **NEVER** add `/* vN */` comments to queries used by `generateStaticParams`
- **NEVER** mark a query `stable: true` if it reads from a mutable table
- **NEVER** bust >20 query caches in one deploy (Azure SQL 30-connection limit)
- **NEVER** ship unrelated code changes during publish-week — see Publish-Week Discipline below

## Publish-Week Discipline

When Russ runs publish-week (admin button at /evillair, or `scripts/fix-rebuild.mjs` plus a publish marker), only the publish marker should ride that deploy. **Do NOT bundle unrelated code changes** — bug fixes, query tweaks, feature work — into the same window. They wait until the next day.

A publish-week deploy already busts ~80 bowler page caches + the current season's queries. Adding a SQL hash change in any cross-season query (e.g. `getSeasonStandings`, `getSeasonWeeklyScores`) will cascade to all 35 seasons rebuilding simultaneously, which will overrun Azure SQL's 30-connection cap and crash the build. Reference: 2026-05-05 incident — standings tiebreaker fix shipped mid-publish, two consecutive builds died at the connection limit, took ~90 minutes to recover.

If Russ is mid-publish and wants to land an unrelated fix, push back: "Let's land that tomorrow once the publish has settled."

## Data Fix Cascade — FOLLOW EVERY TIME

Full checklist in `memory/feedback_data_operations.md`.

**Quick version:** `node scripts/fix-rebuild.mjs --season=N` (handles matchResults + patches + cache bust)

When inserting/shifting score data manually, check ALL downstream:
1. scores 2. incomingAvg 3. seasons.notes 4. matchResults 5. bowlerPatches 6. bowlerMilestones 7. Cache channels 8. Stable queries

## Pre-Work Checklists

- **Before writing SQL:** Read `memory/db-schema.md`. Never guess column names.
- **Before DB operations:** Check `scripts/` for existing scripts. Copy their env-loading pattern.
- **Before reading files:** Verify paths with Glob. Don't guess.
- **Before touching error-prone areas:** Check `memory/errors.md`.
- **After visible changes:** Remind Russ to update `content/updates.ts`.

## Debugging Display Issues

1. **Check the DB first** — run a quick `node -e` query to verify data exists
2. **If data exists** -> it's a cache issue. Delete specific cache files, redeploy.
3. **If data is missing** -> check source CSVs in `docs/data/`, scripts in `scripts/`
4. **Never assume the data is missing** — the DB is usually complete

## Error Discipline

- When the same error occurs twice, STOP. Don't patch around it.
- Log the error, root cause, and fix in `memory/errors.md` before continuing.

## Bash Inline JS

- ALWAYS use single quotes for `node -e '...'` — zsh expands `!` inside double quotes
- If the JS contains single quotes, use a heredoc or write to a temp file

## Workflow

- Skip `next build` locally — user checks via `next dev`. Vercel builds on push.
- Commit frequently at natural stopping points
- Local full builds overwhelm Azure SQL (30 concurrent requests, 7 parallel workers)

## User Preferences

- Iterative UI experiments with checkpoint feedback rounds
- Reverse chronological order for stats/game logs
- No score color formatting on personal records (keep in game logs only)
- Strike X styling (red/bold at 60% opacity) — hero headings only, not lists/tables
- Zero values show "X" (strike symbol) in records panel
- **NO em dashes anywhere on the site** — sweep all `&mdash;`, `---`, and `\u2014` from every file. Never introduce them in new code.

## Key Formulas

- **Slug**: `LOWER(REPLACE(firstName,' ','-'))+'-'+LOWER(REPLACE(lastName,' ','-'))`
- **HCP**: `FLOOR((225 - FLOOR(incomingAvg)) * 0.95)` — floor avg FIRST, max 147
- **Penalty**: flat 199 per hcpGame
- **No-avg bowler**: flat 219 per hcpGame
- **incomingAvg**: ALWAYS stored as whole number (no decimals)
- **Rolling avg**: 27-game rolling, computed inline (DB function `fn_RollingAverage` is broken)
