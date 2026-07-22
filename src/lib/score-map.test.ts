import { describe, it, expect } from 'vitest';
import { heatBin } from './score-map';

describe('heatBin', () => {
  it('returns 0 for no rolls', () => {
    expect(heatBin(0)).toBe(0);
    expect(heatBin(-1)).toBe(0);
  });
  it('bins by absolute frequency', () => {
    expect(heatBin(1)).toBe(1);
    expect(heatBin(2)).toBe(2);
    expect(heatBin(3)).toBe(2);
    expect(heatBin(4)).toBe(3);
    expect(heatBin(6)).toBe(3);
    expect(heatBin(7)).toBe(4);
    expect(heatBin(10)).toBe(4);
    expect(heatBin(11)).toBe(5);
    expect(heatBin(99)).toBe(5);
  });
});

import { buildScoreMap, type ScoreMapRow } from './score-map';

const row = (score: number, total: number, thisSeason = 0, isNew = 0): ScoreMapRow =>
  ({ score, total, thisSeason, isNew });

describe('buildScoreMap', () => {
  it('returns hasData=false for no rows', () => {
    const m = buildScoreMap([], false);
    expect(m.hasData).toBe(false);
    expect(m.decades).toEqual([]);
    expect(m.mostRolled).toBeNull();
  });

  it('clips decades to the bowler range and fills gaps', () => {
    const m = buildScoreMap([row(148, 3), row(159, 5), row(162, 1)], false);
    expect(m.minScore).toBe(148);
    expect(m.maxScore).toBe(162);
    expect(m.minDecade).toBe(140);
    expect(m.maxDecade).toBe(160);
    expect(m.decades).toEqual([140, 150, 160]);
    expect(m.cells[159]).toMatchObject({ count: 5, bin: 3, thisSeason: false });
    expect(m.cells[150]).toMatchObject({ count: 0, bin: 0, aboveMax: false });
    expect(m.cells[169]).toMatchObject({ count: 0, aboveMax: true });
    expect(m.filledCount).toBe(3);
  });

  it('excludes scores below 60 and the 300', () => {
    const m = buildScoreMap([row(55, 2), row(140, 1), row(300, 1)], false);
    expect(m.minScore).toBe(140);
    expect(m.maxScore).toBe(140);
    expect(m.cells[55]).toBeUndefined();
    expect(m.cells[300]).toBeUndefined();
    expect(m.filledCount).toBe(1);
  });

  it('picks most-rolled by highest count, ties broken by lowest score', () => {
    const m = buildScoreMap([row(150, 4), row(160, 4), row(170, 2)], false);
    expect(m.mostRolled).toBe(150);
  });

  it('counts this-season and new squares', () => {
    const m = buildScoreMap(
      [row(150, 8, 1, 0), row(160, 1, 1, 1), row(170, 3, 0, 0)],
      false,
    );
    expect(m.seasonCount).toBe(2);
    expect(m.newCount).toBe(1);
    expect(m.cells[160]).toMatchObject({ thisSeason: true, isNew: true });
  });

  it('passes hasPerfect through', () => {
    expect(buildScoreMap([row(150, 1)], true).hasPerfect).toBe(true);
    expect(buildScoreMap([row(150, 1)], false).hasPerfect).toBe(false);
  });
});

import { scoreMapTeaser } from './score-map';

describe('scoreMapTeaser', () => {
  const base = (over: Partial<Parameters<typeof scoreMapTeaser>[0]> = {}) =>
    scoreMapTeaser({ filledCount: 134, seasonCount: 0, newCount: 0, ...over } as any);

  it('shows scores rolled and the open hint', () => {
    expect(base()).toBe('134 scores rolled · tap to open');
  });
  it('adds this-season count when present', () => {
    expect(base({ seasonCount: 3 })).toBe('134 scores rolled · 3 this season · tap to open');
  });
  it('calls out new squares only when there are any', () => {
    expect(base({ seasonCount: 3, newCount: 1 }))
      .toBe('134 scores rolled · 3 this season · 1 new square! · tap to open');
    expect(base({ seasonCount: 3, newCount: 2 }))
      .toBe('134 scores rolled · 3 this season · 2 new squares! · tap to open');
  });
});
