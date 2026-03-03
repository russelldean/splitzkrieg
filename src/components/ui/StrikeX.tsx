import type { ReactNode } from 'react';

/**
 * Replaces uppercase X characters in a string with a styled bowling-strike X.
 * Use in display text (names, season numerals, headings) — not in URLs or metadata.
 */
export function strikeX(text: string): ReactNode {
  if (!text.includes('X')) return text;

  const parts = text.split(/(X)/g);
  return parts.map((part, i) =>
    part === 'X' ? (
      <span key={i} className="text-red-600/50 font-bold">
        X
      </span>
    ) : (
      part
    ),
  );
}
