import { describe, it, expect } from 'vitest';
import { scoreColorClass } from './score-utils';

describe('scoreColorClass', () => {
  it('returns red+bold for perfect game (300)', () => {
    expect(scoreColorClass(300)).toBe('text-red-600 font-bold');
  });
  it('returns amber+semibold for 250-299', () => {
    expect(scoreColorClass(250)).toBe('text-amber-500 font-semibold');
    expect(scoreColorClass(275)).toBe('text-amber-500 font-semibold');
  });
  it('returns green for 200-249', () => {
    expect(scoreColorClass(200)).toBe('text-green-600');
    expect(scoreColorClass(220)).toBe('text-green-600');
  });
  it('returns empty string for sub-200', () => {
    expect(scoreColorClass(199)).toBe('');
    expect(scoreColorClass(0)).toBe('');
  });
  it('returns empty string for null', () => {
    expect(scoreColorClass(null)).toBe('');
  });
});
