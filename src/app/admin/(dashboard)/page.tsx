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
    teams: Array<{ teamID: number; teamName: string; submitted: boolean }>;
  } | null;
  preNightDone: string[];
  postNightDone: string[];
}

const PRE_NIGHT_STEPS = [
  { key: 'remind', label: 'Remind', page: '/admin/lineups' },
  { key: 'push', label: 'Push LP', page: '/admin/lineups' },
  { key: 'print', label: 'Scoresheets', page: '/admin/scoresheets' },
];

const POST_NIGHT_STEPS = [
  { key: 'pull', label: 'Pull', page: '/admin/scores' },
  { key: 'review', label: 'Review', page: '/admin/scores' },
  { key: 'confirm', label: 'Confirm', page: '/admin/scores' },
  { key: 'blog', label: 'Recap', page: '/admin/blog' },
  { key: 'publish', label: 'Publish', page: '' },
  { key: 'email', label: 'Email', page: '' },
];

/* Shared pipeline renderer with clickable toggleable steps */
function Pipeline({
  steps,
  doneKeys,
  onToggle,
}: {
  steps: { key: string; label: string; page: string }[];
  doneKeys: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex items-start justify-center mb-5 overflow-x-auto pb-2">
      {steps.map((step, idx) => {
        const done = doneKeys.has(step.key);
        return (
          <div key={step.key} className="flex items-start shrink-0">
            <div className="flex flex-col items-center w-16">
              <button
                onClick={() => onToggle(step.key)}
                className={`flex items-center justify-center w-9 h-9 rounded-full text-xs font-body font-semibold transition-colors cursor-pointer ${
                  done
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-navy/10 text-navy/40 hover:bg-navy/20 hover:text-navy/60'
                }`}
                title={done ? `Mark ${step.label} undone` : `Mark ${step.label} done`}
              >
                {done ? '\u2713' : idx + 1}
              </button>
              <span
                className={`font-body text-[10px] mt-1.5 text-center leading-tight ${
                  done ? 'text-green-600 font-semibold' : 'text-navy/40'
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-6 h-0.5 mt-[18px] -mx-1 ${
                  done && doneKeys.has(steps[idx + 1].key)
                    ? 'bg-green-500'
                    : 'bg-navy/10'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);
  const [remindLoading, setRemindLoading] = useState(false);
  const [remindResult, setRemindResult] = useState<string | null>(null);
  const [selectedTeamIDs, setSelectedTeamIDs] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/dashboard');
        if (!res.ok) throw new Error('Failed to load dashboard');
        const json = await res.json();
        setData(json);
        // Default: all unsubmitted teams selected
        if (json.lineupStatus?.teams) {
          setSelectedTeamIDs(
            new Set(
              json.lineupStatus.teams
                .filter((t: { submitted: boolean }) => !t.submitted)
                .map((t: { teamID: number }) => t.teamID),
            ),
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const toggleStep = useCallback(
    async (pipeline: 'pre' | 'post', stepKey: string) => {
      if (!data) return;
      const week = (data.publishedWeek || 0) + 1;

      // Optimistic update
      const field = pipeline === 'pre' ? 'preNightDone' : 'postNightDone';
      const current = data[field];
      const next = current.includes(stepKey)
        ? current.filter((k) => k !== stepKey)
        : [...current, stepKey];
      setData((prev) => (prev ? { ...prev, [field]: next } : prev));

      try {
        const res = await fetch('/api/admin/dashboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pipeline, stepKey, week }),
        });
        const json = await res.json();
        if (res.ok) {
          setData((prev) => (prev ? { ...prev, [field]: json.done } : prev));
        }
      } catch {
        // Revert on error
        setData((prev) => (prev ? { ...prev, [field]: current } : prev));
      }
    },
    [data],
  );

  const toggleTeamSelection = useCallback((teamID: number) => {
    setSelectedTeamIDs((prev) => {
      const next = new Set(prev);
      if (next.has(teamID)) next.delete(teamID);
      else next.add(teamID);
      return next;
    });
  }, []);

  const handleRemind = useCallback(async () => {
    if (!data?.season || !data?.lineupStatus) return;
    if (selectedTeamIDs.size === 0) return;

    const selectedNames = data.lineupStatus.teams
      .filter((t) => selectedTeamIDs.has(t.teamID))
      .map((t) => t.teamName);

    if (
      !confirm(
        `Send lineup reminders to ${selectedNames.length} team${selectedNames.length !== 1 ? 's' : ''}?\n\n${selectedNames.join(', ')}`,
      )
    )
      return;

    setRemindLoading(true);
    setRemindResult(null);

    try {
      const res = await fetch('/api/admin/remind-captains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonID: data.season.seasonID,
          week: data.lineupStatus.week,
          teamIDs: [...selectedTeamIDs],
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Remind failed');

      let msg = json.message;
      if (json.noEmail?.length > 0) {
        msg += ` | No email on file: ${json.noEmail.join(', ')}`;
      }
      setRemindResult(msg);
    } catch (err) {
      setRemindResult(err instanceof Error ? err.message : 'Failed to send reminders');
    } finally {
      setRemindLoading(false);
    }
  }, [data, selectedTeamIDs]);

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
      setData((prev) => (prev ? { ...prev, publishedWeek: week } : prev));
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
  const missingLineups = data?.lineupStatus
    ? data.lineupStatus.teams.filter((t) => !t.submitted).length
    : 0;

  const preNightDone = new Set(data?.preNightDone ?? []);
  const postNightDone = new Set(data?.postNightDone ?? []);

  return (
    <div className="max-w-5xl mx-auto overflow-x-hidden">
      <div className="mb-8">
        <h1 className="font-heading text-3xl text-navy mb-1">Dashboard</h1>
        <p className="font-body text-sm text-navy/60">
          {seasonLabel}, Week {data?.publishedWeek || 0} published
        </p>
      </div>

      {/* Pre-Bowling Night */}
      <div className="bg-white rounded-lg shadow-sm border border-navy/10 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-navy/10 flex items-center justify-between">
          <div>
            <h2 className="font-heading text-sm text-navy">Pre-Bowling Night</h2>
            <p className="font-body text-xs text-navy/40 mt-0.5">Week {nextWeek} prep</p>
          </div>
          {data?.lineupStatus && (
            <span className="font-body text-xs text-navy/50">
              {data.lineupStatus.submitted}/{data.lineupStatus.total} lineups in
            </span>
          )}
        </div>
        <div className="p-5">
          <Pipeline
            steps={PRE_NIGHT_STEPS}
            doneKeys={preNightDone}
            onToggle={(key) => toggleStep('pre', key)}
          />

          {/* Lineup team grid */}
          {data?.lineupStatus && data.lineupStatus.teams.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 mb-4">
              {data.lineupStatus.teams.map((t) => (
                <div key={t.teamID} className="flex items-center gap-2 py-0.5">
                  {t.submitted ? (
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    </div>
                  ) : (
                    <input
                      type="checkbox"
                      checked={selectedTeamIDs.has(t.teamID)}
                      onChange={() => toggleTeamSelection(t.teamID)}
                      className="w-4 h-4 shrink-0 accent-navy cursor-pointer"
                    />
                  )}
                  <span
                    className={`font-body text-xs truncate ${
                      t.submitted ? 'text-navy/40' : 'text-navy/70'
                    }`}
                  >
                    {t.teamName}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Remind button */}
          {missingLineups > 0 && (
            <button
              onClick={handleRemind}
              disabled={remindLoading || selectedTeamIDs.size === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-navy text-cream font-body text-xs font-semibold hover:bg-navy/90 transition-colors disabled:opacity-50"
            >
              <EmailIcon className="w-4 h-4" />
              {remindLoading
                ? 'Sending...'
                : `Remind ${selectedTeamIDs.size} Captain${selectedTeamIDs.size !== 1 ? 's' : ''}`}
            </button>
          )}

          {remindResult && (
            <p className="font-body text-xs text-navy/70 bg-cream p-2 rounded mt-3">
              {remindResult}
            </p>
          )}
        </div>
      </div>

      {/* Post-Bowling Night */}
      <div className="bg-white rounded-lg shadow-sm border border-navy/10 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-navy/10">
          <h2 className="font-heading text-sm text-navy">Post-Bowling Night</h2>
          <p className="font-body text-xs text-navy/40 mt-0.5">Week {nextWeek} results</p>
        </div>
        <div className="p-5">
          <Pipeline
            steps={POST_NIGHT_STEPS}
            doneKeys={postNightDone}
            onToggle={(key) => toggleStep('post', key)}
          />

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mb-3">
            <button
              onClick={handlePublish}
              disabled={publishLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-navy/20 font-body text-xs text-navy hover:bg-navy/5 transition-colors disabled:opacity-50"
            >
              <PublishIcon className="w-4 h-4" />
              {publishLoading ? 'Publishing...' : `Publish Week ${nextWeek}`}
            </button>
            <button
              onClick={handleEmail}
              disabled={emailLoading || !data?.publishedWeek}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-navy/20 font-body text-xs text-navy hover:bg-navy/5 transition-colors disabled:opacity-50"
            >
              <EmailIcon className="w-4 h-4" />
              {emailLoading ? 'Sending...' : 'Send Recap Email'}
            </button>
          </div>

          {publishResult && (
            <p className="font-body text-xs text-navy/70 bg-cream p-2 rounded mb-2">
              {publishResult}
            </p>
          )}
          {emailResult && (
            <p className="font-body text-xs text-navy/70 bg-cream p-2 rounded mb-2">
              {emailResult}
            </p>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link
          href="/admin/announcements"
          className="bg-white rounded-lg shadow-sm border border-navy/10 p-4 text-center hover:border-navy/30 transition-colors"
        >
          <span className="font-body text-xs text-navy">Announcements</span>
        </Link>
        <Link
          href="/admin/updates"
          className="bg-white rounded-lg shadow-sm border border-navy/10 p-4 text-center hover:border-navy/30 transition-colors"
        >
          <span className="font-body text-xs text-navy">Site Updates</span>
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

      {/* Easter Eggs */}
      <EasterEggs />
    </div>
  );
}

/* Inline SVG icons */

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

function EasterEggs() {
  const [hotFunCountdown, setHotFunCountdown] = useState<number | null>(null);
  const [blogBadge, setBlogBadge] = useState<boolean | null>(null);
  const [blogBadgeLoading, setBlogBadgeLoading] = useState(false);

  // Load blog badge state
  useEffect(() => {
    fetch('/api/admin/new-blog-badge')
      .then(r => r.json())
      .then(d => setBlogBadge(d.active))
      .catch(() => {});
  }, []);

  const toggleBlogBadge = useCallback(async () => {
    const next = !blogBadge;
    setBlogBadgeLoading(true);
    try {
      const res = await fetch('/api/admin/new-blog-badge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: next }),
      });
      if (res.ok) setBlogBadge(next);
    } catch { /* ignore */ }
    finally { setBlogBadgeLoading(false); }
  }, [blogBadge]);

  const triggerHotFun = useCallback(() => {
    window.open('/?hotfun=5', '_blank');
    setHotFunCountdown(5);
    const interval = setInterval(() => {
      setHotFunCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  return (
    <div className="mt-8 bg-white rounded-lg shadow-sm border border-navy/10 overflow-hidden">
      <div className="px-5 py-4 border-b border-navy/10">
        <h2 className="font-heading text-sm text-navy">Easter Eggs</h2>
        <p className="font-body text-xs text-navy/60 mt-0.5">Manual triggers for live moments</p>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={triggerHotFun}
              disabled={hotFunCountdown !== null}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-600 text-white font-body text-xs font-semibold hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {hotFunCountdown !== null ? (
                <>HOT FUN in {hotFunCountdown}...</>
              ) : (
                <>HOT FUN</>
              )}
            </button>
          </div>
          <p className="font-body text-xs text-navy/60 mt-1">
            Opens homepage and fires animation after 5 seconds
          </p>
        </div>

        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleBlogBadge}
              disabled={blogBadgeLoading || blogBadge === null}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md font-body text-xs font-semibold transition-colors disabled:opacity-50 ${
                blogBadge
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-navy/10 text-navy hover:bg-navy/20'
              }`}
            >
              {blogBadge ? 'NEW Blog Badge: ON' : 'NEW Blog Badge: OFF'}
            </button>
          </div>
          <p className="font-body text-xs text-navy/60 mt-1">
            Shows a red &quot;New&quot; badge next to Blog in the nav bar
          </p>
        </div>
      </div>
    </div>
  );
}
