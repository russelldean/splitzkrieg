-- Backfill incomingAvg for scores rows where it is NULL.
-- incomingAvg = average of up to 27 most recent individual games PRIOR to that week.
-- Preserves existing non-NULL values. First-ever week for a bowler stays NULL.
--
-- Run the DRY-RUN SELECT first to verify, then run the UPDATE.

----------------------------------------------------------------------
-- DRY RUN: Preview what would be updated
----------------------------------------------------------------------
WITH GameRows AS (
  -- Unpivot each score row into individual games with a chronological ordering key
  SELECT
    s.scoreID,
    s.bowlerID,
    s.seasonID,
    s.week,
    g.GameNum,
    g.pins,
    sn.year,
    CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END AS periodOrd
  FROM scores s
  JOIN seasons sn ON s.seasonID = sn.seasonID
  CROSS APPLY (
    VALUES (1, s.game1), (2, s.game2), (3, s.game3)
  ) g(GameNum, pins)
  WHERE s.isPenalty = 0
    AND g.pins IS NOT NULL
    AND g.pins > 0
),
OrderedGames AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY bowlerID
      ORDER BY year, periodOrd, week, GameNum
    ) AS gameSeq
  FROM GameRows
),
-- For each score row, find the max gameSeq of the PRIOR week's last game
ScoreContext AS (
  SELECT
    s.scoreID,
    s.bowlerID,
    s.seasonID,
    s.week,
    sn.year,
    CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END AS periodOrd
  FROM scores s
  JOIN seasons sn ON s.seasonID = sn.seasonID
  WHERE s.isPenalty = 0
    AND s.incomingAvg IS NULL
),
PriorGameCutoff AS (
  SELECT
    sc.scoreID,
    sc.bowlerID,
    -- Find the highest gameSeq for this bowler BEFORE this week
    (
      SELECT MAX(og.gameSeq)
      FROM OrderedGames og
      WHERE og.bowlerID = sc.bowlerID
        AND (
          og.year < sc.year
          OR (og.year = sc.year AND og.periodOrd < sc.periodOrd)
          OR (og.year = sc.year AND og.periodOrd = sc.periodOrd AND og.week < sc.week)
        )
    ) AS maxPriorSeq
  FROM ScoreContext sc
),
RollingAvg AS (
  SELECT
    pgc.scoreID,
    pgc.bowlerID,
    pgc.maxPriorSeq,
    (
      SELECT CAST(AVG(sub.pins * 1.0) AS DECIMAL(5,1))
      FROM (
        SELECT og2.pins
        FROM OrderedGames og2
        WHERE og2.bowlerID = pgc.bowlerID
          AND og2.gameSeq <= pgc.maxPriorSeq
          AND og2.gameSeq > pgc.maxPriorSeq - 27
      ) sub
    ) AS computedAvg
  FROM PriorGameCutoff pgc
  WHERE pgc.maxPriorSeq IS NOT NULL  -- NULL means no prior games (first week)
)
-- DRY RUN: see what will be updated
SELECT
  ra.scoreID,
  ra.bowlerID,
  b.bowlerName,
  ra.computedAvg
FROM RollingAvg ra
JOIN bowlers b ON ra.bowlerID = b.bowlerID
ORDER BY ra.bowlerID, ra.scoreID;


----------------------------------------------------------------------
-- ACTUAL UPDATE: Uncomment and run after verifying dry-run results
----------------------------------------------------------------------
/*
WITH GameRows AS (
  SELECT
    s.scoreID,
    s.bowlerID,
    s.seasonID,
    s.week,
    g.GameNum,
    g.pins,
    sn.year,
    CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END AS periodOrd
  FROM scores s
  JOIN seasons sn ON s.seasonID = sn.seasonID
  CROSS APPLY (
    VALUES (1, s.game1), (2, s.game2), (3, s.game3)
  ) g(GameNum, pins)
  WHERE s.isPenalty = 0
    AND g.pins IS NOT NULL
    AND g.pins > 0
),
OrderedGames AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY bowlerID
      ORDER BY year, periodOrd, week, GameNum
    ) AS gameSeq
  FROM GameRows
),
ScoreContext AS (
  SELECT
    s.scoreID,
    s.bowlerID,
    s.seasonID,
    s.week,
    sn.year,
    CASE sn.period WHEN 'Fall' THEN 2 ELSE 1 END AS periodOrd
  FROM scores s
  JOIN seasons sn ON s.seasonID = sn.seasonID
  WHERE s.isPenalty = 0
    AND s.incomingAvg IS NULL
),
PriorGameCutoff AS (
  SELECT
    sc.scoreID,
    sc.bowlerID,
    (
      SELECT MAX(og.gameSeq)
      FROM OrderedGames og
      WHERE og.bowlerID = sc.bowlerID
        AND (
          og.year < sc.year
          OR (og.year = sc.year AND og.periodOrd < sc.periodOrd)
          OR (og.year = sc.year AND og.periodOrd = sc.periodOrd AND og.week < sc.week)
        )
    ) AS maxPriorSeq
  FROM ScoreContext sc
),
RollingAvg AS (
  SELECT
    pgc.scoreID,
    pgc.bowlerID,
    pgc.maxPriorSeq,
    (
      SELECT CAST(AVG(sub.pins * 1.0) AS DECIMAL(5,1))
      FROM (
        SELECT og2.pins
        FROM OrderedGames og2
        WHERE og2.bowlerID = pgc.bowlerID
          AND og2.gameSeq <= pgc.maxPriorSeq
          AND og2.gameSeq > pgc.maxPriorSeq - 27
      ) sub
    ) AS computedAvg
  FROM PriorGameCutoff pgc
  WHERE pgc.maxPriorSeq IS NOT NULL
)
UPDATE s
SET s.incomingAvg = ra.computedAvg
FROM scores s
JOIN RollingAvg ra ON s.scoreID = ra.scoreID;
*/
