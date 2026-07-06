import { describe, it, expect } from 'vitest';
import { groupByMatchDate } from './week-utils';

describe('groupByMatchDate', () => {
  it('returns a single group when all items share one date', () => {
    const items = [{ matchDate: '2026-08-24' }, { matchDate: '2026-08-24' }];
    const groups = groupByMatchDate(items, (x) => x.matchDate);
    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBe('2026-08-24');
    expect(groups[0].items).toHaveLength(2);
  });

  it('splits multiple dates into ascending groups, preserving within-group order', () => {
    const items = [
      { id: 1, matchDate: '2026-07-13' },
      { id: 2, matchDate: '2026-07-20' },
      { id: 3, matchDate: '2026-07-13' },
    ];
    const groups = groupByMatchDate(items, (x) => x.matchDate);
    expect(groups.map((g) => g.date)).toEqual(['2026-07-13', '2026-07-20']);
    expect(groups[0].items.map((i) => i.id)).toEqual([1, 3]);
    expect(groups[1].items.map((i) => i.id)).toEqual([2]);
  });

  it('sorts null dates last', () => {
    const items = [{ matchDate: null }, { matchDate: '2026-07-13' }];
    const groups = groupByMatchDate(items, (x) => x.matchDate);
    expect(groups.map((g) => g.date)).toEqual(['2026-07-13', null]);
  });

  it('groups equal Date objects into one group (mssql returns date columns as Date)', () => {
    // Distinct Date instances for the same calendar day must NOT become separate
    // groups (reference-equality trap). This is the split-week preview bug.
    const items = [
      { matchDate: new Date('2026-08-24T00:00:00.000Z') },
      { matchDate: new Date('2026-08-24T00:00:00.000Z') },
      { matchDate: new Date('2026-08-24T00:00:00.000Z') },
    ];
    const groups = groupByMatchDate(items, (x) => x.matchDate);
    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBe('2026-08-24');
    expect(groups[0].items).toHaveLength(3);
  });

  it('groups Date objects across two days into two groups', () => {
    const items = [
      { matchDate: new Date('2026-07-13T00:00:00.000Z') },
      { matchDate: new Date('2026-07-20T00:00:00.000Z') },
      { matchDate: new Date('2026-07-13T00:00:00.000Z') },
    ];
    const groups = groupByMatchDate(items, (x) => x.matchDate);
    expect(groups.map((g) => g.date)).toEqual(['2026-07-13', '2026-07-20']);
  });
});
