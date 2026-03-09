'use client';

import { useState } from 'react';

interface Props {
  url: string;
  title?: string;
  label?: string;
}

export function ShareButton({ url, title, label = 'Share Profile' }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    // Use native share sheet on mobile (Messages, Mail, WhatsApp, etc.)
    if (navigator.share) {
      try {
        await navigator.share({ url, title });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    // Desktop fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleShare}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body border border-navy/30 text-navy/70 rounded hover:border-navy hover:text-navy transition-colors"
      aria-label="Share profile link"
    >
      {copied ? (
        <span>Copied!</span>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}
