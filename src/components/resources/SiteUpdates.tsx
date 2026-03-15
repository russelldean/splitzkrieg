'use client';

import { useState } from 'react';
import type { Update } from '../../../content/updates';

const COLLAPSED_COUNT = 5;

function UpdateRow({ update }: { update: Update }) {
  return (
    <div className="flex items-baseline gap-3 px-5 py-3">
      <span className="font-body text-xs font-medium uppercase tracking-wide text-navy/40 shrink-0">
        {update.tag}
      </span>
      <span className="font-body text-sm text-navy/50 shrink-0">
        {new Date(update.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </span>
      <span className="font-body text-sm text-navy">
        {update.text}
      </span>
    </div>
  );
}

export function SiteUpdates({ updates, lastUpdated }: { updates: Update[]; lastUpdated?: string }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = updates.length > COLLAPSED_COUNT;
  const visible = expanded ? updates : updates.slice(0, COLLAPSED_COUNT);

  return (
    <section id="recent-updates" className="mb-10 scroll-mt-20">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-heading text-xl text-navy">
          Site Updates
        </h2>
        {lastUpdated && (
          <span className="font-body text-xs text-navy/40">
            Updated {new Date(lastUpdated + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
      </div>
      <div className="bg-white rounded-lg border border-navy/10">
        <div className={`divide-y divide-navy/5 ${expanded ? 'max-h-96 overflow-y-auto' : ''}`}>
          {visible.map((update, i) => (
            <UpdateRow key={i} update={update} />
          ))}
        </div>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-5 py-3 text-sm font-body text-navy/50 hover:text-navy transition-colors text-left flex items-center gap-1.5 border-t border-navy/5"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {expanded ? 'Show less' : 'Show all updates'}
          </button>
        )}
      </div>
    </section>
  );
}
