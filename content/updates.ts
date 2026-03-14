export interface Update {
  date: string;
  text: string;
  tag: 'fix' | 'feat';
}

// Last updated: 2026-03-14T21:00:00-04:00
// Search git log --after this timestamp for new entries next time
export const lastUpdated = '2026-03-14';

const updates: Update[] = [
  { date: '2026-03-14', text: 'Trophy icons next to individual champions in season stats and leaderboards', tag: 'feat' },
  { date: '2026-03-14', text: 'Playoff head-to-head section on team pages with lifetime totals', tag: 'feat' },
  { date: '2026-03-14', text: 'Corrected cross-division semifinal matchups for Seasons XVIII-XXII', tag: 'fix' },
  { date: '2026-03-14', text: 'All 35 seasons now have complete schedule data', tag: 'feat' },
  { date: '2026-03-13', text: 'Ghost team forfeit scoring now displays correctly across all components', tag: 'fix' },
  { date: '2026-03-13', text: 'Added Season notes documenting known data gaps and quirks for all seasons', tag: 'feat' },
  { date: '2026-03-13', text: 'Collapsible season accordion on weeks page', tag: 'feat' },
  { date: '2026-03-13', text: 'League Timeline sorted by team debut order', tag: 'feat' },
  { date: '2026-03-12', text: 'W-L-T record now shows on team cards', tag: 'feat' },
  { date: '2026-03-12', text: 'Bowler debut order shown in ticker', tag: 'feat' },
  { date: '2026-03-12', text: 'Search now finds both bowlers and teams', tag: 'feat' },
  { date: '2026-03-12', text: 'Season XXV, XVII, XVI schedule data and cascading stats updated', tag: 'feat' },
  { date: '2026-03-12', text: 'Announcement banner for league-wide notices (snow makeups, etc.)', tag: 'feat' },
  { date: '2026-03-12', text: 'Added share button to average progression chart', tag: 'feat' },
  { date: '2026-03-12', text: 'Photo headers on most index pages', tag: 'feat' },
  { date: '2026-03-11', text: 'Corrected 150+ historical average blips and recalculated affected stats', tag: 'fix' },
  { date: '2026-03-11', text: 'Added three ??? to user profiles', tag: 'feat' },
  { date: '2026-03-11', text: 'Fixed feedback button not clickable on desktop', tag: 'fix' },
  { date: '2026-03-11', text: 'Week 4 scores are live', tag: 'feat' },
  { date: '2026-03-11', text: 'Site Updates feed on the Resources page', tag: 'feat' },
  { date: '2026-03-11', text: 'Blog page and featured post card', tag: 'feat' },
  { date: '2026-03-10', text: 'Switched domain from splitzkrieg.org to splitzkrieg.com', tag: 'feat' },
];

export default updates;
