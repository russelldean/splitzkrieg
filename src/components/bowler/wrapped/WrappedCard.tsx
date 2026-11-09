import type { ReactNode } from 'react';


export type CardTone = 'navy' | 'red' | 'cream' | 'gold';

const TONE: Record<CardTone, { card: string; eyebrow: string; muted: string; rule: string; divider: string }> = {
  navy:  { card: 'bg-navy text-cream',                         eyebrow: 'text-cream/80', muted: 'text-cream/80', rule: 'bg-red-light',    divider: 'bg-cream/25' },
  red:   { card: 'bg-red text-cream',                          eyebrow: 'text-cream/85', muted: 'text-cream/85', rule: 'bg-cream/80',     divider: 'bg-cream/30' },
  cream: { card: 'bg-white text-navy border border-navy/10',   eyebrow: 'text-red',      muted: 'text-navy/70',  rule: 'bg-red/60',       divider: 'bg-navy/15' },
  gold:  { card: 'bg-amber-100 text-navy border border-amber-200', eyebrow: 'text-amber-800', muted: 'text-navy/70', rule: 'bg-amber-600/60', divider: 'bg-amber-700/25' },
};

interface Props {
  tone: CardTone;
  eyebrow?: string;
  children: ReactNode;
  /** Card number shown top right, 1-based. */
  index?: number;
  total?: number;
  /** Shorter card for a single idea that does not need the room. */
  compact?: boolean;
}

/**
 * One full-height recap card. Big type, one idea, a colored field. Children are
 * laid out top to bottom; use <BigNumber> and <Muted> for the typographic roles.
 */
export function WrappedCard({ tone, eyebrow, children, index, total, compact = false }: Props) {
  const t = TONE[tone];
  return (
    <section className={`relative rounded-2xl shadow-md px-6 py-10 sm:px-10 sm:py-14 ${compact ? 'min-h-0' : 'min-h-[70svh]'} flex flex-col justify-center ${t.card}`}>
      {index != null && total != null && <FrameCorner index={index} total={total} tone={tone} />}
      {eyebrow && (
        <div className="mb-6">
          <p className={`text-xs sm:text-sm font-body font-semibold uppercase tracking-[0.2em] ${t.eyebrow}`}>{eyebrow}</p>
          <span className={`block w-10 h-0.5 mt-2 ${t.rule}`} />
        </div>
      )}
      {children}
    </section>
  );
}

export function BigNumber({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`font-heading leading-none tabular-nums text-7xl sm:text-8xl ${className}`}>{children}</p>;
}

export function Headline({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`font-heading leading-tight text-3xl sm:text-4xl ${className}`}>{children}</p>;
}

export function Muted({ children, tone, className = '' }: { children: ReactNode; tone: CardTone; className?: string }) {
  return <p className={`font-body text-base sm:text-lg leading-relaxed ${TONE[tone].muted} ${className}`}>{children}</p>;
}

export const toneMuted = (tone: CardTone) => TONE[tone].muted;

/** Hairline between sections of a long card. */
export function Divider({ tone }: { tone: CardTone }) {
  return <span aria-hidden className={`block h-px w-full my-8 ${TONE[tone].divider}`} />;
}

/**
 * The scoresheet corner, top right of every card, scored like a real frame:
 * two ball boxes on top and the running total underneath. Every frame is one
 * pin and a gutter, so the running total is the card number. The last card is
 * the tenth frame: three strikes, and the total finally jumps.
 */
function FrameCorner({ index, total, tone }: { index: number; total: number; tone: CardTone }) {
  const line = TONE[tone].divider.replace('bg-', 'border-');
  const muted = TONE[tone].muted;
  const last = index === total;
  const balls = last ? ['X', 'X', 'X'] : ['1', '\u2013'];
  const score = last ? index - 1 + 30 : index;
  return (
    <span
      className={`absolute top-0 right-0 flex flex-col border-b border-l ${line} font-heading leading-none`}
      style={{ width: last ? '4.5rem' : '3rem' }}
      aria-label={last ? `Tenth frame, three strikes, ${score}` : `Frame ${index}, one pin, running total ${index}`}
    >
      <span className="flex justify-end">
        {balls.map((b, i) => (
          <span
            key={i}
            className={`flex h-5 w-5 items-center justify-center border-b border-l ${line} text-[11px] ${b === 'X' ? 'text-red-600/60 font-bold' : muted}`}
          >
            {b}
          </span>
        ))}
      </span>
      <span className={`flex h-7 items-center justify-center text-base tabular-nums ${muted}`}>{score}</span>
    </span>
  );
}
