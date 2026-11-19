/**
 * Badge pill colors and labels. Lives outside PatchBadge (a client module) so
 * server components can read the values: a value imported from a 'use client'
 * file arrives on the server as a client reference, not the object.
 */
export const PATCH_CONFIG: Record<string, { label: string; abbr: string; color: string; bg: string }> = {
  perfectGame:    { label: 'Perfect Game',       abbr: '300',  color: 'text-amber-800',  bg: 'bg-amber-200' },
  botw:           { label: 'Bowler of the Week', abbr: 'BOTW', color: 'text-purple-700', bg: 'bg-purple-100' },
  highGame:       { label: 'Weekly High Game',   abbr: 'HG',   color: 'text-blue-700',   bg: 'bg-blue-100' },
  highSeries:     { label: 'Weekly High Series', abbr: 'HS',   color: 'text-emerald-700', bg: 'bg-emerald-100' },
  aboveAvg:         { label: 'Above Avg All 3',     abbr: '3/3',  color: 'text-teal-700',    bg: 'bg-teal-100' },
  threeOfAKind:     { label: 'Three of a Kind',    abbr: '3K',   color: 'text-pink-700',    bg: 'bg-pink-100' },
  playoff:          { label: 'Team Playoffs',      abbr: 'TP',   color: 'text-indigo-700',  bg: 'bg-indigo-100' },
  scratchPlayoff:   { label: 'Scratch Playoffs',   abbr: 'SP',   color: 'text-rose-700',    bg: 'bg-rose-100' },
  hcpPlayoff:       { label: 'Handicap Playoffs',  abbr: 'HP',   color: 'text-orange-700',  bg: 'bg-orange-100' },
  champion:         { label: 'Champion',            abbr: '\uD83C\uDFC6',  color: 'text-amber-700',   bg: 'bg-amber-100' },
  scratchChampion:  { label: 'Scratch Champion',    abbr: 'SC',   color: 'text-rose-700',    bg: 'bg-rose-200' },
  hcpChampion:      { label: 'Handicap Champion',   abbr: 'HC',   color: 'text-orange-700',  bg: 'bg-orange-200' },
  turkeyTrophy:     { label: 'Turkey Trophy',       abbr: '🦃', color: 'text-lime-800', bg: 'bg-lime-100' },
  attendance:      { label: 'Like Clockwork', abbr: '\uD83D\uDD52', color: 'text-sky-700', bg: 'bg-sky-100' },
  captain:          { label: 'Team Captain',   abbr: '\u2693', color: 'text-navy', bg: 'bg-navy/10' },
  // Not patches. Career highs are derived from the scores themselves, but they
  // read as badges in the game log and used to render as full sentences
  // ("Career high game + series") that crowded the season header. Routing them
  // through here buys the same pill and the same hover label as everything else.
  careerHighGame:   { label: 'Career High Game',    abbr: 'CHG',  color: 'text-amber-800',   bg: 'bg-amber-100' },
  careerHighSeries: { label: 'Career High Series',  abbr: 'CHS',  color: 'text-amber-800',   bg: 'bg-amber-100' },
};
