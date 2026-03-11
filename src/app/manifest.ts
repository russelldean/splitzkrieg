import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Splitzkrieg Bowling League',
    short_name: 'Splitzkrieg',
    description: 'Stats, records, and history for the Splitzkrieg Bowling League. Since 2007.',
    start_url: '/',
    display: 'browser',
  };
}
