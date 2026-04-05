'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import type { RandomFact } from '@/lib/queries/facts';

const LINE_COLOR = '#1B2A4A'; // navy
const NAVY = '#1B2A4A';

interface Props {
  facts: RandomFact[];
  bowlerName: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
    timeZone: 'America/New_York',
  });
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/New_York',
  });
}

/** Simple stick figure SVG — 20x28 viewBox, origin at feet */
function StickFigure({ celebrating }: { celebrating: boolean }) {
  return (
    <g>
      {/* Head */}
      <circle cx="10" cy="4" r="3.5" fill={NAVY} stroke="white" strokeWidth="1" />
      {/* Body */}
      <line x1="10" y1="7.5" x2="10" y2="17" stroke={NAVY} strokeWidth="1.8" strokeLinecap="round" />
      {/* Arms */}
      {celebrating ? (
        <>
          <line x1="10" y1="10" x2="4" y2="5" stroke={NAVY} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10" y1="10" x2="16" y2="5" stroke={NAVY} strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          <line x1="10" y1="10" x2="7" y2="17" stroke={NAVY} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="10" y1="10" x2="13" y2="17" stroke={NAVY} strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
      {/* Legs */}
      <line x1="10" y1="17" x2="6" y2="24" stroke={NAVY} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="10" y1="17" x2="14" y2="24" stroke={NAVY} strokeWidth="1.5" strokeLinecap="round" />
      {/* Flag when celebrating */}
      {celebrating && (
        <>
          <line x1="16" y1="5" x2="16" y2="-4" stroke={LINE_COLOR} strokeWidth="1.2" />
          <polygon points="16,-4 24,-2 16,0" fill={LINE_COLOR} opacity="0.9" />
        </>
      )}
    </g>
  );
}

export function RecordProgression({ facts, bowlerName }: Props) {
  const [activePoint, setActivePoint] = useState<{ type: string; idx: number } | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);
  const [animPhase, setAnimPhase] = useState(-1); // -1 = not started, 0..n = at step i, n+1 = celebrating
  const [animKey, setAnimKey] = useState(0); // bump to restart CSS animations

  const highGames = facts.filter(f => f.factTypeID === 1);

  // Trigger animation on scroll into view
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Schedule score reveals timed to when the climber reaches each point
  useEffect(() => {
    if (!inView || highGames.length < 2) return;
    const n = highGames.length;
    const duration = (n * 1.2 + 1.5) * 1000; // match totalAnimDuration in ms
    const animDelay = 300; // ms before animation starts
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (let i = 0; i < n; i++) {
      // Climber arrives at step i at this fraction of the animation
      const arrivalFraction = i === 0 ? 0 : ((i / (n - 1)) * 0.95);
      const revealTime = animDelay + arrivalFraction * duration;
      timers.push(setTimeout(() => setAnimPhase(i), revealTime));
    }
    // Celebration: after animation ends
    timers.push(setTimeout(() => setAnimPhase(n), animDelay + duration));

    return () => timers.forEach(clearTimeout);
  }, [inView, highGames.length, animKey]);

  if (highGames.length < 2) return null;

  // Use referenceDate timestamp for x positioning (true time scale)
  const allDates = highGames.filter(p => p.referenceDate).map(p => new Date(p.referenceDate!).getTime());
  const minTime = Math.min(...allDates);
  const maxTime = Math.max(...allDates);
  const timeSpan = maxTime - minTime || 1;

  function timeToX(f: RandomFact): number {
    if (!f.referenceDate) return 0;
    return (new Date(f.referenceDate).getTime() - minTime) / timeSpan;
  }

  // Padded value range
  const gameMinRaw = Math.min(...highGames.map(f => f.value));
  const gameMaxRaw = Math.max(...highGames.map(f => f.value));
  const gameRange = gameMaxRaw - gameMinRaw || 1;
  const gameMin = gameMinRaw - gameRange * 0.15;
  const gameMax = gameMaxRaw + gameRange * 0.15;

  // Full chart height: 0.9 = bottom (leave room for x-axis), 0.15 = top (leave room for legend pill)
  function gameToY(val: number): number {
    const normalized = (val - gameMin) / (gameMax - gameMin); // 0..1
    return 0.9 - normalized * 0.75; // maps to 0.9..0.15
  }

  const svgW = 1000;
  const svgH = 360;
  const padL = 0;
  const padR = 0;
  const padT = 10;
  const padB = 10;
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  function buildStepPath(points: RandomFact[], toY: (v: number) => number): string {
    if (points.length === 0) return '';
    const parts: string[] = [];
    for (let i = 0; i < points.length; i++) {
      const x = padL + timeToX(points[i]) * chartW;
      const y = padT + toY(points[i].value) * chartH;
      if (i === 0) {
        parts.push(`M ${x} ${y}`);
      } else {
        parts.push(`H ${x} V ${y}`);
      }
    }
    parts.push(`H ${svgW}`);
    return parts.join(' ');
  }

  function buildFillPath(points: RandomFact[], toY: (v: number) => number, baseY: number): string {
    if (points.length === 0) return '';
    const stepPath = buildStepPath(points, toY);
    const firstX = padL + timeToX(points[0]) * chartW;
    return `${stepPath} V ${baseY} H ${firstX} Z`;
  }

  const gamePath = buildStepPath(highGames, gameToY);
  const gameFillPath = buildFillPath(highGames, gameToY, svgH);

  // Year labels for x-axis
  const yearLabels: { year: string; pct: number }[] = [];
  const seenYears = new Set<string>();
  for (const f of highGames) {
    const yr = `'${String(f.year).slice(2)}`;
    if (!seenYears.has(yr)) {
      seenYears.add(yr);
      yearLabels.push({ year: yr, pct: timeToX(f) * 100 });
    }
  }

  // Compute step coordinates as percentages for the climber
  const stepCoords = highGames.map((f, i) => ({
    leftPct: timeToX(f) * 100,
    topPct: gameToY(f.value) * 100,
    value: f.value,
    date: f.referenceDate,
    seasonSlug: f.seasonSlug,
    week: f.week,
    isLast: i === highGames.length - 1,
  }));

  // Current climber position
  const isCelebrating = animPhase >= highGames.length;
  const climberIdx = isCelebrating ? highGames.length - 1 : Math.max(0, animPhase);
  const climberPos = stepCoords[climberIdx] ?? stepCoords[0];

  // Build smooth continuous climb keyframes — no pauses
  const climberKeyframes = useMemo(() => {
    if (stepCoords.length < 2) return '';
    const n = stepCoords.length;
    const frames: string[] = [];

    for (let i = 0; i < n; i++) {
      const pct = i === 0 ? 0 : (i / (n - 1)) * 95; // 0% to 95%, hold last 5%
      const { leftPct, topPct } = stepCoords[i];

      if (i > 0) {
        // Horizontal move first (at previous y)
        const prevTopPct = stepCoords[i - 1].topPct;
        const hPct = pct - (95 / (n - 1)) * 0.35;
        frames.push(`${hPct.toFixed(1)}% { left: ${leftPct.toFixed(1)}%; top: ${prevTopPct.toFixed(1)}%; }`);
      }

      // Arrive at step
      frames.push(`${pct.toFixed(1)}% { left: ${leftPct.toFixed(1)}%; top: ${topPct.toFixed(1)}%; }`);
    }

    // Hold at final position
    const last = stepCoords[n - 1];
    frames.push(`100% { left: ${last.leftPct.toFixed(1)}%; top: ${last.topPct.toFixed(1)}%; }`);

    return `@keyframes climbPath { ${frames.join(' ')} }`;
  }, [stepCoords]);

  const totalAnimDuration = highGames.length * 1.2 + 1.5; // seconds — smooth and unhurried

  // Score labels that appear as climber passes — exclude the last one (shown above card instead)
  const visibleScores = animPhase >= 0
    ? stepCoords.slice(0, Math.min(animPhase + 1, stepCoords.length)).filter(s => !s.isLast)
    : [];

  return (
    <section ref={sectionRef} className="h-full flex flex-col">
      <h2 className="font-heading text-2xl text-navy">Your High Game Progression</h2>
      <span className="block w-10 h-0.5 bg-red-600/40 mt-1.5" />

      {/* Career high reveal — fades in when climber reaches the top */}
      <div
        className="mt-3 flex items-end justify-between transition-all duration-700"
        style={{ opacity: isCelebrating ? 1 : 0, transform: isCelebrating ? 'translateY(0)' : 'translateY(8px)' }}
      >
        <div>
          <div className="font-heading text-3xl text-amber-700">Career High: {highGames[highGames.length - 1].value}</div>
          <p className="text-sm text-navy/60 font-body mt-0.5">
            {highGames[highGames.length - 1].referenceDate ? formatDateLong(highGames[highGames.length - 1].referenceDate!) : ''}
          </p>
        </div>
        <button
          onClick={() => { setAnimPhase(-1); setAnimKey(k => k + 1); setTimeout(() => setAnimPhase(0), 100); }}
          className="text-[11px] text-navy/40 hover:text-navy/70 font-body flex items-center gap-1 transition-colors cursor-pointer mb-0.5"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 1v5h5" />
            <path d="M3.5 10a5 5 0 1 0 1-7L1 6" />
          </svg>
          Replay
        </button>
      </div>

      {/* Card */}
      <div className="mt-auto bg-white rounded-lg border border-navy/10 shadow-sm p-4" style={{ height: 216 }}>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div className="relative h-full" onClick={() => setActivePoint(null)}>
          {/* Legend pill */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 bg-navy/[0.06] rounded-full px-3 py-0.5" style={{ height: 17 }}>
            <span className="w-4 h-[2.5px] rounded-full" style={{ backgroundColor: LINE_COLOR }} />
            <span className="text-[8px] font-medium font-body text-navy/85 leading-none">High Game</span>
          </div>

          {/* SVG lines + gradient fills */}
          <svg
            className="absolute inset-0 w-full h-full overflow-visible"
            preserveAspectRatio="none"
            viewBox={`0 0 ${svgW} ${svgH}`}
          >
            <defs>
              <linearGradient id="gameGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={LINE_COLOR} stopOpacity="0.25" />
                <stop offset="100%" stopColor={LINE_COLOR} stopOpacity="0.04" />
              </linearGradient>
            </defs>
            <path d={gameFillPath} fill="url(#gameGrad)" />
            <path
              d={gamePath}
              fill="none"
              stroke={LINE_COLOR}
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              opacity="0.8"
            />
          </svg>

          {/* Score labels that appear as climber passes */}
          {visibleScores.map((s, i) => (
            <div
              key={`score-${i}`}
              className="absolute z-10 pointer-events-none"
              style={{
                left: `${s.leftPct}%`,
                top: `${s.topPct}%`,
                transform: 'translate(-50%, -130%)',
                opacity: 0,
                animation: 'scorePopIn 0.3s ease-out forwards',
              }}
            >
              <span className="text-[10px] font-heading text-navy/70 bg-white/80 rounded px-1">
                {s.value}
              </span>
            </div>
          ))}

          {/* Animated stick figure climber */}
          {inView && (
            <div
              key={`climber-${animKey}`}
              className="absolute z-20 pointer-events-none"
              style={{
                left: `${stepCoords[0].leftPct}%`,
                top: `${stepCoords[0].topPct}%`,
                transform: 'translate(-50%, -85%)',
                animation: `climbPath ${totalAnimDuration}s ease-in-out 0.3s forwards`,
              }}
            >
              <svg width="16" height="22" viewBox="0 0 20 28" overflow="visible">
                <StickFigure celebrating={isCelebrating} />
              </svg>
            </div>
          )}

          {/* Career high score over climber's head */}
          {isCelebrating && (
            <div
              className="absolute z-10 pointer-events-none"
              style={{
                left: `${stepCoords[stepCoords.length - 1].leftPct}%`,
                top: `calc(${stepCoords[stepCoords.length - 1].topPct}% - 32px)`,
                opacity: 0,
                animation: 'careerHighPop 0.4s ease-out 0.3s forwards',
              }}
            >
              <span className="text-[12px] font-heading text-navy bg-white/80 rounded px-1">
                {highGames[highGames.length - 1].value}
              </span>
            </div>
          )}

          {/* Interactive dots (visible after animation) */}
          {highGames.map((f, i) => {
            const leftPct = timeToX(f) * 100;
            const topPct = gameToY(f.value) * 100;
            const isActive = activePoint?.type === 'game' && activePoint.idx === i;

            return (
              <div
                key={`g-${i}`}
                className="absolute"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isActive ? 20 : 10,
                  opacity: animPhase >= i ? 1 : 0,
                  transition: 'opacity 0.3s',
                }}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); setActivePoint(isActive ? null : { type: 'game', idx: i }); }}
                  className={`w-3 h-3 rounded-full border-2 border-white shadow-sm transition-transform cursor-pointer ${
                    isActive ? 'scale-150 bg-navy' : 'hover:scale-125'
                  }`}
                  style={{ backgroundColor: isActive ? undefined : LINE_COLOR }}
                />
                {isActive && (
                  <div className={`absolute bottom-full mb-2 z-30 ${leftPct > 70 ? 'right-0' : leftPct < 30 ? 'left-0' : 'left-1/2 -translate-x-1/2'}`}>
                    <div className="bg-navy text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap font-body">
                      <div className="font-bold text-sm">Game: {f.value}</div>
                      {f.previousValue && <div className="text-white/60">Prev: {f.previousValue}</div>}
                      {f.referenceDate && <div className="text-white/60">{formatDate(f.referenceDate)}</div>}
                      <Link
                        href={`/week/${f.seasonSlug}/${f.week}`}
                        className="text-red-300 hover:text-red-200 text-[11px]"
                        onClick={e => e.stopPropagation()}
                      >
                        View night &rarr;
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* X-axis year labels */}
          <div className="absolute left-0 right-0 -bottom-5">
            {yearLabels.map(({ year, pct }) => (
              <span
                key={year}
                className="absolute text-[10px] text-navy/60 font-body -translate-x-1/2"
                style={{ left: `${pct}%` }}
              >
                {year}
              </span>
            ))}
          </div>
        </div>
      </div>
      {/* Footer link — matches GameProfile footer for symmetry */}
      <div className="mt-6 flex justify-end">
        <Link
          href="/stats/all-time/high-game-record"
          className="text-sm text-red-600 hover:text-red-700 font-body"
        >
          League High Game Record &rarr;
        </Link>
      </div>

      <style>{`
        ${climberKeyframes}
        @keyframes scorePopIn {
          from { opacity: 0; transform: translate(-50%, -100%) scale(0.7); }
          to { opacity: 1; transform: translate(-50%, -130%) scale(1); }
        }
        @keyframes careerHighPop {
          from { opacity: 0; transform: translate(-50%, 0) scale(0.7); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </section>
  );
}
