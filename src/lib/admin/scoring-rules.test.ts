import { describe, it, expect } from 'vitest';
import { bonusPoints, gamePoints, milestoneCrossings } from './scoring-rules';

/**
 * bonusPoints was 15 anonymous lines inside runMatchResults, a 234-line
 * database function with no tests. The behaviour below was verified against
 * every stored bonus value in the database before these were written: 5,991
 * values across 36 seasons, 15 of them containing forfeits, all reproduced
 * exactly. So these pin what the league has always done, not what looks right.
 */

/** n teams with descending series, so position maps to teamID. */
function ladder(n: number, start = 900, step = 10) {
  return Array.from({ length: n }, (_, i) => ({ teamID: i + 1, series: start - i * step }));
}

describe('bonusPoints', () => {
  it('awards 3 to the top five, 2 to the next five, 1 to the next five', () => {
    const b = bonusPoints(ladder(20));
    expect([1, 2, 3, 4, 5].map((t) => b.get(t))).toEqual([3, 3, 3, 3, 3]);
    expect([6, 7, 8, 9, 10].map((t) => b.get(t))).toEqual([2, 2, 2, 2, 2]);
    expect([11, 12, 13, 14, 15].map((t) => b.get(t))).toEqual([1, 1, 1, 1, 1]);
    expect([16, 17, 18, 19, 20].map((t) => b.get(t))).toEqual([0, 0, 0, 0, 0]);
  });

  it('gives every tied team the better bonus', () => {
    // Three teams tied on the 5th-place score: all three take 3, because the
    // comparison is >= against the score at the cutoff, not the position.
    const teams = [
      { teamID: 1, series: 900 }, { teamID: 2, series: 890 },
      { teamID: 3, series: 880 }, { teamID: 4, series: 870 },
      { teamID: 5, series: 870 }, { teamID: 6, series: 870 },
      ...Array.from({ length: 14 }, (_, i) => ({ teamID: 10 + i, series: 800 - i })),
    ];
    const b = bonusPoints(teams);
    expect(b.get(4)).toBe(3);
    expect(b.get(5)).toBe(3);
    expect(b.get(6)).toBe(3);
  });

  it('a league-wide tie gives everyone 3', () => {
    const b = bonusPoints(ladder(20, 800, 0));
    expect([...b.values()].every((v) => v === 3)).toBe(true);
  });

  it('awards no 1-point band below fifteen teams', () => {
    // A bye or a split night. The 15th-place cutoff does not exist, so nobody
    // can take the bottom band, but the 3 and 2 bands still apply.
    const b = bonusPoints(ladder(12));
    expect(b.get(1)).toBe(3);
    expect(b.get(10)).toBe(2);
    expect(b.get(11)).toBe(0);
    expect(b.get(12)).toBe(0);
    expect([...b.values()]).not.toContain(1);
  });

  it('awards no 2-point band below ten teams', () => {
    const b = bonusPoints(ladder(7));
    expect(b.get(5)).toBe(3);
    expect(b.get(6)).toBe(0);
    expect([...b.values()]).not.toContain(2);
  });

  it('awards nothing below five teams', () => {
    const b = bonusPoints(ladder(4));
    expect([...b.values()]).toEqual([0, 0, 0, 0]);
  });

  it('returns an entry for every team it was given', () => {
    expect(bonusPoints(ladder(20)).size).toBe(20);
  });

  it('handles an empty week without throwing', () => {
    expect(bonusPoints([]).size).toBe(0);
  });

  it('does not reorder the caller\'s array', () => {
    const teams = [
      { teamID: 1, series: 700 },
      { teamID: 2, series: 900 },
    ];
    bonusPoints(teams);
    expect(teams.map((t) => t.teamID)).toEqual([1, 2]);
  });
});

/**
 * gamePoints was ~30 lines inside runMatchResults. It decides who won a match,
 * which is the most consequential thing in the pipeline: a wrong answer here
 * changes standings and, through Bowler of the Week, the badges too. It is
 * also where the 2026-08-04 incident landed, when a substitution filed under
 * the rostered bowler inherited their handicap and flipped a match.
 *
 * Verified against every stored match before these were written: 3,017 across
 * 36 seasons, 42 involving a forfeit. All reproduced except one, which turned
 * out to be a stale matchResults row rather than a disagreement about the
 * rule (season 28 week 1: the scores were corrected afterwards and the match
 * was never recomputed).
 */
const games = (g1: number, g2: number, g3: number) => ({ g1, g2, g3 });

describe('gamePoints', () => {
  it('awards two points per game won', () => {
    expect(gamePoints(games(800, 800, 800), games(700, 700, 700)))
      .toEqual({ team1: 6, team2: 0 });
  });

  it('splits a tied game one point each', () => {
    expect(gamePoints(games(800, 800, 800), games(800, 800, 800)))
      .toEqual({ team1: 3, team2: 3 });
  });

  it('scores each game independently', () => {
    // win, loss, tie
    expect(gamePoints(games(810, 700, 800), games(800, 900, 800)))
      .toEqual({ team1: 3, team2: 3 });
  });

  it('decides a game by a single pin', () => {
    expect(gamePoints(games(801, 700, 700), games(800, 800, 800)))
      .toEqual({ team1: 2, team2: 4 });
  });

  describe('forfeits', () => {
    // The opponent still has to bowl: for each game their scratch total must
    // reach their own team average less 20 to take the points.
    const ghost = { sg1: 700, sg2: 700, sg3: 700, teamAvg: 700 };

    it('gives the opponent nothing for games they did not bowl up to', () => {
      const cold = { sg1: 600, sg2: 600, sg3: 600, teamAvg: 700 };
      expect(gamePoints(games(0, 0, 0), games(800, 800, 800), { team1Forfeit: true, ghost: cold }))
        .toEqual({ team1: 0, team2: 0 });
    });

    it('gives the opponent the points for games they did', () => {
      expect(gamePoints(games(0, 0, 0), games(800, 800, 800), { team1Forfeit: true, ghost }))
        .toEqual({ team1: 0, team2: 6 });
    });

    it('applies the threshold per game, not to the series', () => {
      const mixed = { sg1: 700, sg2: 600, sg3: 700, teamAvg: 700 };
      expect(gamePoints(games(0, 0, 0), games(800, 800, 800), { team1Forfeit: true, ghost: mixed }))
        .toEqual({ team1: 0, team2: 4 });
    });

    it('counts a total exactly on the threshold as cleared', () => {
      const exact = { sg1: 680, sg2: 680, sg3: 680, teamAvg: 700 };
      expect(gamePoints(games(0, 0, 0), games(1, 1, 1), { team1Forfeit: true, ghost: exact }))
        .toEqual({ team1: 0, team2: 6 });
      const justUnder = { sg1: 679, sg2: 679, sg3: 679, teamAvg: 700 };
      expect(gamePoints(games(0, 0, 0), games(1, 1, 1), { team1Forfeit: true, ghost: justUnder }))
        .toEqual({ team1: 0, team2: 0 });
    });

    it('works the same way when it is team 2 that forfeits', () => {
      expect(gamePoints(games(800, 800, 800), games(0, 0, 0), { team2Forfeit: true, ghost }))
        .toEqual({ team1: 6, team2: 0 });
    });

    it('awards nothing when the opponent has no scratch data', () => {
      expect(gamePoints(games(0, 0, 0), games(800, 800, 800), { team1Forfeit: true }))
        .toEqual({ team1: 0, team2: 0 });
    });

    it('awards nothing to either side when both forfeit', () => {
      expect(gamePoints(games(0, 0, 0), games(0, 0, 0), { team1Forfeit: true, team2Forfeit: true }))
        .toEqual({ team1: 0, team2: 0 });
    });

    it('ignores the handicap totals entirely in a forfeit', () => {
      // The forfeiting team's own scores never earn anything, however high.
      expect(gamePoints(games(9999, 9999, 9999), games(1, 1, 1), { team1Forfeit: true, ghost }))
        .toEqual({ team1: 0, team2: 6 });
    });
  });
});

/**
 * milestoneCrossings was the innermost condition of recordMilestones. It fires
 * a badge on the CROSSING rather than on the standing, which is what stops a
 * re-confirmed week from re-awarding milestones a bowler passed long ago.
 */
describe('milestoneCrossings', () => {
  const T = [100, 200, 300] as const;

  it('fires when the week carries a bowler past a threshold', () => {
    expect(milestoneCrossings(105, 10, T)).toEqual([100]);
  });

  it('fires on landing exactly on the threshold', () => {
    expect(milestoneCrossings(100, 5, T)).toEqual([100]);
  });

  it('stays silent for a bowler already past it', () => {
    // The standing is well above 100, but the crossing happened weeks ago.
    expect(milestoneCrossings(150, 10, T)).toEqual([]);
  });

  it('stays silent when the bowler was already exactly on it', () => {
    expect(milestoneCrossings(105, 5, T)).toEqual([]);
  });

  it('fires for several thresholds crossed in one week', () => {
    // A big week can clear more than one mark at once.
    expect(milestoneCrossings(250, 200, T)).toEqual([100, 200]);
  });

  it('crosses nothing when the week contributed nothing', () => {
    // This is what makes re-confirming a week safe.
    expect(milestoneCrossings(500, 0, T)).toEqual([]);
  });

  it('handles a bowler below every threshold', () => {
    expect(milestoneCrossings(50, 50, T)).toEqual([]);
  });

  it('returns thresholds in the order given', () => {
    expect(milestoneCrossings(1000, 1000, T)).toEqual([100, 200, 300]);
  });
});
