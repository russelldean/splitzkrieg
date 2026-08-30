/**
 * Data invariants: conditions that are ALWAYS a bug when violated.
 *
 * Every query here returns a single count `n`, and every one of them was run
 * against the live database and confirmed to return zero before being added.
 * That matters more than it sounds: several plausible-looking invariants did
 * NOT hold and were dropped rather than shipped as future false alarms.
 *
 *   - same bowler with several score rows in one week: 150 cases spread evenly
 *     across all 33 seasons, so it is a normal pattern (subs, two teams in a
 *     week), not a defect
 *   - non-penalty rows with missing games: 2 rows, both historical, which the
 *     data audit already records as permanent gaps. Scoped to the current
 *     season instead, where it means today's import went wrong
 *   - null incomingAvg in the current season: 9 rows, all new bowlers, who by
 *     rule get a flat 219 per handicap game rather than an average
 *
 * A check that fires on healthy data gets ignored within a week, so anything
 * that cannot be shown to hold today does not belong here.
 */

/** Invariants that must hold across all of history. */
const ALL_TIME = [
  {
    name: 'duplicate-bowler-slug',
    why: 'Two bowlers sharing a slug means one of their pages is unreachable.',
    sql: `SELECT COUNT(*) n FROM (SELECT slug FROM bowlers GROUP BY slug HAVING COUNT(*) > 1) d`,
  },
  {
    name: 'duplicate-bowler-name',
    why:
      'Captains type existing bowlers into the free-text name field, which seats ' +
      'a duplicate account with a 0 average. That is the lineup free-text trap.',
    sql: `SELECT COUNT(*) n FROM (SELECT bowlerName FROM bowlers GROUP BY bowlerName HAVING COUNT(*) > 1) d`,
  },
  {
    name: 'duplicate-team-slug',
    why: 'Same as bowler slugs: a collision hides one team page.',
    sql: `SELECT COUNT(*) n FROM (SELECT slug FROM teams GROUP BY slug HAVING COUNT(*) > 1) d`,
  },
  {
    name: 'bowler-slug-empty',
    why: 'A bowler with no slug has no page and cannot be linked.',
    sql: `SELECT COUNT(*) n FROM bowlers WHERE slug IS NULL OR LTRIM(RTRIM(slug)) = ''`,
  },
  {
    name: 'bowler-slug-format',
    why: 'Slugs are lowercase and hyphenated; a space or capital breaks the URL contract.',
    sql: `SELECT COUNT(*) n FROM bowlers WHERE slug LIKE '% %' OR slug COLLATE Latin1_General_CS_AS <> LOWER(slug)`,
  },
  {
    name: 'incoming-avg-not-whole',
    why: 'incomingAvg is decimal in the schema but is ALWAYS stored as a whole number.',
    sql: `SELECT COUNT(*) n FROM scores WHERE incomingAvg IS NOT NULL AND incomingAvg <> FLOOR(incomingAvg)`,
  },
  {
    name: 'incoming-avg-out-of-range',
    why: 'An average outside 0 to 300 is impossible and poisons handicap for every later week.',
    sql: `SELECT COUNT(*) n FROM scores WHERE incomingAvg IS NOT NULL AND (incomingAvg < 0 OR incomingAvg > 300)`,
  },
  {
    name: 'game-score-out-of-range',
    why: 'A bowling game cannot be below 0 or above 300.',
    sql: `SELECT COUNT(*) n FROM scores WHERE (game1 IS NOT NULL AND (game1 < 0 OR game1 > 300))
            OR (game2 IS NOT NULL AND (game2 < 0 OR game2 > 300))
            OR (game3 IS NOT NULL AND (game3 < 0 OR game3 > 300))`,
  },
  {
    name: 'score-orphan-bowler',
    why: 'A score pointing at a bowler that no longer exists renders nowhere.',
    sql: `SELECT COUNT(*) n FROM scores s LEFT JOIN bowlers b ON b.bowlerID = s.bowlerID WHERE b.bowlerID IS NULL`,
  },
  {
    name: 'score-orphan-season',
    why: 'A score in no season is invisible to every season-scoped query.',
    sql: `SELECT COUNT(*) n FROM scores s LEFT JOIN seasons se ON se.seasonID = s.seasonID WHERE se.seasonID IS NULL`,
  },
  {
    name: 'patch-orphan-bowler',
    why: 'A badge awarded to a missing bowler can never be displayed.',
    sql: `SELECT COUNT(*) n FROM bowlerPatches p LEFT JOIN bowlers b ON b.bowlerID = p.bowlerID WHERE b.bowlerID IS NULL`,
  },
  {
    name: 'bowler-name-whitespace',
    why: 'Padded names break exact-match lookups and sort wrongly.',
    sql: `SELECT COUNT(*) n FROM bowlers WHERE bowlerName <> LTRIM(RTRIM(bowlerName))`,
  },
  {
    name: 'team-name-whitespace',
    why: 'Same as bowler names, and team name matching drives the LP roster push.',
    sql: `SELECT COUNT(*) n FROM teams WHERE teamName <> LTRIM(RTRIM(teamName))`,
  },
];

/**
 * Current-season invariants. Scoped deliberately: history has known permanent
 * gaps that will never be filled, while the same shape in the live season
 * means an import went wrong this week.
 */
const CURRENT_SEASON = [
  {
    name: 'current-season-missing-games',
    why: 'A non-penalty row missing a game means a partial import of this week.',
    sql: `SELECT COUNT(*) n FROM scores s JOIN seasons se ON se.seasonID = s.seasonID
          WHERE se.isCurrentSeason = 1 AND s.isPenalty = 0
            AND (s.game1 IS NULL OR s.game2 IS NULL OR s.game3 IS NULL)`,
  },
  {
    name: 'current-season-orphan-team',
    why: 'A score pointing at a team that does not exist drops out of standings.',
    sql: `SELECT COUNT(*) n FROM scores s JOIN seasons se ON se.seasonID = s.seasonID
          LEFT JOIN teams t ON t.teamID = s.teamID
          WHERE se.isCurrentSeason = 1 AND s.teamID IS NOT NULL AND t.teamID IS NULL`,
  },
  {
    name: 'current-season-matchresults-stale',
    why:
      'matchResults stores the team game totals it was computed from. When they ' +
      'no longer equal the current scores, someone corrected a score without ' +
      're-running the cascade, and the standings are being served from stale ' +
      'numbers. Twelve rows across seasons 28 and 32 are already like this; one ' +
      'of them has the wrong team winning.',
    sql: `WITH team AS (
            SELECT seasonID, week, teamID,
                   SUM(hcpGame1) g1, SUM(hcpGame2) g2, SUM(hcpGame3) g3
            FROM scores GROUP BY seasonID, week, teamID)
          SELECT COUNT(*) n
          FROM matchResults mr
          JOIN schedule sch ON sch.scheduleID = mr.scheduleID
          JOIN seasons se ON se.seasonID = sch.seasonID AND se.isCurrentSeason = 1
          LEFT JOIN team a ON a.seasonID=sch.seasonID AND a.week=sch.week AND a.teamID=sch.team1ID
          LEFT JOIN team b ON b.seasonID=sch.seasonID AND b.week=sch.week AND b.teamID=sch.team2ID
          WHERE (a.g1 IS NOT NULL AND (mr.team1Game1<>a.g1 OR mr.team1Game2<>a.g2 OR mr.team1Game3<>a.g3))
             OR (b.g1 IS NOT NULL AND (mr.team2Game1<>b.g1 OR mr.team2Game2<>b.g2 OR mr.team2Game3<>b.g3))`,
  },
  {
    name: 'current-season-schedule-missing-date',
    why: 'matchDate drives the week page and the lineup reminder crons.',
    sql: `SELECT COUNT(*) n FROM schedule sc JOIN seasons se ON se.seasonID = sc.seasonID
          WHERE se.isCurrentSeason = 1 AND sc.matchDate IS NULL`,
  },
];

/** Exactly one season may be current; zero or several breaks every "this week" query. */
const EXACTLY_ONE = [
  {
    name: 'exactly-one-current-season',
    why: 'Zero or multiple current seasons breaks the homepage, the header and the crons.',
    sql: `SELECT COUNT(*) n FROM seasons WHERE isCurrentSeason = 1`,
    expect: 1,
  },
];

export const INVARIANTS = [...ALL_TIME, ...CURRENT_SEASON, ...EXACTLY_ONE];

/**
 * Compare one invariant against its observed count.
 * Returns a finding, or null when it holds. Pure, so it is testable without a
 * database.
 */
export function evaluate(invariant, count) {
  const expected = invariant.expect ?? 0;
  if (count === expected) return null;
  return {
    name: invariant.name,
    expected,
    actual: count,
    why: invariant.why,
    message:
      expected === 0
        ? `${invariant.name}: ${count} row(s) violate this. ${invariant.why}`
        : `${invariant.name}: expected ${expected}, found ${count}. ${invariant.why}`,
  };
}

/** Roll a set of results up into findings. */
export function evaluateAll(results) {
  return results
    .map(({ invariant, count }) => evaluate(invariant, count))
    .filter(Boolean);
}
