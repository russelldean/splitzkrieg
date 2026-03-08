'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || undefined,
          email: email || undefined,
          message,
          pageUrl: pathname,
        }),
      });

      if (!res.ok) throw new Error('Failed');
      setStatus('sent');
      setName('');
      setEmail('');
      setMessage('');
      setTimeout(() => {
        setOpen(false);
        setStatus('idle');
      }, 2000);
    } catch {
      setStatus('error');
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 bg-navy text-cream rounded-full p-2.5 sm:px-4 sm:py-2.5 text-sm font-body font-medium shadow-lg hover:bg-navy-light transition-colors flex items-center gap-2"
        aria-label="Send feedback"
      >
        <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {/* Modal backdrop + form */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-navy/30 backdrop-blur-sm" />

          {/* Modal */}
          <form
            onSubmit={handleSubmit}
            className="relative bg-cream rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md mx-0 sm:mx-4 p-6 shadow-2xl border border-navy/10"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-heading text-xl text-navy">Send Feedback</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-navy/40 hover:text-navy transition-colors p-1"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm font-body text-navy/70 mb-4">
              Spotted an error?<br />
              Have a suggestion or other feedback?<br />
              Let me know.
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Name (optional)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white border border-navy/15 rounded-lg px-3 py-2 text-sm font-body text-navy placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-red/30 focus:border-red/30"
                  maxLength={100}
                />
                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white border border-navy/15 rounded-lg px-3 py-2 text-sm font-body text-navy placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-red/30 focus:border-red/30"
                  maxLength={255}
                />
              </div>
              <textarea
                ref={textareaRef}
                placeholder="What's on your mind?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                maxLength={2000}
                rows={4}
                className="w-full bg-white border border-navy/15 rounded-lg px-3 py-2 text-sm font-body text-navy placeholder:text-navy/40 focus:outline-none focus:ring-2 focus:ring-red/30 focus:border-red/30 resize-none"
              />
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="text-xs font-body text-navy/50">
                {message.length > 0 && `${message.length}/2000`}
              </span>
              <button
                type="submit"
                disabled={status === 'sending' || status === 'sent' || !message.trim()}
                className={`px-5 py-2 rounded-lg text-sm font-body font-semibold transition-colors ${
                  status === 'sent'
                    ? 'bg-green-600 text-white'
                    : status === 'error'
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-navy text-cream hover:bg-navy-light disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
              >
                {status === 'sending' ? 'Sending...'
                  : status === 'sent' ? 'Sent!'
                  : status === 'error' ? 'Try Again'
                  : 'Send'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
