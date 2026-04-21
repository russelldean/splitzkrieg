'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ALL_HIST_TEAMS_VIZ, ALL_TEAMS_VIZ } from '../teams-data';
import { ArcDiagram } from '../_arc-diagram';

const HIST_MAX_NIGHTS = Math.max(1, ...ALL_HIST_TEAMS_VIZ.flatMap(t => Object.values(t.nightsMap)));
const ALL_TEAMS_FOR_PANEL = [...ALL_TEAMS_VIZ, ...ALL_HIST_TEAMS_VIZ];

export default function HistoricalTeamsPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [sort, setSort] = useState<'firstSeason' | 'totalNights'>('firstSeason');
  function handleSelect(id: number | null, team: string | null) { setSelectedId(id); setSelectedTeam(team); }

  return (
    <main style={{ minHeight: '100vh', background: '#0d1b2a', color: '#f8fafc', fontFamily: 'inherit' }}>
      <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid #132238' }}>
        <div style={{ marginBottom: 12 }}>
          <Link href="/lucky-strikes/lineups" style={{ color: '#60a5fa', fontSize: 12, textDecoration: 'none', letterSpacing: '0.04em' }}>
            &larr; Team Networks
          </Link>
        </div>
        <h1 style={{ fontSize: 38, fontWeight: 900, margin: '0 0 8px', lineHeight: 1.1 }}>Historical Teams</h1>
        <p style={{ color: '#94a3b8', fontSize: 14, margin: 0, maxWidth: 520 }}>
          Teams that have since disbanded or merged. Click a bowler to see their full history across all teams.
        </p>
      </div>

      <div style={{ padding: '16px 32px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {([['firstSeason', 'First Appearance'], ['totalNights', 'Total Nights']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setSort(val)} style={{ padding: '3px 12px', borderRadius: 20, border: '1px solid', borderColor: sort === val ? '#60a5fa' : '#1e3a5f', background: sort === val ? '#1e3a5f' : 'transparent', color: sort === val ? '#f8fafc' : '#94a3b8', fontSize: 11, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {ALL_HIST_TEAMS_VIZ.map((team, i) => (
          <div key={team.title} style={{ marginBottom: i === ALL_HIST_TEAMS_VIZ.length - 1 ? 48 : 0, borderTop: i === 0 ? 'none' : '1px solid #1e2d3d', marginTop: i === 0 ? 0 : 12, paddingTop: i === 0 ? 0 : 8 }}>
            <div style={{ overflowX: 'auto' }}>
              <ArcDiagram
                bowlers={team.bowlers}
                pairs={team.pairs}
                nightsMap={team.nightsMap}
                champCounts={team.champCounts}
                captainID={team.captainID}
                title={team.title}
                selectedId={selectedId}
                selectedTeam={selectedTeam}
                onSelect={handleSelect}
                sort={sort}
                showLegend={i === 0}
                maxNights={HIST_MAX_NIGHTS}
                allTeamsForPanel={ALL_TEAMS_FOR_PANEL}
              />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
