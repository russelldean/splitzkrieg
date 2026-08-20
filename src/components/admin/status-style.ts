import type { StepState } from '@/lib/admin/week-status';

/**
 * Marker, colour and meaning for each step state.
 *
 * Shared by both status boards rather than copied into each. They render one
 * above the other on the admin dashboard, so a legend that drifted between
 * them would read as a bug. It lives here rather than in week-status.ts
 * because that module is pure logic and should not carry Tailwind classes.
 */
export const STATE_STYLE: Record<StepState, { mark: string; className: string }> = {
  done: { mark: 'DONE', className: 'text-green-700 bg-green-50 border-green-200' },
  pending: { mark: 'WAITING', className: 'text-navy/70 bg-navy/[0.03] border-navy/15' },
  attention: { mark: 'ACTION', className: 'text-red-700 bg-red-50 border-red-300' },
  optional: { mark: 'OPTIONAL', className: 'text-navy/70 bg-navy/[0.03] border-navy/15' },
  unknown: { mark: 'UNKNOWN', className: 'text-navy/70 bg-navy/[0.03] border-navy/15' },
};
