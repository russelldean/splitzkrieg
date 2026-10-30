/**
 * "Like Clockwork" -- the one definition. (Named "Perfect Enough Attendance"
 * for about an hour on 2026-10-30; Russ preferred a name that does not need the
 * rule explained away.)
 *
 * Awarded per season to a bowler who missed at most one of the season's
 * available league nights. Russ chose "miss one" over strict perfect on
 * 2026-10-30 so one missed night, or a team that rotates people, does not
 * zero you out; and over the 6-of-9 playoff cutoff, which 57% of the field
 * clears every season and would read as a participation marker.
 *
 * "Showed up" means a scores row with at least one game bowled. Penalty rows
 * carry zero games and do not count. Prebowls and subbing for another team
 * both count: the bowler was there.
 *
 * "Available nights" is the number of distinct weeks with scores in the
 * season, so the rule reads: 8 of 9 for a normal season, 9 of 10 for S3,
 * 4 of 5 for the two COVID seasons (S25, S27), and 7 of 8 for the four seasons
 * whose week 9 never made it into the archive (S1, S5, S15, S18). Russ ruled on
 * each of those 2026-10-30. S2 is the one override: 17 weeks with a bye each
 * week, so 16 possible nights, and Russ set the bar at 15.
 *
 * Only completed seasons qualify (isCurrentSeason = 0), so the current season
 * never earns it mid-season and it is awarded at the changeover, next to the
 * playoff badges.
 *
 * Shared by scripts/populate-patches.mjs (writer) and scripts/audit-patches.mjs
 * (diff), following above-average.mjs, so the two cannot drift apart.
 */

/** Seasons whose bar is not simply "available nights minus one". */
export const MIN_NIGHTS_OVERRIDES = { 2: 15 };

/**
 * Full SELECT of (bowlerID, seasonID, week=NULL) rows that earn the patch.
 *
 * @param {{ seasonID?: number | null }} [opts] restrict to one season
 * @returns {string}
 */
export function attendanceSql({ seasonID = null } = {}) {
  const seasonFilter = seasonID != null ? `AND a.seasonID = ${parseInt(seasonID, 10)}` : '';
  const overrides = Object.entries(MIN_NIGHTS_OVERRIDES)
    .map(([sid, n]) => `WHEN a.seasonID = ${parseInt(sid, 10)} THEN ${n}`)
    .join(' ');
  return `
    SELECT a.bowlerID, a.seasonID, NULL AS week
    FROM (
      SELECT sc.seasonID, sc.bowlerID, COUNT(DISTINCT sc.week) AS nights
      FROM scores sc
      WHERE sc.isPenalty = 0 AND sc.gamesBowled > 0
      GROUP BY sc.seasonID, sc.bowlerID
    ) a
    JOIN (
      SELECT sc.seasonID, COUNT(DISTINCT sc.week) AS nights
      FROM scores sc
      GROUP BY sc.seasonID
    ) s ON s.seasonID = a.seasonID
    JOIN seasons se ON se.seasonID = a.seasonID
    WHERE se.isCurrentSeason = 0
      AND a.nights >= CASE ${overrides} ELSE s.nights - 1 END
      ${seasonFilter}`;
}
