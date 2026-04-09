# Splitzkrieg: Bowling League Stats & Operations
Splitzkrieg.com is a production application with 19 years of historical data from 620+ bowlers.  The data and organization needs of a bowling league are bigger than most expect - both the weekly processes to run the league and the reporting of the results. Part of why this league has thrived for 19 years is that bowlers enjoy poring over their stats and having their accomplishments celebrated. The goal has been to build a tool that cuts regular league upkeep time dramatically and gives bowlers the deep access to league history they've always wanted.  

I've designed and built splitzkrieg.com from scratch as a solo product engineer. Before writing code, I scoped the project into a 10-phase roadmap (now at 12 and growing) with clear deliverables and boundaries per phase, and went live after phase 4. 

### Architecture: Static Hybrid Model

The most common use case is bowlers checking and discussing their recent results, often on their phones at the alley during bowling night. The league has 22,000+ bowling records and counting. The stats are read-heavy but once the data model is locked in, the writes are rare.  If every page view hit the database, costs would scale with traffic, the connection pool would be exhausted during peak periods, and page loads would suffer.  Splitzkrieg uses Azure SQL with a 30-connection limit and pay-per-use pricing.  I investigated Vercel's serverless constraints, Azure SQL's pricing model, and the specific read/write patterns of bowling league data which led me to a static hybrid architecture where all public-facing pages are pre-rendered at build time. A disk-based query cache with per-season versioning and channel-specific invalidation keeps builds efficient, and means that users don't need to hit the database and Azure SQL only wakes during admin operations and scheduled rebuilds.  The end result: zero database cost for read traffic, fast page loads from a static CDN, and no performance degradation or cost surprises during traffic spikes.

## The Stack

Next.js 16 (App Router) | React 19 | TypeScript | Azure SQL | Tailwind CSS v4 | Vercel | Recharts | Resend | Claude Code

## Outcomes

- Production site: [splitzkrieg.com](https://splitzkrieg.com)
- 620+ bowlers with career stats, team pages, H2H records, season standings, leaderboards
- 22,800+ historical scores across 19 years
- 698 commits, ~45K lines of code, 11 of 12 roadmap phases complete
- Automated admin pipelines - weekly ops reduced from hours of work to minutes of oversight
- Zero database cost for read traffic
- Source: [github.com/russelldean/splitzkrieg](https://github.com/russelldean/splitzkrieg)





