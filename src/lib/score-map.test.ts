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
