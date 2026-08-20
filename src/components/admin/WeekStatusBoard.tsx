'use client';

import { useEffect, useState } from 'react';
import type { WeekStatusStep } from '@/lib/admin/week-status';
import { STATE_STYLE } from '@/components/admin/status-style';

interface Props {
  seasonID: number;
  week: number;
  seasonLabel?: string;
}

/**
 * Where the week actually stands, derived rather than recorded.
 *
 * Nothing here is stored when a button is pressed. Every row is read back out
 * of the database or the working tree, so the board cannot drift from reality
 * the way a checklist does once a step is skipped or done out of order.
 */
export function WeekStatusBoard({ seasonID, week, seasonLabel }: Props) {
  const [steps, setSteps] = useState<WeekStatusStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/evillair/week-status?seasonID=${seasonID}&week=${week}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load week status');
      setSteps(data.steps);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load week status');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasonID, week]);

  return (
    <div className="bg-white border border-navy/10 rounded-lg shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-navy/[0.03] border-b border-navy/10">
        <h2 className="font-heading text-base text-navy">
          Week {week}
          {seasonLabel ? <span className="text-navy/60 font-body text-sm"> &middot; {seasonLabel}</span> : null}
        </h2>
        <button
          onClick={load}
          disabled={loading}
          className="font-body text-sm text-navy/70 hover:text-red-600 transition-colors disabled:opacity-60"
        >
          {loading ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <p className="px-4 py-3 font-body text-sm text-red-700">{error}</p>
      )}

      {!error && !steps && (
        <p className="px-4 py-3 font-body text-sm text-navy/70">Checking where things stand...</p>
      )}

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
