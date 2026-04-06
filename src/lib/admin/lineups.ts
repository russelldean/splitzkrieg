/**
 * Lineup CRUD and LeaguePals push logic.
 * Handles captain lineup submissions, admin management, and LP integration.
 */

import { getDb } from '@/lib/db';
import type { LineupEntry, LineupSubmission } from './types';

/**
 * Get all bowlers for the captain bowler picker.
 * Splits bowlerName into firstName/lastName for the UI.
 */
export async function getAllBowlers(): Promise<
  Array<{ bowlerID: number; firstName: string; lastName: string }>
> {
  const db = await getDb();
  const result = await db.request().query<{
    bowlerID: number;
    bowlerName: string;
  }>(`SELECT bowlerID, bowlerName FROM bowlers WHERE isEligible = 1 ORDER BY bowlerName`);
  return result.recordset.map((r) => {
    const parts = r.bowlerName.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';
    return { bowlerID: r.bowlerID, firstName, lastName };
  });
}

/**
 * Get bowlerIDs from the current or previous season for a team.
 * These are the bowlers shown by default in the lineup picker.
 */
export async function getRecentRoster(
  teamID: number,
  seasonID: number,
): Promise<number[]> {
  const db = await getDb();
  const prevSeasonID = seasonID - 1;
  const result = await db
    .request()
    .input('teamID', teamID)
    .input('seasonID', seasonID)
    .input('prevSeasonID', prevSeasonID)
    .query<{ bowlerID: number }>(
      `SELECT DISTINCT s.bowlerID
       FROM scores s
       WHERE s.teamID = @teamID AND s.seasonID IN (@seasonID, @prevSeasonID) AND s.isPenalty = 0
       UNION
       SELECT bowlerID FROM bowlers WHERE bowlerName = 'Penalty'`,
    );
  return result.recordset.map((r) => r.bowlerID);
}

/**
 * Submit a lineup for a team/season/week.
 * If a submission already exists for this team/season/week, replaces it.
 * Returns the new submission ID.
 */
export async function submitLineup(
  seasonID: number,
  week: number,
  teamID: number,
  submittedBy: string,
  entries: Array<{
    position: number;
    bowlerID: number | null;
    newBowlerName: string | null;
  }>,
): Promise<number> {
  const db = await getDb();
  const transaction = db.transaction();
  await transaction.begin();

  try {
    // Delete existing submission for this team/season/week
    const existingResult = await transaction
      .request()
      .input('seasonID', seasonID)
      .input('week', week)
      .input('teamID', teamID)
      .query<{ id: number }>(
        `SELECT id FROM lineupSubmissions WHERE seasonID = @seasonID AND week = @week AND teamID = @teamID`,
      );

    if (existingResult.recordset.length > 0) {
      const existingID = existingResult.recordset[0].id;
      await transaction
        .request()
        .input('submissionID', existingID)
        .query(`DELETE FROM lineupEntries WHERE submissionID = @submissionID`);
      await transaction
        .request()
        .input('id', existingID)
        .query(`DELETE FROM lineupSubmissions WHERE id = @id`);
    }

    // Insert new submission
    const insertResult = await transaction
      .request()
      .input('seasonID', seasonID)
      .input('week', week)
      .input('teamID', teamID)
      .input('submittedBy', submittedBy)
      .query<{ id: number }>(
        `INSERT INTO lineupSubmissions (seasonID, week, teamID, submittedBy, submittedAt, status)
         VALUES (@seasonID, @week, @teamID, @submittedBy, GETDATE(), 'submitted');
         SELECT SCOPE_IDENTITY() AS id`,
      );

    const submissionID = insertResult.recordset[0].id;

    // Insert entries
    for (const entry of entries) {
      await transaction
        .request()
        .input('submissionID', submissionID)
        .input('position', entry.position)
        .input('bowlerID', entry.bowlerID)
        .input('newBowlerName', entry.newBowlerName)
        .query(
          `INSERT INTO lineupEntries (submissionID, position, bowlerID, newBowlerName)
           VALUES (@submissionID, @position, @bowlerID, @newBowlerName)`,
        );
    }

    await transaction.commit();
    return submissionID;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Get all lineup submissions for a season/week, with entries and team names.
 */
export async function getLineups(
  seasonID: number,
  week: number,
): Promise<LineupSubmission[]> {
  const db = await getDb();
  const result = await db
    .request()
    .input('seasonID', seasonID)
    .input('week', week)
    .query<{
      id: number;
      seasonID: number;
      week: number;
      teamID: number;
      teamName: string;
      submittedBy: string | null;
      submittedAt: string;
      status: 'submitted' | 'edited' | 'pushed';
    }>(
      `SELECT ls.id, ls.seasonID, ls.week, ls.teamID, t.teamName,
              ls.submittedBy, ls.submittedAt, ls.status
       FROM lineupSubmissions ls
       JOIN teams t ON ls.teamID = t.teamID
       WHERE ls.seasonID = @seasonID AND ls.week = @week
       ORDER BY t.teamName`,
    );

  const submissions: LineupSubmission[] = [];

  for (const row of result.recordset) {
    const entriesResult = await db
      .request()
      .input('submissionID', row.id)
      .query<{
        id: number;
        submissionID: number;
        position: number;
        bowlerID: number | null;
        newBowlerName: string | null;
        bowlerName: string | null;
      }>(
        `SELECT le.id, le.submissionID, le.position, le.bowlerID, le.newBowlerName,
                b.bowlerName
         FROM lineupEntries le
         LEFT JOIN bowlers b ON le.bowlerID = b.bowlerID
         WHERE le.submissionID = @submissionID
         ORDER BY le.position`,
      );

    const entries: LineupEntry[] = entriesResult.recordset.map((e) => ({
      id: e.id,
      submissionID: e.submissionID,
      position: e.position,
      bowlerID: e.bowlerID,
      newBowlerName: e.newBowlerName,
      bowlerName: e.bowlerID
        ? e.bowlerName || undefined
        : e.newBowlerName || undefined,
    }));

    submissions.push({
      id: row.id,
      seasonID: row.seasonID,
      week: row.week,
      teamID: row.teamID,
      teamName: row.teamName,
      submittedBy: row.submittedBy,
      submittedAt: row.submittedAt,
      status: row.status,
      entries,
    });
  }

  return submissions;
}

/**
 * Admin edit of a lineup submission. Updates entries and sets status to 'edited'.
 */
export async function editLineup(
  submissionID: number,
  entries: Array<{
    position: number;
    bowlerID: number | null;
    newBowlerName: string | null;
  }>,
): Promise<void> {
  const db = await getDb();
  const transaction = db.transaction();
  await transaction.begin();

  try {
    // Delete existing entries
    await transaction
      .request()
      .input('submissionID', submissionID)
      .query(`DELETE FROM lineupEntries WHERE submissionID = @submissionID`);

    // Insert updated entries
    for (const entry of entries) {
      await transaction
        .request()
        .input('submissionID', submissionID)
        .input('position', entry.position)
        .input('bowlerID', entry.bowlerID)
        .input('newBowlerName', entry.newBowlerName)
        .query(
          `INSERT INTO lineupEntries (submissionID, position, bowlerID, newBowlerName)
           VALUES (@submissionID, @position, @bowlerID, @newBowlerName)`,
        );
    }

    // Update status
    await transaction
      .request()
      .input('submissionID', submissionID)
      .query(
        `UPDATE lineupSubmissions SET status = 'edited' WHERE id = @submissionID`,
      );

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Get the most recent lineup for pre-fill.
 * Checks the current week first (so resubmits pre-fill with what you already sent),
 * then falls back to the most recent prior week.
 */
export async function getLastWeekLineup(
  teamID: number,
  seasonID: number,
  currentWeek: number,
): Promise<LineupEntry[]> {
  const db = await getDb();

  // Check current week first, then fall back to most recent prior week
  const subResult = await db
    .request()
    .input('teamID', teamID)
    .input('seasonID', seasonID)
    .input('currentWeek', currentWeek)
    .query<{ id: number }>(
      `SELECT TOP 1 id FROM lineupSubmissions
       WHERE teamID = @teamID AND seasonID = @seasonID AND week <= @currentWeek
       ORDER BY week DESC`,
    );

  if (subResult.recordset.length === 0) return [];

  const submissionID = subResult.recordset[0].id;

  const entriesResult = await db
    .request()
    .input('submissionID', submissionID)
    .query<{
      id: number;
      submissionID: number;
      position: number;
      bowlerID: number | null;
      newBowlerName: string | null;
      bowlerName: string | null;
    }>(
      `SELECT le.id, le.submissionID, le.position, le.bowlerID, le.newBowlerName,
              b.bowlerName
       FROM lineupEntries le
       LEFT JOIN bowlers b ON le.bowlerID = b.bowlerID
       WHERE le.submissionID = @submissionID
       ORDER BY le.position`,
    );

  return entriesResult.recordset.map((e) => ({
    id: e.id,
    submissionID: e.submissionID,
    position: e.position,
    bowlerID: e.bowlerID,
    newBowlerName: e.newBowlerName,
    bowlerName: e.bowlerID
      ? e.bowlerName || undefined
      : e.newBowlerName || undefined,
  }));
}

// ── LeaguePals team ID mapping ──────────────────────────────────────────────

const LP_TEAM_MAP: Record<string, string> = {
  'Alley Oops': '696e614e3d649815687f7935',
  'Bowl Durham': '696e61603d649815687f7a3a',
  'E-Bowla': '696e61483d649815687f78e1',
  'Fancy Pants': '696e614f3d649815687f794d',
  "Grandma's Teeth": '696e613d3d649815687f782b',
  'Gutterglory': '696e61583d649815687f79cb',
  'Guttermouths': '696e61493d649815687f78f9',
  'Guttersnipes': '696e613e3d649815687f7843',
  'HOT FUN': '696e61413d649815687f7867',
  'Hot Shotz': '696e61513d649815687f7968',
  'Living on a Spare': '696e615e3d649815687f7a1c',
  'Lucky Strikes': '696e61463d649815687f78bb',
  'Pin-Ups': '696e614b3d649815687f7917',
  'Smoke-A-Bowl': '696e61533d649815687f7989',
  'Smoke-a-Bowl': '696e61533d649815687f7989',
  'Sparadigm Shift': '696e61643d649815687f7a6d',
  'Stinky Cheese': '696e61553d649815687f79aa',
  'The Boom Kings': '696e615c3d649815687f7a07',
  'Thoughts and Spares': '696e61623d649815687f7a52',
  'Valley of the Balls': '696e61443d649815687f7885',
  'Wild Llamas': '696e615a3d649815687f79ec',
};

const LP_LEAGUE_ID = '696e613d3d649815687f7823';
const LP_BASE = 'https://www.leaguepals.com';

/**
 * Push finalized lineups to LeaguePals for the given season/week.
 * Uses the LP API with the provided connect.sid cookie.
 */
export async function pushLineupsToLP(
  cookie: string,
  seasonID: number,
  week: number,
  teamID?: number,
): Promise<{ pushed: number; errors: string[] }> {
  const db = await getDb();
  const errors: string[] = [];
  let pushed = 0;

  // Normalize cookie - accept raw value or full "connect.sid=..." format
  const cookieHeader = cookie.startsWith('connect.sid=')
    ? cookie
    : `connect.sid=${cookie}`;

  const headers: Record<string, string> = {
    Accept: 'application/json, text/plain, */*',
    'Content-Type': 'application/json;charset=UTF-8',
    Cookie: cookieHeader,
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    Origin: LP_BASE,
    Referer: LP_BASE + '/all-teams-center',
  };

  // Get submissions for this week, optionally filtered to a single team
  let submissions = await getLineups(seasonID, week);
  if (teamID) {
    submissions = submissions.filter((s) => s.teamID === teamID);
  }

  for (const submission of submissions) {
    const teamName = submission.teamName;
    if (!teamName) {
      errors.push(`Submission ${submission.id}: no team name`);
      continue;
    }

    const lpTeamID = LP_TEAM_MAP[teamName];
    if (!lpTeamID) {
      errors.push(`No LP team ID mapped for "${teamName}"`);
      continue;
    }

    try {
      // Load current team roster from LP
      const loadRes = await fetch(
        `${LP_BASE}/api/loadIndividualTeam?id=${lpTeamID}&noPre=false`,
        { headers },
      );
      if (!loadRes.ok) {
        errors.push(`Failed to load LP team "${teamName}": ${loadRes.status}`);
        continue;
      }

      const contentType = loadRes.headers.get('content-type') || '';
      if (!contentType.includes('json')) {
        errors.push(`LP returned HTML for "${teamName}" - cookie is likely expired or invalid`);
        break; // No point trying other teams with a bad cookie
      }

      const teamData = await loadRes.json();
      const rosterData = teamData.data || teamData;
      const roster: Array<Record<string, unknown>> = Array.isArray(rosterData)
        ? rosterData
        : Object.values(rosterData).filter(
            (v) =>
              v && typeof v === 'object' && (v as Record<string, unknown>)._id,
          ) as Array<Record<string, unknown>>;

      if (!roster.length) {
        errors.push(`No roster found in LP for "${teamName}"`);
        continue;
      }

      // Match lineup entries to LP roster bowlers, auto-adding missing ones
      let currentRoster = [...roster];
      let needsReload = false;

      for (const entry of submission.entries) {
        const bowlerName = entry.bowlerName || entry.newBowlerName;
        if (!bowlerName) {
          errors.push(
            `Submission ${submission.id}: entry position ${entry.position} has no bowler name`,
          );
          continue;
        }

        // Find in LP roster by normalized name
        const target = bowlerName.toLowerCase().replace(/[^a-z]/g, '');
        const nameParts = bowlerName.trim().split(/\s+/);
        const lastName = nameParts[nameParts.length - 1].toLowerCase();
        const firstName = nameParts[0].toLowerCase();

        let lpBowler = currentRoster.find((b) => {
          const name = String(b.name || '');
          return name.toLowerCase().replace(/[^a-z]/g, '') === target;
        });
        // Fallback: first+last name fields
        if (!lpBowler) {
          lpBowler = currentRoster.find((b) => {
            return (
              String(b.firstName || '').toLowerCase() === firstName &&
              String(b.lastName || '').toLowerCase() === lastName
            );
          });
        }
        // Fallback: last name only if unique
        if (!lpBowler) {
          const lastMatches = currentRoster.filter(
            (b) => String(b.lastName || '').toLowerCase() === lastName,
          );
          if (lastMatches.length === 1) lpBowler = lastMatches[0];
        }

        if (!lpBowler) {
          // Search LP for the bowler and add them to the team
          const searchQueries = [bowlerName];
          if (nameParts.length > 2) {
            searchQueries.push(`${nameParts[0]} ${nameParts[nameParts.length - 1]}`);
          }

          let found: Record<string, unknown> | null = null;
          for (const q of searchQueries) {
            const searchRes = await fetch(`${LP_BASE}/searchUsers`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ q, exact: true, origin: 'AllTeamsCenter' }),
            });
            if (!searchRes.ok) continue;

            const searchData = await searchRes.json();
            const users = searchData.data || searchData;
            if (!Array.isArray(users) || users.length === 0) continue;

            // Try last name + first initial match
            found = users.find((u: Record<string, unknown>) => {
              const uLast = String(u.lastName || '').toLowerCase();
              const uFirst = String(u.firstName || '').toLowerCase();
              return uLast === lastName && firstName.startsWith(uFirst[0] || '');
            }) ?? null;
            // Try full normalized name match
            if (!found) {
              found = users.find((u: Record<string, unknown>) => {
                const uName = (String(u.firstName || '') + String(u.lastName || ''))
                  .toLowerCase().replace(/[^a-z]/g, '');
                return uName === target;
              }) ?? null;
            }
            // Single result = use it
            if (!found && users.length === 1) found = users[0];
            if (found) break;
          }

          if (!found) {
            errors.push(`"${bowlerName}" not found on LeaguePals at all`);
            continue;
          }

          const fName = String(found.firstName || nameParts[0]);
          const lName = String(found.lastName || nameParts.slice(1).join(' '));

          // Add bowler to the LP team
          const addPayload = {
            type: 'invites',
            bowlers: [found.email],
            id: lpTeamID,
            fullBowlers: [{
              email: found.email,
              canEdit: true,
              enteredName: true,
              isFemale: false,
              isJunior: false,
              dontIdentify: false,
              average: 0,
              totalPointsCarryOn: 0,
              gamesCarryOn: 0,
              individualPoints: 0,
              lastName: lName,
              firstName: fName,
              name: `${fName} ${lName}`,
            }],
            origin: 'AllTeamsCenter-sendInvites',
          };

          const addRes = await fetch(`${LP_BASE}/updateTeam`, {
            method: 'POST',
            headers,
            body: JSON.stringify(addPayload),
          });

          if (!addRes.ok) {
            errors.push(`Failed to add "${bowlerName}" to LP team "${teamName}"`);
            continue;
          }

          needsReload = true;
        }
      }

      // Reload roster if we added anyone
      if (needsReload) {
        const reloadRes = await fetch(
          `${LP_BASE}/api/loadIndividualTeam?id=${lpTeamID}&noPre=false`,
          { headers },
        );
        if (reloadRes.ok) {
          const reloadData = await reloadRes.json();
          const reloadRoster = reloadData.data || reloadData;
          currentRoster = Array.isArray(reloadRoster)
            ? reloadRoster
            : (Object.values(reloadRoster).filter(
                (v) => v && typeof v === 'object' && (v as Record<string, unknown>)._id,
              ) as Array<Record<string, unknown>>);
        }
      }

      // Build final roster: lineup bowlers on top, rest below
      const topBowlers: Array<Record<string, unknown>> = [];
      const topIds = new Set<string>();
      let matchFailed = false;

      for (const entry of submission.entries) {
        const bowlerName = entry.bowlerName || entry.newBowlerName;
        if (!bowlerName) continue;

        const target = bowlerName.toLowerCase().replace(/[^a-z]/g, '');
        const nameParts = bowlerName.trim().split(/\s+/);
        const lastName = nameParts[nameParts.length - 1].toLowerCase();
        const firstName = nameParts[0].toLowerCase();

        let lpBowler = currentRoster.find((b) => {
          const name = String(b.name || '');
          return name.toLowerCase().replace(/[^a-z]/g, '') === target;
        });
        if (!lpBowler) {
          lpBowler = currentRoster.find((b) => {
            return (
              String(b.firstName || '').toLowerCase() === firstName &&
              String(b.lastName || '').toLowerCase() === lastName
            );
          });
        }
        if (!lpBowler) {
          const lastMatches = currentRoster.filter(
            (b) => String(b.lastName || '').toLowerCase() === lastName,
          );
          if (lastMatches.length === 1) lpBowler = lastMatches[0];
        }

        if (!lpBowler) {
          errors.push(`Still can't find "${bowlerName}" in LP roster for "${teamName}" after adds`);
          matchFailed = true;
          break;
        }

        topBowlers.push(lpBowler);
        topIds.add(String(lpBowler._id));
      }

      if (matchFailed) continue;

      const restBowlers = currentRoster.filter((b) => !topIds.has(String(b._id)));
      const fullRoster = [...topBowlers, ...restBowlers];

      // Build and send update payload
      const payload = {
        type: 'roster_avg',
        bowlers: fullRoster.map((b) => String(b.email || '')),
        roster: fullRoster,
        league: LP_LEAGUE_ID,
        id: lpTeamID,
        origin: 'AllTeamsCenter-updateRoster',
      };

      const updateRes = await fetch(`${LP_BASE}/updateTeam`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!updateRes.ok) {
        const text = await updateRes.text();
        errors.push(`Failed to update LP team "${teamName}": ${text}`);
        continue;
      }

      // Mark as pushed in DB
      await db
        .request()
        .input('id', submission.id)
        .query(
          `UPDATE lineupSubmissions SET status = 'pushed' WHERE id = @id`,
        );

      pushed++;
    } catch (err) {
      errors.push(
        `Error pushing "${teamName}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { pushed, errors };
}

/**
 * Get the current season info and next week for lineup submission.
 */
export async function getCurrentLineupContext(): Promise<{
  seasonID: number;
  seasonName: string;
  nextWeek: number;
} | null> {
  const db = await getDb();

  // Get current season
  const seasonResult = await db.request().query<{
    seasonID: number;
    displayName: string;
  }>(
    `SELECT TOP 1 seasonID, displayName
     FROM seasons
     ORDER BY year DESC, CASE period WHEN 'Fall' THEN 2 ELSE 1 END DESC`,
  );

  const season = seasonResult.recordset[0];
  if (!season) return null;

  // Get published week from leagueSettings
  let publishedWeek = 0;
  try {
    const lsResult = await db
      .request()
      .query<{ settingValue: string }>(
        `SELECT settingValue FROM leagueSettings WHERE settingKey = 'publishedWeek'`,
      );
    if (lsResult.recordset[0]) {
      publishedWeek = parseInt(lsResult.recordset[0].settingValue, 10);
    }
  } catch {
    // leagueSettings might not exist yet
  }

  return {
    seasonID: season.seasonID,
    seasonName: season.displayName,
    nextWeek: publishedWeek + 1,
  };
}

/**
 * Get all teams for the current season (for admin lineup management).
 */
export async function getSeasonTeams(
  seasonID: number,
): Promise<Array<{ teamID: number; teamName: string }>> {
  const db = await getDb();
  const result = await db
    .request()
    .input('seasonID', seasonID)
    .query<{ teamID: number; teamName: string }>(
      `SELECT DISTINCT t.teamID, t.teamName
       FROM schedule sch
       JOIN teams t ON t.teamID = sch.team1ID OR t.teamID = sch.team2ID
       WHERE sch.seasonID = @seasonID
       ORDER BY t.teamName`,
    );
  return result.recordset;
}

/**
 * Get the set of teamIDs that have submitted lineups for a given season/week.
 */
export async function getSubmittedTeamIDs(
  seasonID: number,
  week: number,
): Promise<Set<number>> {
  const db = await getDb();
  const result = await db
    .request()
    .input('seasonID', seasonID)
    .input('week', week)
    .query<{ teamID: number }>(
      `SELECT teamID FROM lineupSubmissions WHERE seasonID = @seasonID AND week = @week`,
    );
  return new Set(result.recordset.map((r) => r.teamID));
}

/**
 * Get the submittedBy name from the current week's submission (for pre-fill).
 */
export async function getCurrentSubmittedBy(
  teamID: number,
  seasonID: number,
  week: number,
): Promise<string | null> {
  const db = await getDb();
  const result = await db
    .request()
    .input('teamID', teamID)
    .input('seasonID', seasonID)
    .input('week', week)
    .query<{ submittedBy: string | null }>(
      `SELECT submittedBy FROM lineupSubmissions
       WHERE teamID = @teamID AND seasonID = @seasonID AND week = @week`,
    );
  return result.recordset[0]?.submittedBy ?? null;
}
