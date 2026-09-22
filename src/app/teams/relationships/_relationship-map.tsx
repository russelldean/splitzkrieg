'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Styled to match Team Networks (/teams/network) so the loader sells it.
const STEPS = [
  'Loading 36 seasons of bowlers...',
  'Cross-referencing marriages...',
  'Cross-referencing divorces...',
  'Indexing hookups, Season 1 to present...',
  'Consulting text chains...',
  'Cross-referencing parking lot footage...',
];
const STEP_MS = 2000;

export function RelationshipMap() {
  const [step, setStep] = useState(0);
  const done = step >= STEPS.length;

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setStep(s => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step, done]);

  return (
    <main style={{ minHeight: '100vh', background: '#0d1b2a', color: '#f8fafc', fontFamily: 'inherit' }}>
      <div style={{ padding: '28px 32px 20px', borderBottom: '1px solid #132238' }}>
        <h1 style={{ fontSize: 38, fontWeight: 900, margin: '0 0 8px', lineHeight: 1.1 }}>Relationship Map</h1>
        <p style={{ color: '#94a3b8', fontSize: 14, margin: 0, maxWidth: 520 }}>
          Every marriage, divorce and hookup in league history. Each bowler is a node. Hover over a
          bowler to see who they have been with, click for the full story.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '32px 16px', textAlign: 'center' }}>
        {!done ? (
          <>
            <div
              className="animate-spin"
              style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid #1e3a5f', borderTopColor: '#60a5fa', marginBottom: 20 }}
            />
            <p style={{ color: '#94a3b8', fontSize: 15, margin: 0 }}>{STEPS[step]}</p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.2, margin: '0 0 16px', maxWidth: 640 }}>
              Did you really think that I built that?
            </p>
            <p style={{ color: '#94a3b8', fontSize: 15, margin: '0 0 28px' }}>
              Congratulations, Martin.
            </p>
            <Link href="/" prefetch={false} style={{ color: '#60a5fa', fontSize: 14, textDecoration: 'underline' }}>
              Back to Splitzkrieg
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
