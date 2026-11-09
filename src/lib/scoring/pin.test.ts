import { describe, it, expect } from 'vitest';
import { pinScoresForWeek } from './pin';

const match = (home: number, away: number, h: number[], a: number[]) => ({
  homeTeamID: home, awayTeamID: away,
  team1Game1: h[0], team1Game2: h[1], team1Game3: h[2], team1Series: h[0] + h[1] + h[2],
  team2Game1: a[0], team2Game2: a[1], team2Game3: a[2], team2Series: a[0] + a[1] + a[2],
});

describe('pinScoresForWeek', () => {
  // Two matches, four teams. Team 1 beats team 2 by 10 pins a game; the bowler on team 1
  // shot 210 + 40 hcp = 250 per game, so a blind 199 costs the team 51 a game and flips all three.
  const matches = [match(1, 2, [900, 900, 900], [890, 890, 890]), match(3, 4, [800, 800, 800], [700, 700, 700])];
  const bowler = (id: number, teamID: number, games: number[], hcp: number) => ({
    bowlerID: id, bowlerName: `B${id}`, bowlerSlug: `b${id}`, teamID, teamName: `T${teamID}`,
    game1: games[0], game2: games[1], game3: games[2], incomingHcp: hcp,
  });

  it('credits a bowler whose games decided the match and the series ranking', () => {
    const pins = pinScoresForWeek([bowler(1, 1, [210, 210, 210], 40), bowler(2, 3, [150, 150, 150], 40)], matches);
    const b1 = pins.find(p => p.bowlerID === 1)!;
    // Actual: team 1 takes 6 game points + 3 XP (1st of 4) = 9. Blind: loses all three games
    // (849 vs 890) and drops to 3rd in series (2547 vs 2670, 2400, 2100) = 0 + 3 = 3. PIN 6.
    expect(b1.pin).toBe(6);
    // Team 3 won by 100 a game; swapping 190 for 199 changes nothing.
    expect(pins.find(p => p.bowlerID === 2)!.pin).toBe(0);
    expect(pins[0].bowlerID).toBe(1);
  });

  it('skips bowlers missing a game or a handicap, and returns nothing without results', () => {
    expect(pinScoresForWeek([bowler(1, 1, [210, 210, 210], 40)], [])).toEqual([]);
    const b = { ...bowler(1, 1, [210, 210, 210], 40), game3: null };
    expect(pinScoresForWeek([b], matches)).toEqual([]);
  });
});
