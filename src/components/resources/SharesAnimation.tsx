'use client';

function StickFigure({ animation }: { animation: string }) {
  return (
    <g className={animation}>
      <circle cx="0" cy="20" r="6" fill="currentColor" className="text-navy" />
      <line x1="0" y1="26" x2="0" y2="48" stroke="currentColor" strokeWidth="2.5" className="text-navy" />
      <line x1="0" y1="33" x2="-8" y2="42" stroke="currentColor" strokeWidth="2" className="text-navy" />
      <line x1="0" y1="33" x2="8" y2="38" stroke="currentColor" strokeWidth="2" className="text-navy" />
      <line x1="0" y1="48" x2="-6" y2="62" stroke="currentColor" strokeWidth="2" className="text-navy" />
      <line x1="0" y1="48" x2="6" y2="62" stroke="currentColor" strokeWidth="2" className="text-navy" />
    </g>
  );
}

interface Items {
  /** Emoji that travels the whole chain (on head) */
  head: string;
  /** Three hand-level items for P2↔P1, P3↔P2, P4↔P3 */
  hand: [string, string, string];
}

const SET_1: Items = {
  head: '\u{1F3A9}',  // top hat
  hand: ['\u{1F4DA}', '\u{1F9E5}', '\u{1F3BA}'],  // books, coat, tuba
};

const SET_2: Items = {
  head: '\u{1F451}',  // crown
  hand: ['\u{1F3B3}', '\u{1F9F8}', '\u{1F45C}'],  // bowling, teddy bear, handbag
};

function Animation({ items }: { items: Items }) {
  return (
    <div className="py-2 sm:py-6" aria-hidden="true">
      <div className="opacity-60">
        <svg viewBox="0 0 460 65" className="w-full h-20 sm:h-24" preserveAspectRatio="xMidYMid slice">
          <StickFigure animation="animate-[shares-hero-p1_18s_ease-in-out_infinite]" />
          <StickFigure animation="animate-[shares-hero-p2_18s_ease-in-out_infinite]" />
          <StickFigure animation="animate-[shares-hero-p3_18s_ease-in-out_infinite]" />
          <StickFigure animation="animate-[shares-hero-p4_18s_ease-in-out_infinite]" />

          <g className="animate-[shares-hero-iA_18s_ease-in-out_infinite]">
            <text x="0" y="14" textAnchor="middle" fontSize="18">{items.head}</text>
          </g>
          <g className="animate-[shares-hero-iB_18s_ease-in-out_infinite]">
            <text x="0" y="46" textAnchor="middle" fontSize="22">{items.hand[0]}</text>
          </g>
          <g className="animate-[shares-hero-iC_18s_ease-in-out_infinite]">
            <text x="0" y="46" textAnchor="middle" fontSize="24">{items.hand[1]}</text>
          </g>
          <g className="animate-[shares-hero-iD_18s_ease-in-out_infinite]">
            <text x="0" y="46" textAnchor="middle" fontSize="22">{items.hand[2]}</text>
          </g>
        </svg>
      </div>
    </div>
  );
}

export function SharesAnimation() {
  return <Animation items={SET_1} />;
}

export function SharesAnimation2() {
  return <Animation items={SET_2} />;
}
