import { describe, it, expect } from 'vitest';
import { surname, compareByLastName, surnameInitial } from './name-sort';

describe('surname', () => {
  it.each([
    ['Russ Dean', 'Dean'],
    ['Emma Jane Richardson', 'Richardson'],
    ['Geoffrey Berry II', 'Berry'],
    ['Mike M (Unknown)', 'M'],
    ['Megan Van Noord', 'Van Noord'],
    ['Gil Dos Santos', 'Dos Santos'],
    ['Mirla del Rosario', 'del Rosario'],
    ['J.D. Lubenetski', 'Lubenetski'],
    ['Jon E. Walker', 'Walker'],
    ['Fitz', 'Fitz'],
    ['Penalty', 'Penalty'],
  ])('%s -> %s', (name, want) => {
    expect(surname(name)).toBe(want);
  });
});

describe('compareByLastName', () => {
  it('orders by surname, then first name', () => {
    const names = ['Russ Dean', 'Alik Lyle', 'Amy Kostrewa', 'Geoffrey Berry II', 'Ben Berry', 'Megan Van Noord'];
    expect([...names].sort(compareByLastName)).toEqual([
      'Ben Berry', 'Geoffrey Berry II', 'Russ Dean', 'Amy Kostrewa', 'Alik Lyle', 'Megan Van Noord',
    ]);
  });
  it('files under the surname initial', () => {
    expect(surnameInitial('Megan Van Noord')).toBe('V');
    expect(surnameInitial('Russ Dean')).toBe('D');
  });
});
