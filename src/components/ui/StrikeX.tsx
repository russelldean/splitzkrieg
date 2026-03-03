import type { ReactNode } from 'react';

/**
 * Replaces X/x characters in a string with a styled bowling-strike X.
 * Use in display text (names, season numerals, headings) — not in URLs or metadata.
 * Preserves original case (uppercase X stays X, lowercase x stays x).
 */
export function strikeX(text: string): ReactNode {
  if (!/x/i.test(text)) return text;

  const parts = text.split(/([Xx])/g);
  return parts.map((part, i) =>
    part === 'X' || part === 'x' ? (
      <span key={i} className="text-red-600/60 font-bold">
        {part}
      </span>
    ) : (
      part
    ),
  );
}
