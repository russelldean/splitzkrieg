import { describe, it, expect } from 'vitest';
import { ordinal, pinEquivalents, rankPhrase, nearestMilestone, animalWeight, stackedFeet, peakComparison, timeSince } from './wrapped-text';

describe('ordinal', () => {
  it('handles the teens and the 1/2/3 endings', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 35, 101, 111].map(ordinal))
      .toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '35th', '101st', '111th']);
  });
});

describe('pinEquivalents', () => {
  it('switches to miles and tons once a season is big enough', () => {
    const eq = pinEquivalents(4285);
    expect(eq[0].value).toBe('1.0 mi');
    expect(eq[1].value).toBe('18');
    expect(eq[2].value).toBe('7.5 tons');
    expect(eq[3].value).toBe('429');
  });
  it('stays in feet and pounds for a short season', () => {
    const eq = pinEquivalents(400);
    expect(eq[0].value).toBe('500 ft');
    expect(eq[2].value).toBe('1,400 lb');
  });
});

describe('rankPhrase', () => {
  it('celebrates first place, otherwise ordinal of field', () => {
    expect(rankPhrase(1, 135)).toBe('Most in the league');
    expect(rankPhrase(4, 135)).toBe('4th of 135 in the league');
  });
});

describe('nearestMilestone', () => {
  it('picks the line the bowler is furthest along toward, ignoring proximity windows', () => {
    const m = nearestMilestone({ totalGamesBowled: 864, totalPins: 143535, games200Plus: 97, series600Plus: 5, totalTurkeys: 281 });
    expect(m).toEqual({ category: 'games200Plus', current: 97, next: 100, needed: 3, pct: 0.88 });
  });
  it('null when every line is already crossed', () => {
    expect(nearestMilestone({ totalGamesBowled: 2000, totalPins: 300000, games200Plus: 400, series600Plus: 200, totalTurkeys: 500 })).toBeNull();
  });
});

describe('animalWeight', () => {
  it('a full strong season is about one T. rex', () => {
    const a = animalWeight(4285);
    expect(a.animal.name).toBe('Tyrannosaurus rex');
    expect(a.weightText).toBe('7.5 tons');
    expect(a.count).toBe(1);
    expect(a.phrase).toBe('about one Tyrannosaurus rex');
  });
  it('prefers one big animal, otherwise a small herd of a lighter one', () => {
    expect(animalWeight(3294).phrase).toBe('about one African elephant');
    expect(animalWeight(3015).phrase).toBe('about two white rhinos');
    expect(animalWeight(514).phrase).toBe('three grizzly bears');
  });
  it('caps the herd and falls back to the closest fit when nothing is within tolerance', () => {
    const a = animalWeight(258);
    expect(a.count).toBeLessThanOrEqual(5);
    expect(a.animal.name).toBe('horse');
  });
  it('reports pounds under a ton', () => {
    expect(animalWeight(20).weightText).toBe('70 lb');
  });
});

describe('stackedFeet', () => {
  it('stacks 15-inch pins', () => {
    expect(stackedFeet(4285)).toBe(5356);
  });
});

describe('peakComparison', () => {
  it('stands giraffes on the tallest peak that fits under the stack', () => {
    expect(peakComparison(5356)).toBe('37 giraffes piggyback on the summit of Mount Jefferson');
    expect(peakComparison(2439)).toBe('one giraffe piggybacks on the summit of Pilot Mountain');
  });
  it('calls a near miss the summit itself', () => {
    expect(peakComparison(2425)).toBe('right at the summit of Pilot Mountain');
  });
  it('is giraffes alone below the lowest peak, and keeps going above the highest', () => {
    expect(peakComparison(323)).toBe('18 giraffes piggyback on the alley floor');
    expect(peakComparison(7000)).toBe('18 giraffes piggyback on the summit of Mount Mitchell, the highest point east of the Mississippi');
  });
});

describe('timeSince', () => {
  const d = (s: string) => new Date(s);
  it('rounds to weeks, months, then years and months', () => {
    expect(timeSince(d('2026-10-26'), d('2026-11-02'))).toBe('a week');
    expect(timeSince(d('2026-10-05'), d('2026-11-02'))).toBe('4 weeks');
    expect(timeSince(d('2026-01-12'), d('2026-11-02'))).toBe('10 months');
    expect(timeSince(d('2022-03-14'), d('2026-11-02'))).toBe('4 years and 8 months');
    expect(timeSince(d('2025-11-03'), d('2026-11-02'))).toBe('a year');
  });
});
