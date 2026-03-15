'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const expired = searchParams.get('expired');
  const [status, setStatus] = useState<'checking' | 'error'>('checking');

  useEffect(() => {
    if (expired) {
      setStatus('error');
      return;
    }

    if (token) {
      // Redirect to auth API to set cookie
      window.location.href = `/api/lineup/auth?token=${encodeURIComponent(token)}`;
    } else {
      setStatus('error');
    }
  }, [token, expired]);

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <h1 className="font-heading text-3xl text-navy mb-4">
          Splitzkrieg Lineup
        </h1>

        {status === 'checking' && !expired && (
          <div>
            <p className="font-body text-navy/70 mb-6">
              Checking your link...
            </p>
            <div className="w-8 h-8 border-3 border-navy/20 border-t-navy rounded-full animate-spin mx-auto" />
          </div>
        )}

        {status === 'error' && (
          <div className="bg-white rounded-lg p-8 shadow-sm">
            <p className="font-body text-navy/80 mb-4">
              {expired
                ? 'Your session has expired.'
                : 'This link is invalid or has expired.'}
            </p>
            <p className="font-body text-navy/60 text-sm">
              Contact the commissioner for a new link.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LineupLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-navy/20 border-t-navy rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
