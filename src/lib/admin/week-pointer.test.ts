import { describe, it, expect } from 'vitest';
import { nextWeekPointer } from './week-pointer';

describe('nextWeekPointer', () => {
  it('advances the pointer when a later week is confirmed', () => {
    expect(nextWeekPointer({ seasonID: 36, week: 3 }, 36, 4)).toEqual({ seasonID: 36, week: 4 });
  });

  it('does NOT rewind when an earlier week is re-confirmed', () => {
    // Re-running week 2 to fix a bad score must not make the league think
    // week 2 is the latest completed week.
    expect(nextWeekPointer({ seasonID: 36, week: 4 }, 36, 2)).toEqual({ seasonID: 36, week: 4 });
  });

  it('holds steady when the same week is confirmed twice', () => {
    expect(nextWeekPointer({ seasonID: 36, week: 4 }, 36, 4)).toEqual({ seasonID: 36, week: 4 });
  });

  it('takes the new week outright when the season changed', () => {
    // At changeover the pointer holds the prior season's LAST week (say 11).
    // Confirming week 1 of the new season must not be treated as a rewind.
    expect(nextWeekPointer({ seasonID: 35, week: 11 }, 36, 1)).toEqual({ seasonID: 36, week: 1 });
  });

  it('takes the week when there is no pointer yet', () => {
    expect(nextWeekPointer(null, 36, 1)).toEqual({ seasonID: 36, week: 1 });
  });

  it('treats an unknown season on the existing pointer as a season change', () => {
    expect(nextWeekPointer({ seasonID: null, week: 9 }, 36, 2)).toEqual({ seasonID: 36, week: 2 });
  });
});
