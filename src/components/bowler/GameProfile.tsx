'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import type { GameProfileRow, LeagueGameAvgs } from '@/lib/queries/alltime';

interface Props {
  profile: GameProfileRow;
  leagueAvgs: LeagueGameAvgs;
}

// Site colors from AverageProgressionChart
const NAVY = '#1B2A4A';
const RED = '#C53030';
const CREAM = '#FFFBF2';
const LEAGUE_COLOR = '#64748b'; // slate-500

const ARCHETYPE_STYLE: Record<string, { heroColor: string; desc: string; dotColor: string }> = {
  'Fast Starter': { heroColor: 'text-orange-700', desc: 'You come out hot in Game 1', dotColor: '#c2410c' },
  'Middle Child': { heroColor: 'text-purple-700', desc: 'You peak in Game 2', dotColor: '#7e22ce' },
  'Late Bloomer': { heroColor: 'text-emerald-700', desc: 'You save your best for Game 3', dotColor: '#15803d' },
  'Flatliner':    { heroColor: 'text-sky-700',      desc: 'Consistent across all 3 games', dotColor: '#0369a1' },
};

function AnimatedShapeBox({ avg1, avg2, avg3, bestGame, isFlatliner, animate, leagueAvgs, dotColor }: {
  avg1: number; avg2: number; avg3: number; bestGame: 1 | 2 | 3; isFlatliner: boolean; animate: boolean;
  leagueAvgs: LeagueGameAvgs; dotColor: string;
}) {
  // Normalize both to 100 baseline
  const bowlerOverall = (avg1 + avg2 + avg3) / 3;
  const bowlerNorm = [avg1 / bowlerOverall, avg2 / bowlerOverall, avg3 / bowlerOverall];

  const leagueOverall = (leagueAvgs.avg1 + leagueAvgs.avg2 + leagueAvgs.avg3) / 3;
  const leagueNorm = [leagueAvgs.avg1 / leagueOverall, leagueAvgs.avg2 / leagueOverall, leagueAvgs.avg3 / leagueOverall];

  // Combined min/max for shared scale
  const allVals = [...bowlerNorm, ...leagueNorm];
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 0.01;

  const w = 312;
  const h = 190;
  const padTop = 36;
  const padBot = 52;
  const padX = 40;
  const usableH = h - padTop - padBot;

  function toPoints(norms: number[]) {
    return norms.map((v, i) => {
      const x = (i / 2) * (w - padX * 2) + padX;
      const y = padTop + usableH - ((v - min) / range) * usableH;
      return { x, y, val: v };
    });
  }

  const bowlerPts = toPoints(bowlerNorm);
  const leaguePts = toPoints(leagueNorm);

  const bowlerPathD = `M ${bowlerPts.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const leaguePathD = `M ${leaguePts.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const labels = ['G1', 'G2', 'G3'];

  // Percentage difference from overall average per game (matches leaderboard)
  const gamePcts = [avg1, avg2, avg3].map(v => bowlerOverall > 0 ? ((v / bowlerOverall) - 1) * 100 : 0);

  // Path length for draw animation
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    if (pathRef.current) {
      setPathLength(pathRef.current.getTotalLength());
    }
  }, []);

  // 1.0 baseline y position
  const baselineY = padTop + usableH - ((1.0 - min) / range) * usableH;

  return (
    <div className="bg-white rounded-lg border border-navy/10 p-4 flex-shrink-0">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* "avg" baseline at 1.0 */}
        <line x1={padX - 8} y1={baselineY} x2={w - padX + 8} y2={baselineY}
          stroke={NAVY} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="4 3" />
        <text x={6} y={baselineY + 3} fontSize={9} fill={NAVY} opacity={0.85} fontFamily="var(--font-body)">
          avg
        </text>

        {/* League line (dashed, lighter, appears immediately) */}
        <path
          d={leaguePathD}
          fill="none"
          stroke={LEAGUE_COLOR}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="6 4"
          style={animate ? {
            opacity: 0,
            animation: 'fadeIn 0.625s ease-out 0.15s forwards',
          } : undefined}
        />
        {/* League dots */}
        {leaguePts.map((p, i) => (
          <circle key={`league-${i}`} cx={p.x} cy={p.y} r={3.5}
            fill={LEAGUE_COLOR}
            style={animate ? {
              opacity: 0,
              animation: `fadeIn 0.45s ease-out ${0.15 + i * 0.45}s forwards`,
            } : undefined}
          />
        ))}

        {/* Bowler line (animated draw) */}
        <path
          ref={pathRef}
          d={bowlerPathD}
          fill="none"
          stroke={NAVY}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={animate && pathLength > 0 ? {
            strokeDasharray: pathLength,
            strokeDashoffset: pathLength,
            animation: 'drawLine 1.5s ease-out 0.3s forwards',
          } : undefined}
        />

        {/* Bowler dots + values */}
        {bowlerPts.map((p, i) => {
          const isBest = (i + 1) === bestGame && !isFlatliner;
          const delay = animate ? `${0.3 + i * 0.6}s` : '0s';
          const rawVal = [avg1, avg2, avg3][i];
          return (
            <g
              key={i}
              style={animate ? {
                opacity: 0,
                animation: `fadeIn 0.45s ease-out ${delay} forwards`,
              } : undefined}
            >
              <circle cx={p.x} cy={p.y} r={6}
                fill={isBest ? dotColor : NAVY}
                stroke={CREAM}
                strokeWidth={2}
              />
              {/* Game label */}
              <text
                x={p.x}
                y={h - 3}
                textAnchor="middle"
                fontSize={11}
                fill={NAVY}
                opacity={0.85}
                fontFamily="var(--font-body)"
              >
                {['Game 1', 'Game 2', 'Game 3'][i]}
              </text>
            </g>
          );
        })}

        {/* Per-game % from average labels */}
        {bowlerPts.map((p, i) => {
          const pct = gamePcts[i];
          const delay = `${1.5 + i * 0.3}s`;
          return (
            <text
              key={`pct-${i}`}
              x={p.x}
              y={p.y - 14}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill={pct >= 0 ? '#16a34a' : RED}
              opacity={0.8}
              fontFamily="var(--font-body)"
              style={animate ? {
                opacity: 0,
                animation: `fadeIn 0.45s ease-out ${delay} forwards`,
              } : undefined}
            >
              {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
            </text>
          );
        })}

        {/* Legend - centered top with background pill */}
        <g style={animate ? { opacity: 0, animation: 'fadeIn 0.45s ease-out 2.25s forwards' } : undefined}>
          <rect x={w / 2 - 68} y={-2} width={144} height={20} rx={10} fill={NAVY} fillOpacity={0.06} />
          <line x1={w / 2 - 48} y1={8} x2={w / 2 - 28} y2={8} stroke={NAVY} strokeWidth={3} strokeLinecap="round" />
          <text x={w / 2 - 24} y={12} fontSize={10} fill={NAVY} opacity={0.85} fontWeight={500} fontFamily="var(--font-body)">You</text>
          <line x1={w / 2 + 8} y1={8} x2={w / 2 + 28} y2={8} stroke={LEAGUE_COLOR} strokeWidth={2.5} strokeDasharray="5 3" strokeLinecap="round" />
          <text x={w / 2 + 32} y={12} fontSize={10} fill={LEAGUE_COLOR} fontWeight={500} fontFamily="var(--font-body)">League</text>
        </g>
      </svg>

      <style>{`
        @keyframes drawLine {
          to { stroke-dashoffset: 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export function GameProfile({ profile, leagueAvgs }: Props) {
  const [revealed, setRevealed] = useState(false);
  const [animateKey, setAnimateKey] = useState(0);
  const style = ARCHETYPE_STYLE[profile.archetype] ?? ARCHETYPE_STYLE['Flatliner'];
  const isFlatliner = profile.archetype === 'Flatliner';

  function handleReveal() {
    if (!revealed) {
      setRevealed(true);
      setAnimateKey(k => k + 1);
    } else {
      setRevealed(false);
    }
  }

  return (
    <section>
      <button
        onClick={handleReveal}
        className="flex items-center gap-3 group cursor-pointer"
      >
        <h2 className="font-heading text-2xl text-navy">Your Bowler Profile</h2>
        <svg
          className={`w-5 h-5 text-navy/55 transition-transform duration-200 ${revealed ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <span className="block w-10 h-0.5 bg-red-600/40 mt-1.5" />

      {revealed && (
        <div className="mt-4 flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5" key={animateKey}>
          {/* Archetype hero - shown above chart on mobile, after chart on desktop */}
          <div
            className="sm:hidden"
            style={{
              opacity: 0,
              animation: 'fadeIn 0.6s ease-out 0.3s forwards',
            }}
          >
            <div className={`font-heading text-3xl ${style.heroColor}`}>
              {profile.archetype}
            </div>
            <p className="text-sm text-navy/60 font-body mt-0.5">
              {style.desc}
            </p>
          </div>

          {/* Animated chart box */}
          <div className="flex-shrink-0">
            <AnimatedShapeBox
              avg1={profile.avg1}
              avg2={profile.avg2}
              avg3={profile.avg3}
              bestGame={profile.bestGame}
              isFlatliner={isFlatliner}
              animate={true}
              leagueAvgs={leagueAvgs}
              dotColor={style.dotColor}
            />
          </div>

          {/* Archetype info - desktop shows full block, mobile shows remaining details */}
          <div
            className="min-w-0 pt-1"
            style={{
              opacity: 0,
              animation: 'fadeIn 0.6s ease-out 2.4s forwards',
            }}
          >
            <div className="hidden sm:block">
              <div className="text-sm text-navy/60 font-body">Your Profile:</div>
              <div className={`font-heading text-4xl ${style.heroColor} -mt-0.5`}>
                {profile.archetype}
              </div>
              <p className="text-sm text-navy/60 font-body mt-1">
                {style.desc}
              </p>
            </div>
            <div className="text-sm text-navy/80 font-semibold font-body sm:mt-2 tabular-nums">
              {isFlatliner
                ? `${profile.pctSpread.toFixed(1)}% variance`
                : `${profile.pctSpread.toFixed(1)}% skew`}
            </div>
            <Link
              href="/stats/all-time/game-profiles"
              className="inline-block mt-2 sm:mt-3 text-sm text-red-600 hover:text-red-700 font-body"
            >
              League Night Profiles &rarr;
            </Link>
            {profile.games < 27 && (
              <p className="text-[10px] text-navy/60 font-body mt-2">
                Based on {profile.games} game{profile.games !== 1 ? 's' : ''}. Stabilizes around 27.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
