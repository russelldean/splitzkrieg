import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Hit the 10 Pin | Splitzkrieg',
  description: 'Can you knock down the last pin? A rigged bowling mini-game.',
};

export default function GameLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="fixed inset-0 w-screen bg-[#1a1a2e] overflow-hidden z-[100]" style={{ height: '100dvh' }}>
      <Link
        href="/"
        className="absolute top-3 left-3 z-50 text-white/60 hover:text-white/90 transition-colors font-heading text-xs tracking-widest"
      >
        SPLITZKRIEG
      </Link>
      {children}
    </div>
  );
}
