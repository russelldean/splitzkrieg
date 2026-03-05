import { EmptyState } from '@/components/ui/EmptyState';

export function HeadToHead() {
  return (
    <section>
      <h2 className="font-heading text-2xl text-navy mb-4">
        Head-to-Head Records
      </h2>
      <EmptyState
        title="Coming soon"
        message="Head-to-head matchup records are being compiled from the league archives. This section will show win/loss records against every other team once the data is ready."
      />
    </section>
  );
}
