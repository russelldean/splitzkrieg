/**
 * Naming convention for a week's recap post.
 *
 * These MUST keep matching the posts already in the database. The build-time
 * redirect map in next.config keys on the slug, so a post created with a
 * different slug silently breaks that week's link in every weekly email that
 * went out. Pinned by tests against real stored values.
 */

/** e.g. ('XXXVI', 3) -> 'season-xxxvi-week-3-recap' */
export function recapSlug(romanNumeral: string, week: number): string {
  return `season-${romanNumeral.toLowerCase()}-week-${week}-recap`;
}

/** e.g. ('XXXVI', 3) -> 'Season XXXVI - Week 3 Recap' */
export function recapTitle(romanNumeral: string, week: number): string {
  return `Season ${romanNumeral} - Week ${week} Recap`;
}
