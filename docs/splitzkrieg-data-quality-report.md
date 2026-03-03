# Splitzkrieg Data Quality Report

Updated March 2026 (post-cleanup session).

## Current Database Stats

| Table | Rows | Notes |
|-------|------|-------|
| seasons | 35 | Seasons I–XXXV |
| bowlers | 619 | Down from 626 after merges and removal of bowlers with no games |
| scores | 22,817 | Up from 22,700 after recovery/corrections |
| teamRosters | 4,322 | |
| schedule | 846 | Seasons XXVI–XXXV only |
| teams | 42 | Down from 43 after Gutter Despair → Bowl Derek merge |
| seasonDivisions | 199 | |
| bowlerNameHistory | 69 | Alternate name mappings |
| teamNameHistory | 29 | 17 franchise lineages mapped |
| correctionLog | 0 | Table exists, not yet populated |
| matchResults | 0 | Not yet populated |
| playoffResults | 0 | Not yet populated |
| seasonChampions | 0 | Not yet populated |
| blogPosts | 0 | Not yet populated |

## Issues Fixed During Migration & Cleanup

### Duplicate Slug: Leo DeLuca
- "Leo Deluca" and "Leo DeLuca" both in AllBowlers — same person
- **Fixed:** Added "Leo Deluca" as alternate name for BowlerID 407

### Name Mapping Error: Mike M → Mike Morrone
- "Mike M" was a one-time sub on Gutterglory in Season XXX Week 2
- NOT Mike Morrone — different person, identity unknown
- **Fixed:** Created "Mike M (Unknown)" bowler, reassigned the score row, removed bad name mapping

### Bowl'd Peanuts Double-Entry: Season IX
- All 4 Bowl'd Peanuts bowlers had duplicate rows in Week 7
- Both sets of scores were real — one set was actually Week 8
- **Fixed:** Set B moved to Week 8

### Unique Constraint Dropped
- `UQ_BowlerSeasonWeek` was too strict — legitimate duplicates exist (subs, Tino McCullough S2W15)
- **Fixed:** Replaced with non-unique index `IX_WeeklyScores_BowlerSeasonWeek`

### Handicap Columns Standardized (Major Change)
- All handicap calculations converted from stored values to **computed columns**
- Formula standardized to **225 base / 95% / FLOOR** across all 35 seasons
- Old stored handicap values intentionally discarded (not backed up)
- See schema doc for full computed column logic

### Penalty Rows Cleaned
- Rows with `isPenalty = 1` now have games set to NULL
- Computed columns produce hcpGame1/2/3 = 199 each, handSeries = 597
- Penalty games no longer pollute scratch aggregates

### Season XVIII Veteran Bowlers — Averages Backfilled
- Bridget Fletcher, Tim Fletcher, Ed Lipkins, Julie Humphrey
- Had missing `incomingAvg` values despite being returning bowlers
- **Fixed:** Averages populated from prior season data

### First-Nighter Corrections
- Ben Cumbee, Leah Joyner, Taylor Boyle, Jaimie Lea
- Had averages assigned despite being first-time bowlers
- **Fixed:** `incomingAvg` set to NULL; computed columns now produce 219 flat handicap

### Kevin Gilcher Average Fix
- Average was incorrect
- **Fixed:** Set to 105

### Denis Webb / Kelly Shirley Injury Rows
- Had NULL individual games (bowled 2 of 3 games due to injury)
- **Fixed:** Handled by computed column logic — NULL game → 199 handicap score

### Bowler Merges
- Joe Phillipose → Joe Philipose (spelling correction)
- Camilla Brennan → Camelia Brennan (spelling correction)
- Katie → Katie O'Brien (name completion)

### Team Merge
- Gutter Despair → Bowl Derek (franchise lineage identified)

### Bowler Cleanup
- 3 bowlers deleted who had no games and no averages
- Established averages populated for returning bowlers

### Tino McCullough: Season II Week 15
- Originally flagged as potential error — appears on both Pin-Ups and Ten Pin Teasers
- **Resolved:** Tino legitimately bowled for two teams in one night. Both rows stay.

## Known Issues — Pending

### Series Mismatches (~83 rows)
- Scratch series doesn't equal Game1 + Game2 + Game3 in the original data
- Now moot for scratch series (computed column always calculates correctly)
- Concentrated in Season XVI Week 5 (likely column shift during original data entry)
- Original stored values logged in migration notes but not in correctionLog table

### Zero-Score Games (4 rows)
- Season II Week 15: Justin Faerber, Paul Cardillo (Jive Turkeys), Stacie Smith (Pin-Ups), Katie Courtland (The Bowled and the Beautiful)
- All 3 games = 0. Could be forfeits that weren't filtered, or placeholder rows
- **Action needed:** Russ to confirm if these should be deleted

### Bowlers Missing Gender (21 people)
These bowlers appear in scoring data but weren't in the AllBowlers master list:
- Alik Lyle, Allan Fast, Annie Seagrest, Clay Staley, Derek Gude, Doug Wixted, Eliza Lawdley, Erik Ramquist, Gillian Galdy, Joe Philipose, Katelin Fallon, Keith McAdoo, Lauren McCullough, Liz Conde, Ray Ray Mejia, Renee Gerardo, Robert Cullen Keel, Rossie Izlar, Shane Huffman, Stephen Eren, Vince Galgano
- **Action needed:** Assign gender (M/F) to each. Most can be inferred from first names.

### fn_RollingAverage — Broken
- Function references old table name `WeeklyScores` and PascalCase column names
- Will fail at runtime
- **Action needed:** Rewrite to use `scores` table with camelCase columns

## Future Data Projects

### Planned Next
- Add `chronoNumber` to bowlers and teams — sequential numbering by first appearance
- Consider first/last name split on bowlers — parked for Phase 1 website

### Missing Nights (7 of 309)
| Season | Week | Notes |
|--------|------|-------|
| I | 9 | Likely playoff week — may not exist |
| II | 16-17 | Unknown — search Gmail |
| V | 9 | Likely playoff week |
| XIII | 9 | Likely playoff week |
| XV | 9 | Likely playoff week |
| XVIII | 9 | Likely playoff week |

### Data Not Yet Loaded
- **COVID interim season** — separate dataset, different team format. Meaningful community moment worth preserving.
- **Schedule data for Seasons I–XXV** — only XXVI–XXXV currently loaded
- **Match results** — table exists but empty, no data loaded yet
- **Playoff results & season champions** — tables exist but empty
- **Paul Cardillo** — missed one of W15/16/17 in Season II (gap, no extra row to recover)

### Parked Investigations
- IncomingAvg backfill for recovered rows (S1W9, S2 W15/16/17)
- 2016 allgames file exploration
- ZUB team placeholder rows — need research to assign correct teams
