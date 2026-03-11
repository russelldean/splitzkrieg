# Weekly Score Pipeline

Step-by-step for publishing each week's results.

## Pre-Bowling

- [ ] Verify countdown animation shows correct date (check /league-nights)

## After Bowling Night

### 1. Pull Scores from LeaguePals

- Run: `node scripts/import-week-scores.mjs pull --cookie="connect.sid=s%3A..." --week=N --season=35`
- Review pulled data: `node scripts/import-week-scores.mjs show --week=N --season=35`
- Check for UNMATCHED bowlers and resolve in the staging file (`docs/pending/s35-week-N.json`)
- Add turkey counts to the staging file (LeaguePals does not track these)

### 2. Import Scores to DB

- Run: `node scripts/import-week-scores.mjs import --week=N --season=35`
- Optional dry run first: add `--dry-run` flag
- Verify a few bowler profiles in `next dev`

### 3. Calculate Match Results

- Run: `node scripts/populate-match-results.mjs --season=35`

### 4. Calculate Patches

- Run: `node scripts/populate-patches.mjs`
- Note: This recalculates ALL patches (~5 min). Future: incremental mode.

### 5. Write Blog Post

- Create `content/blog/season-xxxv-week-N-recap.mdx`
- Use the stat block template (copy from previous week's post)
- Update frontmatter: title, date, slug, season, week, excerpt
- Write narrative intro (optional — skip if short on time, do it conversationally with Claude)
- Test locally: `next dev` then visit `/blog/season-xxxv-week-N-recap`

### 6. Publish Week

- Run: `node scripts/publish-week.mjs --week=N`
- This gates homepage and profile stats to show up to week N
- The SQL text change auto-invalidates the cache hash (no manual cache busting needed)

### 7. Deploy

- Commit all changes and push to main (Vercel auto-deploys)
- Verify: check splitzkrieg.com after deploy completes (~2-3 min)
- Check homepage snapshot shows correct week number
- Check a bowler profile for updated stats

### 8. Send Email

- Run: `node scripts/send-recap-email.mjs --week=N --season=XXXV`
- With custom teaser: `--teaser="Three career highs and a debut this week!"`
- With custom recipient (for testing): `--to=your@email.com`
- Dry run: add `--dry-run` to preview HTML without sending
- Verify: check Google Group for email delivery

## Quick Reference

| Step | Script | Time |
|------|--------|------|
| Pull scores | `import-week-scores.mjs pull` | ~30s |
| Review/correct | Manual in staging JSON | 5-10 min |
| Import scores | `import-week-scores.mjs import` | ~10s |
| Match results | `populate-match-results.mjs` | ~10s |
| Patches | `populate-patches.mjs` | ~5 min |
| Blog post | Manual + Claude | 15-30 min |
| Publish week | `publish-week.mjs` | ~5s |
| Deploy | `git push` | ~3 min |
| Send email | `send-recap-email.mjs` | ~5s |

## Troubleshooting

- **Build too slow?** Check if `generateStaticParams` queries were modified (they shouldn't be). Those queries run for ALL seasons. If they got `/* vN */` comments, remove them and delete specific cache files instead.

- **Data not showing on homepage?** Check publish gate:
  ```
  node -e 'const sql = require("mssql"); ...'
  ```
  Or query the DB: `SELECT * FROM leagueSettings`

- **Data not showing on bowler profile?** Same publish gate check. Bowler-of-the-week and homepage stats are gated. Career stats and game logs are NOT gated — they show all data.

- **League night page missing?** League night pages are NOT gated by the publish gate. They build for every week with data in the DB. If a league night page is missing, the data likely hasn't been imported yet.

- **Cache stale?** Delete specific cache files per CLAUDE.md rules:
  ```
  find .next/cache/sql/ -name "*queryName-seasonID*" -delete
  ```
  NEVER use `vercel --prod --force` or bump `DB_CACHE_VERSION`.

- **Email failed with 403?** The from domain (splitzkrieg.com) needs to be verified in Resend. Go to https://resend.com/domains.

- **Patches taking too long?** The current script recalculates all patches from scratch. This is expected (~5 min). An incremental mode is planned for the future.
