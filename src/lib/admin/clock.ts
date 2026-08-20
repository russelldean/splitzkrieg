/**
 * League wall-clock helpers.
 *
 * Separate from reminder-window.ts on purpose: that module is pure and takes
 * the date as an injected string so it stays testable. This is the impure edge
 * that reads the actual clock.
 */

/**
 * Today's date in league time, as 'YYYY-MM-DD'.
 *
 * Assembled from formatToParts rather than format(). A locale's formatted
 * string is CLDR behaviour, not a contract: if 'en-CA' ever emitted slashes,
 * Date.parse downstream would yield NaN, and NaN fails every comparison in
 * reminderPlan, so the cron would judge itself eligible on every run and mail
 * everyone. Reading the named parts cannot drift that way.
 */
export function todayET(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
