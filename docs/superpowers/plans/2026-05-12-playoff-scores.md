# Playoff Scores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture team and individual playoff game scores in a new isolated `playoffScores` table, exposed through admin entry forms and read queries, without touching season-stat queries.

**Architecture:** New `playoffScores` table mirrors the `scores` shape (game1/2/3 + computed handicap formulas) but lives outside every existing query path. One row per bowler per round, with `teamID` and `championshipType` columns recording bracket intent. Admin scoresheet entry under `/evillair/playoffs`. New read functions in `src/lib/queries/seasons/playoffs.ts` wrapped in `cachedQuery` with a new `playoffScores` channel. Patches (`scratchPlayoff`, `hcpPlayoff`, etc.) are unchanged — they're still auto-computed from the `scores` table in `scripts/populate-patches.mjs`.

**Tech Stack:** Next.js (App Router), Azure SQL (mssql node driver), Tailwind, Vitest for the few unit-testable pieces.

**Reference spec:** `docs/superpowers/specs/2026-05-12-playoff-scores-design.md`

---

## Files

**Create:**
- `scripts/create-playoff-scores-table.mjs` — migration: creates `playoffScores`, mirrors handicap computed columns from `scores`
- `src/lib/queries/playoffs/scores.ts` — read queries with `dependsOn: ['playoffScores']`
- `src/lib/admin/playoff-scores-admin.ts` — admin write functions and types
- `src/lib/admin/playoff-scores-utils.ts` — pure helpers (alternate detection, team rollup) — testable
- `src/lib/admin/playoff-scores-utils.test.ts` — Vitest unit tests for the pure helpers
- `src/app/api/evillair/playoffs/save-scoresheet/route.ts` — POST endpoint for one scoresheet's rows
- `src/app/evillair/(dashboard)/playoffs/scoresheets/page.tsx` — server component listing matchups/brackets
- `src/app/evillair/(dashboard)/playoffs/scoresheets/PlayoffScoresheetClient.tsx` — client-side scoresheet entry form

**Modify:**
- `scripts/check-cache-invariants.mjs` — add `playoffScores` to `MUTABLE_TABLES` (around line 28)
- `src/app/evillair/(dashboard)/playoffs/PlayoffsAdminClient.tsx` — add a link/button to the new scoresheets page

**Out of scope (separate future plans):**
- Public recap page (`/seasons/[slug]/playoffs/recap` or similar)
- Auto-determine round-2 winners from scores
- Backfill of historical playoff games

---

## Task 1: Create the `playoffScores` migration script

**Files:**
- Create: `scripts/create-playoff-scores-table.mjs`

- [ ] **Step 1: Read formula source for the computed columns**

The `scores` table already has the canonical handicap formulas as computed columns. We need to mirror them exactly. From `memory/db-schema.md` and the `scores` schema, the formulas are:

- `incomingHcp = FLOOR((225 - FLOOR(incomingAvg)) * 0.95)` (max 147; rule from CLAUDE.md)
- `hcpGameN = gameN + incomingHcp` when `incomingAvg` present; `199` flat when `isPenalty=1`; `219` flat when no avg

For the playoff context there are no penalties (every playoff bowler has 18+ games and a known avg), so we can simplify: `incomingAvg` is always present and `isPenalty` is implicitly 0. Computed columns become:

- `incomingHcp = CASE WHEN incomingAvg IS NULL THEN 0 ELSE FLOOR((225 - FLOOR(incomingAvg)) * 0.95) END`
- `hcpGameN = ISNULL(gameN, 0) + incomingHcp`
- `handSeries = hcpGame1 + hcpGame2 + hcpGame3`
- `scratchSeries = ISNULL(game1,0) + ISNULL(game2,0) + ISNULL(game3,0)`

- [ ] **Step 2: Write the migration script**

```javascript
#!/usr/bin/env node
/**
 * One-time setup: Create the playoffScores table.
 *
 * Stores actual game scores from team semifinals/final and individual bracket
 * rounds. Isolated from the `scores` table so season stats stay clean.
 *
 * Usage:
 *   node scripts/create-playoff-scores-table.mjs
 */

import sql from 'mssql';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

const envContent = readFileSync(resolve(PROJECT_ROOT, '.env.local'), 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const dbConfig = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 120000,
    requestTimeout: 30000,
  },
};

async function main() {
  const pool = await new sql.ConnectionPool(dbConfig).connect();

  console.log('Creating playoffScores table (if not exists)...');

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'playoffScores')
    BEGIN
      CREATE TABLE playoffScores (
        playoffScoreID    INT IDENTITY(1,1) PRIMARY KEY,
        seasonID          INT NOT NULL REFERENCES seasons(seasonID),
        bowlerID          INT NOT NULL REFERENCES bowlers(bowlerID),
        round             INT NOT NULL,
        teamID            INT NULL REFERENCES teams(teamID),
        championshipType  VARCHAR(30) NULL,
        game1             INT NULL,
        game2             INT NULL,
        game3             INT NULL,
        incomingAvg       DECIMAL(5,1) NULL,
        scratchSeries     AS (ISNULL(game1,0) + ISNULL(game2,0) + ISNULL(game3,0)),
        incomingHcp       AS (CASE WHEN incomingAvg IS NULL THEN 0
                                   ELSE FLOOR((225 - FLOOR(incomingAvg)) * 0.95) END) PERSISTED,
        hcpGame1          AS (ISNULL(game1,0)
                              + (CASE WHEN incomingAvg IS NULL THEN 0
                                      ELSE FLOOR((225 - FLOOR(incomingAvg)) * 0.95) END)),
        hcpGame2          AS (ISNULL(game2,0)
                              + (CASE WHEN incomingAvg IS NULL THEN 0
                                      ELSE FLOOR((225 - FLOOR(incomingAvg)) * 0.95) END)),
        hcpGame3          AS (ISNULL(game3,0)
                              + (CASE WHEN incomingAvg IS NULL THEN 0
                                      ELSE FLOOR((225 - FLOOR(incomingAvg)) * 0.95) END)),
        handSeries        AS (ISNULL(game1,0) + ISNULL(game2,0) + ISNULL(game3,0)
                              + 3 * (CASE WHEN incomingAvg IS NULL THEN 0
                                          ELSE FLOOR((225 - FLOOR(incomingAvg)) * 0.95) END)),
        CONSTRAINT CK_playoffScores_role
          CHECK (teamID IS NOT NULL OR championshipType IS NOT NULL),
        CONSTRAINT CK_playoffScores_round
          CHECK (round IN (1, 2)),
        CONSTRAINT CK_playoffScores_type
          CHECK (championshipType IS NULL
                 OR championshipType IN ('MensScratch','WomensScratch','Handicap')),
        CONSTRAINT UQ_playoffScores_bowler_round
          UNIQUE (seasonID, bowlerID, round)
      );

      CREATE INDEX IX_playoffScores_season_round
        ON playoffScores (seasonID, round)
        INCLUDE (bowlerID, teamID, championshipType);

      PRINT 'Table created.';
    END
    ELSE
    BEGIN
      PRINT 'Table already exists, skipping creation.';
    END
  `);

  const result = await pool.request().query(
    `SELECT COUNT(*) AS cnt FROM playoffScores`
  );
  console.log(`playoffScores: ${result.recordset[0].cnt} rows`);

  await pool.close();
  console.log('Done.');
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
```

- [ ] **Step 3: Run the migration**

Run: `node scripts/create-playoff-scores-table.mjs`
Expected output: `Table created.` then `playoffScores: 0 rows` then `Done.`

- [ ] **Step 4: Verify computed columns work**

Run a one-off check in your shell:
```bash
node -e 'import("mssql").then(async ({default: sql}) => {
  const fs = await import("fs");
  for (const line of fs.readFileSync(".env.local","utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()]=m[2].trim();
  }
  const pool = await new sql.ConnectionPool({
    server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
    user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
    options: { encrypt: true, trustServerCertificate: false }
  }).connect();
  await pool.request().query(`INSERT INTO playoffScores (seasonID, bowlerID, round, championshipType, game1, game2, game3, incomingAvg) SELECT TOP 1 35, bowlerID, 1, '"'"'MensScratch'"'"', 200, 200, 200, 180 FROM bowlers WHERE isActive=1`);
  const r = await pool.request().query(`SELECT TOP 1 game1, scratchSeries, incomingHcp, hcpGame1, handSeries FROM playoffScores ORDER BY playoffScoreID DESC`);
  console.log(r.recordset);
  await pool.request().query(`DELETE FROM playoffScores WHERE round = 1 AND seasonID = 35 AND game1 = 200 AND game2 = 200 AND game3 = 200`);
  await pool.close();
})'
```
Expected: one row showing `scratchSeries: 600`, `incomingHcp: 43` (FLOOR((225-180)*0.95) = FLOOR(42.75) = 42 — recheck: actually 225-180=45, 45*0.95=42.75, FLOOR=42; let's say 42), `hcpGame1: 242`, `handSeries: 726`. Adjust expectations to match if formulas differ; the goal is sanity-checking that computed columns evaluate at all.

- [ ] **Step 5: Refresh schema doc**

Run: `node scripts/refresh-schema.mjs`
Expected: `memory/db-schema.md` regenerates and includes the new `playoffScores` table.

- [ ] **Step 6: Commit**

```bash
git add scripts/create-playoff-scores-table.mjs memory/db-schema.md
git commit -m "$(cat <<'EOF'
feat: add playoffScores table for capturing playoff games

Mirrors the scores table shape with computed handicap columns, isolated
from season-stat queries. Stores team semifinal/final scoresheets and
individual bracket rounds. Constraints enforce one set of games per
bowler per round and at least one of teamID/championshipType.
EOF
)"
```

---

## Task 2: Register `playoffScores` in cache invariants

**Files:**
- Modify: `scripts/check-cache-invariants.mjs:28-32`

- [ ] **Step 1: Add `playoffScores` to the MUTABLE_TABLES list**

Open `scripts/check-cache-invariants.mjs`. Locate the `MUTABLE_TABLES` array (around line 28). Add `'playoffScores'` to the array. The result should look like:

```javascript
const MUTABLE_TABLES = [
  'scores', 'matchResults', 'bowlerPatches', 'bowlerMilestones',
  'schedule', 'seasonDivisions', 'playoffResults', 'seasonChampions',
  'leagueSettings', 'teamRosters', 'teamNameHistory', 'bowlerNameHistory',
  'playoffScores',
];
```

- [ ] **Step 2: Run the invariants check**

Run: `node scripts/check-cache-invariants.mjs`
Expected: pre-existing violations (the 8 in `project_cache_invariants_backlog.md`) may still show; no NEW violations introduced. Exit code is whatever it was before.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-cache-invariants.mjs
git commit -m "chore: register playoffScores as a mutable table in cache invariants"
```

---

## Task 3: Pure helpers + tests for scoresheet utilities

**Files:**
- Create: `src/lib/admin/playoff-scores-utils.ts`
- Create: `src/lib/admin/playoff-scores-utils.test.ts`

The two pure functions worth unit-testing are: (a) summing a team's lineup into team game/series totals, and (b) detecting an alternate by comparing the bowled list to the qualifier list.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/admin/playoff-scores-utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { rollupTeamTotals, flagAlternates } from './playoff-scores-utils';

describe('rollupTeamTotals', () => {
  it('sums three bowlers into team game and series totals', () => {
    const rows = [
      { bowlerID: 1, game1: 200, game2: 210, game3: 190, incomingAvg: 180 },
      { bowlerID: 2, game1: 150, game2: 160, game3: 170, incomingAvg: 150 },
      { bowlerID: 3, game1: 220, game2: 180, game3: 200, incomingAvg: 200 },
    ];
    const result = rollupTeamTotals(rows);
    expect(result.scratch).toEqual({ game1: 570, game2: 550, game3: 560, series: 1680 });
  });

  it('returns zeros for an empty lineup', () => {
    expect(rollupTeamTotals([])).toEqual({
      scratch: { game1: 0, game2: 0, game3: 0, series: 0 },
    });
  });

  it('treats null games as zero', () => {
    const rows = [
      { bowlerID: 1, game1: 200, game2: null, game3: 190, incomingAvg: 180 },
      { bowlerID: 2, game1: null, game2: 160, game3: null, incomingAvg: 150 },
    ];
    const result = rollupTeamTotals(rows);
    expect(result.scratch).toEqual({ game1: 200, game2: 160, game3: 190, series: 550 });
  });
});

describe('flagAlternates', () => {
  it('flags bowlers who bowled but are not in the qualifier list', () => {
    const bowled = [{ bowlerID: 1 }, { bowlerID: 2 }, { bowlerID: 3 }];
    const qualifiers = [{ bowlerID: 1 }, { bowlerID: 2 }];
    const result = flagAlternates(bowled, qualifiers);
    expect(result).toEqual([
      { bowlerID: 1, isAlternate: false },
      { bowlerID: 2, isAlternate: false },
      { bowlerID: 3, isAlternate: true },
    ]);
  });

  it('returns no alternates when qualifier and bowled sets match', () => {
    const bowled = [{ bowlerID: 1 }, { bowlerID: 2 }];
    const qualifiers = [{ bowlerID: 1 }, { bowlerID: 2 }];
    expect(flagAlternates(bowled, qualifiers).every(r => !r.isAlternate)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/admin/playoff-scores-utils.test.ts`
Expected: FAIL with "Cannot find module './playoff-scores-utils'".

- [ ] **Step 3: Implement the helpers**

Create `src/lib/admin/playoff-scores-utils.ts`:

```typescript
export interface BowlerGameRow {
  bowlerID: number;
  game1: number | null;
  game2: number | null;
  game3: number | null;
  incomingAvg: number | null;
}

export interface TeamRollup {
  scratch: {
    game1: number;
    game2: number;
    game3: number;
    series: number;
  };
}

export function rollupTeamTotals(rows: BowlerGameRow[]): TeamRollup {
  const sum = (key: 'game1' | 'game2' | 'game3') =>
    rows.reduce((acc, r) => acc + (r[key] ?? 0), 0);
  const g1 = sum('game1');
  const g2 = sum('game2');
  const g3 = sum('game3');
  return { scratch: { game1: g1, game2: g2, game3: g3, series: g1 + g2 + g3 } };
}

export interface QualifierRef {
  bowlerID: number;
}

export function flagAlternates<T extends { bowlerID: number }>(
  bowled: T[],
  qualifiers: QualifierRef[],
): Array<T & { isAlternate: boolean }> {
  const qualifierSet = new Set(qualifiers.map(q => q.bowlerID));
  return bowled.map(b => ({ ...b, isAlternate: !qualifierSet.has(b.bowlerID) }));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/admin/playoff-scores-utils.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/playoff-scores-utils.ts src/lib/admin/playoff-scores-utils.test.ts
git commit -m "feat: pure helpers for playoff scoresheet rollup and alternate detection"
```

---

## Task 4: Admin write functions for `playoffScores`

**Files:**
- Create: `src/lib/admin/playoff-scores-admin.ts`

- [ ] **Step 1: Define types and the upsert function**

Create `src/lib/admin/playoff-scores-admin.ts`:

```typescript
/**
 * Playoff scores admin: write functions for the playoffScores table.
 *
 * Each row represents one bowler's 3-game set for one playoff round.
 * (seasonID, bowlerID, round) is the natural key — re-saving overwrites.
 */

import sql from 'mssql';
import { getDb } from '@/lib/db';
import type { ChampionshipType } from './playoff-admin';

export interface PlayoffScoreInput {
  bowlerID: number;
  teamID: number | null;
  championshipType: ChampionshipType | null;
  game1: number | null;
  game2: number | null;
  game3: number | null;
  incomingAvg: number | null;
}

export interface PlayoffScoreRow extends PlayoffScoreInput {
  playoffScoreID: number;
  seasonID: number;
  round: 1 | 2;
  scratchSeries: number;
  incomingHcp: number;
  hcpGame1: number;
  hcpGame2: number;
  hcpGame3: number;
  handSeries: number;
}

/**
 * Upsert a batch of playoff score rows for a single (seasonID, round).
 * Re-saving any (seasonID, bowlerID, round) overwrites the prior row.
 *
 * Validation:
 * - Each row must have teamID OR championshipType set (or both); both NULL is rejected.
 * - round must be 1 or 2.
 * - championshipType must be one of the three valid values when set.
 */
export async function savePlayoffScores(
  seasonID: number,
  round: 1 | 2,
  rows: PlayoffScoreInput[],
): Promise<void> {
  if (round !== 1 && round !== 2) {
    throw new Error(`round must be 1 or 2, got ${round}`);
  }
  for (const r of rows) {
    if (r.teamID == null && r.championshipType == null) {
      throw new Error(`Row for bowlerID ${r.bowlerID} has neither teamID nor championshipType`);
    }
    if (r.championshipType != null
        && !['MensScratch', 'WomensScratch', 'Handicap'].includes(r.championshipType)) {
      throw new Error(`Invalid championshipType: ${r.championshipType}`);
    }
  }

  const pool = await getDb();
  for (const r of rows) {
    await pool.request()
      .input('seasonID', sql.Int, seasonID)
      .input('bowlerID', sql.Int, r.bowlerID)
      .input('round', sql.Int, round)
      .input('teamID', sql.Int, r.teamID)
      .input('championshipType', sql.VarChar(30), r.championshipType)
      .input('game1', sql.Int, r.game1)
      .input('game2', sql.Int, r.game2)
      .input('game3', sql.Int, r.game3)
      .input('incomingAvg', sql.Decimal(5, 1), r.incomingAvg)
      .query(`
        MERGE playoffScores AS tgt
        USING (SELECT @seasonID AS seasonID, @bowlerID AS bowlerID, @round AS round) AS src
          ON tgt.seasonID = src.seasonID
             AND tgt.bowlerID = src.bowlerID
             AND tgt.round = src.round
        WHEN MATCHED THEN UPDATE SET
          teamID = @teamID,
          championshipType = @championshipType,
          game1 = @game1,
          game2 = @game2,
          game3 = @game3,
          incomingAvg = @incomingAvg
        WHEN NOT MATCHED THEN
          INSERT (seasonID, bowlerID, round, teamID, championshipType,
                  game1, game2, game3, incomingAvg)
          VALUES (@seasonID, @bowlerID, @round, @teamID, @championshipType,
                  @game1, @game2, @game3, @incomingAvg);
      `);
  }
}

/**
 * Read all rows for a season/round (admin view). Used to prefill the entry form.
 */
export async function getPlayoffScoresForRound(
  seasonID: number,
  round: 1 | 2,
): Promise<PlayoffScoreRow[]> {
  const pool = await getDb();
  const result = await pool.request()
    .input('seasonID', sql.Int, seasonID)
    .input('round', sql.Int, round)
    .query<PlayoffScoreRow>(`
      SELECT playoffScoreID, seasonID, bowlerID, round, teamID, championshipType,
             game1, game2, game3, incomingAvg,
             scratchSeries, incomingHcp, hcpGame1, hcpGame2, hcpGame3, handSeries
      FROM playoffScores
      WHERE seasonID = @seasonID AND round = @round
      ORDER BY championshipType, teamID, bowlerID
    `);
  return result.recordset;
}
```

- [ ] **Step 2: TypeScript sanity check**

Run: `npx tsc --noEmit`
Expected: PASS with no new errors in the new file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/playoff-scores-admin.ts
git commit -m "feat: admin write functions for playoffScores upsert and reads"
```

---

## Task 5: Read queries with `playoffScores` cache channel

**Files:**
- Create: `src/lib/queries/playoffs/scores.ts`

- [ ] **Step 1: Verify directory and pattern**

The existing playoff queries live in `src/lib/queries/seasons/playoffs.ts`. We're creating a new sibling directory `src/lib/queries/playoffs/` to host playoff-score-specific queries. The pattern to mirror is `seasons/playoffs.ts` (which uses `cachedQuery` with `dependsOn` and `sql` options).

Run: `ls src/lib/queries/`
Expected: directory listing includes `seasons/`. Create the new directory if needed: `mkdir -p src/lib/queries/playoffs`.

- [ ] **Step 2: Write the read queries**

Create `src/lib/queries/playoffs/scores.ts`:

```typescript
import { cachedQuery, getDb } from '@/lib/db';
import sql from 'mssql';
import type { ChampionshipType } from '@/lib/admin/playoff-admin';

export interface PlayoffScoresheetEntry {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  teamID: number | null;
  championshipType: ChampionshipType | null;
  game1: number | null;
  game2: number | null;
  game3: number | null;
  incomingAvg: number | null;
  scratchSeries: number;
  handSeries: number;
  isAlternate: boolean;
}

const TEAM_SCORESHEET_SQL = `
  SELECT ps.bowlerID, b.bowlerName, b.slug,
         ps.teamID, ps.championshipType,
         ps.game1, ps.game2, ps.game3, ps.incomingAvg,
         ps.scratchSeries, ps.handSeries,
         CAST(0 AS BIT) AS isAlternate
  FROM playoffScores ps
  JOIN bowlers b ON b.bowlerID = ps.bowlerID
  WHERE ps.seasonID = @seasonID AND ps.round = @round AND ps.teamID = @teamID
  ORDER BY ps.playoffScoreID
`;

/**
 * Returns the lineup that bowled for one team in one playoff round.
 * Used to render a team scoresheet on the future public recap page.
 */
export async function getTeamPlayoffScoresheet(
  seasonID: number,
  round: 1 | 2,
  teamID: number,
): Promise<PlayoffScoresheetEntry[]> {
  return cachedQuery(
    `getTeamPlayoffScoresheet-${seasonID}-${round}-${teamID}`,
    async () => {
      const pool = await getDb();
      const result = await pool.request()
        .input('seasonID', sql.Int, seasonID)
        .input('round', sql.Int, round)
        .input('teamID', sql.Int, teamID)
        .query<PlayoffScoresheetEntry>(TEAM_SCORESHEET_SQL);
      return result.recordset;
    },
    [],
    { sql: TEAM_SCORESHEET_SQL, dependsOn: ['playoffScores'], seasonID },
  );
}

const INDIVIDUAL_BRACKET_SQL = `
  SELECT ps.bowlerID, b.bowlerName, b.slug,
         ps.teamID, ps.championshipType,
         ps.game1, ps.game2, ps.game3, ps.incomingAvg,
         ps.scratchSeries, ps.handSeries,
         CASE WHEN ipp.bowlerID IS NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS isAlternate
  FROM playoffScores ps
  JOIN bowlers b ON b.bowlerID = ps.bowlerID
  LEFT JOIN individualPlayoffParticipants ipp
    ON ipp.seasonID = ps.seasonID
       AND ipp.bowlerID = ps.bowlerID
       AND ipp.championshipType = ps.championshipType
       AND ipp.round = ps.round
  WHERE ps.seasonID = @seasonID
    AND ps.round = @round
    AND ps.championshipType = @championshipType
  ORDER BY
    CASE WHEN ps.championshipType = 'Handicap' THEN ps.handSeries ELSE ps.scratchSeries END DESC
`;

/**
 * Returns the leaderboard for one individual bracket round, ordered by the
 * relevant series (handSeries for Handicap, scratchSeries otherwise). Bowlers
 * not in individualPlayoffParticipants for this season+type+round are flagged
 * as alternates.
 */
export async function getIndividualBracketResults(
  seasonID: number,
  championshipType: ChampionshipType,
  round: 1 | 2,
): Promise<PlayoffScoresheetEntry[]> {
  return cachedQuery(
    `getIndividualBracketResults-${seasonID}-${championshipType}-${round}`,
    async () => {
      const pool = await getDb();
      const result = await pool.request()
        .input('seasonID', sql.Int, seasonID)
        .input('round', sql.Int, round)
        .input('championshipType', sql.VarChar(30), championshipType)
        .query<PlayoffScoresheetEntry>(INDIVIDUAL_BRACKET_SQL);
      return result.recordset;
    },
    [],
    { sql: INDIVIDUAL_BRACKET_SQL, dependsOn: ['playoffScores'], seasonID },
  );
}
```

- [ ] **Step 3: Wire the new channel into data-versions**

The `dependsOn: ['playoffScores']` channel only invalidates when `.data-versions.json` includes a `playoffScores` channel. Open `.data-versions.json`:

Run: `cat .data-versions.json`

Expected: existing JSON like `{ "scores": { "35": 4 }, "schedule": { "17": 3 } }`. Add a `playoffScores` channel keyed by current season:

```json
{
  "scores": { "...": "..." },
  "schedule": { "...": "..." },
  "playoffScores": { "35": 1 }
}
```

Use a small node-eval to do this safely (don't hand-edit if seasonIDs are dynamic; for now seasonID 35 is the only relevant one):

```bash
node -e 'const fs=require("fs"); const v=JSON.parse(fs.readFileSync(".data-versions.json","utf8")); v.playoffScores = v.playoffScores || {}; v.playoffScores["35"] = (v.playoffScores["35"]||0)+1; fs.writeFileSync(".data-versions.json", JSON.stringify(v,null,2) + "\n");'
```

- [ ] **Step 4: TypeScript sanity check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Cache invariants check**

Run: `node scripts/check-cache-invariants.mjs`
Expected: no new violations introduced by the two new cached queries (each has `sql`, `dependsOn`, `seasonID`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/queries/playoffs/scores.ts .data-versions.json
git commit -m "feat: cached read queries for playoff team and individual scoresheets"
```

---

## Task 6: API route to save a scoresheet

**Files:**
- Create: `src/app/api/evillair/playoffs/save-scoresheet/route.ts`

- [ ] **Step 1: Write the route**

Create `src/app/api/evillair/playoffs/save-scoresheet/route.ts`:

```typescript
/**
 * POST /api/evillair/playoffs/save-scoresheet
 * Save (upsert) playoff score rows for one (seasonID, round).
 *
 * Body: { seasonID, round, rows: PlayoffScoreInput[] }
 *
 * Each row represents one bowler's 3 games. teamID and/or championshipType
 * must be set on each row. Re-posting overwrites existing rows by
 * (seasonID, bowlerID, round).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/auth';
import {
  savePlayoffScores,
  type PlayoffScoreInput,
} from '@/lib/admin/playoff-scores-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
  } catch {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { seasonID, round, rows } = body as {
      seasonID: number;
      round: 1 | 2;
      rows: PlayoffScoreInput[];
    };

    if (!seasonID || !round || !Array.isArray(rows)) {
      return NextResponse.json(
        { error: 'seasonID, round, and rows[] are required' },
        { status: 400 },
      );
    }
    if (round !== 1 && round !== 2) {
      return NextResponse.json({ error: 'round must be 1 or 2' }, { status: 400 });
    }
    if (rows.length === 0) {
      return NextResponse.json({ error: 'rows must not be empty' }, { status: 400 });
    }

    await savePlayoffScores(seasonID, round, rows);
    return NextResponse.json({ ok: true, count: rows.length });
  } catch (err) {
    console.error('save-scoresheet error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save' },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: TypeScript sanity check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/evillair/playoffs/save-scoresheet/route.ts
git commit -m "feat: API route to save playoff scoresheet rows"
```

---

## Task 7: Admin scoresheet entry page

**Files:**
- Create: `src/app/evillair/(dashboard)/playoffs/scoresheets/page.tsx`
- Create: `src/app/evillair/(dashboard)/playoffs/scoresheets/PlayoffScoresheetClient.tsx`

This page lets the admin enter scores for one of:
- A team match (semifinal or final) — lineup of 3+ bowlers per team
- An individual bracket round — 8 bowlers (round 1) or 4 bowlers (round 2)

The MVP renders a single mode-selector at the top, then a table with: bowler name, incomingAvg, three game inputs, and computed total. Save button posts to `/api/evillair/playoffs/save-scoresheet`.

- [ ] **Step 1: Write the server page**

Create `src/app/evillair/(dashboard)/playoffs/scoresheets/page.tsx`:

```typescript
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getCurrentSeason } from '@/lib/queries/seasons/core';
import {
  getDivisionTopTeams,
  getIndividualPlayoffParticipants,
} from '@/lib/admin/playoff-admin';
import { getPlayoffScoresForRound } from '@/lib/admin/playoff-scores-admin';
import { PlayoffScoresheetClient } from './PlayoffScoresheetClient';

export const dynamic = 'force-dynamic';

export default async function PlayoffScoresheetsPage() {
  const cookieStore = await cookies();
  if (!cookieStore.get('admin_session')) redirect('/evillair/login');

  const season = await getCurrentSeason();
  if (!season) {
    return <div className="p-6">No current season found.</div>;
  }

  // Pre-load what the admin will need: top teams (for team scoresheets) and the
  // individual participant lists (for individual bracket scoresheets).
  const [topTeams, mScratchR1, wScratchR1, hcpR1, mScratchR2, wScratchR2, hcpR2, existingR1, existingR2] =
    await Promise.all([
      getDivisionTopTeams(season.seasonID),
      getIndividualPlayoffParticipants(season.seasonID, 'MensScratch', 1),
      getIndividualPlayoffParticipants(season.seasonID, 'WomensScratch', 1),
      getIndividualPlayoffParticipants(season.seasonID, 'Handicap', 1),
      getIndividualPlayoffParticipants(season.seasonID, 'MensScratch', 2),
      getIndividualPlayoffParticipants(season.seasonID, 'WomensScratch', 2),
      getIndividualPlayoffParticipants(season.seasonID, 'Handicap', 2),
      getPlayoffScoresForRound(season.seasonID, 1),
      getPlayoffScoresForRound(season.seasonID, 2),
    ]);

  return (
    <PlayoffScoresheetClient
      seasonID={season.seasonID}
      seasonName={season.displayName ?? `Season ${season.seasonID}`}
      topTeams={topTeams}
      individualParticipants={{
        1: { MensScratch: mScratchR1, WomensScratch: wScratchR1, Handicap: hcpR1 },
        2: { MensScratch: mScratchR2, WomensScratch: wScratchR2, Handicap: hcpR2 },
      }}
      existingScores={{ 1: existingR1, 2: existingR2 }}
    />
  );
}
```

**Note on imports:** `getIndividualPlayoffParticipants` is the existing read function in `src/lib/admin/playoff-admin.ts` — verify its exported name. If it has a different name (e.g., `loadIndividualPlayoffField`), update the import.

- [ ] **Step 2: Verify the import names exist**

Run: `grep -n "^export" src/lib/admin/playoff-admin.ts`
Expected: includes `getDivisionTopTeams` and a function returning the individual participants. If the actual exported name differs from `getIndividualPlayoffParticipants`, update the page imports to match.

- [ ] **Step 3: Write the client component**

Create `src/app/evillair/(dashboard)/playoffs/scoresheets/PlayoffScoresheetClient.tsx`:

```typescript
'use client';

import { useState, useMemo } from 'react';
import type { ChampionshipType, PlayoffEligibleBowler, DivisionTopTeam } from '@/lib/admin/playoff-admin';
import type { PlayoffScoreInput, PlayoffScoreRow } from '@/lib/admin/playoff-scores-admin';
import { rollupTeamTotals } from '@/lib/admin/playoff-scores-utils';

type ParticipantsByRoundType = {
  1: Record<ChampionshipType, PlayoffEligibleBowler[]>;
  2: Record<ChampionshipType, PlayoffEligibleBowler[]>;
};

interface Props {
  seasonID: number;
  seasonName: string;
  topTeams: DivisionTopTeam[];
  individualParticipants: ParticipantsByRoundType;
  existingScores: { 1: PlayoffScoreRow[]; 2: PlayoffScoreRow[] };
}

type Mode =
  | { kind: 'team'; teamID: number }
  | { kind: 'individual'; championshipType: ChampionshipType };

interface EditableRow {
  bowlerID: number;
  bowlerName: string;
  teamID: number | null;
  championshipType: ChampionshipType | null;
  game1: number | null;
  game2: number | null;
  game3: number | null;
  incomingAvg: number | null;
}

export function PlayoffScoresheetClient({
  seasonID,
  seasonName,
  topTeams,
  individualParticipants,
  existingScores,
}: Props) {
  const [round, setRound] = useState<1 | 2>(1);
  const [mode, setMode] = useState<Mode | null>(null);
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function loadMode(newMode: Mode, newRound: 1 | 2) {
    setError(null);
    setSavedAt(null);
    const existing = existingScores[newRound];

    if (newMode.kind === 'team') {
      // For team mode, start from existing rows for that teamID (could be empty
      // if not yet entered). Admin keys in bowlers manually if no prior data.
      const teamRows = existing.filter(r => r.teamID === newMode.teamID);
      setRows(teamRows.map(r => ({
        bowlerID: r.bowlerID,
        bowlerName: '',
        teamID: r.teamID,
        championshipType: r.championshipType,
        game1: r.game1,
        game2: r.game2,
        game3: r.game3,
        incomingAvg: r.incomingAvg,
      })));
    } else {
      // For individual mode, seed rows from the participant list (qualifiers).
      const participants = individualParticipants[newRound][newMode.championshipType];
      const existingByBowler = new Map(
        existing
          .filter(r => r.championshipType === newMode.championshipType)
          .map(r => [r.bowlerID, r])
      );
      setRows(participants.map(p => {
        const prior = existingByBowler.get(p.bowlerID);
        return {
          bowlerID: p.bowlerID,
          bowlerName: p.bowlerName,
          teamID: prior?.teamID ?? null,
          championshipType: newMode.championshipType,
          game1: prior?.game1 ?? null,
          game2: prior?.game2 ?? null,
          game3: prior?.game3 ?? null,
          incomingAvg: prior?.incomingAvg ?? p.value,
        };
      }));
    }
    setMode(newMode);
    setRound(newRound);
  }

  function updateGame(idx: number, key: 'game1' | 'game2' | 'game3', value: string) {
    setRows(rs => rs.map((r, i) =>
      i === idx ? { ...r, [key]: value === '' ? null : Number(value) } : r
    ));
  }

  const totals = useMemo(() => rollupTeamTotals(rows), [rows]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload: PlayoffScoreInput[] = rows.map(r => ({
        bowlerID: r.bowlerID,
        teamID: r.teamID,
        championshipType: r.championshipType,
        game1: r.game1,
        game2: r.game2,
        game3: r.game3,
        incomingAvg: r.incomingAvg,
      }));
      const res = await fetch('/api/evillair/playoffs/save-scoresheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonID, round, rows: payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Save failed (${res.status})`);
      }
      setSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Playoff Scoresheets — {seasonName}</h1>

      <div className="flex gap-2">
        <button
          className={`px-3 py-1 rounded border ${round === 1 ? 'bg-blue-100' : ''}`}
          onClick={() => setRound(1)}
        >Round 1</button>
        <button
          className={`px-3 py-1 rounded border ${round === 2 ? 'bg-blue-100' : ''}`}
          onClick={() => setRound(2)}
        >Round 2</button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className="font-semibold mb-2">Team matches</h2>
          <ul className="space-y-1">
            {topTeams.map(t => (
              <li key={t.teamID}>
                <button
                  className="underline text-sm"
                  onClick={() => loadMode({ kind: 'team', teamID: t.teamID }, round)}
                >
                  {t.teamName} ({t.divisionName} #{t.divRank})
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-semibold mb-2">Individual brackets</h2>
          <ul className="space-y-1">
            {(['MensScratch', 'WomensScratch', 'Handicap'] as const).map(ct => (
              <li key={ct}>
                <button
                  className="underline text-sm"
                  onClick={() => loadMode({ kind: 'individual', championshipType: ct }, round)}
                >
                  {ct}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {mode && (
        <div className="border-t pt-4">
          <h2 className="font-semibold mb-2">
            {mode.kind === 'team'
              ? `Team scoresheet — Round ${round}`
              : `${mode.championshipType} — Round ${round}`}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left">
                <th>Bowler</th>
                <th>Avg</th>
                <th>Game 1</th>
                <th>Game 2</th>
                <th>Game 3</th>
                <th>Series</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const series = (r.game1 ?? 0) + (r.game2 ?? 0) + (r.game3 ?? 0);
                return (
                  <tr key={r.bowlerID} className="border-t">
                    <td>{r.bowlerName || `Bowler ${r.bowlerID}`}</td>
                    <td>{r.incomingAvg ?? '—'}</td>
                    {(['game1','game2','game3'] as const).map(g => (
                      <td key={g}>
                        <input
                          type="number"
                          className="w-16 border rounded px-1"
                          value={r[g] ?? ''}
                          onChange={e => updateGame(i, g, e.target.value)}
                        />
                      </td>
                    ))}
                    <td>{series}</td>
                  </tr>
                );
              })}
            </tbody>
            {mode.kind === 'team' && (
              <tfoot>
                <tr className="border-t font-semibold">
                  <td>Totals</td>
                  <td />
                  <td>{totals.scratch.game1}</td>
                  <td>{totals.scratch.game2}</td>
                  <td>{totals.scratch.game3}</td>
                  <td>{totals.scratch.series}</td>
                </tr>
              </tfoot>
            )}
          </table>
          <div className="mt-4 flex items-center gap-3">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              onClick={save}
              disabled={saving || rows.length === 0}
            >
              {saving ? 'Saving...' : 'Save scoresheet'}
            </button>
            {savedAt && <span className="text-sm text-green-600">Saved at {savedAt}</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Note:** The team-mode flow is intentionally minimal in this MVP — it assumes rows have already been seeded (e.g., by the admin entering bowler IDs manually or by extending this page to pre-load team lineups from `lineupSubmissions`). The "Open planning-time question" in the spec applies here. For first-use this season (S35 round 1 = 2026-05-11), if there's no `lineupSubmission` for the playoff week, the admin will need a way to add bowlers. The simplest stopgap: enable individual mode first (which seeds from qualifiers automatically), and treat the team scoresheet as a follow-up enhancement if needed.

- [ ] **Step 4: Add a link to the new page from the existing playoffs admin**

Open `src/app/evillair/(dashboard)/playoffs/PlayoffsAdminClient.tsx` and add a `<Link>` to `/evillair/playoffs/scoresheets` near the top, e.g.:

```tsx
import Link from 'next/link';
// ... inside the component, near the top of the rendered JSX:
<div className="mb-4">
  <Link href="/evillair/playoffs/scoresheets" className="text-blue-600 underline">
    → Enter playoff scoresheets
  </Link>
</div>
```

- [ ] **Step 5: TypeScript + lint check**

Run: `npx tsc --noEmit && npx eslint src/app/evillair/(dashboard)/playoffs/scoresheets src/app/api/evillair/playoffs/save-scoresheet`
Expected: PASS with no new errors.

- [ ] **Step 6: Manual smoke test in dev**

Run: `npm run dev`
Then in a browser, log in to `/evillair`, click the new "Enter playoff scoresheets" link, switch to Round 1, click MensScratch, key in three game scores for the first row, and click Save. Verify the page shows "Saved at HH:MM:SS". Then reload — the entered scores should still be in the inputs.

Verify in DB:
```bash
node -e 'import("mssql").then(async ({default: sql}) => {
  const fs = await import("fs");
  for (const line of fs.readFileSync(".env.local","utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()]=m[2].trim();
  }
  const pool = await new sql.ConnectionPool({
    server: process.env.AZURE_SQL_SERVER, database: process.env.AZURE_SQL_DATABASE,
    user: process.env.AZURE_SQL_USER, password: process.env.AZURE_SQL_PASSWORD,
    options: { encrypt: true, trustServerCertificate: false }
  }).connect();
  const r = await pool.request().query("SELECT TOP 5 * FROM playoffScores ORDER BY playoffScoreID DESC");
  console.log(r.recordset);
  await pool.close();
})'
```
Expected: one or more rows with the games you entered, computed columns populated.

- [ ] **Step 7: Commit**

```bash
git add src/app/evillair/\(dashboard\)/playoffs/scoresheets src/app/evillair/\(dashboard\)/playoffs/PlayoffsAdminClient.tsx
git commit -m "feat: admin UI for entering playoff scoresheets"
```

---

## Task 8: Update memory and end-of-phase verification

**Files:**
- Modify: `memory/db-schema.md` (already done in Task 1 step 5 if `refresh-schema.mjs` was run)
- Optional: append a line to project memory about the new table and admin route

- [ ] **Step 1: Confirm schema doc shows `playoffScores`**

Run: `grep -A 20 "## playoffScores" memory/db-schema.md`
Expected: the new table block with all columns and computed columns. If not present, re-run `node scripts/refresh-schema.mjs`.

- [ ] **Step 2: Run the full pre-push check**

Run: `node scripts/pre-push-check.mjs`
Expected: passes (or fails only on pre-existing violations documented in `project_cache_invariants_backlog.md`).

- [ ] **Step 3: Manual end-to-end verification**

In `npm run dev`:
1. Enter an individual bracket (MensScratch round 1) scoresheet with realistic scores for the existing qualifiers
2. Save
3. Hit the read query directly via a one-off `node -e` script to call `getIndividualBracketResults(35, 'MensScratch', 1)` and verify the result list is ordered by `scratchSeries` desc and `isAlternate` is false for all qualifiers

```bash
node -e 'import("./src/lib/queries/playoffs/scores.ts").then(async ({getIndividualBracketResults}) => {
  const rows = await getIndividualBracketResults(35, "MensScratch", 1);
  console.log(rows.map(r => ({ bowlerID: r.bowlerID, scratchSeries: r.scratchSeries, isAlternate: r.isAlternate })));
  process.exit(0);
})'
```
**Note:** that script requires TS compilation; the actual verification will be easier via a small `/api` debug endpoint or by waiting until the public recap page is built in a future phase. If running the `node -e` proves painful, defer this step and just verify via the admin UI re-render (which uses `getPlayoffScoresForRound`, a different but adjacent function).

- [ ] **Step 4: Final commit if any tidy-up needed**

If any small changes were needed (e.g., refreshed schema doc not committed), commit them now:

```bash
git add -A
git commit -m "chore: refresh schema doc after playoffScores migration"
```

(If nothing to commit, skip this step.)

---

## Self-Review

**Spec coverage check:**

| Spec section | Plan task | Status |
|--------------|-----------|--------|
| §1 New `playoffScores` table | Task 1 | ✓ |
| §2 `championshipType` on score row | Task 1 (column + check constraint) | ✓ |
| §3 Alternate detection by absence | Task 3 (`flagAlternates`) + Task 5 (SQL LEFT JOIN) | ✓ |
| §4 Patches unchanged | (No task needed — explicitly out of scope) | ✓ |
| §5 Write path (admin UI) | Tasks 4, 6, 7 | ✓ |
| §6 Read path with `dependsOn: ['playoffScores']` | Task 5 | ✓ |
| §7 No backfill | (No task — explicit) | ✓ |
| Cache & invariant impact | Task 2 | ✓ |
| Migration script | Task 1 | ✓ |
| Acceptance criteria | Task 8 verification | ✓ |

**Placeholder scan:** No TBDs, no "implement appropriately." One soft area is Task 7 step 6's manual test — the verification is concrete (smoke test in dev + DB inspection), which is acceptable for a UI task.

**Type consistency:**
- `ChampionshipType` from `@/lib/admin/playoff-admin` used consistently in Tasks 4, 5, 6, 7
- `PlayoffScoreInput` defined in Task 4, used in Task 6 and Task 7
- `PlayoffScoresheetEntry` defined in Task 5 — not referenced again (read-side only; recap page is future scope)
- `rollupTeamTotals` signature in Task 3 takes `BowlerGameRow[]`; Task 7 uses `EditableRow[]` (compatible — `EditableRow` extends the required fields)

All consistent.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-12-playoff-scores.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
