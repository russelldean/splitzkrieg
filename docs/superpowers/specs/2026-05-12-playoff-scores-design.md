# Playoff Scores — Design

**Date:** 2026-05-12
**Status:** Spec, awaiting user review

## Problem

Splitzkrieg records playoff *winners* (`playoffResults`) and playoff *qualifiers* (`individualPlayoffParticipants`), but the actual game scores from playoff night are never captured. We want to start recording them — both team semifinal/final scoresheets and individual bracket games — for use on a future playoff recap page.

Constraints from brainstorming:
- Playoff scores must NOT contaminate season averages, BotW, milestones, or career stats. They are a separate data domain.
- One bowler bowls one set of 3 games on playoff night. Those games can simultaneously serve their team's match AND one individual bracket (M Scratch, W Scratch, or Handicap — exclusive per league rule).
- Alternates sometimes bowl in place of qualifiers. Their scores must be recordable. Qualifier patches remain tied to qualifier identity, not to whoever actually bowled.

## Decisions

### 1. New `playoffScores` table (isolated from `scores`)

A separate table mirrors the `scores` shape but stays out of every existing query path. Zero risk of polluting season aggregates or triggering cache cascades across 35 seasons.

**Schema:**

```sql
CREATE TABLE playoffScores (
  playoffScoreID    INT IDENTITY PRIMARY KEY,
  seasonID          INT NOT NULL FOREIGN KEY REFERENCES seasons(seasonID),
  bowlerID          INT NOT NULL FOREIGN KEY REFERENCES bowlers(bowlerID),
  round             INT NOT NULL,                                    -- 1 or 2
  teamID            INT NULL FOREIGN KEY REFERENCES teams(teamID),    -- set if in team semi/final lineup
  championshipType  VARCHAR(30) NULL,                                -- 'MensScratch' | 'WomensScratch' | 'Handicap', NULL if team-only
  game1             INT NULL,
  game2             INT NULL,
  game3             INT NULL,
  incomingAvg       DECIMAL(5,1) NULL,
  -- computed columns mirroring `scores`:
  scratchSeries     AS (ISNULL(game1,0) + ISNULL(game2,0) + ISNULL(game3,0)),
  incomingHcp       AS (CASE WHEN incomingAvg IS NULL THEN 0
                            ELSE FLOOR((225 - FLOOR(incomingAvg)) * 0.95) END) PERSISTED,
  hcpGame1          AS (...),
  hcpGame2          AS (...),
  hcpGame3          AS (...),
  handSeries        AS (...),
  CONSTRAINT chk_playoffScores_role CHECK (teamID IS NOT NULL OR championshipType IS NOT NULL),
  CONSTRAINT uq_playoffScores_bowler_round UNIQUE (seasonID, bowlerID, round)
);

CREATE NONCLUSTERED INDEX IX_playoffScores_season_round
  ON playoffScores (seasonID, round)
  INCLUDE (bowlerID, teamID, championshipType);
```

Key rules enforced by schema:
- `teamID` and `championshipType` can both be set; one or the other can be NULL; both NULL is rejected (the row would mean nothing).
- One bowler bowls one set of games per round — `(seasonID, bowlerID, round)` is unique.

Computed-column expressions for handicap should be copied verbatim from the `scores` table to keep formulas in sync. The migration script will pull them via `INFORMATION_SCHEMA.COMPUTED_COLUMNS` to avoid drift.

### 2. Bracket attachment via `championshipType` on the score row (not via JOIN)

Earlier we considered deriving bracket membership by JOINing to `individualPlayoffParticipants`. The alternate case forces the column onto `playoffScores`: an alternate has scores in a bracket but no qualifier row. Storing `championshipType` directly on `playoffScores` is the only way to know which bracket an alternate's games belong to.

`individualPlayoffParticipants` retains its existing role as the **qualifier registry** — patch source of truth, NOT the score source of truth.

### 3. Alternate detection by absence

A bowler with a row in `playoffScores` but no matching row in `individualPlayoffParticipants` for that `(seasonID, championshipType, round)` is an alternate. The recap UI surfaces this with a label (e.g., "(alternate)"). No `replacedBowlerID` column — keeping it simple per user preference.

### 4. Patches are auto-computed from the `scores` table — unaffected by this work

`scripts/populate-patches.mjs` already awards the relevant patches by querying `scores` directly:

- **`scratchPlayoff`** (M/W Scratch qualifier): top 8 per gender by season scratch avg, 18+ games (override: 9+ for S27). Lines 263–280.
- **`hcpPlayoff`** (Handicap qualifier): top 8 by season hcp avg, excluding anyone in the scratch top 8, 18+ games. Lines 282–315.
- **`scratchChampion` / `hcpChampion`**: read from `seasonChampions` (set manually by admin via the existing playoffs admin page).

Patches are NOT derived from `individualPlayoffParticipants`. That table is an admin-curated "who's on the bracket sheet" view, populated when the playoffs admin page shipped (2026-05-07). It's used for scoresheet generation and to enforce the M/W-scratch-excluded-from-handicap league rule in the admin UI, but the patch script ignores it entirely.

Consequences for this spec:
- **Alternates never receive a qualifier patch automatically** — they didn't make the top-8-by-avg cut, so `populate-patches.mjs` won't award them. This is the right outcome with zero new code.
- **Recording playoff scores is fully orthogonal to patch awarding.** Nothing in `populate-patches.mjs` needs to change.
- The `championshipType` column on `playoffScores` still earns its keep because it records bracket *intent* on the night ("Joe is bowling in M Scratch as an alternate") — a fact that can't be derived from either the qualifier table or the auto-computed top 8.

Champion patches could eventually be auto-determined by `MAX(scratchSeries)` / `MAX(handSeries)` of round 2 in `playoffScores` and written back to `seasonChampions`. Listed in Out of Scope below.

### 5. Write path

A new admin section under `/evillair/playoffs` for entering scores. Two flows:

- **Team match scoresheet entry:** pick a `playoffResults` row (e.g., "Round 1 — Team A1 vs A2"), display the lineup for both teams (from `lineupSubmissions` for that playoff week, or manual entry), key in 3 games per bowler. Saves one `playoffScores` row per bowler with `teamID` set and `championshipType` looked up from `individualPlayoffParticipants` if that bowler is also in an individual bracket.
- **Individual bracket scoresheet entry:** pick a bracket + round, display the qualifier list, allow swapping in an alternate via bowler search. Saves one `playoffScores` row per bowler with `championshipType` set.

The two flows merge into a single upsert by `(seasonID, bowlerID, round)`. A bowler in both team and individual gets one row with both `teamID` and `championshipType` set.

`incomingAvg` is captured at write time as the bowler's regular-season average through the final regular-season week (the same value used to seed individual-bracket qualification). Stored as a whole number per the existing `incomingAvg` convention. This locks the displayed handicap on the scoresheet even if a subsequent score correction shifts the underlying average.

**Open planning-time question:** team playoff lineups currently flow through `lineupSubmissions` keyed by `(seasonID, week, teamID)`. Need to confirm that captains submit lineups for playoff weeks the same way they do for regular weeks — if not, the admin entry UI may need a lineup-entry step before scoresheet entry. Resolve during plan phase.

### 6. Read path

Extend the existing `src/lib/queries/seasons/playoffs.ts` module with three new functions:

- `getTeamPlayoffScoresheet(seasonID, round, teamID)` — returns lineup + games + team rollup
- `getIndividualBracketResults(seasonID, championshipType, round)` — returns ordered leaderboard with alternate flag
- `getPlayoffRecap(seasonID)` — single page-level query bundling everything for the recap page

All wrapped in `cachedQuery()` with `dependsOn: ['playoffScores']` (new channel). The channel busts whenever the admin saves new playoff scores. Since `playoffScores` is a brand-new table never touched by existing queries, this channel is fully isolated — no risk of cross-season cascades.

### 7. Backfill scope: NONE in this phase

We will start recording from S35 (current season) forward. Historical playoff scoresheets are not being backfilled. If we ever want to, the same admin UI can be used retroactively — the schema supports any seasonID.

## Cache & invariant impact

- New table → no existing query is touched → no cache cascade risk
- New `playoffScores` cache channel → only the new playoff queries depend on it
- `cache-invariants` script update: add `playoffScores` to known channel list

## Out of scope (follow-ups)

These are deliberately not in this spec; we'll punt them to a future phase:

1. **Auto-determine round-2 winners** from `playoffScores` and write to `seasonChampions` / `playoffResults.winnerBowlerID`. Currently admin records winners manually.
2. **Public recap page UI** (`/seasons/[slug]/playoffs` or similar). This spec covers data capture; presentation is a separate spec.
3. **Backfill of historical playoff games** from old paper scoresheets, if Russ ever wants to.
4. **Alternate's regular-season patches/stats:** alternates' playoff games still don't count toward season stats — confirmed in spec — but no UI affordance to call out "Joe bowled as alternate" beyond the recap page label.

## Migration

A new script `scripts/create-playoff-scores-table.mjs`:
1. Reads `scores` table's computed-column definitions via `INFORMATION_SCHEMA`
2. Creates `playoffScores` with mirrored formulas
3. Adds the unique constraint and index
4. Idempotent guard (`IF NOT EXISTS`-style check) so it can be re-run safely

After the migration script runs, regenerate `memory/db-schema.md` via `scripts/refresh-schema.mjs`.

## Acceptance

This phase is done when:
1. `playoffScores` table exists in Azure SQL with mirrored handicap formulas
2. Admin can enter a team-match scoresheet and have one row per bowler land in `playoffScores`
3. Admin can enter an individual-bracket scoresheet (with alternate swap) and have rows land correctly
4. A single `getPlayoffRecap(seasonID)` query returns enough data to drive a future recap page
5. `node scripts/check-cache-invariants.mjs` passes with the new channel registered
6. No regression in any existing season query (verified by spot-checking BotW + standings on the current season)
