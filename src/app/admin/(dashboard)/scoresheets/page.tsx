'use client';

import { useState, useCallback, useEffect } from 'react';

interface PreviewBowler {
  name: string;
  side: 'home' | 'away';
  avg: number | null;
  hcp: number | null;
  source: 'lineup' | 'lastweek' | null;
}

interface PreviewMatch {
  home: string;
  away: string;
  homeCount: number;
  awayCount: number;
  bowlers: PreviewBowler[];
}

export default function ScoresheetsPage() {
  const [seasonID, setSeasonID] = useState<number | null>(null);
  const [seasonName, setSeasonName] = useState('');
  const [week, setWeek] = useState(1);
  const source = 'lineups';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewMatch[] | null>(null);

  // Email state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('scoresheet-email') || '';
    }
    return '';
  });
  const [emailing, setEmailing] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Load current season on mount
  useEffect(() => {
    fetch('/api/admin/dashboard')
      .then((r) => r.json())
      .then((data) => {
        if (data.season) {
          setSeasonID(data.season.seasonID);
          setSeasonName(data.season.displayName || `Season ${data.season.seasonID}`);
          if (data.publishedWeek != null) {
            setWeek(data.publishedWeek + 1);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Auto-load preview when week or source changes
  const loadPreview = useCallback(async () => {
    if (!seasonID) return;
    setError(null);
    setPreview(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/scoresheets/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonID, week, source }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to load preview');
        setLoading(false);
        return;
      }

      const data = await res.json();
      setPreview(data.matches);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [seasonID, week, source]);

  useEffect(() => {
    if (seasonID) loadPreview();
  }, [seasonID, week, source, loadPreview]);

  // Email PDF
  const handleEmail = useCallback(async () => {
    if (!emailTo.trim() || !seasonID) return;
    setEmailing(true);
    setEmailStatus(null);

    try {
      localStorage.setItem('scoresheet-email', emailTo.trim());

      const res = await fetch('/api/admin/scoresheets/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonID, week, source, to: emailTo.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setEmailStatus({ text: data.error || 'Failed to send', type: 'error' });
      } else {
        setEmailStatus({ text: `Sent to ${emailTo.trim()}`, type: 'success' });
        setTimeout(() => {
          setShowEmailModal(false);
          setEmailStatus(null);
        }, 2000);
      }
    } catch {
      setEmailStatus({ text: 'Network error', type: 'error' });
    } finally {
      setEmailing(false);
    }
  }, [seasonID, week, source, emailTo]);

  // Generate and download PDF
  const handleGenerate = useCallback(async () => {
    if (!seasonID) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/scoresheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonID, week, source }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to generate' }));
        setError(errorData.error || 'Failed to generate scoresheets');
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scoresheets-s${seasonID}-w${week}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [seasonID, week, source]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="font-heading text-2xl text-navy mb-6">Scoresheets</h1>

      {/* Season/Week Selectors */}
      {seasonID == null ? (
        <div className="flex items-center gap-2 mb-6">
          <div className="w-4 h-4 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
          <span className="font-body text-sm text-navy/60">Loading season...</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block font-body text-xs text-navy/60 mb-1">
              Season
            </label>
            <p className="font-body text-sm text-navy px-3 py-2">
              {seasonName}
            </p>
          </div>

          <div>
            <label className="block font-body text-xs text-navy/60 mb-1">
              Week
            </label>
            <select
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              className="font-body text-sm border border-navy/20 rounded px-3 py-2 bg-white text-navy"
            >
              {Array.from({ length: 11 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </div>

        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red/10 border border-red/30 rounded-md">
          <p className="font-body text-sm text-red">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-2 border-navy/20 border-t-navy rounded-full animate-spin mb-4" />
            <p className="font-body text-sm text-navy/60">
              {preview ? 'Generating PDF...' : 'Loading matchups...'}
            </p>
          </div>
        </div>
      )}

      {/* Preview with bowler details */}
      {preview && !loading && (
        <div className="space-y-4 mb-8">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg text-navy">
              Week {week} Matchups ({preview.length} matches)
            </h2>
            <div className="flex gap-3">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-4 py-2 bg-navy text-cream font-body text-sm rounded hover:bg-navy/90 disabled:opacity-50 transition-colors"
              >
                Download PDF
              </button>
              <button
                onClick={() => setShowEmailModal(true)}
                disabled={loading}
                className="px-4 py-2 bg-white text-navy border border-navy/20 font-body text-sm rounded hover:bg-navy/5 disabled:opacity-50 transition-colors"
              >
                Email Scoresheets
              </button>
            </div>
          </div>

          {preview.map((m, i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow-sm border border-navy/10 overflow-hidden"
            >
              <div className="bg-navy/5 px-4 py-3 border-b border-navy/10">
                <h3 className="font-heading text-sm text-navy">
                  {m.home} vs {m.away}
                </h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-4">
                {/* Home Team */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-body text-xs font-semibold text-navy/50 uppercase tracking-wider">
                      {m.home}
                    </p>
                    {(() => {
                      const src = m.bowlers.find((b) => b.side === 'home')?.source;
                      return src === 'lineup' ? (
                        <span className="font-body text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">submitted</span>
                      ) : src === 'lastweek' ? (
                        <span className="font-body text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">last week</span>
                      ) : null;
                    })()}
                  </div>
                  <table className="w-full text-xs font-body">
                    <thead>
                      <tr className="text-navy/40 border-b border-navy/10">
                        <th className="text-left py-1 px-1">Name</th>
                        <th className="text-center py-1 px-1 w-12">Avg</th>
                        <th className="text-center py-1 px-1 w-12">HCP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.bowlers
                        .filter((b) => b.side === 'home')
                        .map((b, j) => (
                          <tr key={j} className="border-b border-navy/5">
                            <td className="py-1.5 px-1 text-navy">
                              {b.name || <span className="text-navy/30">--</span>}
                            </td>
                            <td className="py-1.5 px-1 text-center text-navy/60">
                              {b.avg ?? '--'}
                            </td>
                            <td className="py-1.5 px-1 text-center text-navy/60">
                              {b.hcp ?? '--'}
                            </td>
                          </tr>
                        ))}
                      {m.bowlers.filter((b) => b.side === 'home').length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-2 text-center text-navy/30">
                            No bowlers
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Away Team */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-body text-xs font-semibold text-navy/50 uppercase tracking-wider">
                      {m.away}
                    </p>
                    {(() => {
                      const src = m.bowlers.find((b) => b.side === 'away')?.source;
                      return src === 'lineup' ? (
                        <span className="font-body text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">submitted</span>
                      ) : src === 'lastweek' ? (
                        <span className="font-body text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">last week</span>
                      ) : null;
                    })()}
                  </div>
                  <table className="w-full text-xs font-body">
                    <thead>
                      <tr className="text-navy/40 border-b border-navy/10">
                        <th className="text-left py-1 px-1">Name</th>
                        <th className="text-center py-1 px-1 w-12">Avg</th>
                        <th className="text-center py-1 px-1 w-12">HCP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.bowlers
                        .filter((b) => b.side === 'away')
                        .map((b, j) => (
                          <tr key={j} className="border-b border-navy/5">
                            <td className="py-1.5 px-1 text-navy">
                              {b.name || <span className="text-navy/30">--</span>}
                            </td>
                            <td className="py-1.5 px-1 text-center text-navy/60">
                              {b.avg ?? '--'}
                            </td>
                            <td className="py-1.5 px-1 text-center text-navy/60">
                              {b.hcp ?? '--'}
                            </td>
                          </tr>
                        ))}
                      {m.bowlers.filter((b) => b.side === 'away').length === 0 && (
                        <tr>
                          <td colSpan={3} className="py-2 text-center text-navy/30">
                            No bowlers
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!preview && !loading && !error && seasonID != null && (
        <div className="text-center py-16">
          <p className="font-body text-sm text-navy/40">
            No matchups found for this week.
          </p>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm mx-4">
            <h2 className="font-heading text-lg text-navy mb-3">
              Email Scoresheets
            </h2>
            <p className="font-body text-xs text-navy/60 mb-4">
              Week {week} scoresheets will be sent as a PDF attachment.
            </p>
            <input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="email@example.com"
              className="w-full px-3 py-2 font-body text-sm border border-navy/20 rounded bg-white text-navy placeholder:text-navy/30 focus:outline-none focus:ring-2 focus:ring-navy/20 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && emailTo.trim()) handleEmail();
              }}
            />

            {emailStatus && (
              <p className={`mb-3 font-body text-sm ${emailStatus.type === 'success' ? 'text-green-700' : 'text-red'}`}>
                {emailStatus.text}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowEmailModal(false);
                  setEmailStatus(null);
                }}
                className="px-4 py-2 font-body text-sm text-navy/60 hover:text-navy transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEmail}
                disabled={emailing || !emailTo.trim()}
                className="px-4 py-2 bg-navy text-cream font-body text-sm rounded hover:bg-navy/90 disabled:opacity-50 transition-colors"
              >
                {emailing ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
