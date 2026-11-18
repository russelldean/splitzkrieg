/**
 * Drop undecided playoff matches from a team's playoff head-to-head.
 *
 * The H2H SQL (GET_TEAM_PLAYOFF_H2H_SQL) marks a match `won` only when
 * winnerTeamID is this team, so an unbowled final reads as a LOSS for both
 * finalists. That SQL lives inside the batched team page query, and editing it
 * would re-query all 41 team pages in one build, so the filter lives here instead.
 *
 * A win is always decided. A loss is kept only when the team has a recorded
 * finish for that season and round (semifinalist for a semi, runner-up for a
 * final), and GET_TEAM_PLAYOFF_FINISHES_SQL only records finishes for matches
 * with a winner.
 *
 * Plain .mjs so the team page and scripts/check-no-early-results.mjs share it.
 *
 * @template {{ seasonID: number, round: string, won: boolean | number }} T
 * @param {T[]} matchups
 * @param {{ teamID: number, seasonID: number, finish: string }[]} finishes all teams' finishes
 * @param {number} teamID
 * @returns {T[]}
 */
export function decidedPlayoffH2H(matchups, finishes, teamID) {
  const lossFinish = { semifinal: 'semifinalist', final: 'runner-up' };
  const lost = new Set(
    finishes.filter((f) => f.teamID === teamID).map((f) => `${f.seasonID}:${f.finish}`),
  );
  return matchups.filter((m) => m.won || lost.has(`${m.seasonID}:${lossFinish[m.round]}`));
}
