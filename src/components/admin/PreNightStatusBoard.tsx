'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WeekStatusStep } from '@/lib/admin/week-status';
import { STATE_STYLE } from '@/components/admin/status-style';

interface Props {
  seasonID: number;
  week: number;
}

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
        <div className="flex items-center gap-3">
          <button
            onClick={load}
            disabled={loading}
            className="font-body text-sm text-navy/70 hover:text-red-600 transition-colors disabled:opacity-60"
          >
            {loading ? 'Checking...' : 'Refresh'}
          </button>
          <button
            onClick={toggleAutomation}
            disabled={loading}
            aria-pressed={enabled}
            className="font-body text-xs text-navy/60 hover:text-navy underline underline-offset-2 disabled:opacity-60"
          >
            Reminder emails: {enabled ? 'on' : 'off'}
          </button>
        </div>
      </div>

      {loading && !steps && <p className="px-4 py-3 font-body text-sm text-navy/60">Loading...</p>}
      {error && <p className="px-4 py-3 font-body text-sm text-red-700">{error}</p>}

      {steps && (
        <ul className="divide-y divide-navy/5">
          {steps.map((s) => {
            const style = STATE_STYLE[s.state];
            return (
              <li key={s.key} className="flex items-start gap-3 px-4 py-2.5">
                <span
                  className={`font-body text-[11px] tracking-wide px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${style.className}`}
                >
                  {style.mark}
                </span>
                <span className="min-w-0">
                  <span className="block font-body text-sm text-navy">{s.label}</span>
                  <span className="block font-body text-sm text-navy/65">{s.detail}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
