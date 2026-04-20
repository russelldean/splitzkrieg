import Link from 'next/link';
import { ALL_TOP_LINEUPS, type TopTeamData } from './top-lineups-data';

const RANK_COLORS = ['#f59e0b', '#38bdf8', '#a78bfa'];

function TopLineups({ teams }: { teams: TopTeamData[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '40px 48px' }}>
      {teams.map(team => {
        const top3 = team.lineups.slice(0, 3);
        const maxNights = top3[0]?.count ?? 1;
        return (
          <div key={team.name}>
            <h2 style={{ fontSize: 16, fontWeight: 900, margin: '0 0 3px', color: '#f8fafc' }}>{team.name}</h2>
            <div style={{ color: '#475569', fontSize: 12, marginBottom: 18 }}>
              {team.totalNights} nights &bull; {team.uniqueLineups} unique lineups
            </div>
            {top3.map((lineup, i) => {
              const color = RANK_COLORS[i];
              const pct = Math.round(lineup.count / team.totalNights * 100);
              return (
                <div key={i} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                    <span style={{ color, fontWeight: 900, fontSize: 12, minWidth: 22 }}>#{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      {lineup.names.map(name => (
                        <div key={name} style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.5 }}>{name}</div>
                      ))}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ color, fontWeight: 700, fontSize: 17, lineHeight: 1 }}>{lineup.count}</div>
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

export default function TopLineupsPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#0d1b2a', color: '#f8fafc', fontFamily: 'inherit' }}>
      <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid #132238' }}>
        <div style={{ marginBottom: 12 }}>
          <Link href="/lucky-strikes/lineups" style={{ color: '#475569', fontSize: 12, textDecoration: 'none', letterSpacing: '0.04em' }}>
            &larr; Bowler Networks
          </Link>
        </div>
        <h1 style={{ fontSize: 38, fontWeight: 900, margin: '0 0 8px', lineHeight: 1.1 }}>Top Lineups</h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0, maxWidth: 520 }}>
          The three most-used four-bowler lineups per team. Bar length and percentage are relative to that team&apos;s top lineup.
        </p>
      </div>

      <div style={{ padding: '32px 32px 56px' }}>
        <TopLineups teams={ALL_TOP_LINEUPS} />
      </div>
    </main>
  );
}
