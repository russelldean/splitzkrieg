import { MILESTONE_THRESHOLDS, type MilestoneCategory } from './milestone-config';

/**
 * Pure text helpers for the season recap cards. Kept free of React and DB so
 * the copy rules can be unit-tested.
 */

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

const PIN_HEIGHT_IN = 15;
const PIN_WEIGHT_LB = 3.5;
const FOOTBALL_FIELD_FT = 300;

export interface PinEquivalent { value: string; label: string }

/**
 * Turn a season pin count into things a person can picture. A score is not a
 * count of pins knocked down, so these are deliberately framed as "pins of score".
 */
export function pinEquivalents(pins: number): PinEquivalent[] {
  const feet = (pins * PIN_HEIGHT_IN) / 12;
  const lengthCard: PinEquivalent = feet >= 5280
    ? { value: `${(feet / 5280).toFixed(1)} mi`, label: 'of pins laid end to end' }
    : { value: `${fmt(Math.round(feet))} ft`, label: 'of pins laid end to end' };
  const fields = feet / FOOTBALL_FIELD_FT;
  const fieldCard: PinEquivalent = { value: `${Math.round(fields)}`, label: fields >= 1.5 ? 'football fields, goal line to goal line' : 'football field, goal line to goal line' };
  const pounds = pins * PIN_WEIGHT_LB;
  const weightCard: PinEquivalent = pounds >= 2000
    ? { value: `${(pounds / 2000).toFixed(1)} tons`, label: 'of maple, if every pin were real' }
    : { value: `${fmt(Math.round(pounds))} lb`, label: 'of maple, if every pin were real' };
  const racks: PinEquivalent = { value: fmt(Math.round(pins / 10)), label: 'full racks of ten' };
  return [lengthCard, fieldCard, weightCard, racks];
}

export interface AnimalRung { key: string; name: string; plural: string; article: 'a' | 'an'; lbs: number }

/** Heaviest to lightest. Weights are typical adults, rounded. */
export const ANIMAL_LADDER: AnimalRung[] = [
  { key: 'triceratops', name: 'Triceratops', plural: 'Triceratops', article: 'a', lbs: 20000 },
  { key: 'trex', name: 'Tyrannosaurus rex', plural: 'Tyrannosaurus rexes', article: 'a', lbs: 16000 },
  { key: 'elephant', name: 'African elephant', plural: 'African elephants', article: 'an', lbs: 12000 },
  { key: 'orca', name: 'orca', plural: 'orcas', article: 'an', lbs: 8000 },
  { key: 'rhino', name: 'white rhino', plural: 'white rhinos', article: 'a', lbs: 5000 },
  { key: 'beluga', name: 'beluga whale', plural: 'beluga whales', article: 'a', lbs: 3000 },
  { key: 'giraffe', name: 'giraffe', plural: 'giraffes', article: 'a', lbs: 2600 },
  { key: 'bison', name: 'bison', plural: 'bison', article: 'a', lbs: 2000 },
  { key: 'horse', name: 'horse', plural: 'horses', article: 'a', lbs: 1100 },
  { key: 'bear', name: 'grizzly bear', plural: 'grizzly bears', article: 'a', lbs: 600 },
];

export interface AnimalWeight {
  animal: AnimalRung;
  /** How many of the animal, 1 to MAX_HERD. */
  count: number;
  pounds: number;
  /** "7.5 tons" or "840 lb". */
  weightText: string;
  /** count * animal weight / pins weight, so 1 is exact. */
  fit: number;
  /** "about one Tyrannosaurus rex", "two white rhinos", "three grizzly bears". */
  phrase: string;
}

const MAX_HERD = 5;
const HERD_TOLERANCE = 0.08;

/**
 * Walk the ladder heaviest first and take the first animal whose whole-number
 * count lands within tolerance of the pins' weight: one T. rex beats three
 * rhinos when both fit, but a season that is not close to any single beast
 * becomes a small herd of something lighter. Falls back to the closest fit.
 */
export function animalWeight(pins: number): AnimalWeight {
  const pounds = pins * PIN_WEIGHT_LB;
  const options = ANIMAL_LADDER.map(animal => {
    const count = Math.min(MAX_HERD, Math.max(1, Math.round(pounds / animal.lbs)));
    return { animal, count, fit: (count * animal.lbs) / pounds };
  });
  const pick = options.find(o => Math.abs(o.fit - 1) <= HERD_TOLERANCE)
    ?? options.reduce((best, o) => (Math.abs(o.fit - 1) < Math.abs(best.fit - 1) ? o : best), options[0]);
  const { animal, count, fit } = pick;
  const noun = count === 1 ? animal.name : animal.plural;
  const phrase = `${Math.abs(fit - 1) <= 0.03 ? '' : 'about '}${numberWord(count)} ${noun}`;
  const weightText = pounds >= 2000 ? `${(pounds / 2000).toFixed(1)} tons` : `${fmt(Math.round(pounds))} lb`;
  return { animal, count, pounds, weightText, fit, phrase };
}

function numberWord(n: number): string {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][n] ?? String(n);
}

export const NC_PEAKS: Array<{ feet: number; name: string }> = [
  { feet: 867, name: 'Occoneechee Mountain' },
  { feet: 2421, name: 'Pilot Mountain' },
  { feet: 2579, name: 'Hanging Rock' },
  { feet: 3920, name: 'Table Rock' },
  { feet: 4683, name: 'Mount Jefferson' },
  { feet: 5721, name: 'Mount Pisgah' },
  { feet: 5946, name: 'Grandfather Mountain' },
  { feet: 6643, name: 'Clingmans Dome' },
  { feet: 6684, name: 'Mount Mitchell' },
];

const GIRAFFE_FT = 18;

/**
 * Where a stack of pins would stand against the North Carolina peaks, with the
 * leftover height made up in giraffes piggybacking on the summit: "37 giraffes
 * piggyback on the summit of Mount Jefferson". Below the lowest peak it is giraffes alone.
 */
export function peakComparison(feet: number): string {
  const base = [...NC_PEAKS].reverse().find(p => p.feet <= feet);
  const giraffes = Math.round((feet - (base?.feet ?? 0)) / GIRAFFE_FT);
  const herd = giraffes === 1 ? 'one giraffe piggybacks' : `${fmt(giraffes)} giraffes piggyback`;
  if (!base) return giraffes <= 1 ? 'about one giraffe' : `${herd} on the alley floor`;
  const name = base === NC_PEAKS[NC_PEAKS.length - 1] ? `${base.name}, the highest point east of the Mississippi` : base.name;
  if (giraffes === 0) return `right at the summit of ${base.name}`;
  return `${herd} on the summit of ${name}`;
}

/** Pins stacked base to crown, in feet. */
export function stackedFeet(pins: number): number {
  return Math.round((pins * PIN_HEIGHT_IN) / 12);
}

/** "4th of 135" style rank sentence. */
export function rankPhrase(rank: number, field: number): string {
  if (rank === 1) return `Most in the league`;
  return `${ordinal(rank)} of ${field} in the league`;
}

export interface NearestMilestone { category: MilestoneCategory; current: number; next: number; needed: number; pct: number }

/**
 * The career line the bowler is closest to crossing, by share of the way
 * there. Unlike computePersonalMilestones this ignores the proximity window:
 * the recap always has something to point at.
 */
export function nearestMilestone(stats: {
  totalGamesBowled: number | null; totalPins: number | null; games200Plus: number | null;
  series600Plus: number | null; totalTurkeys: number | null;
}): NearestMilestone | null {
  const current: Record<MilestoneCategory, number> = {
    totalGames: stats.totalGamesBowled ?? 0, totalPins: stats.totalPins ?? 0, games200Plus: stats.games200Plus ?? 0,
    series600Plus: stats.series600Plus ?? 0, totalTurkeys: stats.totalTurkeys ?? 0,
  };
  let best: NearestMilestone | null = null;
  for (const category of Object.keys(MILESTONE_THRESHOLDS) as MilestoneCategory[]) {
    const thresholds = MILESTONE_THRESHOLDS[category].thresholds as readonly number[];
    const have = current[category];
    const next = thresholds.find(t => have < t);
    if (next == null) continue;
    const prev = [...thresholds].reverse().find(t => t <= have) ?? 0;
    const pct = (have - prev) / (next - prev);
    if (!best || pct > best.pct) best = { category, current: have, next, needed: next - have, pct };
  }
  return best;
}

/**
 * Plain-English gap between two dates: "4 years and 7 months", "11 months",
 * "3 weeks", "a week". Days under a week round to "a week".
 */
export function timeSince(from: Date | string, to: Date | string): string {
  // Dates arrive as strings once the recordsets have been through the disk cache.
  const days = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);
  if (days < 11) return 'a week';
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  const months = Math.round(days / 30.44);
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  const y = years === 1 ? 'a year' : `${years} years`;
  if (rem === 0) return y;
  return `${y} and ${rem === 1 ? 'a month' : `${rem} months`}`;
}
