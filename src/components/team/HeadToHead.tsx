import { EmptyState } from '@/components/ui/EmptyState';

export function HeadToHead() {
  return (
    <section>
      <h2 className="font-heading text-2xl text-navy mb-4">Head-to-Head Records</h2>
      <EmptyState
        title="Someone is currently looking through the file cabinets to find this data."
        message="Check back in a month."
      />
    </section>
  );
}
