'use client';

import { useState, useCallback } from 'react';

type Source = 'lineups' | 'lastweek';

export default function ScoresheetsPage() {
  const [seasonID, setSeasonID] = useState(35);
  const [week, setWeek] = useState(1);
  const [source, setSource] = useState<Source>('lineups');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<
    Array<{ home: string; away: string; homeCount: number; awayCount: number }> | null
  >(null);

  // Fetch matchup preview
  const loadPreview = useCallback(async () => {
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

  // Generate and download PDF
  const handleGenerate = useCallback(async () => {
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

      // Download the PDF blob
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
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div>
          <label className="block font-body text-xs text-navy/60 mb-1">
            Season
          </label>
          <select
            value={seasonID}
            onChange={(e) => {
              setSeasonID(Number(e.target.value));
              setPreview(null);
            }}
            className="font-body text-sm border border-navy/20 rounded px-3 py-2 bg-white text-navy"
          >
            {Array.from({ length: 35 }, (_, i) => 35 - i).map((s) => (
              <option key={s} value={s}>
                Season {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-body text-xs text-navy/60 mb-1">
            Week
          </label>
          <select
            value={week}
            onChange={(e) => {
              setWeek(Number(e.target.value));
              setPreview(null);
            }}
            className="font-body text-sm border border-navy/20 rounded px-3 py-2 bg-white text-navy"
          >
            {Array.from({ length: 20 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-body text-xs text-navy/60 mb-1">
            Source
          </label>
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value as Source);
              setPreview(null);
            }}
            className="font-body text-sm border border-navy/20 rounded px-3 py-2 bg-white text-navy"
          >
            <option value="lineups">From Lineups</option>
            <option value="lastweek">From Last Week</option>
          </select>
        </div>

        <button
          onClick={loadPreview}
          disabled={loading}
          className="px-4 py-2 bg-white text-navy border border-navy/20 font-body text-sm rounded hover:bg-navy/5 disabled:opacity-50 transition-colors"
        >
          Preview Matchups
        </button>
      </div>

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

      {/* Preview */}
      {preview && !loading && (
        <div className="space-y-3 mb-8">
          <h2 className="font-heading text-lg text-navy">
            Week {week} Matchups ({preview.length} matches)
          </h2>

          <div className="grid gap-3">
            {preview.map((m, i) => (
              <div
                key={i}
                className="bg-white rounded-lg shadow-sm border border-navy/10 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="font-heading text-sm text-navy">{m.home}</span>
                  <span className="font-body text-xs text-navy/40">vs</span>
                  <span className="font-heading text-sm text-navy">{m.away}</span>
                </div>
                <div className="font-body text-xs text-navy/50">
                  {m.homeCount} / {m.awayCount} bowlers
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mt-4 px-6 py-3 bg-navy text-cream font-body text-sm rounded-md hover:bg-navy/90 disabled:opacity-50 transition-colors"
          >
            Generate Scoresheets
          </button>
        </div>
      )}

      {/* Empty state */}
      {!preview && !loading && !error && (
        <div className="text-center py-16">
          <p className="font-body text-sm text-navy/40">
            Select a season and week, then preview matchups before generating scoresheets.
          </p>
        </div>
      )}
    </div>
  );
}
