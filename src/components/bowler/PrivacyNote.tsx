'use client';

import { useState } from 'react';

export function PrivacyNote() {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="font-body text-xs text-navy/40 hover:text-navy/60 transition-colors underline decoration-dotted underline-offset-2"
      >
        Privacy note
      </button>
      {open && (
        <p className="mt-2 font-body text-sm text-navy/60 max-w-md leading-relaxed">
          If you have any concerns about being listed, I am happy to change your name to a
          username, codename, or pseudonym of your choosing. Hit the Feedback button to let me know.
        </p>
      )}
    </div>
  );
}
