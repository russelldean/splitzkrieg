'use client';

import { ParallaxBg } from '@/components/ui/ParallaxBg';

function StickFigure({ animation }: { animation: string }) {
  return (
    <g className={animation}>
      <circle cx="0" cy="20" r="6" fill="currentColor" className="text-white" />
      <line x1="0" y1="26" x2="0" y2="48" stroke="currentColor" strokeWidth="2.5" className="text-white" />
      <line x1="0" y1="33" x2="-8" y2="42" stroke="currentColor" strokeWidth="2" className="text-white" />
      <line x1="0" y1="33" x2="8" y2="38" stroke="currentColor" strokeWidth="2" className="text-white" />
      <line x1="0" y1="48" x2="-6" y2="62" stroke="currentColor" strokeWidth="2" className="text-white" />
      <line x1="0" y1="48" x2="6" y2="62" stroke="currentColor" strokeWidth="2" className="text-white" />
    </g>
  );
}

export function SharesHero() {
  return (
    <section
      className="relative overflow-hidden h-48 sm:h-56"
      role="img"
      aria-label="Splitzkrieg Shares free table loaded with treasures"
    >
      <ParallaxBg
        src="/splitzkrieg-shares-table.jpg"
        imgW={1512}
        imgH={2016}
        focalY={0.35}
        maxW={3024}
        mobileSrc="/splitzkrieg-shares-table.jpg"
        mobileFocalY={0.35}
        mobileImgW={3024}
        mobileImgH={4032}
      />
      <div className="absolute inset-0 z-[1] bg-navy/30" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-r from-navy/60 via-transparent to-navy/60 sm:from-navy/70 sm:via-transparent sm:to-navy/70" />

      {/* 4-person chain swap animation */}
      <div className="absolute inset-0 z-[2] flex items-center justify-center opacity-30" aria-hidden="true">
        <svg viewBox="0 0 460 65" className="w-full max-w-5xl h-full" preserveAspectRatio="xMidYMid meet">
          {/* Four people */}
          <StickFigure animation="animate-[shares-hero-p1_18s_ease-in-out_infinite]" />
          <StickFigure animation="animate-[shares-hero-p2_18s_ease-in-out_infinite]" />
          <StickFigure animation="animate-[shares-hero-p3_18s_ease-in-out_infinite]" />
          <StickFigure animation="animate-[shares-hero-p4_18s_ease-in-out_infinite]" />

          {/* Hat: travels the whole chain, sits on each person's head */}
          <g className="animate-[shares-hero-iA_18s_ease-in-out_infinite]">
            <text x="0" y="14" textAnchor="middle" fontSize="18">&#x1F3A9;</text>
          </g>
          {/* Item B: teddy bear - swaps P2↔P1 and back */}
          <g className="animate-[shares-hero-iB_18s_ease-in-out_infinite]">
            <text x="0" y="46" textAnchor="middle" fontSize="22">&#x1F9F8;</text>
          </g>
          {/* Item C: coat - swaps P3↔P2 and back */}
          <g className="animate-[shares-hero-iC_18s_ease-in-out_infinite]">
            <text x="0" y="46" textAnchor="middle" fontSize="24">&#x1F9E5;</text>
          </g>
          {/* Item D: record - swaps P4↔P3 and back */}
          <g className="animate-[shares-hero-iD_18s_ease-in-out_infinite]">
            <text x="0" y="46" textAnchor="middle" fontSize="22">&#x1F3BA;</text>
          </g>
        </svg>
      </div>

      {/* Text overlay */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-end pb-6">
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl text-white drop-shadow-lg">
            Splitzkrieg Shares
          </h1>
          <p className="font-body text-white/90 text-sm sm:text-base mt-1 drop-shadow">
            One bowler&apos;s junk is another bowler&apos;s treasure.
          </p>
        </div>
      </div>
    </section>
  );
}
