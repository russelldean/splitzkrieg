export interface Announcement {
  id: string;
  message: string;
  type: 'info' | 'urgent' | 'celebration';
  expires?: string; // YYYY-MM-DD — auto-hides after this date
}

const announcements: Announcement[] = [
  {
    id: 'makeup-2026-04-13',
    message: 'Snow makeup date scheduled for April 13th',
    type: 'info',
    expires: '2026-04-14',
  },
];

export default announcements;
