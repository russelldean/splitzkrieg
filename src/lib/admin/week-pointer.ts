/**
 * The league's "latest completed week" pointer.
 *
 * Stored in leagueSettings as publishedWeek + publishedSeasonID. Despite the
 * name it is NOT a visibility gate: the public site derives what to show from
 * the scores table, and a week becomes public when the site is deployed. This
 * pointer only answers "what week is the league on", which drives the lineup
 * form, the Friday lineup-reminder cron, the LeaguePals push, and the week
 * defaults on the admin score pages.
 */

export interface WeekPointer {
  seasonID: number | null;
  week: number;
}

/**
 * Where the pointer should land after confirming a week.
 *
 * Within a season the pointer only ever moves forward: re-confirming an earlier
 * week to fix a bad score must not convince the league it is back on week 2.
 * Across a season boundary it takes the new week outright, because week 1 of a
 * new season is not a rewind from week 11 of the old one.
 */
export function nextWeekPointer(
  current: WeekPointer | null,
  seasonID: number,
  week: number,
): { seasonID: number; week: number } {
  if (!current || current.seasonID !== seasonID) return { seasonID, week };
  return { seasonID, week: Math.max(current.week, week) };
}
