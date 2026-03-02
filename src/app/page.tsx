import { EmptyState } from "@/components/ui/EmptyState";

export default function Home() {
  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="flex flex-col items-center text-center gap-6">
          <h1 className="font-heading text-4xl sm:text-5xl text-navy uppercase tracking-widest">
            SPLITZKRIEG
          </h1>
          <p className="font-body text-lg text-navy/60 max-w-md">
            Bowling League Stats &amp; History
          </p>
          <div className="mt-8 w-full max-w-lg">
            <EmptyState
              title="Coming Soon"
              message="Stats, records, and 18 years of league history — all coming soon. Since 2007."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
