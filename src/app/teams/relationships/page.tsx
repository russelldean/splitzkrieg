import type { Metadata } from 'next';
import { RelationshipMap } from './_relationship-map';

// A joke from the S36 week 6 writeup (Martin Hall's wedding). There is no map.
export const metadata: Metadata = {
  title: 'Relationship Map',
  robots: { index: false, follow: false },
};

export default function RelationshipsPage() {
  return <RelationshipMap />;
}
