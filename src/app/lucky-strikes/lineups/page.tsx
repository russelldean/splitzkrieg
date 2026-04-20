'use client';

import { useState, useMemo } from 'react';
import { ALL_TEAMS_VIZ, type BowlerNode, type BowlerPair } from './teams-data';

const SEASON_LABELS: Record<number, string> = {
  1:"S'07",2:"F'08",3:"S'09",4:"F'09",5:"S'10",6:"F'10",7:"S'11",8:"F'11",
  9:"S'12",10:"F'12",11:"S'13",12:"F'13",13:"S'14",14:"F'14",15:"S'15",
  16:"F'15",17:"S'16",18:"F'16",19:"S'17",20:"F'17",21:"S'18",22:"F'18",
  23:"S'19",24:"F'19",25:"S'20",26:"F'21",27:"S'22",28:"F'22",29:"S'23",
  30:"F'23",31:"S'24",32:"F'24",33:"S'25",34:"F'25",35:"S'26",
};

type Lineup = {
  ids: number[];
  names: string[];
  active: boolean[];
  count: number;
  seasons: number[];
};

type TeamData = {
  name: string;
  totalNights: number;
  uniqueLineups: number;
  lineups: Lineup[];
};

const TEAMS: TeamData[] = [
  {
    name: 'Lucky Strikes',
    totalNights: 308,
    uniqueLineups: 107,
    lineups: [
      { ids:[326,391,483,548], names:["John Williams","Kyle Hanlin","Mirla del Rosario","Russ Dean"], active:[true,false,false,true], count:86, seasons:[1,2,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19] },
      { ids:[326,435,483,548], names:["John Williams","Martin Hall","Mirla del Rosario","Russ Dean"], active:[true,true,false,true], count:21, seasons:[14,15,16,17,20,21,22,24,25,26,27] },
      { ids:[121,225,435,548], names:["Christina Manzella","Geoffrey Berry","Martin Hall","Russ Dean"], active:[true,true,true,true], count:13, seasons:[32,33,34] },
    ],
  },
  {
    name: 'E-Bowla',
    totalNights: 307,
    uniqueLineups: 29,
    lineups: [
      { ids:[24,271,575,615], names:["Amy Kostrewa","James Hepler","Spott Philpott","Tracy Wills"], active:[true,true,true,true], count:207, seasons:[5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35] },
      { ids:[24,575,604,615], names:["Amy Kostrewa","Spott Philpott","Tim Ross","Tracy Wills"], active:[true,true,false,true], count:31, seasons:[2,3,4,7,8,9,10,12] },
      { ids:[24,135,575,615], names:["Amy Kostrewa","Cy Rawls","Spott Philpott","Tracy Wills"], active:[true,false,true,true], count:17, seasons:[1,2] },
    ],
  },
  {
    name: 'Thoughts and Spares',
    totalNights: 232,
    uniqueLineups: 66,
    lineups: [
      { ids:[282,345,496,508], names:["Jay Lowe","Justin Levens","Nick Cain","Patrick Nerz"], active:[false,false,false,false], count:40, seasons:[9,10,11,12,13] },
      { ids:[11,202,387,496], names:["Alex Rubenstein","Eric Thomas","Kristin Pearson","Nick Cain"], active:[true,true,true,false], count:31, seasons:[18,19,20,21,22,23,24,25,26,27,28,29] },
      { ids:[11,202,496,508], names:["Alex Rubenstein","Eric Thomas","Nick Cain","Patrick Nerz"], active:[true,true,false,false], count:14, seasons:[16,18,19,20,21,22,24,25,27] },
    ],
  },
];



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

function ArcDiagram({ bowlers, pairs, nightsMap, champCounts, title, selectedId, onSelect, sort }: {
  bowlers: BowlerNode[];
  pairs: BowlerPair[];
  nightsMap: Record<number, number>;
  champCounts: Record<number, number>;
  title: string;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  sort: 'firstSeason' | 'totalNights';
}) {
  const [hovNodeId, setHovNodeId] = useState<number | null>(null);
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
          <text x={AD_W / 2} y={16} textAnchor="middle" fontSize={13} fontWeight={700} fill="#475569" letterSpacing="0.08em">{title.toUpperCase()}</text>
          <line x1={AD_PAD} y1={AD_BASELINE} x2={AD_W - AD_PAD} y2={AD_BASELINE} stroke="#1e2d3d" strokeWidth={1} />

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
            return (
              <path
                key={key}
                d={`M ${x1},${AD_BASELINE} C ${x1},${AD_BASELINE - arcH} ${x2},${AD_BASELINE - arcH} ${x2},${AD_BASELINE}`}
                fill="none"
                stroke={heatColor(tSqrt)}
                strokeWidth={isConnected ? Math.max(1.5, tSqrt * 7) + 1 : Math.max(0.3, tSqrt * 6)}
                strokeOpacity={isDimmed ? 0.03 : isConnected ? 0.5 + t * 0.45 : 0.07 + t * 0.63}
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
            const labelColor = isSelected ? '#fbbf24' : isFocus ? '#f8fafc' : isConnected ? '#cbd5e1' : '#64748b';
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
                  <text x={0} y={0} transform={`translate(${x}, ${AD_BASELINE + r + 8}) rotate(45)`} textAnchor="start" fontSize={isSelected ? 13 : 11} fill={labelColor} fontWeight={isSelected ? 900 : isConnected || isFocus ? 700 : 400}>
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

        {hovNodeId !== null && selectedId === null && (() => {
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

const RANK_COLORS = ['#f59e0b', '#38bdf8', '#a78bfa'];

function TopLineups({ teams }: { teams: TeamData[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 40, alignItems: 'flex-start' }}>
      {teams.map(team => {
        const top3 = team.lineups.slice(0, 3);
        const maxNights = top3[0].count;
        return (
          <div key={team.name} style={{ flex: '1 1 260px', minWidth: 260 }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: '0 0 4px', color: '#f8fafc' }}>{team.name}</h2>
            <div style={{ color: '#475569', fontSize: 12, marginBottom: 20 }}>
              {team.totalNights} nights &bull; {team.uniqueLineups} unique lineups
            </div>
            {top3.map((lineup, i) => {
              const color = RANK_COLORS[i];
              const pct = Math.round(lineup.count / team.totalNights * 100);
              return (
                <div key={i} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
                    <span style={{ color, fontWeight: 900, fontSize: 13, minWidth: 24 }}>#{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      {lineup.names.map(name => (
                        <div key={name} style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>{name}</div>
                      ))}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ color, fontWeight: 700, fontSize: 18, lineHeight: 1 }}>{lineup.count}</div>
                      <div style={{ color: '#475569', fontSize: 11 }}>{pct}%</div>
                    </div>
                  </div>
                  <div style={{ height: 4, background: '#132238', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${lineup.count / maxNights * 100}%`, background: color, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
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
        <h1 style={{ fontSize: 38, fontWeight: 900, margin: '0 0 8px', lineHeight: 1.1 }}>Bowler Networks</h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0, maxWidth: 520 }}>
          Each node is a bowler. Size and arc thickness scale with nights bowled together. Hover to highlight connections, click to pin.
        </p>
      </div>

      <div style={{ padding: '16px 32px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {([['firstSeason', 'First Appearance'], ['totalNights', 'Total Nights']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setSort(val)} style={{ padding: '3px 12px', borderRadius: 20, border: '1px solid', borderColor: sort === val ? '#60a5fa' : '#1e3a5f', background: sort === val ? '#1e3a5f' : 'transparent', color: sort === val ? '#f8fafc' : '#64748b', fontSize: 11, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', fontSize: 11, color: '#475569' }}>
            <span>arc color: fewer</span>
            <div style={{ width: 60, height: 4, borderRadius: 3, background: `linear-gradient(to right, ${heatColor(0)}, ${heatColor(0.5)}, ${heatColor(1)})` }} />
            <span>more</span>
          </div>
        </div>

        {selectedId !== null && <SharedPinPanel selectedId={selectedId} onClose={() => setSelectedId(null)} />}

        {ALL_TEAMS_VIZ.map((team, i) => (
          <div key={team.title} style={{ marginBottom: i === ALL_TEAMS_VIZ.length - 1 ? 48 : 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <ArcDiagram
                bowlers={team.bowlers}
                pairs={team.pairs}
                nightsMap={team.nightsMap}
                champCounts={team.champCounts}
                title={team.title}
                selectedId={selectedId}
                onSelect={setSelectedId}
                sort={sort}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ padding: '0 32px 56px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px' }}>Top Lineups by Team</h2>
        <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 28px' }}>
          The three most-used four-bowler lineups. Bar length and percentage are relative to that team&apos;s top lineup.
        </p>
        <TopLineups teams={TEAMS} />
      </div>
    </main>
  );
}
