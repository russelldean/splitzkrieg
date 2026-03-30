import { LeagueHeatCheck } from '@/components/season/LeagueHeatCheck';
import { MiniHeatCheck } from '@/components/season/MiniHeatCheck';

/**
 * Preview page showing the heat check card at every tier.
 * Visit /heat-check-preview to see them all.
 */

const SAMPLES = [
  { label: 'Scorching (+6.2)', pinsOver: 6.2, avg: 139.8, exp: 133.6 },
  { label: 'Hot (+3.8)', pinsOver: 3.8, avg: 142.5, exp: 138.7 },
  { label: 'Toasty (+2.2)', pinsOver: 2.2, avg: 140.2, exp: 138.0 },
  { label: 'Mild (+1.3)', pinsOver: 1.3, avg: 138.6, exp: 137.3 },
  { label: 'Breezy (-0.5)', pinsOver: -0.5, avg: 138.2, exp: 138.7 },
  { label: 'Cool (-1.5)', pinsOver: -1.5, avg: 135.8, exp: 137.3 },
  { label: 'Frigid (-3.8)', pinsOver: -3.8, avg: 135.0, exp: 138.8 },
  { label: 'Frozen (-8.2)', pinsOver: -8.2, avg: 131.6, exp: 139.8 },
];

export default function HeatCheckPreview() {
  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="font-heading text-3xl text-navy mb-2">League Heat Check Preview</h1>
      <p className="font-body text-sm text-navy/60 mb-8">All 8 tiers with real historical examples</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left: Horizontal (week page) */}
        <div>
          <h2 className="font-heading text-lg text-navy mb-4">Week Page (horizontal)</h2>
          <div className="space-y-4">
            {SAMPLES.map((s) => (
              <div key={s.label}>
                <div className="text-xs font-body text-navy/40 mb-1 ml-1">{s.label}</div>
                <LeagueHeatCheck
                  pinsOverPerGame={s.pinsOver}
                  leagueAvg={s.avg}
                  expectedAvg={s.exp}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right: Vertical mini (home page) */}
        <div>
          <h2 className="font-heading text-lg text-navy mb-4">Home Page (mini vertical)</h2>
          <div className="space-y-6">
            {SAMPLES.map((s) => (
              <div key={s.label} className="bg-white border border-navy/10 rounded-lg p-4 shadow-sm">
                <div className="text-xs font-body text-navy/40 mb-3">{s.label}</div>
                <MiniHeatCheck
                  pinsOverPerGame={s.pinsOver}
                  leagueAvg={s.avg}
                  expectedAvg={s.exp}
                  bowlerCount={80}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
