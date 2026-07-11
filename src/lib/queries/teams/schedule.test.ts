import { describe, it, expect } from 'vitest';
import { shapeTeamScheduleRow } from './schedule';

describe('shapeTeamScheduleRow', () => {
  it('marks a row with a matchResults row as played and computes total', () => {
    const row = shapeTeamScheduleRow({
      week: 1, matchDate: '2026-07-20', opponentName: 'Gutterglory', opponentSlug: 'gutterglory',
      resultID: 500,
      ourGame1: 180, ourGame2: 190, ourGame3: 150,
      theirGame1: 170, theirGame2: 160, theirGame3: 200,
      gamePts: 4, xp: 3,
    });
    expect(row.played).toBe(true);
    expect(row.total).toBe(7);
    expect(row.gamePts).toBe(4);
    expect(row.xp).toBe(3);
    expect(row.opponentSlug).toBe('gutterglory');
  });

  it('marks a row with no matchResults row as unplayed with null totals', () => {
    const row = shapeTeamScheduleRow({
      week: 4, matchDate: '2026-08-24', opponentName: 'E-Bowla', opponentSlug: 'e-bowla',
      resultID: null,
      ourGame1: null, ourGame2: null, ourGame3: null,
      theirGame1: null, theirGame2: null, theirGame3: null,
      gamePts: null, xp: null,
    });
    expect(row.played).toBe(false);
    expect(row.total).toBeNull();
    expect(row.gamePts).toBeNull();
    expect(row.xp).toBeNull();
  });
});
