export interface BowlerGameRow {
  bowlerID: number;
  game1: number | null;
  game2: number | null;
  game3: number | null;
  incomingAvg: number | null;
}

export interface TeamRollup {
  scratch: {
    game1: number;
    game2: number;
    game3: number;
    series: number;
  };
}

export function rollupTeamTotals(rows: BowlerGameRow[]): TeamRollup {
  const sum = (key: 'game1' | 'game2' | 'game3') =>
    rows.reduce((acc, r) => acc + (r[key] ?? 0), 0);
  const g1 = sum('game1');
  const g2 = sum('game2');
  const g3 = sum('game3');
  return { scratch: { game1: g1, game2: g2, game3: g3, series: g1 + g2 + g3 } };
}

export interface QualifierRef {
  bowlerID: number;
}

export function flagAlternates<T extends { bowlerID: number }>(
  bowled: T[],
  qualifiers: QualifierRef[],
): Array<T & { isAlternate: boolean }> {
  const qualifierSet = new Set(qualifiers.map(q => q.bowlerID));
  return bowled.map(b => ({ ...b, isAlternate: !qualifierSet.has(b.bowlerID) }));
}
