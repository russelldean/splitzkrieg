'use client';

import { useEffect, useState } from 'react';

interface Props {
  seasonSlug: string;
  week: number;
}

interface WeekWriteupState {
  postID: number | null;
  hasPhoto: boolean;
  hasWriteup: boolean;
}

/**
 * Admin shortcut to this week's writeup, shown on the week page itself.
 *
 * Entirely client side and renders nothing until a session is confirmed. That
 * is deliberate: the week page is statically prebuilt for ~325 URLs, and a
 * server side session check would read cookies, opt every one of them into
 * per request rendering, and point the database at live traffic. A visitor who
 * is not logged in gets a 401 here and sees nothing, so the public HTML is
 * identical whether or not this component exists.
 */
export function WeekAdminBar({ seasonSlug, week }: Props) {
  const [state, setState] = useState<WeekWriteupState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/evillair/week-writeup?seasonSlug=${encodeURIComponent(seasonSlug)}&week=${week}`,
        );
        if (!res.ok) return; // 401 for a normal visitor: stay invisible.
        const data = (await res.json()) as WeekWriteupState;
        if (!cancelled) setState(data);
      } catch {
        // Offline or blocked: stay invisible rather than showing a broken bar.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonSlug, week]);

  if (!state) return null;

  async function openEditor() {
    if (!state) return;
    if (state.postID) {
      window.location.href = `/evillair/blog/${state.postID}`;
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/evillair/week-writeup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonSlug, week }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not create the post');
      window.location.href = `/evillair/blog/${data.postID}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the post');
      setBusy(false);
    }
  }

  const bits: string[] = [];
  bits.push(state.hasWriteup ? 'writeup added' : 'no writeup yet');
  bits.push(state.hasPhoto ? 'photo added' : 'no photo yet');

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5">
      <span className="font-body text-sm text-navy">
        Week {week}: {bits.join(', ')}
      </span>
      <span className="flex items-center gap-3">
        {error && <span className="font-body text-sm text-red-700">{error}</span>}
        <button
          onClick={openEditor}
          disabled={busy}
          className="rounded-md bg-navy px-3 py-1.5 font-body text-sm text-cream transition-colors hover:bg-navy-light disabled:opacity-60"
        >
          {busy ? 'Creating...' : state.postID ? 'Edit writeup' : 'Write one'}
        </button>
      </span>
    </div>
  );
}
