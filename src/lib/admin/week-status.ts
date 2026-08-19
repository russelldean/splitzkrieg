/**
 * Derived state for one league week.
 *
 * Every value here is read back out of the system, never recorded by clicking
 * a button. A checklist records what you SAY you did and quietly lies the
 * moment you skip a step or work out of order, which is why the last attempt
 * at a weekly checklist did not stick. This cannot lie, because it never
 * stores anything.
 */

export type StepState =
  /** Confirmed present. */
  | 'done'
  /** Not started, and that is fine for where you are. */
  | 'pending'
  /** Something ran and did not finish, or is standing between you and live. */
  | 'attention'
  /** Genuinely optional, never blocking. */
  | 'optional'
  /** Not knowable from here (for example git state on a deployed server). */
  | 'unknown';

export interface WeekCounts {
  scores: number;
  turkeys: number;
  matchResults: number;
  patches: number;
  milestones: number;
  facts: number;
  heroImage: string | null;
  writeupChars: number;
  /** Commits on main not yet pushed. Null when there is no working tree. */
  commitsAhead: number | null;
  /** ISO timestamp recorded when the weekly email went out, else null. */
  emailSentAt: string | null;
}

export interface WeekStatusStep {
  key: string;
  label: string;
  state: StepState;
  detail: string;
}

/**
 * Which downstream tables the confirm pipeline must populate for a week.
 *
 * Milestones are deliberately absent: a quiet week genuinely produces none, so
 * a zero there is not evidence of a failure. The others always produce rows
 * when the pipeline completes, so a zero means it died partway.
 */
const REQUIRED_CASCADE: Array<{ key: keyof WeekCounts; label: string }> = [
  { key: 'matchResults', label: 'match results' },
  { key: 'patches', label: 'patches' },
  { key: 'facts', label: 'facts' },
];

export function deriveWeekStatus(counts: WeekCounts): WeekStatusStep[] {
  const hasScores = counts.scores > 0;

  const missing = REQUIRED_CASCADE.filter((t) => (counts[t.key] as number) === 0).map(
    (t) => t.label,
  );

  let cascadeState: StepState;
  let cascadeDetail: string;
  if (!hasScores) {
    // Nothing downstream can exist before scores do, so this is not a failure.
    cascadeState = 'pending';
    cascadeDetail = 'waiting on scores';
  } else if (missing.length > 0) {
    cascadeState = 'attention';
    cascadeDetail = `scores are in but no ${missing.join(', no ')}`;
  } else {
    cascadeState = 'done';
    cascadeDetail = `${counts.matchResults} match results, ${counts.patches} patches, ${counts.milestones} milestones, ${counts.facts} facts`;
  }

  let deployState: StepState;
  let deployDetail: string;
  if (counts.commitsAhead == null) {
    deployState = 'unknown';
    deployDetail = 'no working tree here, check locally';
  } else if (counts.commitsAhead > 0) {
    deployState = 'attention';
    deployDetail = `${counts.commitsAhead} commit${counts.commitsAhead === 1 ? '' : 's'} not pushed`;
  } else {
    deployState = 'done';
    deployDetail = 'nothing waiting to push';
  }

  return [
    {
      key: 'scores',
      label: 'Scores imported',
      state: hasScores ? 'done' : 'pending',
      detail: hasScores ? `${counts.scores} rows` : 'none yet',
    },
    {
      key: 'turkeys',
      label: 'Turkeys',
      state: hasScores ? 'done' : 'pending',
      // Cannot distinguish "none entered" from "none bowled", so report the
      // number and let the reader judge rather than asserting correctness.
      detail: hasScores ? `${counts.turkeys} recorded` : 'waiting on scores',
    },
    { key: 'cascade', label: 'Confirmed and processed', state: cascadeState, detail: cascadeDetail },
    {
      key: 'photo',
      label: 'Photo',
      state: counts.heroImage ? 'done' : 'optional',
      detail: counts.heroImage ?? 'none attached',
    },
    {
      key: 'writeup',
      label: 'Writeup',
      state: counts.writeupChars > 0 ? 'done' : 'optional',
      detail: counts.writeupChars > 0 ? `${counts.writeupChars} characters` : 'none written',
    },
    { key: 'deploy', label: 'Deployed', state: deployState, detail: deployDetail },
    {
      key: 'email',
      label: 'Email sent',
      // Recorded by the email route on a successful send, so this is derived
      // like everything else rather than being the one row you tick yourself.
      state: counts.emailSentAt ? 'done' : 'pending',
      detail: counts.emailSentAt
        ? new Date(counts.emailSentAt).toLocaleString('en-US', { timeZone: 'America/New_York' })
        : 'not sent yet',
    },
  ];
}
