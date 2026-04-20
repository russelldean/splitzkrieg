'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { ALL_TEAMS_VIZ, type BowlerNode, type BowlerPair } from './teams-data';

const SEASON_LABELS: Record<number, string> = {
  1:"S'07",2:"F'08",3:"S'09",4:"F'09",5:"S'10",6:"F'10",7:"S'11",8:"F'11",
  9:"S'12",10:"F'12",11:"S'13",12:"F'13",13:"S'14",14:"F'14",15:"S'15",
  16:"F'15",17:"S'16",18:"F'16",19:"S'17",20:"F'17",21:"S'18",22:"F'18",
  23:"S'19",24:"F'19",25:"S'20",26:"F'21",27:"S'22",28:"F'22",29:"S'23",
  30:"F'23",31:"S'24",32:"F'24",33:"S'25",34:"F'25",35:"S'26",
};




const AD_W = 1000;
const AD_PAD = 30;
const AD_BASELINE = 195;
const AD_H = 300;
const AD_LABEL_MIN = 5;

function heatColor(t: number): string {
  const hue = Math.round(220 - t * 220);
  const lit = Math.round(65 - t * 18);
  return `hsl(${hue},90%,${lit}%)`;
}

function nodeColor(t: number): string {
  const sat = Math.round(75 - t * 65);
  const lit = Math.round(58 + t * 36);
  return `hsl(220,${sat}%,${lit}%)`;
}

const GLOBAL_MAX_NIGHTS = Math.max(1, ...ALL_TEAMS_VIZ.flatMap(t => Object.values(t.nightsMap)));

function ArcDiagram({ bowlers, pairs, nightsMap, champCounts, captainID, title, selectedId, onSelect, sort, showLegend }: {
  bowlers: BowlerNode[];
  pairs: BowlerPair[];
  nightsMap: Record<number, number>;
  champCounts: Record<number, number>;
  captainID: number | null;
  title: string;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  sort: 'firstSeason' | 'totalNights';
  showLegend?: boolean;
}) {
  const [hovNodeId, setHovNodeId] = useState<number | null>(null);
  const [hovArc, setHovArc] = useState<{ id1: number; id2: number; coNights: number } | null>(null);
  const [tip, setTip] = useState({ x: 0, y: 0 });

  const maxNights = GLOBAL_MAX_NIGHTS;

  const coLookup = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pairs) m.set(`${Math.min(p.id1, p.id2)},${Math.max(p.id1, p.id2)}`, p.coNights);
    return m;
  }, [pairs]);

  function co(a: number, b: number) {
    return coLookup.get(`${Math.min(a, b)},${Math.max(a, b)}`) || 0;
  }

  const sortedBowlers = useMemo(() => {
    const n = (id: number) => nightsMap[id] ?? 1;
    if (sort === 'totalNights') return [...bowlers].sort((a, b) => n(b.id) - n(a.id));
    return [...bowlers].sort((a, b) => a.firstSeason - b.firstSeason || n(b.id) - n(a.id));
  }, [sort, bowlers, nightsMap]);

  const availW = AD_W - AD_PAD * 2;

  const nodeRadius = new Map<number, number>(
    bowlers.map(b => {
      const nights = nightsMap[b.id] ?? 1;
      return [b.id, 2 + Math.sqrt(nights / maxNights) * 8];
    })
  );

  const totalR = sortedBowlers.reduce((sum, b) => sum + (nodeRadius.get(b.id) ?? 2), 0);
  const rScale = availW / totalR;
  const nodeX = new Map<number, number>();
  let cumR = 0;
  for (const b of sortedBowlers) {
    const r = nodeRadius.get(b.id) ?? 2;
    nodeX.set(b.id, AD_PAD + (cumR + r / 2) * rScale);
    cumR += r;
  }

  const maxDist = availW;
  const maxCoNights = pairs[0]?.coNights ?? 1;

  const selectedInThisTeam = selectedId !== null && bowlers.some(b => b.id === selectedId);
  const focusId = (selectedInThisTeam ? selectedId : null) ?? hovNodeId;

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <svg width={AD_W} height={AD_H} style={{ display: 'block', overflow: 'visible' }}>
          <text x={AD_W / 2} y={16} textAnchor="middle" fontSize={13} fontWeight={700} fill="#94a3b8" letterSpacing="0.08em">{title.toUpperCase()}</text>
          <line x1={AD_PAD} y1={AD_BASELINE} x2={AD_W - AD_PAD} y2={AD_BASELINE} stroke="#1e2d3d" strokeWidth={1} />

          {showLegend && (
            <>
              <defs>
                <linearGradient id="arc-legend-grad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stopColor={heatColor(1)}   />
                  <stop offset="50%"  stopColor={heatColor(0.5)} />
                  <stop offset="100%" stopColor={heatColor(0)}   />
                </linearGradient>
              </defs>
              {/* arc key — upper right, outside chart */}
              <g textAnchor="start">
                <text x={AD_W + 16} y={133} fontSize={10} fill="#94a3b8">nights bowled together</text>
                <rect x={AD_W + 16} y={141} width={64} height={4} rx={2} fill="url(#arc-legend-grad)" />
              </g>
              {/* dot key — near baseline, outside chart */}
              <g textAnchor="start">
                <text x={AD_W + 16} y={AD_BASELINE - 14} fontSize={10} fill="#94a3b8">nights bowled</text>
                <circle cx={AD_W + 24} cy={AD_BASELINE} r={8}   fill={nodeColor(1)}   />
                <circle cx={AD_W + 42} cy={AD_BASELINE} r={4.5} fill={nodeColor(0.4)} />
                <circle cx={AD_W + 56} cy={AD_BASELINE} r={2}   fill={nodeColor(0)}   />
              </g>
              {/* crown key — below dot key */}
              <g textAnchor="start">
                <text x={AD_W + 16} y={AD_BASELINE + 36} fontSize={10} fill="#94a3b8">team championship</text>
                <text x={AD_W + 16} y={AD_BASELINE + 52} fontSize={14} fill="#f59e0b">♛</text>
              </g>
            </>
          )}

          {[...pairs].reverse().map(pair => {
            const x1 = nodeX.get(pair.id1);
            const x2 = nodeX.get(pair.id2);
            if (x1 === undefined || x2 === undefined) return null;
            const dist = Math.abs(x2 - x1);
            const arcH = Math.max(40, Math.pow(dist / maxDist, 0.5) * 185);
            const t = pair.coNights / maxCoNights;
            const tSqrt = Math.sqrt(t);
            const key = `${pair.id1},${pair.id2}`;
            const isConnected = focusId !== null && (pair.id1 === focusId || pair.id2 === focusId);
            const isDimmed = focusId !== null && !isConnected;
            const isHovArc = hovArc?.id1 === pair.id1 && hovArc?.id2 === pair.id2;
            return (
              <path
                key={key}
                d={`M ${x1},${AD_BASELINE} C ${x1},${AD_BASELINE - arcH} ${x2},${AD_BASELINE - arcH} ${x2},${AD_BASELINE}`}
                fill="none"
                stroke={heatColor(tSqrt)}
                strokeWidth={isHovArc ? Math.max(1.5, tSqrt * 7) + 2 : isConnected ? Math.max(1.5, tSqrt * 7) + 1 : Math.max(0.3, tSqrt * 6)}
                strokeOpacity={isDimmed ? 0.03 : isConnected || isHovArc ? 0.5 + t * 0.45 : 0.07 + t * 0.63}
                style={{ cursor: isConnected ? 'pointer' : 'default' }}
                onMouseEnter={isConnected ? e => { setHovArc(pair); setTip({ x: e.clientX, y: e.clientY }); } : undefined}
                onMouseMove={isConnected ? e => setTip({ x: e.clientX, y: e.clientY }) : undefined}
                onMouseLeave={isConnected ? () => setHovArc(null) : undefined}
              />
            );
          })}

          {sortedBowlers.map(b => {
            const x = nodeX.get(b.id)!;
            const nights = nightsMap[b.id] ?? 1;
            const r = nodeRadius.get(b.id) ?? 2;
            const isSelected = b.id === selectedId;
            const isFocus = b.id === focusId;
            const isConnected = focusId !== null && !isFocus && co(focusId, b.id) > 0;
            const isDimmed = focusId !== null && !isFocus && !isConnected;
            const showLabel = nights >= AD_LABEL_MIN || isConnected || isSelected;
            const color = nodeColor(Math.sqrt(nights / maxNights));
            const isCaptain = b.id === captainID;
            const labelColor = isSelected ? '#fbbf24' : isFocus ? '#f8fafc' : isConnected ? '#cbd5e1' : '#94a3b8';
            return (
              <g key={b.id} style={{ cursor: 'pointer' }}
                onClick={() => onSelect(selectedId === b.id ? null : b.id)}
                onMouseEnter={e => { setHovNodeId(b.id); setTip({ x: e.clientX, y: e.clientY }); }}
                onMouseMove={e => setTip({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHovNodeId(null)}
              >
                {isSelected && <circle cx={x} cy={AD_BASELINE} r={r + 7} fill="none" stroke="#fbbf24" strokeWidth={1.5} strokeOpacity={0.4} />}
                <circle
                  cx={x} cy={AD_BASELINE}
                  r={isSelected ? r + 4 : isFocus ? r + 2.5 : r}
                  fill={isSelected ? '#fbbf24' : color}
                  fillOpacity={isDimmed ? 0.2 : 1}
                  stroke={isSelected ? '#fff' : isFocus ? '#93c5fd' : 'none'}
                  strokeWidth={isSelected ? 2 : 1.5}
                />
                {showLabel && (
                  <text x={0} y={0} transform={`translate(${x}, ${AD_BASELINE + r + 8}) rotate(45)`} textAnchor="start" fontSize={isSelected ? 13 : 11} fill={labelColor} fontWeight={isSelected ? 900 : isConnected || isFocus ? 700 : 400} textDecoration={isCaptain ? 'underline' : undefined}>
                    {b.name}{(champCounts[b.id] ?? 0) > 0 && <tspan fill="#f59e0b" fontSize={isSelected ? 16 : 14}>{' '}{'♛'.repeat(champCounts[b.id])}</tspan>}
                  </text>
                )}
                {!showLabel && (champCounts[b.id] ?? 0) > 0 && (
                  <text x={0} y={0} transform={`translate(${x}, ${AD_BASELINE + r + 8}) rotate(45)`} textAnchor="start" fontSize={14} fill="#f59e0b" fillOpacity={isDimmed ? 0.15 : 0.9}>{'♛'.repeat(champCounts[b.id])}</text>
                )}
              </g>
            );
          })}
        </svg>

        {hovArc !== null && (() => {
          const b1 = bowlers.find(b => b.id === hovArc.id1);
          const b2 = bowlers.find(b => b.id === hovArc.id2);
          if (!b1 || !b2) return null;
          return (
            <div style={{ position: 'fixed', left: tip.x + 14, top: tip.y - 10, background: '#132238', border: '1px solid #1e3a5f', borderRadius: 8, padding: '8px 12px', pointerEvents: 'none', zIndex: 50, whiteSpace: 'nowrap' }}>
              <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{b1.name} &amp; {b2.name}</div>
              <div style={{ color: '#60a5fa', fontSize: 12 }}>{hovArc.coNights} nights bowled together</div>
            </div>
          );
        })()}

        {hovNodeId !== null && (() => {
          const b = bowlers.find(b => b.id === hovNodeId);
          if (!b) return null;
          const nights = nightsMap[hovNodeId] ?? 1;
          return (
            <div style={{ position: 'fixed', left: tip.x + 14, top: tip.y - 10, background: '#132238', border: '1px solid #1e3a5f', borderRadius: 8, padding: '8px 12px', pointerEvents: 'none', zIndex: 50, whiteSpace: 'nowrap' }}>
              <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{b.name}{(champCounts[b.id] ?? 0) > 0 && <span style={{ color: '#f59e0b', fontSize: 15 }}>{' '}{'♛'.repeat(champCounts[b.id])}</span>}</div>
              <div style={{ color: '#60a5fa', fontSize: 12 }}>{nights} nights with team &bull; since {SEASON_LABELS[b.firstSeason]}</div>
              <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>click to pin</div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}


function SharedPinPanel({ selectedId, onClose }: { selectedId: number; onClose: () => void }) {
  const teamsForBowler = ALL_TEAMS_VIZ.filter(t => t.bowlers.some(b => b.id === selectedId));
  if (teamsForBowler.length === 0) return null;

  const bowlerName = teamsForBowler[0].bowlers.find(b => b.id === selectedId)!.name;

  return (
    <div style={{ background: '#132238', border: '1px solid #1e3a5f', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: 15 }}>{bowlerName}</span>
        <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>&#x2715;</button>
      </div>
      <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {teamsForBowler.map(team => {
          const b = team.bowlers.find(b => b.id === selectedId)!;
          const nights = team.nightsMap[selectedId] ?? 0;
          const topPartners = team.pairs
            .filter(p => p.id1 === selectedId || p.id2 === selectedId)
            .sort((a, x) => x.coNights - a.coNights)
            .slice(0, 5)
            .map(p => {
              const partnerId = p.id1 === selectedId ? p.id2 : p.id1;
              const partner = team.bowlers.find(b => b.id === partnerId)!;
              return { name: partner.name, coNights: p.coNights };
            });
          return (
            <div key={team.title} style={{ minWidth: 180 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{team.title}</div>
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 8 }}>{nights} nights &bull; since {SEASON_LABELS[b.firstSeason]}</div>
              {topPartners.map((p, i) => (
                <div key={p.name} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ color: '#475569', fontSize: 11, width: 14, textAlign: 'right' }}>{i + 1}.</span>
                  <span style={{ color: '#cbd5e1', fontSize: 13 }}>{p.name}</span>
                  <span style={{ color: '#60a5fa', fontSize: 12, marginLeft: 'auto' }}>{p.coNights} nights</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function LineupsPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [sort, setSort] = useState<'firstSeason' | 'totalNights'>('firstSeason');
  return (
    <main style={{ minHeight: '100vh', background: '#0d1b2a', color: '#f8fafc', fontFamily: 'inherit' }}>
      <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid #132238' }}>
        <h1 style={{ fontSize: 38, fontWeight: 900, margin: '0 0 8px', lineHeight: 1.1 }}>Team Networks</h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0, maxWidth: 520 }}>
          Each bowler is a node, sized by number of league nights bowled. Color and thickness of arc between bowlers is how many nights bowled together. Hover over bowler to highlight connections, click to see details.
        </p>
      </div>

      <div style={{ padding: '16px 32px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {([['firstSeason', 'First Appearance'], ['totalNights', 'Total Nights']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setSort(val)} style={{ padding: '3px 12px', borderRadius: 20, border: '1px solid', borderColor: sort === val ? '#60a5fa' : '#1e3a5f', background: sort === val ? '#1e3a5f' : 'transparent', color: sort === val ? '#f8fafc' : '#64748b', fontSize: 11, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {selectedId !== null && <SharedPinPanel selectedId={selectedId} onClose={() => setSelectedId(null)} />}

        {ALL_TEAMS_VIZ.map((team, i) => (
          <div key={team.title} style={{ marginBottom: i === ALL_TEAMS_VIZ.length - 1 ? 48 : 0, borderTop: i === 0 ? 'none' : '1px solid #1e2d3d', marginTop: i === 0 ? 0 : 12, paddingTop: i === 0 ? 0 : 8 }}>
            <div style={{ overflowX: 'auto', paddingBottom: 0 }}>
              <ArcDiagram
                bowlers={team.bowlers}
                pairs={team.pairs}
                nightsMap={team.nightsMap}
                champCounts={team.champCounts}
                captainID={team.captainID}
                title={team.title}
                selectedId={selectedId}
                onSelect={setSelectedId}
                sort={sort}
                showLegend={i === 0}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 32px 56px' }}>
        <Link href="/lucky-strikes/lineups/top" style={{ display: 'inline-block', color: '#60a5fa', fontSize: 13, textDecoration: 'none', borderBottom: '1px solid #1e3a5f', paddingBottom: 1 }}>
          Top Lineups by Team &rarr;
        </Link>
      </div>
    </main>
  );
}
