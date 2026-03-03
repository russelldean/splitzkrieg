# Splitzkrieg Bowling League — Website Plan v1

## 1. Site Map

### Public Pages (No Login Required)

**Home Page**
- League branding, hero section with personality
- "Search for a Bowler" — prominent search bar front and center
- Current season snapshot: standings, recent results, upcoming schedule
- Latest blog post / weekly recap teaser
- Quick stats ticker: total bowlers all-time, total games bowled, league since 2007
- "Want to Join?" call-to-action for prospective bowlers

**Bowler Profile Page** ⭐ *The Killer Feature*
- Career summary header: name, seasons active, total games, career average, teams played for
- Personal records panel: high game, high series, 200+ games, 600+ series, turkeys
- Season-by-season stats table (like Baseball Reference career stats)
- Average progression chart — line graph showing average over time across all seasons
- Game log: expandable season-by-season, week-by-week scores
- Milestones achieved and milestones approaching
- Playoff appearances and results
- Shareable URL: splitzkrieg.com/bowler/russ-smith (or similar)
- Privacy: opt-out flag hides page from public, visible only when logged in

**Team Profile Page**
- Current roster with links to bowler profiles
- Season record and current standings position
- Team history: all-time record, past rosters by season, championships won
- Head-to-head record vs. every other team (from matchup grid data)
- Team stats: combined averages, best team nights

**Season Page**
- Final standings with points breakdown (W/L points + bonus points)
- Division alignment for that season
- Weekly results archive
- Season leaderboards: top averages, high games, high series
- Season award winners
- Playoff bracket and results
- Link to blog posts from that season

**All-Time Leaderboards**
- Filterable: all-time, by season, by gender, active only
- Categories: career average, high game, high series, total pins, total games, 200+ games, 600+ series, turkeys
- Sortable tables with links to bowler profiles

**Champions & Awards (Hall of Fame)**
- Season-by-season champions: team, male scratch, female scratch, handicap
- Trophy photos where available
- Historical record book
- Named awards and traditions

**Playoffs**
- Current season playoff race tracker (who's in, who's on the bubble)
- Playoff bracket visualization for current/past seasons
- Individual playoff qualifiers with averages

**Schedule**
- Current season schedule with dates and matchups
- Division breakdown
- Results filled in as season progresses
- Past season schedules accessible

**Blog / Weekly Recap**
- Where the weekly email content lives permanently
- Bowler of the week, team of the week highlights
- Personal bests achieved that week
- Season narratives and stories
- Replaces the pressure of "composing the perfect email" — write it here, email just links to it

**Photo Gallery**
- Season-by-season photo collections
- Integration point for Kristin's content
- Trophy ceremony photos, league night action shots

**About / Join the League**
- What is Splitzkrieg? History, culture, vibe
- How the league works: format, schedule, handicap system explained for newcomers
- FAQ for prospective bowlers
- How to get on the waiting list / express interest (simple form)
- Location info: Bowlero Durham (and the Village Lanes history)

**League Rules & Documents**
- Current rules and bylaws
- Handicap system explanation
- Playoff format and tiebreaker rules
- Any other league governance docs

---

### Admin / Commissioner Tools (Future Phase, Login Required)

**Lineup Submission System**
- Replaces Google Form
- Captains log in, select who's bowling from their roster
- Sub requests visible to commissioner
- Deadline enforcement
- Auto-generates scoresheet data and LeaguePals-ready export

**Score Entry**
- Web form for entering weekly scores (replaces Chris's spreadsheet workflow)
- Validation: flags unusual scores, checks against known bowlers
- Auto-calculates: averages, handicaps, standings, personal bests, achievements
- Triggers: auto-publishes results, generates weekly recap draft

**Season Management**
- Create new season, set divisions, build schedule
- Manage rosters and team assignments
- Playoff bracket management

---

## 2. Tech Stack Recommendation

### Database: Azure SQL Database
**Why:** You already know SQL Server. Azure SQL is the managed cloud version — same T-SQL syntax, same tools (SSMS connects directly to it). This is the strongest portfolio signal: "I designed and manage a production SQL Server database in Azure." Currently on the **free serverless tier** (General Purpose, Standard-series Gen5, 2 vCores, 32GB storage, 100K vCore seconds/month). Auto-pauses when idle. 22K+ rows is tiny for SQL Server.

### Backend: Next.js (API Routes + Server Components)
**Why:** Next.js is a React framework that handles both the frontend AND the API layer in one project. Instead of building a separate backend server, your database queries live in Next.js API routes or server components. This simplifies the architecture dramatically — one codebase, one deployment. It's also the most in-demand framework in web development right now, which matters for the portfolio angle.

### Frontend: React (via Next.js) + Tailwind CSS
**Why:** React is the industry standard for interactive web UIs, and the data visualization features you want (charts, interactive tables, sortable leaderboards) are where React shines. Tailwind CSS handles styling without you needing to be a CSS expert. The Metrograph-inspired design (bold typography, warm colors, clean nav) is very achievable with Tailwind.

### Data Visualization: Recharts + Custom Components
**Why:** Recharts is a React charting library that makes it straightforward to build the Baseball Savant-style visualizations: line charts for average progression, bar charts for season comparisons, percentile indicators. For more custom stuff, we can add D3.js later.

### Hosting: Vercel (Frontend) + Azure SQL (Database)
**Why:** Vercel is made for Next.js — deployment is essentially "push to GitHub and it's live." The free tier is generous and handles hobby/small projects easily. If you outgrow it, the Pro tier is $20/month. Combined with Azure SQL on the free tier, your total hosting cost is **$0-20/month**.

### Domain: ~$12/year
Grab splitzkrieg.com or splitzkriegbowling.com (or similar) through a registrar like Namecheap, Cloudflare, or Google Domains.

### Development Workflow: Claude Code + GSD
**Why:** This is where GSD enters the picture. Once we have the spec finalized, you'll initialize a GSD project in Claude Code, feed it the requirements, and let it plan and execute the build phase by phase. You'll be learning Claude Code as a real tool on a real project — exactly the portfolio story you want to tell.

### Source Control: GitHub
Public repo (or private, your call). Another portfolio piece — employers can see the commit history, the GSD-structured development process, clean code.

### Architecture Diagram
```
┌─────────────────────────────────────────────┐
│  Vercel (Hosting)                           │
│  ┌───────────────────────────────────────┐  │
│  │  Next.js Application                  │  │
│  │  ├── Pages (React + Tailwind)         │  │
│  │  │   ├── Home                         │  │
│  │  │   ├── /bowler/[slug]  ⭐           │  │
│  │  │   ├── /team/[slug]                 │  │
│  │  │   ├── /season/[id]                 │  │
│  │  │   ├── /leaderboards                │  │
│  │  │   ├── /champions                   │  │
│  │  │   ├── /blog                        │  │
│  │  │   └── /about                       │  │
│  │  │                                    │  │
│  │  ├── API Routes (Server-side)         │  │
│  │  │   ├── /api/bowlers                 │  │
│  │  │   ├── /api/teams                   │  │
│  │  │   ├── /api/seasons                 │  │
│  │  │   ├── /api/scores                  │  │
│  │  │   └── /api/search                  │  │
│  │  │                                    │  │
│  │  └── Recharts Visualizations          │  │
│  └───────────────────────────────────────┘  │
└──────────────────┬──────────────────────────┘
                   │ SQL queries via mssql package
                   ▼
┌─────────────────────────────────────────────┐
│  Azure SQL Database (free serverless tier)          │
│  ├── Bowlers                                │
│  ├── Seasons                                │
│  ├── Teams                                  │
│  ├── TeamRosters                            │
│  ├── WeeklyScores                           │
│  ├── Schedule                               │
│  ├── Playoffs                               │
│  ├── BlogPosts                              │
│  └── ... (normalized from Google Sheets)    │
└─────────────────────────────────────────────┘

  ┌─────────────────────────────────┐
  │  Google Sheets (Legacy/Bridge)  │  ← Continues operating during migration
  │  Raw Data → export → SQL import │     Phased out as website takes over
  └─────────────────────────────────┘
```

---

## 3. Database Schema (Core Tables)

> **⚠️ Note:** The inline schema below reflects the original Phase 0 plan. The actual deployed schema has diverged significantly — table/column names use camelCase, the `scores` table (originally `WeeklyScores`) has 6 computed columns for handicap calculations, an `isPenalty` flag, and other additions. See **`splitzkrieg-schema.sql`** for the current production schema.

Building on the schema suggestions from your data model doc, refined with what we've discussed:

```sql
-- Seasons
CREATE TABLE Seasons (
    SeasonID        INT IDENTITY PRIMARY KEY,
    RomanNumeral    VARCHAR(10) NOT NULL,       -- 'XXXV'
    Period          VARCHAR(10) NOT NULL,        -- 'Spring' or 'Fall'
    Year            INT NOT NULL,
    SeasonNumber    INT NOT NULL,               -- 1=Spring, 2=Fall
    Notes           VARCHAR(255),               -- 'DNF' for COVID season, etc.
    IsCurrentSeason BIT DEFAULT 0
);

-- Bowlers
CREATE TABLE Bowlers (
    BowlerID        INT IDENTITY PRIMARY KEY,
    CanonicalName   VARCHAR(100) NOT NULL,
    Slug            VARCHAR(100) NOT NULL,      -- URL-friendly: 'russ-smith'
    Gender          CHAR(1),                    -- M, F, X
    IsActive        BIT DEFAULT 1,
    IsPublic        BIT DEFAULT 1,             -- Privacy opt-out
    FirstSeasonID   INT REFERENCES Seasons(SeasonID),
    Notes           VARCHAR(255)
);

-- Name history for mapping old/alternate names
CREATE TABLE BowlerNameHistory (
    ID              INT IDENTITY PRIMARY KEY,
    BowlerID        INT NOT NULL REFERENCES Bowlers(BowlerID),
    AlternateName   VARCHAR(100) NOT NULL,
    UNIQUE(AlternateName)
);

-- Teams
CREATE TABLE Teams (
    TeamID          INT IDENTITY PRIMARY KEY,
    TeamName        VARCHAR(100) NOT NULL,
    Slug            VARCHAR(100) NOT NULL
);

-- Team name history
CREATE TABLE TeamNameHistory (
    ID              INT IDENTITY PRIMARY KEY,
    TeamID          INT NOT NULL REFERENCES Teams(TeamID),
    AlternateName   VARCHAR(100) NOT NULL
);

-- Which bowlers were on which teams each season
CREATE TABLE TeamRosters (
    ID              INT IDENTITY PRIMARY KEY,
    TeamID          INT NOT NULL REFERENCES Teams(TeamID),
    BowlerID        INT NOT NULL REFERENCES Bowlers(BowlerID),
    SeasonID        INT NOT NULL REFERENCES Seasons(SeasonID),
    RosterType      VARCHAR(20) DEFAULT 'Member', -- 'Member', 'Sub', 'Captain'
    GamesWithTeam   INT DEFAULT 0                 -- Track the 3-game threshold
);

-- The core fact table — one row per bowler per week
CREATE TABLE WeeklyScores (
    ScoreID         INT IDENTITY PRIMARY KEY,
    BowlerID        INT NOT NULL REFERENCES Bowlers(BowlerID),
    SeasonID        INT NOT NULL REFERENCES Seasons(SeasonID),
    TeamID          INT REFERENCES Teams(TeamID),
    Week            INT NOT NULL,
    Game1           INT,
    Game2           INT,
    Game3           INT,
    ScratchSeries   INT,
    IncomingAvg     DECIMAL(5,1),
    Handicap        INT,
    HandGame1       INT,
    HandGame2       INT,
    HandGame3       INT,
    HandSeries      INT,
    Turkeys         INT DEFAULT 0,
    UNIQUE(BowlerID, SeasonID, Week)
);

-- Weekly schedule / matchups
CREATE TABLE Schedule (
    ScheduleID      INT IDENTITY PRIMARY KEY,
    SeasonID        INT NOT NULL REFERENCES Seasons(SeasonID),
    Week            INT NOT NULL,
    MatchNumber     INT,
    Team1ID         INT REFERENCES Teams(TeamID),
    Team2ID         INT REFERENCES Teams(TeamID),
    Division        VARCHAR(50),
    MatchDate       DATE
);

-- Match results (team vs team outcomes)
CREATE TABLE MatchResults (
    ResultID        INT IDENTITY PRIMARY KEY,
    ScheduleID      INT NOT NULL REFERENCES Schedule(ScheduleID),
    Team1Game1      INT, Team1Game2 INT, Team1Game3 INT, Team1Series INT,
    Team2Game1      INT, Team2Game2 INT, Team2Game3 INT, Team2Series INT,
    -- Points earned per game + bonus
    Team1GamePts    INT,    -- 0-6 from three game results (2 per win, 1 tie)
    Team2GamePts    INT,
    Team1BonusPts   INT,    -- 0-3 from weekly series ranking
    Team2BonusPts   INT
);

-- Playoff results
CREATE TABLE PlayoffResults (
    PlayoffID       INT IDENTITY PRIMARY KEY,
    SeasonID        INT NOT NULL REFERENCES Seasons(SeasonID),
    PlayoffType     VARCHAR(30) NOT NULL,       -- 'Team', 'MaleScratch', 'FemaleScratch', 'Handicap'
    Round           VARCHAR(20),                -- 'Semifinal', 'Final'
    -- For team playoffs
    Team1ID         INT REFERENCES Teams(TeamID),
    Team2ID         INT REFERENCES Teams(TeamID),
    -- For individual playoffs
    Bowler1ID       INT REFERENCES Bowlers(BowlerID),
    Bowler2ID       INT REFERENCES Bowlers(BowlerID),
    WinnerTeamID    INT REFERENCES Teams(TeamID),
    WinnerBowlerID  INT REFERENCES Bowlers(BowlerID),
    Notes           VARCHAR(255)
);

-- Season champions (denormalized for easy lookup)
CREATE TABLE SeasonChampions (
    ID              INT IDENTITY PRIMARY KEY,
    SeasonID        INT NOT NULL REFERENCES Seasons(SeasonID),
    ChampionshipType VARCHAR(30) NOT NULL,      -- 'Team', 'MaleScratch', 'FemaleScratch', 'Handicap'
    WinnerTeamID    INT REFERENCES Teams(TeamID),
    WinnerBowlerID  INT REFERENCES Bowlers(BowlerID)
);

-- Blog posts (weekly recaps, announcements)
CREATE TABLE BlogPosts (
    PostID          INT IDENTITY PRIMARY KEY,
    SeasonID        INT REFERENCES Seasons(SeasonID),
    Week            INT,
    Title           VARCHAR(255) NOT NULL,
    Content         NVARCHAR(MAX),
    PublishedDate   DATETIME2,
    IsPublished     BIT DEFAULT 0
);

-- Division assignments per season
CREATE TABLE SeasonDivisions (
    ID              INT IDENTITY PRIMARY KEY,
    SeasonID        INT NOT NULL REFERENCES Seasons(SeasonID),
    TeamID          INT NOT NULL REFERENCES Teams(TeamID),
    DivisionName    VARCHAR(50) NOT NULL
);
```

---

## 4. Phased Build Roadmap

The guiding principle: **each phase delivers something complete, live, and shareable.** There is no "3 months before it's useful." Phase 1 gives you a working site your bowlers can visit. Everything after that adds value on your schedule — whether that's a burst of energy on a weekend or a feature every few weeks.

### Phase 0 → 1: Foundation + The Wow Moment (Target: 1-2 weeks focused work)
*From zero to "holy crap, look up your stats" — this is the launch.*

**Phase 0 — Setup (Days 1-3)**
- Register domain (splitzkrieg.org preferred, .com fallback)
- Set up Azure SQL Database (Basic tier, ~$5/month)
- Create database schema
- Set up GitHub repo
- Install Claude Code + GSD, initialize Next.js project with Tailwind
- One-time historical data migration: export Google Sheets CSVs → SQL import scripts
- Validate migrated data against existing Google Sheets reports
- Build repeatable sync script for current season data (pull from Sheets periodically until admin tools exist)

**Phase 1 — Launch (Days 4-10)**
- Home page with branding, search bar, and league snapshot
- **Bowler profile page** ⭐ — career stats, season-by-season table, personal records, average progression chart
- Bowler search functionality
- Basic site navigation (Metrograph-inspired: bold typography, cream/navy/red palette)
- Mobile-responsive layout for key pages
- Deploy to Vercel, point domain
- **🚀 GO LIVE — share with the league**

**At this point you have:** A live site, a portfolio piece, and 130 bowlers losing their minds looking themselves up.

---

*Everything below is "add when you have time and energy." Priority order, not a continuous sprint.*

### Phase 2: Teams & Seasons (A few days of work)
*Expanding the browsable universe*
- Team profile pages: current roster, team history, head-to-head records
- Season pages: final standings with points breakdown, division alignment, weekly results
- Schedule display (current + historical)
- Division standings with W/L points + bonus points breakdown

### Phase 3: Leaderboards & Records (A few days of work)
*The "get lost in the data" features*
- All-time leaderboards with filters: gender, active only, season range
- Sortable stat tables: career average, high game, high series, total pins, 200+ games, 600+ series, turkeys
- League-wide aggregate stats page
- Additional visualizations: career comparisons, trend charts, percentile rankings

### Phase 4: Champions, Playoffs & History (A few days of work)
*Celebrating 18 years of league story*
- Champions and awards page (all season winners across all 5 categories)
- Playoff bracket display: historical winners, with room for full brackets going forward
- Playoff race tracker for current season (who's in, who's on the bubble)
- Historical record book
- Village Lanes → Bowlero era narrative

### Phase 5: Blog & Content (A few days of work)
*Taking the pressure off your weekly email*
- Blog system for weekly recaps (new content going forward, no need to backfill)
- Bowler of the week / team of the week highlights
- Auto-generated weekly highlights from score data (personal bests, milestones hit)
- Email becomes a short note with a link to the blog post
- Photo gallery — give Kristin a place to go wild

### Phase 6: Admin Tools (Bigger lift — a week or two)
*This is where the weekly workflow pain goes away*
- Lineup submission system (replaces Google Form) — captains pick from roster
- Score entry interface (replaces Chris's spreadsheet workflow)
- Auto-calculation engine: averages, handicaps, standings, personal bests, achievements
- Scoresheet PDF generation
- LeaguePals export (investigate upload capabilities when ready)
- Season management: create seasons, set divisions, build schedule, manage rosters
- **At this point, Google Sheets can be retired as the operational system** (kept as archive)

### Phase 7: Dream Features (Ongoing, no deadline)
*Add as inspiration strikes*
- User accounts for bowlers
- Customizable team pages and bowler profile personalization
- Privacy controls (opt-out from public visibility)
- Enhanced visualizations (Savant-style percentile charts, rolling average graphs)
- Social sharing (share your profile page, share a monster night)
- Photo tagging and season galleries
- "New bowler" onboarding explainer
- "Join the league" interest form with waitlist
- Close game analysis and other advanced stats you've been wanting to explore

---

## 5. Decisions Made

| Question | Decision |
|----------|----------|
| Domain | splitzkrieg.org (preferred), splitzkrieg.com (fallback) |
| Google Sheets bridge | One-time migration for all historical seasons; current season continues in Sheets with manual sync to SQL every two weeks (after bowling night + data entry) until admin tools are built in Phase 6 |
| Historical playoffs | Store winners for all seasons now; finalists and bracket scores can be researched and backfilled later |
| Blog content | New content going forward only, no backfilling old emails |
| LeaguePals | Defer investigation until Phase 6 |
| Color palette | Start with Metrograph-inspired cream/navy/red, refine during Phase 1 |
| Logo | Existing logos available to use |
| Timeline | Modular — Phase 0+1 in 1-2 focused weeks, everything else added incrementally |
| Sub tracking | Not needed in database; all bowlers stored by team they bowled with that night. Eligibility rules deferred to admin tools phase |
| Current season sync | Manual trigger every two weeks after bowling night data entry is complete |
| Handicap standardization | All computed using 225 base / 95% / FLOOR regardless of what was used historically. Old stored values discarded. |
| Penalty rows | Games set to NULL, isPenalty flag = 1, computed handicap = 199 per game (597 series) |
| First-night bowlers | incomingAvg = NULL, computed handicap = 219 per game (657 series) |
| Tino McCullough S2W15 | Legitimately bowled for two teams in one night — both rows stay |
| Duplicate bowler/season/week | Allowed — unique constraint removed, replaced with non-unique index |

## 6. Remaining Open Questions

*None blocking Phase 0+1. These are deferred to later phases:*

- **Scoresheet generation format** — revisit in Phase 6 when building admin tools. Printable PDF likely.
- **LeaguePals integration** — revisit in Phase 6.
- **Playoff eligibility rules for subs** — revisit if/when admin tools need to enforce this.

## Historical Data Notes

The schema must accommodate significant variation across 35 seasons:

| Era | Teams | Divisions | Nights | Notes |
|-----|-------|-----------|--------|-------|
| Season I (2007) | 10 | 1 | 9 | League founding |
| Season II (2008) | 18 | 1 | 17 | Single season that year |
| Seasons III–XXIV | 18-20 | 2 | 9-10 | Standard era, occasional variation |
| Season XXV (2020) | — | — | — | DNF — COVID |
| COVID-adjacent seasons | varied | varied | varied | Some format changes |
| Current era | 20 | 2 | 9 | Current standard |

### Missing Data (7 nights, 302 of 309 captured)

| Season | Week(s) | Likely Explanation | Recovery Potential |
|--------|---------|-------------------|-------------------|
| I | 9 | Playoff week, regular sheets never done | Low — might not exist |
| II | 16-17 | Unknown, possibly lost | Medium — could search Gmail |
| V | 9 | Playoff week | Low |
| XIII | 9 | Playoff week | Low |
| XV | 9 | Playoff week | Low |
| XVIII | 9 | Playoff week | Low |

- Some Week 9 data may partially exist (e.g., Mike DePasquale's record series was recovered from an email and added as a single row)
- Gmail archives from those dates are the best source for any recovery effort
- Missing data does not cause structural problems — just fewer rows in WeeklyScores for those weeks

### Unloaded Data: COVID Interim Season
There is an interim COVID-era season with data that has NOT been imported yet. Different team format and structure from the standard seasons. This was a meaningful period for the league community and worth preserving. To be imported as a future project — may need a special Season record with notes explaining the format differences.

---

## 7. Portfolio & Resume Positioning

When this project is done, here's what you can point to:

- **Database Design**: Normalized SQL Server schema, data migration from flat files, complex query writing (rolling averages, ranked standings, playoff qualification)
- **Azure Administration**: Production Azure SQL Database management, deployment, monitoring
- **Web Development**: Full-stack Next.js application with React frontend, API design, data visualization
- **Product Management**: Requirements gathering, phased roadmap, stakeholder management (you're both the PM and the user)
- **AI-Assisted Development**: Claude Code + GSD workflow, demonstrating you can leverage modern AI tools to ship real software
- **Data Visualization**: Interactive charts and statistics displays inspired by professional sports analytics sites
- **Real Users**: This isn't a toy project — it serves 130+ active users with 18 years of data

That's a compelling story for any PM or technical PM role.

---

## Status: Phase 0 Complete + Data Cleanup Done — Ready for Phase 1

### Phase 0 — Complete
✅ Domain registered (splitzkrieg.org)
✅ Azure account created (personal, separate from work)
✅ Azure SQL Database deployed (free serverless tier, North Central US)
✅ Schema deployed (14 tables, 2 views, 1 function, indexes)
✅ VS Code connected via mssql extension
✅ Historical data migrated (22,817 scores, 619 bowlers, 42 teams, 4,322 rosters, 846 schedules)
✅ 17 team franchise lineages mapped
✅ Data quality audit complete (see data-quality-report.md)
✅ Season XXXV label corrected to Spring 2026

### Data Cleanup — Complete
✅ Handicap columns converted to computed (225/95%/FLOOR standardized across all seasons)
✅ Penalty rows cleaned (games NULL, isPenalty flag, computed hcp = 199)
✅ First-nighter corrections (avg NULLed, computed hcp = 219)
✅ Veteran bowler averages backfilled (Season XVIII)
✅ Bowler merges completed (Phillipose, Brennan, O'Brien)
✅ Team merge: Gutter Despair → Bowl Derek
✅ `establishedAvg` column added and populated on bowlers
✅ Bowlers with no games or averages removed

### Next Up
⏳ Fix fn_RollingAverage (broken — references old table/column names)
⏳ Add `chronoNumber` to bowlers and teams
⏳ GitHub repo setup
⏳ GSD extension + Claude Code initialization
⏳ Next.js project setup
⏳ Phase 1: Bowler profiles + home page
