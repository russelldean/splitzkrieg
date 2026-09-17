import { describe, it, expect } from 'vitest';
import { isAboveAverageAllThree, ABOVE_AVG_SQL } from './above-average.mjs';

/**
 * The point of these tests is not that the predicate works. It is that the two
 * forms of the rule, the JS predicate and the SQL fragment, stay the same rule.
 *
 * They drifted once already: SQL moved to >= on 2026-08-04 and the JS copy kept
 * using >, which cost 347 bowler-weeks their place on the week page while the
 * badge still showed on their bowler page. Nothing compared the two, so nothing
 * failed.
 */

/** Rows written the way a real score row arrives. */
const CASES = [
  { name: 'tie on the last game (Brooke Insley, S36 wk5)', row: { game1: 157, game2: 147, game3: 144, incomingAvg: 144 }, expected: true },
  { name: 'tie on the last game (Elizabeth Read, S36 wk5)', row: { game1: 147, game2: 179, game3: 125, incomingAvg: 125 }, expected: true },
  { name: 'tie on the first game (Matt Stansell, S36 wk4)', row: { game1: 154, game2: 171, game3: 166, incomingAvg: 154 }, expected: true },
  { name: 'tie on two games (Daz Hicks, S36 wk2)', row: { game1: 131, game2: 152, game3: 152, incomingAvg: 131 }, expected: true },
  { name: 'tie on all three', row: { game1: 140, game2: 140, game3: 140, incomingAvg: 140 }, expected: true },
  { name: 'clear of the average on all three', row: { game1: 200, game2: 175, game3: 266, incomingAvg: 171 }, expected: true },
  { name: 'one pin short on one game', row: { game1: 157, game2: 147, game3: 143, incomingAvg: 144 }, expected: false },
  { name: 'short on every game', row: { game1: 100, game2: 110, game3: 120, incomingAvg: 150 }, expected: false },
  { name: 'no incoming average', row: { game1: 200, game2: 200, game3: 200, incomingAvg: null }, expected: false },
  { name: 'zero incoming average', row: { game1: 90, game2: 80, game3: 70, incomingAvg: 0 }, expected: false },
  { name: 'a missing game', row: { game1: 157, game2: null, game3: 144, incomingAvg: 144 }, expected: false },
  { name: 'a penalty row', row: { game1: 200, game2: 200, game3: 200, incomingAvg: 150, isPenalty: true }, expected: false },
];

describe('isAboveAverageAllThree', () => {
  for (const { name, row, expected } of CASES) {
    it(`${expected ? 'counts' : 'excludes'}: ${name}`, () => {
      expect(isAboveAverageAllThree(row)).toBe(expected);
    });
  }
});

/**
 * Evaluate the SQL fragment against a row, by reading the operators out of the
 * fragment itself rather than restating them. If someone edits the SQL to use >
 * again, this interpreter changes behaviour with it and the shared table below
 * starts disagreeing with the predicate.
 */
function evalSqlFragment(sql, row) {
  const ops = [...sql.matchAll(/sc\.game([123])\s*(>=|>)\s*sc\.incomingAvg/g)];
  if (ops.length !== 3) throw new Error(`expected 3 game comparisons, found ${ops.length}`);
  if (!/sc\.isPenalty\s*=\s*0/.test(sql)) throw new Error('fragment no longer excludes penalty rows');
  if (!/sc\.incomingAvg\s+IS NOT NULL/.test(sql)) throw new Error('fragment no longer excludes a null average');
  if (!/sc\.incomingAvg\s*>\s*0/.test(sql)) throw new Error('fragment no longer excludes a zero average');

  if (row.isPenalty) return false;
  if (row.incomingAvg == null || row.incomingAvg === 0) return false;
  for (const [, n, op] of ops) {
    const g = row[`game${n}`];
    if (g == null) return false;                       // SQL comparison on NULL is not true
    if (op === '>=' ? !(g >= row.incomingAvg) : !(g > row.incomingAvg)) return false;
  }
  return true;
}

describe('ABOVE_AVG_SQL agrees with the predicate', () => {
  it('is shaped the way the interpreter expects', () => {
    expect(() => evalSqlFragment(ABOVE_AVG_SQL, CASES[0].row)).not.toThrow();
  });

  for (const { name, row, expected } of CASES) {
    it(`same verdict on: ${name}`, () => {
      expect(evalSqlFragment(ABOVE_AVG_SQL, row)).toBe(expected);
      expect(evalSqlFragment(ABOVE_AVG_SQL, row)).toBe(isAboveAverageAllThree(row));
    });
  }

  it('catches the exact drift that shipped: SQL reverted to >', () => {
    const reverted = ABOVE_AVG_SQL.replace(/>=/g, '>');
    const tie = { game1: 157, game2: 147, game3: 144, incomingAvg: 144 };
    expect(evalSqlFragment(reverted, tie)).toBe(false);
    expect(isAboveAverageAllThree(tie)).toBe(true);
  });
});
