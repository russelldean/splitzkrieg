/**
 * Score validation rules for the admin pipeline.
 * Returns non-blocking warnings for display in the review UI.
 */

import type { StagedMatch, ValidationWarning } from './types';

/**
 * Validate staged scores and return warnings.
 * Warnings are informational only and never block confirmation.
 */
export function validateScores(matches: StagedMatch[]): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  for (const match of matches) {
    // Track bowlerIDs per match for duplicate detection
    const seenBowlerIDs = new Set<number>();

    for (const bowler of match.bowlers) {
      // Skip validation for penalty rows
      if (bowler.isPenalty) continue;

      const games = [bowler.game1, bowler.game2, bowler.game3];

      for (let i = 0; i < games.length; i++) {
        const score = games[i];
        if (score == null) continue;

        const gameLabel = `game${i + 1}`;

        // Score > 280 = warning
        if (score > 280) {
          warnings.push({
            bowlerID: bowler.bowlerID,
            bowlerName: bowler.bowlerName,
            field: gameLabel,
            message: `${bowler.bowlerName} has a ${score} in Game ${i + 1} (unusually high)`,
            severity: 'warning',
          });
        }

        // Score < 50 = warning
        if (score < 50 && score > 0) {
          warnings.push({
            bowlerID: bowler.bowlerID,
            bowlerName: bowler.bowlerName,
            field: gameLabel,
            message: `${bowler.bowlerName} has a ${score} in Game ${i + 1} (unusually low)`,
            severity: 'warning',
          });
        }

        // Score deviates > 80 pins from avg = info
        if (bowler.incomingAvg != null && bowler.incomingAvg > 0) {
          const deviation = Math.abs(score - bowler.incomingAvg);
          if (deviation > 80) {
            const direction = score > bowler.incomingAvg ? 'above' : 'below';
            warnings.push({
              bowlerID: bowler.bowlerID,
              bowlerName: bowler.bowlerName,
              field: gameLabel,
              message: `${bowler.bowlerName} Game ${i + 1} (${score}) is ${deviation} pins ${direction} average (${bowler.incomingAvg})`,
              severity: 'info',
            });
          }
        }
      }

      // Duplicate bowlerID in same match = warning
      if (bowler.bowlerID != null) {
        if (seenBowlerIDs.has(bowler.bowlerID)) {
          warnings.push({
            bowlerID: bowler.bowlerID,
            bowlerName: bowler.bowlerName,
            field: 'bowlerID',
            message: `${bowler.bowlerName} appears multiple times in this match`,
            severity: 'warning',
          });
        }
        seenBowlerIDs.add(bowler.bowlerID);
      }
    }
  }

  return warnings;
}
