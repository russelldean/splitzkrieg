# Splitzkrieg Bowling League — Complete Data Model Reference

## Overview

Splitzkrieg is a bowling league management system built on **Google Sheets + Google Apps Script**. It has been running since 2007 (Season I) and is currently on Season XXXV. The league runs two seasons per year (Spring and Fall) and recently expanded from 18 to 20 teams. The system imports raw scoring data, calculates averages/handicaps, tracks personal records, generates weekly reports, and produces league emails.

The owner (Russ) is building a proper database to make league history searchable and fun for members. This document describes everything about the current data model so you can help design that database.

---

## Source Data: The "Data Import" Sheet

This is the **single source of truth** — a flat table of every individual bowler performance line, every week, every season. It lives in a separate Google Sheet file called "Splitzkrieg Raw Data" and is imported into the reports workbook via Apps Script.

### Core Columns (the raw record)

| Column | Name | Type | Description |
|--------|------|------|-------------|
| 1 | **Week** | Integer | Week number within a season (resets each season, typically 1–30+) |
| 2 | **Team** | String | Team name for that week |
| 3 | **Bowler** | String | Bowler's name |
| 4 | **Avg** | Numeric | Bowler's incoming average (average going INTO that week) |
| 5 | **95% HCP** | Numeric | 95% handicap value (calculated from base 225) |
| 6 | **Game 1** | Integer | Score for game 1 (0 or empty = didn't bowl) |
| 7 | **Game 2** | Integer | Score for game 2 |
| 8 | **Game 3** | Integer | Score for game 3 |
| 9 | **Scratch Ser** | Integer | Scratch series total (Game 1 + Game 2 + Game 3) |
| 10 | **Hand1** | Integer | Handicap game 1 score |
| 11 | **Hand2** | Integer | Handicap game 2 score |
| 12 | **Hand3** | Integer | Handicap game 3 score |
| 13 | **HandSeries** | Integer | Handicap series total |
| 14 | **Season** | String | Season identifier in Roman numerals (e.g., "XXXIV") |

### Additional Column

| Column | Name | Type | Description |
|--------|------|------|-------------|
| — | **T** | Integer | Turkey count (3 consecutive strikes) for that week |

### Data Characteristics

- **One row per bowler per week** — each row is a complete bowling night for one person
- Data is stored **newest first** (most recent season/week at the top)
- Season transitions are detected by **week number resets** (when week drops below previous week)
- The dataset spans **35 seasons** from 2007 to present
- Typical season length: ~30 weeks
- Row count: Thousands of rows (growing each week)

### Invalid/Special Bowler Names (filtered out in reports)

These names appear in the data but are not real bowlers:
- `PENALTY`, `Forfeit`, `PACER`, `Bowler`, `Vacant`, `Blind`, `Dummy`, `No Show`, `Sub`, `Substitute`, `VACANT`, `BLIND`

---

## Season Reference Table

Seasons use Roman numerals and map to calendar periods. Two seasons per year (Spring = season 1, Fall = season 2).

| Season | Period | Year | Season# | Notes |
|--------|--------|------|---------|-------|
| XXXV | Fall 2025 | 2025 | 2 | **Current season** |
| XXXIV | Fall 2025 | 2025 | 2 | |
| XXXIII | Spring 2025 | 2025 | 1 | |
| XXXII | Fall 2024 | 2024 | 2 | |
| XXXI | Spring 2024 | 2024 | 1 | |
| XXX | Fall 2023 | 2023 | 2 | |
| XXIX | Spring 2023 | 2023 | 1 | |
| XXVIII | Fall 2022 | 2022 | 2 | |
| XXVII | Spring 2022 | 2022 | 1 | |
| XXVI | Fall 2021 | 2021 | 2 | |
| XXV | DNF 2020 | 2020 | 1 | Did Not Finish (COVID) |
| XXIV | Fall 2019 | 2019 | 2 | |
| XXIII | Spring 2019 | 2019 | 1 | |
| XXII | Fall 2018 | 2018 | 2 | |
| XXI | Spring 2018 | 2018 | 1 | |
| XX | Fall 2017 | 2017 | 2 | |
| XIX | Spring 2017 | 2017 | 1 | |
| XVIII | Fall 2016 | 2016 | 2 | |
| XVII | Spring 2016 | 2016 | 1 | |
| XVI | Fall 2015 | 2015 | 2 | |
| XV | Spring 2015 | 2015 | 1 | |
| XIV | Fall 2014 | 2014 | 2 | |
| XIII | Spring 2014 | 2014 | 1 | |
| XII | Fall 2013 | 2013 | 2 | |
| XI | Spring 2013 | 2013 | 1 | |
| X | Fall 2012 | 2012 | 2 | |
| IX | Spring 2012 | 2012 | 1 | |
| VIII | Fall 2011 | 2011 | 2 | |
| VII | Spring 2011 | 2011 | 1 | |
| VI | Fall 2010 | 2010 | 2 | |
| V | Spring 2010 | 2010 | 1 | |
| IV | Fall 2009 | 2009 | 2 | |
| III | Spring 2009 | 2009 | 1 | |
| II | 2008 | 2008 | 1 | Early seasons, single per year |
| I | 2007 | 2007 | 1 | League founding season |

---

## Supporting Data Tables

### Name Mappings Sheet

Handles bowlers who changed names, had typos, or used different name forms across seasons.

| Column A | Column B |
|----------|----------|
| Old/Alternate Name | Canonical/Current Name |

Also supports **team name mappings** using a `TEAM:` prefix convention:
- `TEAM:Old Team Name` → `TEAM:New Team Name`

### AllBowlers Sheet

Master bowler reference list with demographics.

| Column | Description |
|--------|-------------|
| Bowler | Canonical bowler name |
| MF (or M/F) | Gender: M, F, or X |

### Schedule Import Sheet (in Raw Data file)

Contains the weekly matchup schedule.

| Column | Description |
|--------|-------------|
| 1 | Season (Roman numeral) |
| 2 | Week number |
| 3 | Match number |
| 4 | Team 1 name |
| 5 | Team 2 name |
| 6 | (unused) |
| 7 | Division |
| 8 | Date |

---

## Handicap System

- **Handicap Base**: 225
- **Handicap Percentage**: 95%
- **Formula**: `Handicap = (225 - Average) × 0.95`
- **Minimum games for average**: 3
- **Minimum games for ranking**: 9

---

## Derived/Calculated Data (Report Outputs)

The Apps Script system generates these reports from the raw data:

### Current Averages (⭐ Current Averages)
Per-bowler current season stats: games bowled, total pins, current average, handicap.

### Average Progression (⭐ Average Progression)
Week-by-week average tracking across seasons for each bowler. Shows how average changes over time.

### Personal Records (🏆 Personal Records)
Career stats per bowler:
- Most Recent Team, Bowler Name, Gender, Active flag
- Total Games, Total Pins, High Game, High Series
- 200+ Games count, 600+ Series count, Total Turkeys
- First Night bowled, Last Night bowled
- "Active" = bowled in last 3 seasons

### Weekly Summary (⭐ Weekly Summary)
Per-week leaderboards: top games, top series, notable achievements for each week of each season.

### Season Summary (🏆 Season Summary)
End-of-season stats per bowler per season including final average, high game, high series, games bowled.

### League Stats (📊 League Stats)
Aggregate league-wide stats: total games bowled all-time, total pins, 200+ game counts, 600+ series counts, unique bowlers, etc. Both all-time and current-season breakdowns.

### Milestones (🎯 Milestones)
Tracks bowlers approaching career milestones: next 200 game, next 600 series, game count milestones, pin count milestones.

### Scratch Series (🎳 Scratch Series)
Historical scratch series data and rankings.

### Team Results (👥 Team Results)
Win/loss records for teams within seasons, with points earned.

### Matchup Grid (🎯 Matchup Grid)
Cross-reference grid showing how often each pair of teams has faced each other across seasons.

### Team Schedule (📋 Team Schedule)
Current season schedule showing weekly matchups with dates.

### Scoresheet Data
Pre-formatted data for weekly score sheets with bowler names and current averages.

---

## Achievement Thresholds

| Achievement | Threshold |
|-------------|-----------|
| High Game notable | 200+ |
| High Series notable | 600+ |
| Perfect Game | 300 |
| Perfect Series | 900 |

### Personal Bests Tracking (Weekly Email Feature)
The system detects weekly personal bests for inclusion in league emails:
- New personal high game
- New personal high series
- Turkey achievements
- First-time bowlers are excluded from personal bests output to reduce noise

---

## Key Business Rules

1. **Active bowler** = has bowled in the last 3 seasons
2. **Season transitions** detected by week number resetting (data sorted newest-first)
3. **Name mappings** are applied at read time — the canonical name is used everywhere in reports
4. **Gender** comes from the AllBowlers sheet, not from the raw data
5. **Invalid bowler rows** (PENALTY, Forfeit, PACER, etc.) are always filtered out
6. **Handicap recalculates weekly** based on cumulative average
7. **Turkey tracking** uses a dedup key of `bowler-season-week` to prevent double-counting
8. **Teams can change between seasons** — the "most recent team" is tracked for display
9. **Season XXV (2020)** was "DNF" (Did Not Finish) due to COVID
10. **League size**: Recently expanded from 18 to 20 teams

---

## Current Architecture Summary

```
┌─────────────────────────────┐
│  Splitzkrieg Raw Data       │  ← Separate Google Sheet (source of truth)
│  ├── Data Import            │     Flat table: one row per bowler per week
│  └── Schedule Import        │     Matchup schedule by season
└─────────────┬───────────────┘
              │ Apps Script imports via file ID
              ▼
┌─────────────────────────────┐
│  Reports Workbook           │  ← Main Google Sheet
│  ├── Data_Cache (hidden)    │     Local copy of imported data
│  ├── Data_Metadata (hidden) │     Refresh timestamps
│  ├── Name Mappings          │     Old name → Current name
│  ├── AllBowlers             │     Bowler + Gender master list
│  ├── ⭐ Current Averages    │     ┐
│  ├── ⭐ Average Progression │     │
│  ├── 🏆 Personal Records   │     │
│  ├── ⭐ Weekly Summary      │     │ Generated
│  ├── 🏆 Season Summary     │     │ Reports
│  ├── 📊 League Stats       │     │
│  ├── 🎯 Milestones         │     │
│  ├── 🎳 Scratch Series     │     │
│  ├── 👥 Team Results       │     │
│  ├── 🎯 Matchup Grid       │     │
│  ├── 📋 Team Schedule      │     │
│  └── Scoresheet Data        │     ┘
└─────────────────────────────┘
```

### Apps Script Files (in the Reports Workbook)

| File | Purpose |
|------|---------|
| `config` | Centralized CONFIG object (seasons, thresholds, sheet names, feature flags) |
| `datalayer` | Smart caching, data fetching, name-mapped data access |
| `dataconnection` | Source file connection, refresh, metadata tracking |
| `bowlingutilities` | Shared utilities: validation, name mapping, gender mapping, season info, formatting |
| `formattingutilities` | Sheet formatting helpers (colors, column widths, conditional formatting) |
| `bowlingnightworkflow` | One-click workflow to refresh data + run all reports |
| `menusystem` | Custom Google Sheets menu for all operations |
| `cleaningdata` | One-time data cleanup (permanently fix names in raw data) |
| `updateBowlingAveragesSafe` | Current averages calculation |
| `averageprogression` | Week-by-week average tracking |
| `function_updateRecordsTabSafe` | Personal records generation |
| `updateWeeklySummarySafe` | Weekly summary/leaderboard |
| `updateSeasonSummary` | Season-level summary stats |
| `CreateSummaryReportSafe` | League-wide aggregate stats |
| `updateUpcomingMilestones` | Milestone tracking |
| `updateScratchSeriesDataSafe` | Scratch series report |
| `teamresults` | Team win/loss records |
| `creatematchupgrid` | Team vs. team frequency grid |
| `teamschedule` | Schedule extraction |
| `createScoresheetData` | Scoresheet prep |
| `reportshelper` | Report generation utilities |
| `formatDashboard` | Dashboard formatting |

---

## Database Design Considerations

When building the actual database, here are the key entities that should be normalized from this flat data:

### Suggested Core Tables

1. **Seasons** — SeasonID (Roman numeral), Period (Spring/Fall), Year, SeasonNumber, Notes
2. **Bowlers** — BowlerID, CanonicalName, Gender, FirstSeasonID, IsActive
3. **BowlerNameHistory** — Maps all historical name variants to a BowlerID
4. **Teams** — TeamID, TeamName
5. **TeamNameHistory** — Maps all historical team name variants to a TeamID
6. **TeamRosters** — BowlerID, TeamID, SeasonID (which bowler was on which team each season)
7. **WeeklyScores** — The core fact table: BowlerID, SeasonID, Week, Game1, Game2, Game3, ScratchSeries, IncomingAvg, Handicap, HandicapGame1-3, HandicapSeries, Turkeys
8. **Schedule** — SeasonID, Week, MatchNumber, Team1ID, Team2ID, Division, Date
9. **PersonalBests** — BowlerID, HighGame, HighGameSeasonWeek, HighSeries, HighSeriesSeasonWeek (could be calculated or cached)

### Key Relationships
- A Bowler has many WeeklyScores (one per week bowled)
- A Bowler belongs to one Team per Season (via TeamRosters)
- A Season has many Weeks, each with multiple Matches (via Schedule)
- Name Mappings resolve to a single BowlerID
- Gender lives on the Bowler record, not on each score

---

## Sample Queries the Database Should Support

These are the kinds of things league members want to look up:

- "What's my all-time high game / high series?"
- "How has my average changed season to season?"
- "How many 200+ games have I bowled?"
- "Who has the most turkeys all-time?"
- "What's the league record for highest game / series?"
- "How many times has Team X played Team Y?"
- "Who bowled the best game in Season XXVIII?"
- "Show me every week I bowled over 600 series"
- "When did I first join the league?"
- "What was my average in Spring 2019?"
- "Who are the top 10 bowlers by career total pins?"
- "Show all bowlers who have bowled a 250+ game"
