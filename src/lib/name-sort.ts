/**
 * Alphabetize bowlers by LAST name (Russ, 2026-11-18: "use last name everywhere
 * we are alphabetizing"). The DB stores one `bowlerName` ("First Last"), so the
 * surname is derived here, in one place, for every list and tiebreak.
 *
 * Rules, from the names actually in the bowlers table:
 * - the surname is the last word ("Emma Jane Richardson" -> Richardson)
 * - a generational suffix is skipped ("Geoffrey Berry II" -> Berry)
 * - a trailing parenthetical is ignored ("Mike M (Unknown)" -> M)
 * - lowercase or known particles stay attached ("Megan Van Noord" -> Van Noord,
 *   "Gil Dos Santos" -> Dos Santos, "Mirla del Rosario" -> del Rosario)
 * - a single name sorts as itself ("Fitz")
 */

const SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv']);
const PARTICLES = new Set(['van', 'von', 'der', 'den', 'dos', 'da', 'de', 'del', 'della', 'di', 'du', 'la', 'le', 'st.']);

/** The surname a bowler files under, e.g. "Van Noord" for "Megan Van Noord". */
export function surname(fullName: string): string {
  const words = fullName.replace(/\s*\(.*?\)\s*$/, '').trim().split(/\s+/);
  while (words.length > 1 && SUFFIXES.has(words[words.length - 1].toLowerCase())) words.pop();
  if (words.length <= 1) return words[0] ?? '';
  let start = words.length - 1;
  while (start > 1 && PARTICLES.has(words[start - 1].toLowerCase())) start--;
  return words.slice(start).join(' ');
}

/** Sort key: surname, then the full name, so same-surname bowlers order by first name. */
export function surnameKey(fullName: string): string {
  return `${surname(fullName)}\u0000${fullName}`;
}

/** Comparator for two full names, by last name. */
export function compareByLastName(a: string, b: string): number {
  return surnameKey(a).localeCompare(surnameKey(b), undefined, { sensitivity: 'base' });
}

/** The directory letter a bowler files under. */
export function surnameInitial(fullName: string): string {
  return (surname(fullName)[0] ?? '#').toUpperCase();
}
