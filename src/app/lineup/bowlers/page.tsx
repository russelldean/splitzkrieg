'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { BowlerListRow } from '@/lib/admin/bowler-list';

// Read-only copy of /evillair/bowlers for the helpers running the night.
export default function LineupBowlersPage() {
  const [bowlers, setBowlers] = useState<BowlerListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/lineup/bowlers')
      .then((r) => r.json())
      .then((data) => {
        if (data.bowlers) setBowlers(data.bowlers);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim()
    ? bowlers.filter((b) => b.bowlerName.toLowerCase().includes(search.toLowerCase()))
    : bowlers;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-heading text-xl text-navy">Bowlers</h2>
        <Link href="/lineup" prefetch={false} className="font-body text-sm text-navy/60 hover:text-navy">
          Back to lineups
        </Link>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search bowlers..."
        className="w-full mb-4 px-3 py-2 font-body text-sm border border-navy/20 rounded bg-white text-navy placeholder:text-navy/60 focus:outline-none focus:ring-2 focus:ring-navy/20"
      />

      {loading ? (
        <div className="flex items-center gap-2 py-10 justify-center">
          <div className="w-4 h-4 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
          <span className="font-body text-sm text-navy/60">Loading...</span>
        </div>
      ) : error ? (
        <p className="py-10 text-center font-body text-sm text-red">Could not load the bowler list.</p>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-navy/10 overflow-hidden">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-navy/60 border-b border-navy/10 bg-navy/5">
                <th className="text-left py-2 px-3">Name</th>
                <th className="text-center py-2 px-2 w-16">Avg</th>
                <th className="text-center py-2 px-2 w-16">HCP</th>
                <th className="text-center py-2 px-2 w-20">Est. Avg</th>
                <th className="text-center py-2 px-2 w-20">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.bowlerID} className="border-b border-navy/5">
                  <td className="py-2 px-3 text-navy">{b.bowlerName}</td>
                  <td className="py-2 px-2 text-center text-navy font-medium">{b.currentAvg ?? '--'}</td>
                  <td className="py-2 px-2 text-center text-navy font-medium">{b.handicap ?? '--'}</td>
                  <td className="py-2 px-2 text-center text-navy/60">{b.establishedAvg ?? '--'}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={`text-xs font-semibold ${b.isActive ? 'text-green-700' : 'text-navy/60'}`}>
                      {b.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-navy/60">
                    No bowlers found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="px-3 py-2 bg-navy/5 border-t border-navy/10">
            <p className="font-body text-xs text-navy/60">
              {filtered.length} bowler{filtered.length !== 1 ? 's' : ''}
              {search && ` matching "${search}"`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
