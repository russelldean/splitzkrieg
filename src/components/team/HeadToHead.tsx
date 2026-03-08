import { EmptyState } from '@/components/ui/EmptyState';
import { SectionHeading } from '@/components/ui/SectionHeading';

export function HeadToHead() {
  return (
    <section>
      <SectionHeading>Head-to-Head Records</SectionHeading>
      <EmptyState
        title="Coming soon"
        message="Head-to-head matchup records are being compiled from the league archives. This section will show win/loss records against every other team once the data is ready."
      />
    </section>
  );
}
