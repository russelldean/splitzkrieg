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

/** A team's three handicap game totals for one night. */
export interface TeamGames {
  g1: number;
  g2: number;
  g3: number;
}

/** A forfeiting team's opponent bowls against their own scratch average. */
export interface GhostOpponent {
  /** Scratch totals for the three games. */
  sg1: number;
  sg2: number;
  sg3: number;
  /** Sum of the team's incoming averages, the bar they must clear. */
  teamAvg: number;
}

export interface GamePoints {
  team1: number;
  team2: number;
}

/**
 * How close to their own average a team must bowl to take a point off a
 * forfeiting opponent. Their scratch total must reach teamAvg minus this.
 */
export const GHOST_THRESHOLD = 20;

/**
 * Points from the three games of one match. Two for a win, one each for a tie.
 *
 * When a team forfeits, the match is not simply awarded. The opponent still
 * has to bowl: for each game their scratch total must reach their own team
 * average less GHOST_THRESHOLD to take the two points, and a forfeiting team
 * scores nothing regardless. If the opponent's scratch data is missing the
 * game is worth nothing to anyone, which is the `ghost` argument being absent.
 *
 * Both teams forfeiting is treated as team 1 forfeiting, matching the original
 * behaviour: the branch keys off t1Forfeit first, and neither side has an
 * opponent who bowled, so the result is zero either way.
 */
export function gamePoints(
  team1: TeamGames,
  team2: TeamGames,
  opts: { team1Forfeit?: boolean; team2Forfeit?: boolean; ghost?: GhostOpponent } = {},
): GamePoints {
  const { team1Forfeit = false, team2Forfeit = false, ghost } = opts;

  if (team1Forfeit || team2Forfeit) {
    let earned = 0;
    if (ghost) {
      const threshold = ghost.teamAvg - GHOST_THRESHOLD;
      for (const game of ['sg1', 'sg2', 'sg3'] as const) {
        if (ghost[game] >= threshold) earned += 2;
      }
    }
    return team1Forfeit ? { team1: 0, team2: earned } : { team1: earned, team2: 0 };
  }

  let team1Pts = 0;
  let team2Pts = 0;
  for (const game of ['g1', 'g2', 'g3'] as const) {
    if (team1[game] > team2[game]) team1Pts += 2;
    else if (team1[game] < team2[game]) team2Pts += 2;
    else {
      team1Pts += 1;
      team2Pts += 1;
    }
  }
  return { team1: team1Pts, team2: team2Pts };
}
