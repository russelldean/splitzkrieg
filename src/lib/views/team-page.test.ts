import { describe, it, expect } from 'vitest';
import { groupBowlersBySeason, assembleTeamView } from './team-page';

describe('groupBowlersBySeason', () => {
  it('buckets all-season rows by seasonID, preserving row order within a season', () => {
    const rows = [
      { seasonID: 34, bowlerID: 1, bowlerName: 'A', slug: 'a', gamesBowled: 30, totalPins: 5400, average: 180 },
      { seasonID: 34, bowlerID: 2, bowlerName: 'B', slug: 'b', gamesBowled: 27, totalPins: 4700, average: 174 },
      { seasonID: 36, bowlerID: 1, bowlerName: 'A', slug: 'a', gamesBowled: 9, totalPins: 1700, average: 189 },
    ];
    const bySeason = groupBowlersBySeason(rows as any);
    expect(Object.keys(bySeason).sort()).toEqual(['34', '36']);
    expect(bySeason[34]).toHaveLength(2);
    expect(bySeason[34][0].slug).toBe('a');
    expect(bySeason[34][1].slug).toBe('b');
    expect(bySeason[36]).toHaveLength(1);
    expect(bySeason[36][0].gamesBowled).toBe(9);
  });
  it('returns an empty object for no rows', () => {
    expect(groupBowlersBySeason([] as any)).toEqual({});
  });
});

describe('assembleTeamView', () => {
  const recordsets = () => [
    [{ bowlerID: 1, bowlerName: 'A', slug: 'a', gamesBowled: 9, seasonAverage: 189, firstSeason: 'Spring 2026' }],
    [{ seasonID: 36, displayName: 'Spring 2026' }, { seasonID: 34, displayName: 'Spring 2025' }],
    [{ bowlerID: 1, bowlerName: 'A', slug: 'a', totalGames: 39, totalPins: 7100, average: 182, seasonsWithTeam: 2, firstSeason: 'Spring 2025', lastSeason: 'Spring 2026' }],
    [{ teamID: 7, teamName: 'Lucky Strikes', seasonID: 36 }],
    [{ divisionRank: 3, divisionSize: 6, wins: 12, losses: 8 }],
    [{ opponentID: 9, opponentName: 'Hot Shotz', seasonID: 36, week: 4 }],
    [{ opponentID: 9, opponentName: 'Hot Shotz', seasonID: 34, round: 'Semifinal', won: true }],
    [
      { seasonID: 36, bowlerID: 1, bowlerName: 'A', slug: 'a', gamesBowled: 9, totalPins: 1700, average: 189 },
      { seasonID: 34, bowlerID: 1, bowlerName: 'A', slug: 'a', gamesBowled: 30, totalPins: 5400, average: 180 },
    ],
  ];
  it('maps the 8 recordsets into the DTO and builds bowlersBySeason', () => {
    const view = assembleTeamView(recordsets() as any);
    expect(view.currentRoster).toHaveLength(1);
    expect(view.teamSeasons).toHaveLength(2);
    expect(view.allTimeRoster[0].totalGames).toBe(39);
    expect(view.franchiseHistory[0].teamName).toBe('Lucky Strikes');
    expect(view.currentStanding?.divisionRank).toBe(3);
    expect(view.h2hMatchups[0].opponentName).toBe('Hot Shotz');
    expect(view.playoffH2H[0].won).toBe(true);
    expect(view.bowlersBySeason[36][0].gamesBowled).toBe(9);
    expect(view.bowlersBySeason[34][0].gamesBowled).toBe(30);
  });
  it('currentStanding null when recordset 4 empty; empty arrays elsewhere', () => {
    const view = assembleTeamView([[], [], [], [], [], [], [], []] as any);
    expect(view.currentStanding).toBeNull();
    expect(view.currentRoster).toEqual([]);
    expect(view.bowlersBySeason).toEqual({});
  });
});
