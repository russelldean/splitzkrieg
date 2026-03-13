export interface Update {
  date: string;
  text: string;
  tag: 'fix' | 'feat';
}

const updates: Update[] = [
  { date: '2026-03-12', text: 'Announcement banner for league-wide notices (snow makeups, etc.)', tag: 'feat' },
  { date: '2026-03-12', text: 'Photo headers on most index pages', tag: 'feat' },
  { date: '2026-03-11', text: 'Corrected 150+ historical average blips and recalculated affected stats', tag: 'fix' },
  { date: '2026-03-11', text: 'Added 300 game tooltip on Geoffrey Berry high game record', tag: 'feat' },
  { date: '2026-03-11', text: 'Fixed feedback button not clickable on desktop', tag: 'fix' },
  { date: '2026-03-11', text: 'Week 4 scores are live', tag: 'feat' },
  { date: '2026-03-11', text: 'Site Updates feed on the Resources page', tag: 'feat' },
  { date: '2026-03-11', text: 'Blog page with parallax hero and featured post card', tag: 'feat' },
  { date: '2026-03-10', text: 'Switched domain from splitzkrieg.org to splitzkrieg.com', tag: 'feat' },
];

export default updates;
