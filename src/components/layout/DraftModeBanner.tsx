'use client';

import { useEffect, useState } from 'react';

/**
 * Warns when the browser is stuck in preview mode, and offers one click out.
 *
 * Draft mode is browser-wide, not per-page: the cookie the editor's Preview
 * button sets opts EVERY route out of static rendering, so the entire site
 * starts rendering live against Azure SQL. On 2026-08-20 that made production
 * look broken, with the week index taking ~50s while the same URL over curl
 * returned in 0.2s. Nothing surfaced the state and nothing turned it off.
 *
 * Reads a plain cookie rather than calling draftMode(), and stays a client
 * component, on purpose: draftMode() is a dynamic API, so touching it in a
 * layout would opt every route out of static rendering. That is the exact bug
 * this banner exists to warn about, and it would be a fine way to cause it.
 */
export function DraftModeBanner() {
  const [on, setOn] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setOn(document.cookie.split('; ').some((c) => c.startsWith('sk_draft=1')));
  }, []);

  if (!on) return null;

  return (
    <div className="bg-amber-500 text-navy">
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <p className="font-body text-sm">
          <strong>Preview mode is on.</strong> Every page is rendering live
          instead of being served prebuilt, so the whole site is slow for you
          until you exit.
        </p>
        <button
          onClick={async () => {
            setLeaving(true);
            try {
              await fetch('/api/evillair/draft', { method: 'DELETE' });
            } finally {
              window.location.reload();
            }
          }}
          disabled={leaving}
          className="shrink-0 rounded-md bg-navy px-3 py-1.5 font-body text-sm text-cream hover:bg-navy/90 disabled:opacity-60"
        >
          {leaving ? 'Exiting...' : 'Exit preview'}
        </button>
      </div>
    </div>
  );
}
