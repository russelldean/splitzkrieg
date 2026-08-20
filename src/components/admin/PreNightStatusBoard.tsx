'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StepState, WeekStatusStep } from '@/lib/admin/week-status';

interface Props {
  seasonID: number;
  week: number;
}

/** Same legend as WeekStatusBoard so the two boards cannot drift apart. */
const STATE_STYLE: Record<StepState, { mark: string; className: string }> = {
  done: { mark: 'DONE', className: 'text-green-700 bg-green-50 border-green-200' },
  pending: { mark: 'WAITING', className: 'text-navy/70 bg-navy/[0.03] border-navy/15' },
  attention: { mark: 'ACTION', className: 'text-red-700 bg-red-50 border-red-300' },
  optional: { mark: 'OPTIONAL', className: 'text-navy/70 bg-navy/[0.03] border-navy/15' },
  unknown: { mark: 'UNKNOWN', className: 'text-navy/70 bg-navy/[0.03] border-navy/15' },
};

/**
 * Where the coming bowling night stands.
 *
 * Every row is read back out of the database, either as real lineup counts or
 * as a timestamp the acting route recorded. There is nothing to tick, which is
 * the point: the checklist this replaced went stale the moment a step was done
 * out of order.
 */
export function PreNightStatusBoard({ seasonID, week }: Props) {
  const [steps, setSteps] = useState<WeekStatusStep[] | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/evillair/pre-night-status?seasonID=${seasonID}&week=${week}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load pre-night status');
      setSteps(data.steps);
      setEnabled(data.automationEnabled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [seasonID, week]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleAutomation() {
    const next = !enabled;
    setEnabled(next);
    try {
      const res = await fetch('/api/evillair/pre-night-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      if (!res.ok) throw new Error('toggle failed');
      await load();
    } catch {
      // Put the switch back rather than leaving it showing a state the server
      // never accepted. A toggle that lies about being on is how a week goes
      // by with no reminder sent.
      setEnabled(!next);
      setError('Could not change the reminder setting');
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-navy/10 overflow-hidden">
      <div className="px-5 py-4 border-b border-navy/10 flex items-center justify-between">
        <div>
          <h2 className="font-heading text-sm text-navy">Pre-Bowling Night</h2>
          <p className="font-body text-xs text-navy/60 mt-0.5">Week {week} prep</p>
        </div>
        <button
          onClick={toggleAutomation}
          className="font-body text-xs text-navy/60 hover:text-navy underline underline-offset-2"
        >
          Reminder emails: {enabled ? 'on' : 'off'}
        </button>
      </div>

      <div className="p-5 space-y-2">
        {loading && !steps && <p className="font-body text-xs text-navy/60">Loading...</p>}
        {error && <p className="font-body text-xs text-red-700">{error}</p>}
        {steps?.map((s) => {
          const style = STATE_STYLE[s.state];
          return (
            <div
              key={s.key}
              className={`flex items-baseline justify-between gap-3 border rounded px-3 py-2 ${style.className}`}
            >
              <span className="font-heading text-sm">{s.label}</span>
              <span className="font-body text-xs text-right">
                {s.detail}
                <span className="ml-3 font-heading">{style.mark}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
