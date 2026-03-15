'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface DashboardData {
  season: { seasonID: number; displayName: string } | null;
  publishedWeek: number;
  lineupStatus: {
    week: number;
    submitted: number;
    total: number;
    teams: Array<{ teamName: string; submitted: boolean }>;
  } | null;
  pipelineStep: string;
  recentScoreWeek: number | null;
}

const PIPELINE_STEPS = [
  { key: 'pull', label: 'Pull', page: '/admin/scores' },
  { key: 'review', label: 'Review', page: '/admin/scores' },
  { key: 'confirm', label: 'Confirm', page: '/admin/scores' },
  { key: 'blog', label: 'Blog', page: '/admin/blog' },
  { key: 'publish', label: 'Publish', page: '' },
  { key: 'email', label: 'Email', page: '' },
];

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/dashboard');
        if (!res.ok) throw new Error('Failed to load dashboard');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handlePublish = useCallback(async () => {
    if (!data?.season) return;
    const week = data.publishedWeek + 1;
    if (!confirm(`Publish Season ${data.season.seasonID}, Week ${week}?`)) return;

    setPublishLoading(true);
    setPublishResult(null);

    try {
      const res = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonID: data.season.seasonID, week }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Publish failed');

      setPublishResult(`Published Week ${week} successfully`);
      setData((prev) => prev ? { ...prev, publishedWeek: week } : prev);
    } catch (err) {
      setPublishResult(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishLoading(false);
    }
  }, [data]);

  const handleEmail = useCallback(async () => {
    if (!data?.season) return;
    const week = data.publishedWeek;
    if (!week) return;

    setEmailLoading(true);
    setEmailResult(null);

    try {
      const res = await fetch('/api/admin/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seasonID: data.season.seasonID, week }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Email failed');

      if (json.errors?.length > 0) {
        setEmailResult(`Sent with errors: ${json.errors.join(', ')}`);
      } else {
        setEmailResult(`Recap email sent for Week ${week}`);
      }
    } catch (err) {
      setEmailResult(err instanceof Error ? err.message : 'Email failed');
    } finally {
      setEmailLoading(false);
    }
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="inline-block w-8 h-8 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="font-heading text-3xl text-navy mb-2">Dashboard</h1>
        <div className="p-4 bg-red/10 border border-red/30 rounded-md">
          <p className="font-body text-sm text-red">{error}</p>
        </div>
      </div>
    );
  }

  const seasonLabel = data?.season?.displayName || 'Unknown Season';
  const nextWeek = (data?.publishedWeek || 0) + 1;

  // Determine active pipeline step
  function getActiveStep(): number {
    if (!data) return 0;
    if (data.pipelineStep === 'published') return 5; // ready for email
    if (data.pipelineStep === 'confirmed') return 3; // ready for blog
    if (data.pipelineStep === 'reviewing') return 1;
    if (data.pipelineStep === 'pulled') return 1;
    return 0; // idle, ready for pull
  }

  const activeStepIdx = getActiveStep();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="font-heading text-3xl text-navy mb-1">Dashboard</h1>
        <p className="font-body text-sm text-navy/60">
          {seasonLabel}, Week {data?.publishedWeek || 0} published
        </p>
      </div>

      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Lineup Status Card */}
        <div className="bg-white rounded-lg shadow-sm border border-navy/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-navy/10 flex items-center justify-between">
            <h2 className="font-heading text-sm text-navy">Lineup Status</h2>
            <Link
              href="/admin/lineups"
              className="font-body text-xs text-navy/50 hover:text-navy transition-colors"
            >
              View All
            </Link>
          </div>
          <div className="p-5">
            {data?.lineupStatus ? (
              <>
                <p className="font-body text-sm text-navy mb-3">
                  Week {data.lineupStatus.week}: {data.lineupStatus.submitted} of{' '}
                  {data.lineupStatus.total} teams submitted
                </p>
                <div className="w-full h-2 bg-navy/10 rounded-full mb-4">
                  <div
                    className="h-2 bg-green-500 rounded-full transition-all"
                    style={{
                      width: `${data.lineupStatus.total > 0 ? (data.lineupStatus.submitted / data.lineupStatus.total) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {data.lineupStatus.teams.map((t) => (
                    <div key={t.teamName} className="flex items-center gap-2 py-0.5">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          t.submitted ? 'bg-green-500' : 'bg-navy/20'
                        }`}
                      />
                      <span className="font-body text-xs text-navy/70 truncate">
                        {t.teamName}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="font-body text-xs text-navy/40">No lineup data available</p>
            )}
          </div>
        </div>

        {/* Score Pipeline Card */}
        <div className="bg-white rounded-lg shadow-sm border border-navy/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-navy/10">
            <h2 className="font-heading text-sm text-navy">
              Score Pipeline - Week {nextWeek}
            </h2>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-1 mb-4">
              {PIPELINE_STEPS.map((step, idx) => (
                <div key={step.key} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-body font-semibold transition-colors ${
                      idx < activeStepIdx
                        ? 'bg-green-500 text-white'
                        : idx === activeStepIdx
                          ? 'bg-navy text-cream'
                          : 'bg-navy/10 text-navy/40'
                    }`}
                  >
                    {idx < activeStepIdx ? '\u2713' : idx + 1}
                  </div>
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <div
                      className={`w-4 h-0.5 mx-0.5 ${
                        idx < activeStepIdx ? 'bg-green-500' : 'bg-navy/10'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {PIPELINE_STEPS.map((step, idx) => (
                <span
                  key={step.key}
                  className={`font-body text-[10px] ${
                    idx === activeStepIdx ? 'text-navy font-semibold' : 'text-navy/40'
                  }`}
                  style={{ width: '3rem', textAlign: 'center' }}
                >
                  {step.label}
                </span>
              ))}
            </div>
            {PIPELINE_STEPS[activeStepIdx]?.page && (
              <Link
                href={PIPELINE_STEPS[activeStepIdx].page}
                className="font-body text-xs text-navy/60 hover:text-navy underline transition-colors"
              >
                Go to {PIPELINE_STEPS[activeStepIdx].label}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-navy/10 overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-navy/10">
          <h2 className="font-heading text-sm text-navy">Quick Actions</h2>
        </div>
        <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/admin/scores"
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-navy/10 hover:border-navy/30 hover:bg-navy/5 transition-colors text-center"
          >
            <PullIcon className="w-5 h-5 text-navy/60" />
            <span className="font-body text-xs text-navy">Pull Scores</span>
          </Link>

          <Link
            href="/admin/scoresheets"
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-navy/10 hover:border-navy/30 hover:bg-navy/5 transition-colors text-center"
          >
            <PrintIcon className="w-5 h-5 text-navy/60" />
            <span className="font-body text-xs text-navy">Scoresheets</span>
          </Link>

          <button
            onClick={handlePublish}
            disabled={publishLoading}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-navy/10 hover:border-navy/30 hover:bg-navy/5 transition-colors text-center disabled:opacity-50"
          >
            <PublishIcon className="w-5 h-5 text-navy/60" />
            <span className="font-body text-xs text-navy">
              {publishLoading ? 'Publishing...' : `Publish Week ${nextWeek}`}
            </span>
          </button>

          <button
            onClick={handleEmail}
            disabled={emailLoading || !data?.publishedWeek}
            className="flex flex-col items-center gap-2 p-4 rounded-lg border border-navy/10 hover:border-navy/30 hover:bg-navy/5 transition-colors text-center disabled:opacity-50"
          >
            <EmailIcon className="w-5 h-5 text-navy/60" />
            <span className="font-body text-xs text-navy">
              {emailLoading ? 'Sending...' : 'Send Recap'}
            </span>
          </button>
        </div>

        {/* Publish/Email results */}
        {publishResult && (
          <div className="px-5 pb-3">
            <p className="font-body text-xs text-navy/70 bg-cream p-2 rounded">{publishResult}</p>
          </div>
        )}
        {emailResult && (
          <div className="px-5 pb-3">
            <p className="font-body text-xs text-navy/70 bg-cream p-2 rounded">{emailResult}</p>
          </div>
        )}
      </div>

      {/* Links row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          href="/admin/blog"
          className="bg-white rounded-lg shadow-sm border border-navy/10 p-4 text-center hover:border-navy/30 transition-colors"
        >
          <span className="font-body text-xs text-navy">Blog Editor</span>
        </Link>
        <Link
          href="/admin/lineups"
          className="bg-white rounded-lg shadow-sm border border-navy/10 p-4 text-center hover:border-navy/30 transition-colors"
        >
          <span className="font-body text-xs text-navy">Lineup Manager</span>
        </Link>
        <Link
          href="/"
          className="bg-white rounded-lg shadow-sm border border-navy/10 p-4 text-center hover:border-navy/30 transition-colors"
        >
          <span className="font-body text-xs text-navy">View Public Site</span>
        </Link>
        <Link
          href="/blog"
          className="bg-white rounded-lg shadow-sm border border-navy/10 p-4 text-center hover:border-navy/30 transition-colors"
        >
          <span className="font-body text-xs text-navy">View Blog</span>
        </Link>
      </div>
    </div>
  );
}

/* Inline SVG icons */

function PullIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

function PrintIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
    </svg>
  );
}

function PublishIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293 4.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 6.414V13a1 1 0 11-2 0V6.414L7.707 7.707a1 1 0 01-1.414 0zM3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
      <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
    </svg>
  );
}
