# Add PostHog Analytics

## Priority: Pre-launch (before sharing with league)

## Summary
Integrate PostHog analytics to track visitor behavior, page views, and navigation paths once the site is shared with the league.

## Why PostHog
- Free tier: 1M events/mo, 5K session replays/mo (more than enough for league site)
- Path analysis and user flows built-in — see how people navigate between bowler/team/season pages
- Feature popularity tracking — which sections get the most engagement
- Session replays optional (can disable to save quota)
- Next.js SDK available (`posthog-js` + `posthog-node`)
- Privacy-friendly configuration available (no cookie banner needed)

## Implementation
1. Create PostHog account (free cloud tier)
2. Install `posthog-js` package
3. Create PostHog provider component (client-side only)
4. Wrap app layout with provider
5. Configure: enable pageview tracking, disable aggressive autocapture if desired
6. Optional: add custom events for key interactions (search usage, game log expand, chart interactions)

## Key Questions to Answer With Analytics
- Which pages get the most views (bowler profiles vs team pages vs season pages)?
- What navigation paths do people take through the site?
- Do people use the search bar or browse via nav/links?
- Which profile sections get engagement (game logs, charts, records)?
- How many return visitors vs one-time?
