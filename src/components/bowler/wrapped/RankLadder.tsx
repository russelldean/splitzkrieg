import Link from 'next/link';
import type { Ranked } from '@/lib/views/bowler-wrapped';
import type { CardTone } from './WrappedCard';
import { fmt, ordinal } from '@/lib/wrapped-text';

interface Props {
  ranked: Ranked;
  you: string;
  tone: CardTone;
  /** How to print the value, e.g. a one-decimal average. */
  format?: (v: number) => string;
}

const ROW: Record<CardTone, { you: string; other: string; link: string }> = {
  navy:  { you: 'bg-cream text-navy',        other: 'text-cream',  link: 'hover:text-red-light' },
  red:   { you: 'bg-cream text-navy',        other: 'text-cream',  link: 'hover:underline' },
  cream: { you: 'bg-navy text-cream',        other: 'text-navy',   link: 'hover:text-red' },
  gold:  { you: 'bg-navy text-cream',        other: 'text-navy',   link: 'hover:text-red' },
};

/**
 * The bowler's rank with the people immediately above and below. Ties show as
 * a shared rank line. Links go to bowler pages without prefetch.
 */
export function RankLadder({ ranked, you, tone, format = fmt }: Props) {
  const c = ROW[tone];
  const rows: Array<{ rank: number; name: string; slug: string | null; value: number; isYou: boolean }> = [];
  for (const a of ranked.above.slice(-2)) rows.push({ rank: a.rank, name: a.bowlerName, slug: a.slug, value: a.value, isYou: false });
  rows.push({ rank: ranked.rank, name: you, slug: null, value: ranked.value, isYou: true });
  for (const t of ranked.tiedWith.slice(0, 2)) rows.push({ rank: t.rank, name: t.bowlerName, slug: t.slug, value: t.value, isYou: false });
  for (const b of ranked.below.slice(0, 2)) rows.push({ rank: b.rank, name: b.bowlerName, slug: b.slug, value: b.value, isYou: false });

  return (
    <ol className="mt-6 space-y-1.5 font-body">
      {rows.map((r) => (
        <li
          key={`${r.rank}-${r.name}`}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 ${r.isYou ? `${c.you} font-semibold shadow-sm` : c.other}`}
        >
          <span className="w-10 shrink-0 text-sm tabular-nums font-semibold">
            {ordinal(r.rank)}
          </span>
          <span className="flex-1 truncate">
            {r.slug ? (
              <Link href={`/bowler/${r.slug}`} prefetch={false} className={`transition-colors ${c.link}`}>{r.name}</Link>
            ) : r.name}
          </span>
          <span className="tabular-nums font-heading text-lg">{format(r.value)}</span>
        </li>
      ))}
    </ol>
  );
}
