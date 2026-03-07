'use client';

import { useState } from 'react';

interface Props {
  url: string;
  label?: string;
}

export function ShareButton({ url, label = 'Share Profile' }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS environments where clipboard API is restricted
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
      onClick={handleCopy}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-body border border-navy/30 text-navy/70 rounded hover:border-navy hover:text-navy transition-colors"
      aria-label="Copy profile link to clipboard"
    >
      {copied ? (
        <span>Copied!</span>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}
