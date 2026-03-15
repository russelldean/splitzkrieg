'use client';

import { useState } from 'react';

export default function EmailPage() {
  const [to, setTo] = useState<'captains' | 'league'>('captains');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!subject.trim() || !body.trim()) return;
    if (!confirm(`Send this email to all ${to}?`)) return;

    setSending(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/admin/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject: subject.trim(),
          body: body.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');

      let msg = data.message;
      if (data.errors?.length > 0) {
        msg += ` | Errors: ${data.errors.join(', ')}`;
      }
      setResult(msg);
      setSubject('');
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-heading text-2xl text-navy mb-6">Send Email</h1>

      <div className="bg-white rounded-lg border border-navy/10 p-5">
        <div className="space-y-4">
          {/* Audience */}
          <div>
            <label className="block font-body text-sm text-navy/70 mb-2">To</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 font-body text-sm text-navy cursor-pointer">
                <input
                  type="radio"
                  name="to"
                  value="captains"
                  checked={to === 'captains'}
                  onChange={() => setTo('captains')}
                  className="accent-navy"
                />
                All Captains
              </label>
              <label className="flex items-center gap-2 font-body text-sm text-navy cursor-pointer">
                <input
                  type="radio"
                  name="to"
                  value="league"
                  checked={to === 'league'}
                  onChange={() => setTo('league')}
                  className="accent-navy"
                />
                Entire League
              </label>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block font-body text-sm text-navy/70 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Lineup Reminder - Week 5"
              className="w-full px-3 py-2 border border-navy/20 rounded-md font-body text-sm focus:outline-none focus:ring-2 focus:ring-navy/30"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block font-body text-sm text-navy/70 mb-1">
              Message
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message here..."
              rows={8}
              className="w-full px-3 py-2 border border-navy/20 rounded-md font-body text-sm focus:outline-none focus:ring-2 focus:ring-navy/30 resize-y"
            />
            <p className="font-body text-xs text-navy/40 mt-1">
              Plain text. Line breaks will be preserved.
            </p>
          </div>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !body.trim()}
            className="px-5 py-2.5 bg-navy text-cream rounded-md font-body text-sm font-semibold hover:bg-navy/90 transition-colors disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Email'}
          </button>
        </div>

        {result && (
          <div className="mt-4 p-3 bg-green-50 text-green-800 rounded-md font-body text-sm">
            {result}
          </div>
        )}
        {error && (
          <div className="mt-4 p-3 bg-red/10 text-red rounded-md font-body text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
