/**
 * Turning invariant findings into an alert.
 *
 * Pure, so the alerting decision and the message body are testable without a
 * database or a mail provider. The cron route does the querying and sending.
 */

/**
 * Should this run alert?
 *
 * Only on something actionable. A clean run is silent on purpose: a job that
 * mails every day is one whose mail stops being read, and then a real failure
 * arrives in a folder nobody opens.
 */
export function shouldAlert({ findings, error }) {
  return Boolean(error) || (findings?.length ?? 0) > 0;
}

export function subjectFor({ findings, error }) {
  if (error) return 'Splitzkrieg data check could not run';
  const n = findings.length;
  return `Splitzkrieg data check: ${n} violation${n === 1 ? '' : 's'}`;
}

export function bodyFor({ findings, error, checked, ranAt }) {
  const when = ranAt ?? new Date().toISOString();

  if (error) {
    return [
      'The scheduled data integrity check failed to run.',
      '',
      `Error: ${error}`,
      '',
      'This is NOT a clean result. The data was never checked, so treat it as',
      'unknown rather than healthy.',
      '',
      `Run at ${when}`,
    ].join('\n');
  }

  return [
    `${findings.length} of ${checked} data invariants failed.`,
    '',
    'Each of these is a condition that should never be true. Every one was',
    'confirmed to hold against production before being added, so a failure',
    'here means something changed, not that the check is noisy.',
    '',
    ...findings.map((f) => `  - ${f.message}`),
    '',
    'Run `npm run check:data` locally for the same output.',
    '',
    `Run at ${when}`,
  ].join('\n');
}
