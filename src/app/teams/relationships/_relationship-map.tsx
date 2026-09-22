'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

// Styled to match Team Networks (/teams/network) so the loader sells it.
const STEPS = [
  'Loading 36 seasons of bowlers...',
  'Cross-referencing marriages...',
  'Cross-referencing divorces...',
  'Indexing confirmed hookups...',
  'Indexing unconfirmed hookups...',
  'Consulting text chains...',
  'Querying relationship data tables...',
];
const STEP_MS = 3600;
const EMOJI = ['\u{1F48D}', '\u{1F389}', '\u{1F942}', '\u{1F492}', '\u{1F38A}', '\u{1F470}', '\u{1F935}', '\u{2764}\u{FE0F}'];

// Fixed pseudo-random layout: pure, so render stays pure and SSR-safe.
const rand = (i: number, k: number) => {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const DROPS = Array.from({ length: 40 }, (_, i) => ({
  emoji: EMOJI[i % EMOJI.length],
  left: rand(i, 1) * 100,
  delay: rand(i, 2) * 4,
  duration: 4 + rand(i, 3) * 4,
  size: 22 + rand(i, 4) * 22,
  spin: `${rand(i, 5) > 0.5 ? '' : '-'}${180 + Math.round(rand(i, 6) * 360)}deg`,
}));

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
          Every marriage, divorce and ‘less official’ relationship in league history. Each bowler is a node. Hover over a
          bowler to see who they have been with, click the name of the bowler for their full story.
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
              I did not build that.
            </p>
            <p
              style={{
                fontSize: 'clamp(40px, 8vw, 72px)', fontWeight: 900, lineHeight: 1.05, margin: '12px 0 32px',
                color: '#fbbf24', textShadow: '0 0 24px rgba(251, 191, 36, 0.45)',
              }}
            >
              Congratulations Martin Hall!!!!!
            </p>
            <Link href="/" prefetch={false} style={{ color: '#60a5fa', fontSize: 14, textDecoration: 'underline' }}>
              Back to Splitzkrieg
            </Link>
          </>
        )}
      </div>

      {done && (
        <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {DROPS.map((d, i) => (
            <span
              key={i}
              style={{
                position: 'absolute', top: 0, left: `${d.left}%`, fontSize: d.size,
                animation: `emoji-fall ${d.duration}s linear ${d.delay}s infinite both`,
                ['--spin' as string]: d.spin,
              }}
            >
              {d.emoji}
            </span>
          ))}
        </div>
      )}
    </main>
  );
}
