/**
 * The scoring decisions, separated from the queries that feed them.
 *
 * These were inline inside runMatchResults and recordMilestones in scores.ts,
 * which is 955 lines and had no tests. The rules were untestable not because
 * they are complicated but because they sat in the middle of database code:
 * you could not ask "what happens when two teams tie" without a live season.
 *
 * Only rules that live HERE are in this file. Handicap, handicap games and
 * series are computed columns owned by the database, and the badge rules in
 * runPatches are SQL. Re-expressing either in TypeScript would create a second
 * definition free to drift from the real one, so those get conformance tests
 * instead. See scoring-rules.conformance.test.ts.
 */

/** One team's night, as the bonus ranking sees it. */
export interface TeamNight {
  teamID: number;
  series: number;
}

/**
 * Weekly bonus points, by finishing position across the whole league.
 *
 * Top 5 take 3, top 10 take 2, top 15 take 1, everyone else 0.
 *
 * Ties share the better bonus. The comparison is `>=` against the score at the
 * cutoff position, so if three teams tie for 5th they all take 3. That is the
 * long-standing behaviour, preserved here deliberately and pinned by a test,
 * because it was previously implied by an operator rather than written down.
 *
 * A cutoff needs enough teams to exist: with fewer than 15 no team can take
 * the 1-point band, which is what a bye week or a split night produces.
 */
export function bonusPoints(teams: TeamNight[]): Map<number, number> {
  const sorted = [...teams].sort((a, b) => b.series - a.series);

  const cutoff3 = sorted.length >= 5 ? sorted[4].series : -1;
  const cutoff2 = sorted.length >= 10 ? sorted[9].series : -1;
  const cutoff1 = sorted.length >= 15 ? sorted[14].series : -1;

  const bonuses = new Map<number, number>();
  for (const team of sorted) {
    let bonus: number;
    if (team.series >= cutoff3 && cutoff3 >= 0) bonus = 3;
    else if (team.series >= cutoff2 && cutoff2 >= 0) bonus = 2;
    else if (team.series >= cutoff1 && cutoff1 >= 0) bonus = 1;
    else bonus = 0;
    bonuses.set(team.teamID, bonus);
  }
  return bonuses;
}
