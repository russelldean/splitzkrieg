# Claude Code Instructions — Splitzkrieg

## Architecture

- **Static site** — Next.js with build-time Azure SQL data fetching. Visitors never hit the DB.
- **Azure SQL** — Provisioned tier (not serverless). 30 concurrent request limit.
- All SQL queries live in `src/lib/queries/` (split by domain). Components never use raw SQL.
- `scores` table has computed columns (hcpGame1/2/3, handSeries, incomingHcp, scratchSeries) — never INSERT these.
- DB schema documented in `memory/db-schema.md` — ALWAYS check before writing raw SQL.
- Vercel auto-deploys on push to main.

## Cache System — FOLLOW THIS EXACTLY

The #1 source of bugs and wasted time. Read this every time.

### How it works
- All ~40 query functions use `cachedQuery()` — disk cache in `.next/cache/sql/`
- Vercel preserves `.next/cache/` between deploys — subsequent builds skip DB entirely
- `cachedQuery()` hashes the SQL string (MD5) into the cache key

### When you change a query's SQL text
- **Nothing to do.** The hash changes automatically and the old cache is missed.

### When data changes but the query doesn't (e.g., new scores imported)
- Add a version comment to the SQL: `/* v2: added week 4 */` — changes the hash, invalidates just that query
- Or delete specific cache files: `find .next/cache/sql/ -name "*queryName-{seasonID}*" -delete`

### NEVER DO THESE
- **NEVER** use `vercel --prod --force` — nukes ALL cache, causes 15+ minute full rebuilds
- **NEVER** bump `DB_CACHE_VERSION` — same effect as force, full rebuild
- **NEVER** add `/* vN */` comments to queries used by `generateStaticParams` — these run for ALL seasons, busting cache across every season. Delete specific cache files instead.

### Hybrid queries (SQL + TypeScript config)
- If a `cachedQuery` uses TypeScript config (thresholds, filters) inside the callback, include `JSON.stringify(config)` in the `sql` option so config changes auto-invalidate the hash.

## Debugging Display Issues — CHECKLIST

When something isn't showing on the site:
1. **Check the DB first** — run a quick `node -e` query to verify data exists
2. **If data exists** → it's a cache issue. Delete specific cache files, redeploy.
3. **If data is missing** → check source CSVs in `docs/data/`, scripts in `scripts/`, related tables
4. **Never assume the data is missing** — the DB is usually complete

## Error Discipline

- When the same error occurs twice, STOP. Don't patch around it.
- Log the error, root cause, and fix in `memory/errors.md` before continuing.
- Check `memory/errors.md` at the start of tasks that touch areas with prior errors.

## Bash Inline JS

- ALWAYS use single quotes for `node -e '...'` — zsh expands `!` inside double quotes
- If the JS contains single quotes, use a heredoc or write to a temp file

## AskUserQuestion Verification

- After calling AskUserQuestion, verify the user's actual response is in the conversation before proceeding
- If unsure whether the user answered, ask again in plain text

## Workflow

- Skip `next build` locally — user checks via `next dev`. Vercel builds on push.
- Commit frequently at natural stopping points
- Local full builds overwhelm Azure SQL (30 concurrent requests, 7 parallel workers)
- `scripts/warm-cache.mjs` pre-populates disk cache sequentially (safe for Azure SQL)

## User Preferences

- Iterative UI experiments with checkpoint feedback rounds
- Reverse chronological order for stats/game logs
- No score color formatting on personal records (keep in game logs only)
- Strike X styling (red/bold at 60% opacity) — hero headings only, not lists/tables
- Zero values show "X" (strike symbol) in records panel

## Docs Folder Structure

- `docs/data/` — CSVs, TSVs (source data for imports)
- `docs/images/` — Photos used by the site
- `docs/leaguepals/` — LeaguePals PDFs
- `docs/reference/` — Original site plan, schema SQL, data model docs
- `docs/pending/` — Files staged for processing

## Key Formulas

- **Slug**: `LOWER(REPLACE(firstName,' ','-'))+'-'+LOWER(REPLACE(lastName,' ','-'))`
- **HCP**: `FLOOR((225 - FLOOR(incomingAvg)) * 0.95)` — floor avg FIRST
- **Penalty**: flat 199 per hcpGame
- **No-avg bowler**: flat 219 per hcpGame
- **incomingAvg**: ALWAYS stored as whole number (no decimals)
- **Rolling avg**: 27-game rolling, computed inline (DB function `fn_RollingAverage` is broken)
