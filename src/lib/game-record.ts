/**
 * Per-game win/loss/tie counting for a single matchup night, from each team's
 * per-game handicap totals. A game with a null on either side (unplayed) is skipped.
 */
export function countGames(
  ours: (number | null)[],
  theirs: (number | null)[],
): { w: number; l: number; t: number } {
  let w = 0, l = 0, t = 0;
  for (let i = 0; i < ours.length; i++) {
    const o = ours[i];
    const th = theirs[i];
    if (o == null || th == null) continue;
    if (o > th) w++;
    else if (o < th) l++;
    else t++;
  }
  return { w, l, t };
}

/** Format a night's game record as "W-L-T" (e.g. "2-1-0"). */
export function nightRecordStr(
  ours: (number | null)[],
  theirs: (number | null)[],
): string {
  const { w, l, t } = countGames(ours, theirs);
  return `${w}-${l}-${t}`;
}
