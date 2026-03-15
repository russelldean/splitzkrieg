import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

export default async function LineupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('lineup-token')?.value;

  if (!token) {
    redirect('/lineup/login?expired=1');
  }

  const payload = await verifyToken(token);
  if (!payload || payload.role !== 'captain') {
    redirect('/lineup/login?expired=1');
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-navy text-cream px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-lg">Splitzkrieg Lineup</h1>
          <p className="font-body text-xs text-cream/50">
            {payload.captainName || 'Captain'}
          </p>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
