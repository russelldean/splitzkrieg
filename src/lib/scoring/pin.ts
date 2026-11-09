/**
 * PIN: a bowler's point impact on one league night. Take the team's actual
 * points for the night (game points plus bonus points for the series ranking),
 * replace the bowler's three handicap games with a blind 199 each, recompute,
 * and the difference is the PIN. Positive means the team banked points it
 * would not have without them.
 *
 * Pulled out of components/season/weekStatsUtils so the recap can use it too.
 */

export const PENALTY_HCP_GAME = 199;

export interface PinBowler {
  bowlerID: number;
  bowlerName: string;
  bowlerSlug: string;
  teamID: number;
  teamName: string;
  game1: number | null;
  game2: number | null;
  game3: number | null;
  incomingHcp: number | null;
}

export interface PinMatch {
  homeTeamID: number;
  awayTeamID: number;
  team1Game1: number | null; team1Game2: number | null; team1Game3: number | null; team1Series: number | null;
  team2Game1: number | null; team2Game2: number | null; team2Game3: number | null; team2Series: number | null;
}

export interface PinScore { bowlerID: number; name: string; slug: string; team: string; pin: number }

interface Games { g1: number; g2: number; g3: number; series: number }

function calcGamePts(t1: Games, t2: Games) {
  let p1 = 0, p2 = 0;
  for (const [a, b] of [[t1.g1, t2.g1], [t1.g2, t2.g2], [t1.g3, t2.g3]] as [number, number][]) {
    if (a > b) p1 += 2;
    else if (b > a) p2 += 2;
    else { p1 += 1; p2 += 1; }
  }
  return { p1, p2 };
}

const getXP = (rank: number) => (rank < 5 ? 3 : rank < 10 ? 2 : rank < 15 ? 1 : 0);

/** Every bowler's PIN for one week, highest first. Bowlers without three games and a handicap are skipped. */
export function pinScoresForWeek(bowlers: PinBowler[], matchResults: PinMatch[]): PinScore[] {
  if (matchResults.length === 0) return [];

  const teamGames = new Map<number, Games>();
  const opponent = new Map<number, number>();
  for (const mr of matchResults) {
    if (mr.team1Game1 != null) teamGames.set(mr.homeTeamID, { g1: mr.team1Game1, g2: mr.team1Game2 ?? 0, g3: mr.team1Game3 ?? 0, series: mr.team1Series ?? 0 });
    if (mr.team2Game1 != null) teamGames.set(mr.awayTeamID, { g1: mr.team2Game1, g2: mr.team2Game2 ?? 0, g3: mr.team2Game3 ?? 0, series: mr.team2Series ?? 0 });
    opponent.set(mr.homeTeamID, mr.awayTeamID);
    opponent.set(mr.awayTeamID, mr.homeTeamID);
  }

  const pointsWith = (override: { teamID: number; games: Games } | null) => {
    const series = new Map([...teamGames.entries()].map(([id, g]) => [id, override && override.teamID === id ? override.games.series : g.series]));
    const ranked = [...series.entries()].sort((a, b) => b[1] - a[1]);
    const points = new Map<number, number>();
    ranked.forEach(([id], i) => points.set(id, getXP(i)));
    for (const mr of matchResults) {
      const home = override && override.teamID === mr.homeTeamID ? override.games : teamGames.get(mr.homeTeamID);
      const away = override && override.teamID === mr.awayTeamID ? override.games : teamGames.get(mr.awayTeamID);
      if (!home || !away) continue;
      const pts = calcGamePts(home, away);
      points.set(mr.homeTeamID, (points.get(mr.homeTeamID) ?? 0) + pts.p1);
      points.set(mr.awayTeamID, (points.get(mr.awayTeamID) ?? 0) + pts.p2);
    }
    return points;
  };

  const actual = pointsWith(null);
  const out: PinScore[] = [];
  for (const b of bowlers) {
    if (b.incomingHcp == null || b.game1 == null || b.game2 == null || b.game3 == null) continue;
    const team = teamGames.get(b.teamID);
    const oppID = opponent.get(b.teamID);
    if (!team || oppID == null || !teamGames.has(oppID)) continue;
    const g1 = team.g1 - (b.game1 + b.incomingHcp) + PENALTY_HCP_GAME;
    const g2 = team.g2 - (b.game2 + b.incomingHcp) + PENALTY_HCP_GAME;
    const g3 = team.g3 - (b.game3 + b.incomingHcp) + PENALTY_HCP_GAME;
    const hypothetical = pointsWith({ teamID: b.teamID, games: { g1, g2, g3, series: g1 + g2 + g3 } });
    out.push({ bowlerID: b.bowlerID, name: b.bowlerName, slug: b.bowlerSlug, team: b.teamName, pin: (actual.get(b.teamID) ?? 0) - (hypothetical.get(b.teamID) ?? 0) });
  }
  return out.sort((a, b) => b.pin - a.pin);
}
