# Feature Landscape

**Domain:** Sports statistics website (bowling league) inspired by Baseball Reference / Baseball Savant
**Researched:** 2026-03-02
**Confidence:** HIGH (well-understood domain, detailed project docs, stable reference site patterns)

## Reference Site Patterns That Translate to Bowling

The genius of Baseball Reference and Basketball Reference is not the data itself -- it is the **information architecture** that makes 100+ years of data feel browsable in 30 seconds. Baseball Savant adds a layer of visual analytics that makes numbers *feel* meaningful. Here is what each site does well and how it maps to Splitzkrieg.

### Baseball Reference Player Page Pattern
- **Header card**: Name, position, physical stats, career summary line (WAR, batting avg, etc.)
- **Season-by-season table**: The centerpiece. Every row is a season. Columns are stats. Sortable, with career totals row at bottom.
- **Bold rows for notable seasons** (All-Star years highlighted)
- **Similarity scores**: "Most similar players"
- **Transaction log**: Trades, free agency, etc.
- **Links everywhere**: Every team name, every season is a link to that entity's page
- **Standard vs Advanced toggle**: Casual fans see basic stats; nerds click "Advanced"
- **Leaderboard context**: "Ranked 5th in AL in home runs"

### Baseball Savant Player Page Pattern
- **Percentile rankings**: Visual bars showing how a player compares to league average across metrics
- **Rolling charts**: Performance over time, not just season endpoints
- **Color coding**: Red = elite, blue = poor. Instant visual parsing.
- **Pitch-level breakdowns**: Granular data with filterable views
- **Spray charts / visual representations**: Data as pictures, not just tables

### Basketball Reference Additions
- **Game log**: Every single game expandable within each season
- **Splits**: Home/away, by month, by opponent
- **Per-game / per-36 / totals toggles**: Same data, different lenses
- **Career highs panel**: Quick-reference box

### What Translates to Bowling (and What Does Not)

| Reference Pattern | Bowling Translation | Feasibility |
|---|---|---|
| Season-by-season table | Season-by-season avg, games, high game, high series, 200+ games | Direct -- this IS the killer feature |
| Career totals row | Career games, pins, average, records | Direct |
| Game log | Week-by-week scores expandable per season | Direct -- data exists |
| Percentile rankings | Where a bowler ranks vs all bowlers (avg, high game, etc.) | Straightforward to compute |
| Rolling performance chart | Average progression line chart across seasons | Direct -- already planned |
| Similarity scores | "Bowlers with similar averages" | Easy to compute, fun |
| Color-coded performance tiers | Red for 200+ games, gold for 250+, etc. | Simple CSS |
| Leaderboard context in profiles | "3rd highest career average among active bowlers" | Query-based, medium effort |
| Splits | By season half, by division opponent | Possible but low-value for bowling |
| Spray charts | Not applicable -- bowling has no spatial data | Skip |
| Advanced/basic toggle | Scratch vs handicap views | Natural for bowling |

---

## Table Stakes

Features users expect. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Bowler profile page** | THE reason people visit. Baseball Reference's entire value is player pages. | High | Career stats, season table, records, chart. The centerpiece. |
| **Bowler search** | Baseball Reference search bar is used more than navigation. People type a name, period. | Medium | Autocomplete/fuzzy matching essential. Must handle name variants (the system already has name mappings). |
| **Season-by-season stats table** | The Baseball Reference career stats table is the most-copied pattern in sports web. Every bowler wants to see their history laid out by season. | Medium | One row per season: games, avg, high game, high series, 200+ count, turkeys. Career totals row at bottom. |
| **Personal records panel** | Quick-reference box for high game, high series, 200+ count, 600+ count, turkeys. Basketball Reference calls this "Career Highs." | Low | Data already computed and available in the DB. |
| **Average progression chart** | The signature visualization. A line chart of average over time tells the bowler's story at a glance. Baseball Savant's rolling charts are the inspiration. | Medium | Recharts line chart. X-axis = seasons (chronological), Y-axis = season ending average. |
| **All-time leaderboards** | Every sports reference site has them. "Who has the highest career average?" "Most 200+ games?" | Medium | Sortable tables, filterable by gender/active/season range. Multiple categories. |
| **Season standings page** | Bowlers want to see final standings, just like checking a baseball season's final standings on Baseball Reference. | Medium | Points breakdown (W/L + bonus), division alignment, links to team pages. |
| **Team profile page** | Team pages complete the browsable universe. Roster, history, head-to-head records. | Medium | Current roster with bowler links, all-time record, past rosters by season. |
| **Home page with league snapshot** | Landing page with search bar, current season standings, recent results. Like Baseball Reference's front page with today's scores. | Medium | Search bar prominence is critical -- it must be the first thing you see. |
| **Mobile-responsive layout** | Bowlers will share profile links in group texts. If it does not work on a phone, it does not work. | Medium | Tables must scroll horizontally or reflow. Charts must resize. |
| **Shareable URLs** | Every entity gets a clean URL: /bowler/russ-smith, /team/gutter-sluts, /season/xxxv. The entire point of Baseball Reference is that every page is linkable and shareable. | Low | Slug-based routing already planned. |
| **Cross-linking everywhere** | On a bowler page, team names link to team pages. On team pages, bowler names link to profiles. On season pages, everything links out. This is what makes reference sites "get lost in the data" addictive. | Low | Discipline in templates, not technical complexity. |

---

## Differentiators

Features that set this apart from standard league sites (LeaguePals, BowlSK). These are what make it "Baseball Reference for bowling" instead of "another league website."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Percentile rankings on bowler profiles** | Baseball Savant's percentile bars are instantly readable. "Your career average is in the 78th percentile among all Splitzkrieg bowlers." Color-coded (red = elite, blue = below average). | Medium | Compute percentile ranks across active or all-time bowlers. 5-6 key metrics: average, high game, high series, 200+ games, total games, turkeys. |
| **Milestone tracker** | "You are 3 games away from 100 career games." "Next 200+ game will be your 10th." Approaching-milestone alerts give bowlers something to aim for. | Low | Data already exists in the system. Display upcoming milestones on profile page. |
| **Game log (week-by-week scores)** | Baseball Reference lets you drill into every game of every season. Expandable per season, showing each week's three games and series. This is unique among bowling league sites. | Medium | Collapsible accordion UI. Could be large for long-tenured bowlers, so lazy-load by season. |
| **Head-to-head team records** | "Your team is 12-6 all-time against Bowl Derek." Like the team vs team records on Baseball Reference. | Medium | Requires matchResults data (currently empty table). Can be populated from schedule + scores. |
| **"Best nights" highlights** | Auto-detected notable performances: 200+ games, 600+ series, personal bests, turkeys. Displayed as a highlights reel on the profile page. | Medium | Query scores table for performances exceeding thresholds. Badge/icon system for different achievement levels. |
| **Bowler comparison tool** | Side-by-side comparison of two bowlers' stats. Baseball Reference has this as "Compare Players." | Medium | Select two bowlers, show stats in columns. Chart overlay of average progressions. |
| **Scratch vs handicap toggle** | Unique to bowling -- the ability to view all leaderboards and stats in either scratch or handicap mode. Like Baseball Reference's Standard/Advanced toggle. | Medium | All handicap data exists in DB computed columns. Toggle changes which columns display. |
| **Leaderboard context in profiles** | "Ranked 5th in career average (active bowlers)" shown right on the profile. Gives every stat a "so what" context. | Medium | Rank queries for each stat category. Cache or compute on page load. |
| **Season awards and champions history** | Hall of fame page: every season's champions across all 5 categories, award winners. The historical record book. | Low | Requires seasonChampions table population (currently empty but planned). |
| **Social sharing / OG cards** | When you share a bowler profile link, it shows a rich preview: name, career average, high game. Makes sharing in group chats compelling. | Low | Next.js generateMetadata with dynamic OG tags. No image generation needed initially -- text previews are enough. |
| **"Similar bowlers" suggestions** | "Bowlers with similar career averages" on each profile. Fun, low-effort, drives exploration. | Low | Simple query: find bowlers within +/- 5 pins of career average. |
| **Aggregate league stats dashboard** | Total games bowled all-time, total pins, total 200+ games, unique bowlers. The "did you know" facts. Like the league-wide stats that make the community feel substantial. | Low | Aggregate queries, displayed on home page or dedicated page. |
| **Color-coded performance in tables** | 200+ games highlighted green, 250+ gold, sub-100 dimmed. In season tables, above-average weeks bolded. Visual scanning without reading every number. | Low | Conditional CSS classes based on score thresholds. |
| **Playoff race tracker** | Who is in, who is on the bubble, magic numbers. Like a baseball playoff race page during September. | Medium | Requires understanding playoff qualification rules and computing scenarios from current standings. |
| **Career timeline / "transaction log"** | When did this bowler join? What teams have they been on? A chronological history of their league career, like Baseball Reference's transaction log. | Low | TeamRosters data already tracks this. Display as a simple timeline. |

---

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **User accounts for bowlers (early)** | Adds authentication complexity, password reset flows, and permission management before there is any feature requiring it. The entire site should be public-read. | Defer to Phase 7+. Admin accounts only for commissioner tools. |
| **Real-time score updates** | The league bowls one night per week. There is no "live game" to follow. Real-time adds WebSocket complexity for zero value. | Post scores after bowling night. Weekly cadence is the natural rhythm. |
| **Customizable bowler profiles** | Bowlers choosing their own colors, uploading avatars, writing bios. This turns a reference site into a social network. Baseball Reference does not let Mike Trout customize his page. | Consistent, data-driven profiles. The data IS the profile. |
| **Discussion forums / comments** | Community discussion belongs in the league's existing channels (group texts, email). Building a forum creates a moderation burden and splits conversation. | Link to external channels if needed. The site is a reference, not a community platform. |
| **Mobile native app** | A responsive web app covers 100% of the use case. Native app adds two deployment targets and an app store process for a 130-person bowling league. | Mobile-first responsive design. Add to home screen (PWA) if people want an icon. |
| **Video content / highlights** | Storage costs, bandwidth, recording logistics. Nobody is filming bowling league nights with production quality. | Photo gallery is sufficient. |
| **Predictive analytics / ML** | "We predict your average will be 165 next season." Overengineered for the dataset size and adds no real value for casual bowlers. | Stick to descriptive stats. Trends and percentiles tell the story. |
| **Backfilling old blog/email content** | Tons of effort to find, format, and import 18 years of weekly emails. Diminishing returns -- old recaps are not interesting to current bowlers. | Blog starts fresh. Historical data speaks through the stats. |
| **League-wide notifications / email system** | Building email delivery, preferences, unsubscribe handling. The commissioner already has an email workflow. | Blog RSS feed at most. Keep email external. |
| **Pin-by-pin or frame-by-frame scoring** | Frame data does not exist and was never collected. Building a system to accept it adds complexity with no historical data to show. | Three game scores per night is the granularity. Turkeys are tracked as a separate count. |
| **Gamification (badges, XP, levels)** | Turns a reference site into a game. The achievements system (200+ games, milestones) already provides recognition without manufactured engagement mechanics. | Milestones and records ARE the achievements. Display them cleanly. |

---

## Feature Dependencies

```
Bowler Search --> Bowler Profile Page (search must land somewhere)
Bowler Profile Page --> Season-by-Season Table (core profile component)
Bowler Profile Page --> Personal Records Panel (core profile component)
Bowler Profile Page --> Average Progression Chart (core profile component)
Bowler Profile Page --> Game Log (enhancement to profile)
Bowler Profile Page --> Percentile Rankings (enhancement to profile)
Bowler Profile Page --> Milestone Tracker (enhancement to profile)
Bowler Profile Page --> Leaderboard Context (requires leaderboard queries)
Bowler Profile Page --> Similar Bowlers (requires career average data)

Team Profile Page --> Team Roster (requires bowler profile links)
Team Profile Page --> Head-to-Head Records (requires matchResults data)

Season Page --> Season Standings (core component)
Season Page --> Season Leaderboards (requires score aggregation)
Season Page --> Playoff Bracket (requires playoffResults data)

All-Time Leaderboards --> Bowler Profile Links (leaderboard entries link to profiles)
All-Time Leaderboards --> Scratch/Handicap Toggle (needs both data sets)

Playoff Race Tracker --> Season Standings (depends on current standings data)
Playoff Race Tracker --> Playoff Rules Logic (needs qualification rules encoded)

Bowler Comparison Tool --> Bowler Profile Data (reuses profile queries)
Bowler Comparison Tool --> Average Progression Chart (reuses chart component)

Social Sharing / OG Cards --> Bowler Profile Page (generates previews from profile data)

Champions & Awards Page --> seasonChampions Table (currently empty, needs population)
Head-to-Head Records --> matchResults Table (currently empty, needs population)

Blog System --> Independent (no data dependencies, can be built anytime)
Photo Gallery --> Independent (no data dependencies)
About / Join Page --> Independent (static content)
```

### Critical Data Dependencies

Several differentiator features depend on tables that are currently **empty**:
- `matchResults` -- needed for team head-to-head records, team W/L breakdowns
- `playoffResults` -- needed for playoff bracket display
- `seasonChampions` -- needed for champions/awards page

These tables need population (either from historical research or going-forward data entry) before the features that depend on them can be fully realized. The features should be designed to gracefully handle missing data and progressively fill in as data becomes available.

---

## MVP Recommendation

### Phase 1 Priority (The "Holy Crap" Launch)

Build these first. This is what makes bowlers lose their minds when you share the link.

1. **Bowler search** -- prominent, front and center, with autocomplete
2. **Bowler profile page** with:
   - Career summary header (name, seasons active, career average, total games)
   - Personal records panel (high game, high series, 200+ count, 600+ count, turkeys)
   - Season-by-season stats table with career totals row
   - Average progression line chart
3. **Home page** with search bar, league snapshot, quick stats
4. **Shareable URLs** with basic OG meta tags

This alone makes the site more compelling than any standard league management site. The profile page IS the product.

### Phase 2 Priority (Expand the Universe)

5. **Team profile pages** (roster, history, links to bowler profiles)
6. **Season pages** (standings, weekly results, season leaderboards)
7. **Cross-linking** (every name and team is a link)

### Phase 3 Priority (The "Get Lost in Data" Layer)

8. **All-time leaderboards** with filters (gender, active, season range, scratch/handicap toggle)
9. **Game log** on bowler profiles (expandable week-by-week scores)
10. **Percentile rankings** on bowler profiles
11. **Milestone tracker** on bowler profiles
12. **Color-coded performance** in all tables
13. **Leaderboard context** in profiles ("Ranked Nth in...")

### Phase 4 Priority (History and Recognition)

14. **Champions and awards page** (requires data population)
15. **Playoff bracket display** (requires data population)
16. **Career timeline** on bowler profiles
17. **Similar bowlers** suggestions

### Defer

- **Bowler comparison tool**: Fun but not essential. Build after the core browsing experience is complete.
- **Playoff race tracker**: Only relevant during active seasons. Build when admin tools enable real-time standings.
- **Head-to-head team records**: Blocked on matchResults data population.
- **Blog system**: No dependency on stats infrastructure. Can be built whenever content creation is ready.
- **Photo gallery**: Nice to have, no urgency.
- **Admin tools**: Large scope, separate phase. The site delivers massive value as a read-only reference before admin tools exist.

---

## Bowling-Specific Stats That Matter

These are the metrics bowlers actually care about and talk about. Derived from the data model and bowling culture.

### Individual Stats (Profile Page)
| Stat | Why It Matters | Data Source |
|------|---------------|-------------|
| Career average | The single number that defines a bowler | Computed from all games |
| Season average | How they did in a specific season | Computed from season games |
| High game | Bragging rights, personal best | MAX(game1, game2, game3) across all scores |
| High series | Three-game consistency | MAX(scratchSeries) across all scores |
| 200+ games count | The "club" -- bowlers track this obsessively | COUNT where any game >= 200 |
| 600+ series count | Harder than a single 200 game, more respected | COUNT where scratchSeries >= 600 |
| Turkeys (3 consecutive strikes) | Fun stat, tracked in the data | SUM(turkeys) |
| Total games bowled | Longevity metric | COUNT of score rows * 3 (or count non-null games) |
| Total pins | Volume metric | SUM of all game scores |
| Seasons active | Tenure in the league | COUNT DISTINCT seasons |

### Team Stats (Team Page)
| Stat | Why It Matters |
|------|---------------|
| Season record (W-L) | How the team performed |
| All-time record | Franchise history |
| Team combined average | Strength indicator |
| Best team night | Highest combined team series |
| Championships won | The ultimate team achievement |

### Leaderboard Categories
| Category | Filter Options |
|----------|---------------|
| Career average | All-time, active only, by gender, minimum games threshold |
| High game | All-time, by season, by gender |
| High series | All-time, by season, by gender |
| Most 200+ games | All-time, active only |
| Most 600+ series | All-time, active only |
| Most turkeys | All-time, active only |
| Total pins | All-time, active only |
| Total games | All-time, active only |
| Season average | By specific season, by gender |

### Achievement Thresholds for Visual Highlighting
| Threshold | Display Treatment |
|-----------|------------------|
| 300 game (perfect) | Gold highlight, special icon |
| 250+ game | Gold text or background |
| 200+ game | Green highlight |
| 700+ series | Gold highlight, special icon |
| 600+ series | Green highlight |
| Below 100 game | Dimmed/muted (not shaming, just visual hierarchy) |

---

## Sources

- Project docs: `docs/splitzkrieg-site-plan.md` (detailed feature descriptions and phased roadmap)
- Project docs: `docs/splitzkrieg-data-model.md` (available data fields and derived reports)
- Project docs: `.planning/PROJECT.md` (constraints, decisions, data status)
- Baseball Reference (baseball-reference.com) -- player page structure, season tables, game logs, leaderboards, cross-linking patterns. Stable site architecture unchanged for 10+ years. HIGH confidence in pattern descriptions.
- Basketball Reference (basketball-reference.com) -- similar Sports Reference network patterns, career highs panel, game log structure. HIGH confidence.
- Baseball Savant (baseballsavant.mlb.com) -- percentile ranking visualizations, rolling performance charts, color-coded tiers. HIGH confidence.
- Note: WebSearch and WebFetch were unavailable during this research session. All reference site pattern descriptions are based on training data knowledge of these long-established, architecturally stable sites. Confidence remains HIGH because these sites have maintained consistent design patterns for many years.
