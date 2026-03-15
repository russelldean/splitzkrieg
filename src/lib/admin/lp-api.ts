/**
 * LeaguePals API client for pulling scores.
 * Refactored from scripts/import-week-scores.mjs for use in the admin UI.
 */

import { getDb } from '@/lib/db';
import type { StagedBowler, StagedMatch } from './types';

const LP_LEAGUE_ID = '696e613d3d649815687f7823';
const LP_BASE = 'https://www.leaguepals.com';

// LP team name -> DB teamID (normalized LP names, lowercase for matching)
const LP_TEAM_MAP: Record<string, number> = {
  'alley oops': 1,
  'bowl durham': 4,
  'e bowla': 7,
  'e-bowla': 7,
  'fancy pants': 8,
  "grandma's teeth": 9,
  'gutterglory': 11,
  'guttermouths': 12,
  'guttersnipes': 13,
  'the guttersnipes': 13,
  'hot fun': 14,
  'hot shotz': 15,
  'living on a spare': 17,
  'lucky strikes': 18,
  'pin ups': 22,
  'pin-ups': 22,
  'smoke a bowl': 26,
  'smoke-a-bowl': 26,
  'sparadigm shift': 28,
  'stinky cheese': 31,
  'the boom kings': 33,
  'thoughts and spares': 38,
  'valley of the balls': 39,
  'wild llamas': 42,
};

// ---- Name matching (ported from import-week-scores.mjs) ----

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

interface DbBowler {
  bowlerID: number;
  bowlerName: string;
  slug: string;
  gender: string;
}

function matchBowlerToDB(
  lpName: string,
  dbBowlers: DbBowler[],
): DbBowler | null {
  const target = normalizeName(lpName);

  // Exact normalized match
  let match = dbBowlers.find((b) => normalizeName(b.bowlerName) === target);
  if (match) return match;

  // Last name + first initial
  const parts = lpName.trim().split(/\s+/);
  if (parts.length >= 2) {
    const firstName = parts[0].toLowerCase();
    const lastName = parts[parts.length - 1].toLowerCase();
    match = dbBowlers.find((b) => {
      const bParts = b.bowlerName.split(/\s+/);
      const bFirst = bParts[0]?.toLowerCase() ?? '';
      const bLast = bParts[bParts.length - 1]?.toLowerCase() ?? '';
      return (
        bLast === lastName &&
        (bFirst === firstName || bFirst.startsWith(firstName[0]))
      );
    });
    if (match) return match;

    // Last name only (single match)
    const lastNameMatches = dbBowlers.filter((b) => {
      const bParts = b.bowlerName.split(/\s+/);
      return bParts[bParts.length - 1]?.toLowerCase() === lastName;
    });
    if (lastNameMatches.length === 1) return lastNameMatches[0];
  }

  // Fuzzy match (Levenshtein <= 2, unique best)
  const candidates = dbBowlers.map((b) => ({
    bowler: b,
    dist: levenshtein(target, normalizeName(b.bowlerName)),
  }));
  candidates.sort((a, b) => a.dist - b.dist);
  if (
    candidates[0] &&
    candidates[0].dist <= 2 &&
    candidates[0].dist < (candidates[1]?.dist ?? Infinity)
  ) {
    return candidates[0].bowler;
  }

  return null;
}

// ---- LP data types ----

interface LpGame {
  totalPins: number;
  isBlind?: boolean;
  isVacant?: boolean;
}

interface LpPlayer {
  bowler?: { name: string };
  subName?: string;
  isSubstitute?: boolean;
  isVacant?: boolean;
  games?: LpGame[];
}

interface LpTeam {
  _id: string;
  players: LpPlayer[];
}

interface LpMatch {
  team1Ref: { _id: string; name: string };
  team2Ref: { _id: string; name: string };
  teams: LpTeam[];
  date?: string;
}

interface LpUser {
  _id: string;
  name: string;
}

/**
 * Pull scores from LeaguePals API for a given season and week.
 * Returns structured match data with bowlers fuzzy-matched to DB records.
 */
export async function lpPullScores(
  cookie: string,
  seasonID: number,
  weekNum: number,
): Promise<{ matches: StagedMatch[]; warnings: string[] }> {
  // Strip any whitespace from cookie (line breaks from paste)
  const cleanCookie = cookie.trim().replace(/\s+/g, '');
  // Ensure cookie has the connect.sid= prefix
  const fullCookie = cleanCookie.startsWith('connect.sid=')
    ? cleanCookie
    : `connect.sid=${cleanCookie}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Cookie: fullCookie,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  };

  // 1. Verify LP session is valid
  const latestRes = await fetch(`${LP_BASE}/latestScore?id=${LP_LEAGUE_ID}`, {
    headers,
  });
  if (latestRes.status === 401 || latestRes.status === 403) {
    throw new Error('LP session expired, please get a fresh cookie');
  }
  if (!latestRes.ok) throw new Error(`latestScore failed: ${latestRes.status}`);

  // 2. Get all scores (LP puts all weeks at weekIdx=0 for this league)
  const maxDate = new Date('2027-01-01').getTime();
  const minDate = new Date('2025-01-01').getTime();
  const scoresUrl = `${LP_BASE}/recentScores?leagueId=${LP_LEAGUE_ID}&maxDate=${maxDate}&minDate=${minDate}&weekIdx=0`;
  const scoresRes = await fetch(scoresUrl, { headers });
  if (scoresRes.status === 401 || scoresRes.status === 403) {
    throw new Error('LP session expired, please get a fresh cookie');
  }
  if (!scoresRes.ok)
    throw new Error(`recentScores failed: ${scoresRes.status}`);
  const scoresData = await scoresRes.json();
  const allMatches: LpMatch[] = scoresData.data;

  if (!allMatches || allMatches.length === 0) {
    throw new Error('No matches found on LeaguePals');
  }

  // 3. Look up the match date for this week from our schedule table,
  //    then filter LP matches to that date
  const db2 = await getDb();
  const dateResult = await db2
    .request()
    .input('seasonID', seasonID)
    .input('week', weekNum)
    .query<{ matchDate: Date }>(
      `SELECT TOP 1 matchDate FROM schedule WHERE seasonID = @seasonID AND week = @week AND matchDate IS NOT NULL`,
    );

  if (!dateResult.recordset[0]?.matchDate) {
    throw new Error(`No match date found in schedule for season ${seasonID} week ${weekNum}`);
  }

  const matchDate = dateResult.recordset[0].matchDate.toISOString().split('T')[0];
  const lpMatches = allMatches.filter(
    (m) => m.date && m.date.startsWith(matchDate),
  );

  if (lpMatches.length === 0) {
    // List available dates to help debug
    const availDates = [...new Set(allMatches.map((m) => m.date?.split('T')[0]))]
      .filter(Boolean)
      .sort()
      .join(', ');
    throw new Error(
      `No LP matches found for ${matchDate} (week ${weekNum}). Available dates: ${availDates}`,
    );
  }

  // 3. Get user mapping (LP userId -> name)
  const teamsRes = await fetch(
    `${LP_BASE}/loadTeams?fullLoad=true&id=${LP_LEAGUE_ID}&withBowlers=true`,
    { headers },
  );
  if (!teamsRes.ok) throw new Error(`loadTeams failed: ${teamsRes.status}`);
  const teamsData = await teamsRes.json();
  const usersArr: LpUser[] = teamsData.data?.users || [];
  // We don't actually need the user map since bowler names come from player data
  void usersArr;

  // 4. Get DB bowlers for matching
  const db = await getDb();
  const bowlersResult = await db.request().query(`
    SELECT bowlerID, bowlerName, slug, gender FROM bowlers
  `);
  const dbBowlers: DbBowler[] = bowlersResult.recordset;

  // 5. Get incomingAvg for each bowler going into this week
  const avgResult = await db.request().query(`
    SELECT bowlerID,
      (SELECT TOP 1 x.avg27 FROM (
        SELECT AVG(CAST(g.val AS FLOAT)) AS avg27
        FROM (
          SELECT TOP 27 x2.val
          FROM scores s2
          CROSS APPLY (VALUES (s2.game1),(s2.game2),(s2.game3)) AS x2(val)
          WHERE s2.bowlerID = b.bowlerID AND s2.isPenalty = 0 AND x2.val IS NOT NULL
            AND (s2.seasonID < ${seasonID} OR (s2.seasonID = ${seasonID} AND s2.week < ${weekNum}))
          ORDER BY s2.seasonID DESC, s2.week DESC
        ) g
      ) x) AS incomingAvg
    FROM bowlers b
    WHERE b.bowlerID IN (SELECT DISTINCT bowlerID FROM scores WHERE isPenalty = 0)
  `);
  const avgMap = new Map<number, number>();
  for (const row of avgResult.recordset) {
    if (row.incomingAvg != null) {
      avgMap.set(row.bowlerID, Math.floor(row.incomingAvg));
    }
  }

  // 6. Build staging data
  const warnings: string[] = [];
  const matches: StagedMatch[] = [];

  for (const m of lpMatches) {
    const homeTeamName = m.team1Ref.name;
    const awayTeamName = m.team2Ref.name;
    const homeTeamID = LP_TEAM_MAP[homeTeamName.toLowerCase()];
    const awayTeamID = LP_TEAM_MAP[awayTeamName.toLowerCase()];

    if (!homeTeamID)
      warnings.push(`Unknown home team: "${homeTeamName}"`);
    if (!awayTeamID)
      warnings.push(`Unknown away team: "${awayTeamName}"`);

    const matchEntry: StagedMatch = {
      homeTeamName,
      awayTeamName,
      homeTeamID: homeTeamID ?? 0,
      awayTeamID: awayTeamID ?? 0,
      bowlers: [],
    };

    for (const team of m.teams) {
      const isHome = team._id === m.team1Ref._id;
      const teamID = isHome ? homeTeamID : awayTeamID;
      const teamName = isHome ? homeTeamName : awayTeamName;

      for (const p of team.players) {
        const lpName = p.bowler?.name || p.subName || 'Unknown';
        const isBlind =
          p.games?.some((g: LpGame) => g.isBlind) || false;
        const isVacant =
          p.isVacant ||
          p.games?.some((g: LpGame) => g.isVacant) ||
          false;
        const games = p.games?.map((g: LpGame) => g.totalPins) ?? [];

        // Blind = penalty in our system
        const isPenalty = isBlind || isVacant;

        // Try to match to DB bowler
        const dbMatch = isPenalty ? null : matchBowlerToDB(lpName, dbBowlers);

        const isUnmatched = !dbMatch && !isPenalty;

        // Build suggestions for unmatched bowlers
        let matchedSuggestions:
          | Array<{ bowlerID: number; name: string; score: number }>
          | undefined;
        if (isUnmatched) {
          const target = normalizeName(lpName);
          const candidates = dbBowlers
            .map((b) => ({
              bowlerID: b.bowlerID,
              name: b.bowlerName,
              score: levenshtein(target, normalizeName(b.bowlerName)),
            }))
            .filter((c) => c.score <= 5)
            .sort((a, b) => a.score - b.score)
            .slice(0, 5);
          if (candidates.length > 0) {
            matchedSuggestions = candidates;
          }
          warnings.push(
            `Could not match "${lpName}" (${teamName}) to any DB bowler`,
          );
        }

        const bowlerEntry: StagedBowler = {
          bowlerID: dbMatch?.bowlerID ?? null,
          bowlerName: dbMatch?.bowlerName ?? (isPenalty ? 'Penalty' : lpName),
          teamID: teamID ?? 0,
          teamName: teamName ?? '',
          game1: isPenalty ? null : (games[0] ?? null),
          game2: isPenalty ? null : (games[1] ?? null),
          game3: isPenalty ? null : (games[2] ?? null),
          turkeys: 0,
          incomingAvg: dbMatch ? (avgMap.get(dbMatch.bowlerID) ?? null) : null,
          isPenalty,
          isUnmatched,
          matchedSuggestions,
        };

        matchEntry.bowlers.push(bowlerEntry);
      }
    }

    matches.push(matchEntry);
  }

  return { matches, warnings };
}
