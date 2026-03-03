/**
 * Returns Tailwind class string for a bowling score based on threshold.
 * Single source of truth for 200/250/300 color coding across all components.
 *
 * 300       -> text-red-600 font-bold    (perfect game -- special red)
 * 250-299   -> text-amber-500 font-semibold (gold)
 * 200-249   -> text-green-600            (green)
 * < 200     -> ''                        (no color)
 * null      -> ''                        (no data)
 */
export function scoreColorClass(score: number | null): string {
  if (score === null) return '';
  if (score === 300) return 'text-red-600 font-bold';
  if (score >= 250) return 'text-amber-500 font-semibold';
  if (score >= 200) return 'text-green-600';
  return '';
}

/**
 * Returns Tailwind class string for a bowling series (3-game total).
 * Separate scale from individual games since series max is 900.
 *
 * 700+      -> text-red-600 font-bold    (elite series)
 * 650-699   -> text-amber-500 font-semibold (gold)
 * 600-649   -> text-green-600            (green)
 * < 600     -> ''                        (no color)
 * null      -> ''                        (no data)
 */
export function seriesColorClass(score: number | null): string {
  if (score === null) return '';
  if (score >= 700) return 'text-red-600 font-bold';
  if (score >= 650) return 'text-amber-500 font-semibold';
  if (score >= 600) return 'text-green-600';
  return '';
}
