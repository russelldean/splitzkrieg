export const dynamic = 'force-dynamic';

export default function LineupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-navy text-cream px-4 py-3">
        <h1 className="font-heading text-lg">Splitzkrieg Lineup</h1>
        <p className="font-body text-xs text-cream/50">
          Weekly lineup submission
        </p>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
