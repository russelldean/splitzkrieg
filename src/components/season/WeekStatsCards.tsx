'use client';
import Link from 'next/link';

export interface TopResult<T> {
  items: T[];
  tiedCount: number;
  tiedValue: number;
}

/**
 * Return top N items from a pre-sorted array, expanding ties at the cutoff.
 * If expanding would exceed maxShow, truncate and return tied count instead.
 */
export function topWithTies<T>(sorted: T[], n: number, getValue: (item: T) => number, maxShow = 7): TopResult<T> {
  if (sorted.length <= n) return { items: sorted, tiedCount: 0, tiedValue: 0 };
  const cutoffValue = getValue(sorted[n - 1]);
  let end = n;
  while (end < sorted.length && getValue(sorted[end]) === cutoffValue) end++;
  if (end <= maxShow) {
    return { items: sorted.slice(0, end), tiedCount: 0, tiedValue: 0 };
  }
  // Too many ties — show items above the tie value, then "X tied with Y"
  let aboveTie = 0;
  while (aboveTie < sorted.length && getValue(sorted[aboveTie]) > cutoffValue) aboveTie++;
  const tiedCount = end - aboveTie;
  return { items: sorted.slice(0, aboveTie), tiedCount, tiedValue: cutoffValue };
}

function TiedNote({ count, value, prefix }: { count: number; value: number; prefix?: string }) {
  if (count === 0) return null;
  return (
    <div className="text-sm font-body text-navy/65 italic py-0.5">
      {count} tied with {prefix}{value}
    </div>
  );
}

export function LeaderList<T>({ title, result, getItem }: {
  title: string;
  result: TopResult<T>;
  getItem: (item: T) => { name: string; slug: string; team?: string; value: number };
}) {
  if (result.items.length === 0) return null;
  return (
    <div className="bg-white border border-navy/10 rounded-lg p-3 shadow-sm">
      <h3 className="font-heading text-sm text-navy/60 uppercase tracking-wider mb-1.5">{title}</h3>
      {(() => {
        const topValue = getItem(result.items[0]).value;
        return result.items.map((raw, i) => {
          const item = getItem(raw);
          const isTop = item.value === topValue;
          return (
            <div key={`${item.slug}-${i}`} className="flex justify-between text-sm font-body py-0.5">
              <span className="truncate mr-2">
                <Link href={`/bowler/${item.slug}`} className={`text-navy hover:text-red-600 transition-colors ${isTop ? 'font-bold' : ''}`}>
                  {item.name}
                </Link>
                {item.team && <span className="text-navy/65 text-xs ml-1">({item.team})</span>}
              </span>
              <span className={`tabular-nums shrink-0 ${isTop ? 'font-bold text-navy' : 'text-navy/60'}`}>{item.value}</span>
            </div>
          );
        });
      })()}
      <TiedNote count={result.tiedCount} value={result.tiedValue} />
    </div>
  );
}

export function PINList({ items, tiedCount, tiedValue }: { items: { name: string; slug: string; team: string; pin: number }[]; tiedCount: number; tiedValue: number }) {
  return (
    <div className="bg-white border border-navy/10 rounded-lg p-3 shadow-sm">
      <details className="mb-1.5">
        <summary className="font-heading text-sm text-navy/60 uppercase tracking-wider cursor-pointer list-none inline-flex items-center gap-1">
          PIN <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-navy/10 text-navy/65 text-xs font-bold leading-none">?</span>
        </summary>
        <p className="text-xs font-body text-navy/65 mt-1">Personal Impact Number - how many points your team would have lost if you didn't show up.</p>
      </details>
      {(() => {
        const topPin = items[0].pin;
        return items.map((item, i) => {
          const isTop = item.pin === topPin;
          return (
            <div key={`${item.slug}-${i}`} className="flex justify-between text-sm font-body py-0.5">
              <span className="truncate mr-2">
                <Link href={`/bowler/${item.slug}`} className={`text-navy hover:text-red-600 transition-colors ${isTop ? 'font-bold' : ''}`}>
                  {item.name}
                </Link>
                <span className="text-navy/65 text-xs ml-1">({item.team})</span>
              </span>
              <span className={`tabular-nums shrink-0 ${isTop ? 'font-bold text-navy' : 'text-navy/60'}`}>+{item.pin}</span>
            </div>
          );
        });
      })()}
      {tiedCount > 0 && (
        <div className="text-sm font-body text-navy/65 italic py-0.5">
          {tiedCount} tied with +{tiedValue}
        </div>
      )}
    </div>
  );
}
