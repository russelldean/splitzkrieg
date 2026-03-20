'use client';

import { useState, useEffect, useRef } from 'react';

interface WinCelebrationProps {
  attemptCount: number;
  onNameSubmit: (name: string) => void;
  onSkip: () => void;
}

// Generate confetti pieces with random properties
function generateConfetti(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random() * 2,
    rotation: Math.random() * 720 - 360,
    color: ['#FFD700', '#FF4444', '#FFFFFF', '#FF6B00', '#FFE066'][Math.floor(Math.random() * 5)],
    size: 4 + Math.random() * 8,
  }));
}

export function WinCelebration({ attemptCount, onNameSubmit, onSkip }: WinCelebrationProps) {
  const [textIndex, setTextIndex] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [shake, setShake] = useState(true);
  const confettiRef = useRef(generateConfetti(60));
  const inputRef = useRef<HTMLInputElement>(null);

  // Disbelief text sequence
  const textSequence = [
    'WAIT...',
    'DID YOU JUST...?!',
    'YOU HIT THE 10 PIN!',
    `1 of ? humans to ever do this`,
  ];

  useEffect(() => {
    // Screen shake for 0.5s
    const shakeTimer = setTimeout(() => setShake(false), 500);

    // Text sequence timing
    const timers = [
      setTimeout(() => setTextIndex(1), 500),
      setTimeout(() => setTextIndex(2), 1500),
      setTimeout(() => setTextIndex(3), 2500),
      setTimeout(() => {
        setShowForm(true);
        // Focus input after form appears
        setTimeout(() => inputRef.current?.focus(), 100);
      }, 3500),
    ];

    return () => {
      clearTimeout(shakeTimer);
      timers.forEach(clearTimeout);
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length > 0 && trimmed.length <= 50) {
      onNameSubmit(trimmed);
    }
  };

  return (
    <div
      className={`absolute inset-0 z-30 flex items-center justify-center overflow-hidden bg-black/80 ${
        shake ? 'animate-screen-shake' : ''
      }`}
    >
      {/* Confetti */}
      {confettiRef.current.map(piece => (
        <div
          key={piece.id}
          className="pointer-events-none absolute top-0 animate-confetti-fall"
          style={{
            left: `${piece.left}%`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            width: piece.size,
            height: piece.size * 1.5,
            backgroundColor: piece.color,
            transform: `rotate(${piece.rotation}deg)`,
          }}
        />
      ))}

      {/* Content */}
      <div className="relative z-10 w-full max-w-sm px-6 text-center">
        {/* Disbelief text */}
        <div className="mb-8">
          <h2
            className={`text-3xl font-black transition-all duration-300 ${
              textIndex >= 2 ? 'text-amber-400' : 'text-white'
            }`}
          >
            {textSequence[textIndex]}
          </h2>
        </div>

        {/* Name form */}
        {showForm && (
          <div className="animate-fade-in">
            <p className="mb-4 text-sm text-white/70">
              Enter your name for the Hall of Fame
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={e => setName(e.target.value.slice(0, 50))}
                maxLength={50}
                placeholder="Your name"
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-center text-white placeholder-white/30 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/30"
              />
              <button
                type="submit"
                disabled={name.trim().length === 0}
                className="w-full rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold text-[#1a1a2e] transition-colors hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Submit
              </button>
              <button
                type="button"
                onClick={onSkip}
                className="w-full px-4 py-2 text-sm text-white/40 transition-colors hover:text-white/70"
              >
                Skip
              </button>
            </form>
          </div>
        )}
      </div>

      {/* CSS animations via style tag */}
      <style jsx>{`
        @keyframes screen-shake {
          0%, 100% { transform: translateX(0); }
          10% { transform: translateX(-10px); }
          30% { transform: translateX(10px); }
          50% { transform: translateX(-8px); }
          70% { transform: translateX(8px); }
          90% { transform: translateX(-4px); }
        }
        @keyframes confetti-fall {
          0% {
            transform: translateY(-10px) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-screen-shake {
          animation: screen-shake 0.5s ease-in-out;
        }
        .animate-confetti-fall {
          animation: confetti-fall 2s ease-in forwards;
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
