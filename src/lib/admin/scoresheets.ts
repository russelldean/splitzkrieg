/**
 * Scoresheet PDF generation for league night.
 * Generates printable PDFs with bowler names, averages, and handicaps.
 * Uses jspdf + jspdf-autotable for table layout.
 *
 * Each match produces 2 pages:
 *   Page 1: Cover page (big team names, vs., lane assignment)
 *   Page 2: Scoring grid (both teams, blank game columns, total w/ hdcp, win/loss)
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import sql from 'mssql';
import { getDb } from '@/lib/db';
import { TURKEY_PNG } from './turkey-emoji';
import { getActiveAnnouncements } from './announcements-db';

export interface ScoresheetBowler {
  name: string;
  side: 'home' | 'away';
  incomingAvg: number | null;
  handicap: number | null;
  rosterSource?: 'lineup' | 'lastweek';
}

export interface H2HMeeting {
  date: string;
  homeGameWins: number;
  awayGameWins: number;
}

export interface StandingsEntry {
  teamName: string;
  totalPts: number;
  rank: number;
  division: string;
}

export interface ScoresheetMatch {
  homeTeamName: string;
  awayTeamName: string;
  homeTeamAbbr: string;
  awayTeamAbbr: string;
  homeTeamID: number;
  awayTeamID: number;
  week: number;
  date: string;
  matchNumber: number;
  bowlers: ScoresheetBowler[];
  h2h?: {
    homeWins: number;
    awayWins: number;
    ties: number;
    meetings: H2HMeeting[];
  };
  standings?: StandingsEntry[];
}

/**
 * Calculate handicap using the project formula:
 * FLOOR((225 - FLOOR(incomingAvg)) * 0.95), max 147
 */
function calcHandicap(avg: number | null): number | null {
  if (avg == null || avg <= 0) return null;
  return Math.min(147, Math.floor((225 - Math.floor(avg)) * 0.95));
}

/**
 * Calculate 27-game rolling averages for all bowlers going into a given week.
 * Looks across ALL seasons, not just the current one.
 * Returns Map<bowlerID, flooredAvg>.
 */
async function getRollingAverages(
  db: Awaited<ReturnType<typeof getDb>>,
  seasonID: number,
  week: number,
): Promise<Map<number, number>> {
  const avgResult = await db.request()
    .input('seasonID', sql.Int, seasonID)
    .input('week', sql.Int, week)
    .query<{ bowlerID: number; incomingAvg: number }>(
      `SELECT b.bowlerID,
        (SELECT TOP 1 x.avg27 FROM (
          SELECT AVG(CAST(g.val AS FLOAT)) AS avg27
          FROM (
            SELECT TOP 27 x2.val
            FROM scores s2
            CROSS APPLY (VALUES (s2.game1),(s2.game2),(s2.game3)) AS x2(val)
            WHERE s2.bowlerID = b.bowlerID AND s2.isPenalty = 0 AND x2.val IS NOT NULL
              AND (s2.seasonID < @seasonID OR (s2.seasonID = @seasonID AND s2.week < @week))
            ORDER BY s2.seasonID DESC, s2.week DESC
          ) g
        ) x) AS incomingAvg
      FROM bowlers b
      WHERE b.bowlerID IN (SELECT DISTINCT bowlerID FROM scores WHERE isPenalty = 0)`,
    );

  const avgMap = new Map<number, number>();
  for (const row of avgResult.recordset) {
    if (row.incomingAvg != null) {
      avgMap.set(row.bowlerID, Math.floor(row.incomingAvg));
    }
  }
  return avgMap;
}

/**
 * Get matchups for a given week with bowler info.
 * Uses lineup submissions if available, otherwise falls back to previous week scores.
 */
export async function getMatchupsForWeek(
  seasonID: number,
  week: number,
  source: 'lineups' | 'lastweek' = 'lineups',
): Promise<ScoresheetMatch[]> {
  const db = await getDb();

  // Pre-calculate 27-game rolling averages for all bowlers (cross-season)
  const rollingAvgMap = await getRollingAverages(db, seasonID, week);

  // Get schedule matchups for this week
  const scheduleResult = await db
    .request()
    .input('seasonID', sql.Int, seasonID)
    .input('week', sql.Int, week)
    .query<{
      scheduleID: number;
      matchNumber: number;
      team1ID: number;
      team2ID: number;
      matchDate: string | null;
      t1Name: string;
      t2Name: string;
      t1Abbr: string | null;
      t2Abbr: string | null;
    }>(
      `SELECT sch.scheduleID, sch.matchNumber, sch.team1ID, sch.team2ID, sch.matchDate,
              t1.teamName AS t1Name, t2.teamName AS t2Name,
              t1.abbreviation AS t1Abbr, t2.abbreviation AS t2Abbr
       FROM schedule sch
       JOIN teams t1 ON sch.team1ID = t1.teamID
       JOIN teams t2 ON sch.team2ID = t2.teamID
       WHERE sch.seasonID = @seasonID AND sch.week = @week
         AND sch.team1ID IS NOT NULL AND sch.team2ID IS NOT NULL
       ORDER BY sch.matchNumber`,
    );

  // Query current standings by division (through previous week)
  const prevWeek = week - 1;
  let standings: StandingsEntry[] = [];
  if (prevWeek >= 1) {
    const standingsResult = await db
      .request()
      .input('seasonID', sql.Int, seasonID)
      .input('prevWeek', sql.Int, prevWeek)
      .query<{ teamName: string; totalPts: number; divisionName: string }>(
        `SELECT t.teamName, SUM(pts.gamePts + pts.bonusPts) AS totalPts,
                ISNULL(sd.divisionName, 'Division A') AS divisionName
         FROM (
           SELECT sch.team1ID AS teamID, mr.team1GamePts AS gamePts, mr.team1BonusPts AS bonusPts
           FROM matchResults mr
           JOIN schedule sch ON mr.scheduleID = sch.scheduleID
           WHERE sch.seasonID = @seasonID AND sch.week <= @prevWeek
           UNION ALL
           SELECT sch.team2ID, mr.team2GamePts, mr.team2BonusPts
           FROM matchResults mr
           JOIN schedule sch ON mr.scheduleID = sch.scheduleID
           WHERE sch.seasonID = @seasonID AND sch.week <= @prevWeek
         ) pts
         JOIN teams t ON pts.teamID = t.teamID
         LEFT JOIN seasonDivisions sd ON sd.seasonID = @seasonID AND sd.teamID = pts.teamID
         GROUP BY t.teamName, sd.divisionName
         ORDER BY sd.divisionName, totalPts DESC`,
      );

    // Rank within each division
    let currentDiv = '';
    let rank = 0;
    standings = standingsResult.recordset.map((row) => {
      if (row.divisionName !== currentDiv) { currentDiv = row.divisionName; rank = 0; }
      rank++;
      return {
        teamName: row.teamName,
        totalPts: row.totalPts,
        rank,
        division: row.divisionName,
      };
    });
  }

  const matches: ScoresheetMatch[] = [];

  for (let idx = 0; idx < scheduleResult.recordset.length; idx++) {
    const sched = scheduleResult.recordset[idx];
    const bowlers: ScoresheetBowler[] = [];

    // Load bowlers per team: lineup submission if available, else last week's scores
    for (const teamID of [sched.team1ID, sched.team2ID]) {
      const side: 'home' | 'away' = teamID === sched.team1ID ? 'home' : 'away';
      let teamBowlers: ScoresheetBowler[] = [];

      // Try lineup submission for this team
      if (source === 'lineups') {
        const lineupResult = await db
          .request()
          .input('seasonID', sql.Int, seasonID)
          .input('week', sql.Int, week)
          .input('teamID', sql.Int, teamID)
          .query<{
            bowlerID: number | null;
            newBowlerName: string | null;
            bowlerName: string | null;
            position: number;
          }>(
            `SELECT le.bowlerID, le.newBowlerName, b.bowlerName, le.position
             FROM lineupSubmissions ls
             JOIN lineupEntries le ON ls.id = le.submissionID
             LEFT JOIN bowlers b ON le.bowlerID = b.bowlerID
             WHERE ls.seasonID = @seasonID AND ls.week = @week AND ls.teamID = @teamID
             ORDER BY le.position`,
          );

        for (const row of lineupResult.recordset) {
          const name = row.bowlerID
            ? (row.bowlerName || 'TBD')
            : row.newBowlerName || 'TBD';

          const avg = row.bowlerID ? (rollingAvgMap.get(row.bowlerID) ?? null) : null;

          teamBowlers.push({ name, side, incomingAvg: avg, handicap: calcHandicap(avg), rosterSource: 'lineup' });
        }
      }

      // Fallback: use last week's scores for this team
      if (teamBowlers.length === 0) {
        const prevWeek = week - 1;
        if (prevWeek >= 1) {
          const prevResult = await db
            .request()
            .input('seasonID', sql.Int, seasonID)
            .input('prevWeek', sql.Int, prevWeek)
            .input('teamID', sql.Int, teamID)
            .query<{
              bowlerID: number;
              bowlerName: string;
            }>(
              `SELECT s.bowlerID, b.bowlerName
               FROM scores s
               JOIN bowlers b ON s.bowlerID = b.bowlerID
               WHERE s.seasonID = @seasonID AND s.week = @prevWeek
                 AND s.teamID = @teamID AND s.isPenalty = 0
               ORDER BY b.bowlerName`,
            );

          for (const row of prevResult.recordset) {
            const avg = rollingAvgMap.get(row.bowlerID) ?? null;
            teamBowlers.push({
              name: row.bowlerName,
              side,
              incomingAvg: avg,
              handicap: calcHandicap(avg),
              rosterSource: 'lastweek',
            });
          }
        }
      }

      bowlers.push(...teamBowlers);
    }

    // If still no bowlers, add empty slots
    if (bowlers.length === 0) {
      for (let j = 0; j < 4; j++) {
        bowlers.push({ name: '', side: 'home', incomingAvg: null, handicap: null });
        bowlers.push({ name: '', side: 'away', incomingAvg: null, handicap: null });
      }
    }

    const dateStr = sched.matchDate
      ? new Date(sched.matchDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : '';

    // Query H2H history for these two teams
    const h2hResult = await db
      .request()
      .input('t1ID', sql.Int, sched.team1ID)
      .input('t2ID', sql.Int, sched.team2ID)
      .query<{
        matchDate: Date | null;
        team1ID: number;
        t1GamePts: number;
        t2GamePts: number;
      }>(
        `SELECT s.matchDate, s.team1ID,
                mr.team1GamePts AS t1GamePts,
                mr.team2GamePts AS t2GamePts
         FROM matchResults mr
         JOIN schedule s ON mr.scheduleID = s.scheduleID
         WHERE (s.team1ID = @t1ID AND s.team2ID = @t2ID)
            OR (s.team1ID = @t2ID AND s.team2ID = @t1ID)
         ORDER BY s.seasonID DESC, s.week DESC`,
      );

    // Game wins: gamePts/2 (win=2pts, tie=1pt per game, so 3 game wins to distribute)
    let totalHomeGameWins = 0;
    let totalAwayGameWins = 0;
    const meetings: H2HMeeting[] = [];

    for (const row of h2hResult.recordset) {
      const homeIsT1 = row.team1ID === sched.team1ID;
      const homeGW = (homeIsT1 ? row.t1GamePts : row.t2GamePts) / 2;
      const awayGW = (homeIsT1 ? row.t2GamePts : row.t1GamePts) / 2;

      totalHomeGameWins += homeGW;
      totalAwayGameWins += awayGW;

      const mDate = row.matchDate
        ? new Date(row.matchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';

      meetings.push({
        date: mDate,
        homeGameWins: homeGW,
        awayGameWins: awayGW,
      });
    }

    matches.push({
      homeTeamName: sched.t1Name,
      awayTeamName: sched.t2Name,
      homeTeamAbbr: sched.t1Abbr || sched.t1Name,
      awayTeamAbbr: sched.t2Abbr || sched.t2Name,
      homeTeamID: sched.team1ID,
      awayTeamID: sched.team2ID,
      week,
      date: dateStr,
      matchNumber: idx + 1,
      bowlers,
      h2h: meetings.length > 0 ? { homeWins: totalHomeGameWins, awayWins: totalAwayGameWins, ties: 0, meetings } : undefined,
      standings: standings.length > 0 ? standings : undefined,
    });
  }

  return matches;
}

/**
 * Generate a printable PDF scoresheet from matchup data.
 * Each match = 2 pages: cover page + scoring grid.
 * Portrait letter size.
 */
export async function generateScoresheet(matches: ScoresheetMatch[]): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const navy = '#1a1f3d';
  const cream = '#f5f0e8';
  const grey = [240, 240, 240] as [number, number, number];
  const white = [255, 255, 255] as [number, number, number];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const lanes = `Lanes ${match.matchNumber * 2 - 1}/${match.matchNumber * 2}`;

    // ===== PAGE 1: Cover page =====
    if (i > 0) doc.addPage();

    // Lane assignment top right
    doc.setFontSize(11);
    doc.setTextColor(80);
    doc.text(lanes, pageW - 50, 50, { align: 'right' });

    // Week info top left
    doc.setFontSize(11);
    doc.text(
      `Week ${match.week}${match.date ? `  |  ${match.date}` : ''}`,
      50,
      50,
    );

    // Decorative line
    doc.setDrawColor(navy);
    doc.setLineWidth(2);
    doc.line(50, 70, pageW - 50, 70);

    // Home team name
    const centerY = 135;
    doc.setFontSize(52);
    doc.setTextColor(navy);
    doc.text(match.homeTeamName, pageW / 2, centerY, { align: 'center' });

    // "vs."
    doc.setFontSize(28);
    doc.setTextColor(100);
    doc.text('vs.', pageW / 2, centerY + 55, { align: 'center' });

    // Away team name
    doc.setFontSize(52);
    doc.setTextColor(navy);
    doc.text(match.awayTeamName, pageW / 2, centerY + 115, { align: 'center' });

    // ---- H2H History ----
    if (match.h2h && match.h2h.meetings.length > 0) {
      const h2h = match.h2h;

      // Divider
      const h2hDivY = centerY + 160;
      doc.setDrawColor(180);
      doc.setLineWidth(0.5);
      doc.line(60, h2hDivY, pageW - 60, h2hDivY);

      // Record summary
      const h2hStartY = h2hDivY + 22;
      doc.setFontSize(11);
      doc.setTextColor(navy);
      doc.setFont('helvetica', 'bold');
      let recordText: string;
      // Format game wins: show as integer if whole, one decimal if .5
      function fmtWins(n: number): string {
        return n % 1 === 0 ? String(n) : n.toFixed(1);
      }

      if (h2h.homeWins > h2h.awayWins) {
        recordText = `${match.homeTeamName} lead ${fmtWins(h2h.homeWins)}-${fmtWins(h2h.awayWins)} all-time`;
      } else if (h2h.awayWins > h2h.homeWins) {
        recordText = `${match.awayTeamName} lead ${fmtWins(h2h.awayWins)}-${fmtWins(h2h.homeWins)} all-time`;
      } else {
        recordText = `Tied ${fmtWins(h2h.homeWins)}-${fmtWins(h2h.awayWins)} all-time`;
      }
      doc.text(recordText, pageW / 2, h2hStartY, { align: 'center' });

      // Meeting history: Date | homeAbbr wins | awayAbbr wins
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      const recent = h2h.meetings.slice(0, 10);
      const leftCol = recent.slice(0, 5);
      const rightCol = recent.slice(5, 10);

      const col1X = 80;
      const col2X = pageW / 2 + 30;

      const homeAbbr = match.homeTeamAbbr;
      const awayAbbr = match.awayTeamAbbr;

      let rowY = h2hStartY + 20;
      doc.setTextColor(100);
      doc.setFont('helvetica', 'bold');
      doc.text('Date', col1X + 30, rowY, { align: 'center' });
      doc.text(homeAbbr, col1X + 105, rowY, { align: 'center' });
      doc.text('-', col1X + 130, rowY, { align: 'center' });
      doc.text(awayAbbr, col1X + 155, rowY, { align: 'center' });
      if (rightCol.length > 0) {
        doc.text('Date', col2X + 30, rowY, { align: 'center' });
        doc.text(homeAbbr, col2X + 105, rowY, { align: 'center' });
        doc.text('-', col2X + 130, rowY, { align: 'center' });
        doc.text(awayAbbr, col2X + 155, rowY, { align: 'center' });
      }
      doc.setFont('helvetica', 'normal');
      rowY += 5;
      doc.setDrawColor(200);
      doc.line(col1X, rowY, col1X + 185, rowY);
      if (rightCol.length > 0) doc.line(col2X, rowY, col2X + 185, rowY);
      rowY += 12;

      doc.setTextColor(60);
      for (let j = 0; j < 5; j++) {
        const left = leftCol[j];
        const right = rightCol[j];
        if (left) {
          doc.text(left.date || '', col1X, rowY);
          doc.text(fmtWins(left.homeGameWins), col1X + 105, rowY, { align: 'center' });
          doc.text('-', col1X + 130, rowY, { align: 'center' });
          doc.text(fmtWins(left.awayGameWins), col1X + 155, rowY, { align: 'center' });
        }
        if (right) {
          doc.text(right.date || '', col2X, rowY);
          doc.text(fmtWins(right.homeGameWins), col2X + 105, rowY, { align: 'center' });
          doc.text('-', col2X + 130, rowY, { align: 'center' });
          doc.text(fmtWins(right.awayGameWins), col2X + 155, rowY, { align: 'center' });
        }
        rowY += 15;
      }
    }

    // ---- Current Standings ----
    if (match.standings && match.standings.length > 0) {
      const standingsY = pageH * 0.60;

      doc.setDrawColor(180);
      doc.setLineWidth(0.5);
      doc.line(60, standingsY - 14, pageW - 60, standingsY - 14);

      doc.setFontSize(11);
      doc.setTextColor(navy);
      doc.setFont('helvetica', 'bold');
      doc.text(`Standings through Week ${match.week - 1}`, pageW / 2, standingsY + 5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      // Split by division
      const divisions = [...new Set(match.standings.map((s) => s.division))].sort();
      const divA = match.standings.filter((s) => s.division === divisions[0]);
      const divB = divisions[1] ? match.standings.filter((s) => s.division === divisions[1]) : [];

      const sCol1X = 80;
      const sCol2X = pageW / 2 + 30;

      // Division headers
      let sRowY = standingsY + 24;
      doc.setTextColor(navy);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(divisions[0] || 'Division A', sCol1X, sRowY);
      if (divB.length > 0) doc.text(divisions[1] || 'Division B', sCol2X, sRowY);

      // Column sub-headers
      sRowY += 14;
      doc.setTextColor(100);
      doc.setFontSize(8);
      doc.text('#', sCol1X, sRowY);
      doc.text('Team', sCol1X + 18, sRowY);
      doc.text('Pts', sCol1X + 170, sRowY);
      if (divB.length > 0) {
        doc.text('#', sCol2X, sRowY);
        doc.text('Team', sCol2X + 18, sRowY);
        doc.text('Pts', sCol2X + 170, sRowY);
      }
      doc.setFont('helvetica', 'normal');
      sRowY += 5;
      doc.setDrawColor(200);
      doc.line(sCol1X, sRowY, sCol1X + 190, sRowY);
      if (divB.length > 0) doc.line(sCol2X, sRowY, sCol2X + 190, sRowY);
      sRowY += 12;

      doc.setTextColor(60);
      doc.setFontSize(9);
      const maxRows = Math.max(divA.length, divB.length);
      for (let j = 0; j < maxRows; j++) {
        const left = divA[j];
        const right = divB[j];
        if (left) {
          const isMatchTeam = left.teamName === match.homeTeamName || left.teamName === match.awayTeamName;
          if (isMatchTeam) doc.setFont('helvetica', 'bold');
          doc.text(`${left.rank}.`, sCol1X, sRowY);
          doc.text(left.teamName, sCol1X + 18, sRowY);
          doc.text(String(left.totalPts), sCol1X + 170, sRowY);
          if (isMatchTeam) doc.setFont('helvetica', 'normal');
        }
        if (right) {
          const isMatchTeam = right.teamName === match.homeTeamName || right.teamName === match.awayTeamName;
          if (isMatchTeam) doc.setFont('helvetica', 'bold');
          doc.text(`${right.rank}.`, sCol2X, sRowY);
          doc.text(right.teamName, sCol2X + 18, sRowY);
          doc.text(String(right.totalPts), sCol2X + 170, sRowY);
          if (isMatchTeam) doc.setFont('helvetica', 'normal');
        }
        sRowY += 16;
      }
    }

    // Bottom
    doc.setDrawColor(navy);
    doc.setLineWidth(2);
    doc.line(50, pageH - 45, pageW - 50, pageH - 45);

    // ===== PAGE 2: Scoring grid =====
    doc.addPage();

    const homeBowlers = match.bowlers.filter((b) => b.side === 'home');
    const awayBowlers = match.bowlers.filter((b) => b.side === 'away');

    const columns = ['', 'Bowler', 'Avg', 'HCP', 'Game 1', 'Game 2', 'Game 3', ''];

    // Turkey column position: left margin (35) + sum of cols 0-6 widths
    const turkeyColX = 35 + 95 + 100 + 45 + 45 + 72 + 72 + 72;
    const turkeyColW = 50;

    function buildRows(
      teamName: string,
      bowlers: ScoresheetBowler[],
    ): Array<Array<string | number>> {
      const rows: Array<Array<string | number>> = [];
      for (let j = 0; j < Math.max(bowlers.length, 6); j++) {
        const showTeamName = j < 4 ? teamName : '';
        const b = bowlers[j];
        if (b) {
          rows.push([
            showTeamName,
            b.name || '',
            b.incomingAvg != null ? String(Math.floor(b.incomingAvg)) : '',
            b.handicap != null ? String(b.handicap) : '',
            '',
            '',
            '',
            '',
          ]);
        } else {
          rows.push([showTeamName, '', '', '', '', '', '', '']);
        }
      }
      return rows;
    }

    // Header (week only, lanes are on cover page)
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Week ${match.week}`, 40, 40);

    // Check roster source per team
    const homeSource = homeBowlers[0]?.rosterSource;
    const awaySource = awayBowlers[0]?.rosterSource;
    const fallbackMsg = "Last Week's Lineup - Please Submit Lineups before 5pm Monday";

    // Home team fallback warning
    let homeTableY = 90;
    if (homeSource === 'lastweek') {
      doc.setFontSize(8);
      doc.setTextColor(70);
      doc.setFont('helvetica', 'italic');
      doc.text(fallbackMsg, 40, 82);
      doc.setFont('helvetica', 'normal');
      homeTableY = 94;
    }

    // Turkey emoji above home team's turkeys column (facing left - default)
    const tkSize = 24;
    const tkX = turkeyColX + (turkeyColW - tkSize) / 2;
    doc.addImage(TURKEY_PNG, 'PNG', tkX, homeTableY - tkSize - 4, tkSize, tkSize);

    // Speech bubble from turkey with active announcements
    const activeAnnouncements = await getActiveAnnouncements();
    if (activeAnnouncements.length > 0) {
      const bubbleText = activeAnnouncements.map((a) => a.message).join('  |  ');
      doc.setFontSize(8);
      const textW = doc.getTextWidth(bubbleText);
      const bubbleW = textW + 24;
      const bubbleH = 18;
      const bubbleX = tkX - bubbleW - 14;
      const bubbleY = homeTableY - tkSize - 10;

      // Bubble rectangle
      doc.setDrawColor(180);
      doc.setLineWidth(0.5);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 4, 4, 'FD');

      // Little triangle pointing to turkey
      const triX = bubbleX + bubbleW;
      const triY = bubbleY + bubbleH / 2 - 3;
      doc.setFillColor(255, 255, 255);
      doc.triangle(triX, triY, triX, triY + 6, triX + 7, triY + 3, 'FD');

      // Text (centered in bubble)
      doc.setFontSize(8);
      doc.setTextColor(navy);
      doc.setFont('helvetica', 'bold');
      doc.text(bubbleText, bubbleX + bubbleW / 2, bubbleY + 12, { align: 'center' });
      doc.setFont('helvetica', 'normal');
    }

    // Home team table
    const homeRows = buildRows(match.homeTeamName, homeBowlers);
    autoTable(doc, {
      startY: homeTableY,
      head: [columns],
      body: [
        ...homeRows,
        [{ content: 'total w/ hdcp', colSpan: 4, styles: { halign: 'right' as const, fontStyle: 'bolditalic' as const, fillColor: white } }, '', '', '', ''],
        [{ content: 'win/loss', colSpan: 4, styles: { halign: 'right' as const, fontStyle: 'italic' as const, fillColor: [255, 255, 255] as [number, number, number] } }, '', '', '', ''],
      ],
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 6,
        minCellHeight: 28,
        lineColor: [180, 180, 180],
        lineWidth: 0.5,
        textColor: navy,
        overflow: 'ellipsize' as const,
        valign: 'middle',
      },
      headStyles: {
        fillColor: grey,
        textColor: navy,
        fontSize: 9,
        fontStyle: 'bold',
        cellPadding: 6,
        minCellHeight: 20,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 90, fontSize: 8 },
        1: { cellWidth: 105, fontSize: 9 },
        2: { cellWidth: 45, halign: 'center' },
        3: { cellWidth: 45, halign: 'center' },
        4: { cellWidth: 72, halign: 'center', fillColor: white },
        5: { cellWidth: 72, halign: 'center', fillColor: white },
        6: { cellWidth: 72, halign: 'center', fillColor: white },
        7: { cellWidth: 50, halign: 'center' },
      },
      margin: { left: 35, right: 35 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterHomeY = (doc as any).lastAutoTable?.finalY ?? 300;

    // Away team fallback warning
    const awayGap = 50;
    let awayTableY = afterHomeY + awayGap;
    if (awaySource === 'lastweek') {
      doc.setFontSize(8);
      doc.setTextColor(70);
      doc.setFont('helvetica', 'italic');
      doc.text(fallbackMsg, 40, afterHomeY + awayGap - 8);
      doc.setFont('helvetica', 'normal');
      awayTableY = afterHomeY + awayGap + 4;
    }

    // Turkey emoji above away team's turkeys column (flipped to face right)
    const awayTkX = turkeyColX + (turkeyColW - tkSize) / 2;
    const awayTkY = awayTableY - tkSize - 4;
    // Flip horizontally using internal PDF transform
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internal = doc.internal as any;
    internal.write('q');
    internal.write(`-1 0 0 1 ${(awayTkX * 2 + tkSize).toFixed(2)} 0 cm`);
    doc.addImage(TURKEY_PNG, 'PNG', awayTkX, awayTkY, tkSize, tkSize);
    internal.write('Q');

    // Away team table
    const awayRows = buildRows(match.awayTeamName, awayBowlers);
    autoTable(doc, {
      startY: awayTableY,
      head: [columns],
      body: [
        ...awayRows,
        [{ content: 'total w/ hdcp', colSpan: 4, styles: { halign: 'right' as const, fontStyle: 'bolditalic' as const, fillColor: white } }, '', '', '', ''],
        [{ content: 'win/loss', colSpan: 4, styles: { halign: 'right' as const, fontStyle: 'italic' as const, fillColor: [255, 255, 255] as [number, number, number] } }, '', '', '', ''],
      ],
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 6,
        minCellHeight: 28,
        lineColor: [180, 180, 180],
        lineWidth: 0.5,
        textColor: navy,
        overflow: 'ellipsize' as const,
        valign: 'middle',
      },
      headStyles: {
        fillColor: grey,
        textColor: navy,
        fontSize: 9,
        fontStyle: 'bold',
        cellPadding: 6,
        minCellHeight: 20,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 90, fontSize: 8 },
        1: { cellWidth: 105, fontSize: 9 },
        2: { cellWidth: 45, halign: 'center' },
        3: { cellWidth: 45, halign: 'center' },
        4: { cellWidth: 72, halign: 'center', fillColor: white },
        5: { cellWidth: 72, halign: 'center', fillColor: white },
        6: { cellWidth: 72, halign: 'center', fillColor: white },
        7: { cellWidth: 50, halign: 'center' },
      },
      margin: { left: 35, right: 35 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterAwayY = (doc as any).lastAutoTable?.finalY ?? 550;

    // New bowler warning note
    const noteY = afterAwayY + 20;
    doc.setFontSize(8);
    doc.setTextColor(70);
    doc.setFont('helvetica', 'bold');
    doc.text('NEW BOWLER WITH NO AVERAGE ON YOUR TEAM?', 40, noteY);
    doc.setFont('helvetica', 'normal');
    doc.text('The screen total looks HIGHER than it really is.', 40, noteY + 12);
    doc.text('New bowlers score 219 each game on night 1, but the screen shows 219 + Game Score', 40, noteY + 22);
    doc.setFont('helvetica', 'bold');
    doc.text('WHAT TO DO?', 40, noteY + 36);
    doc.setFont('helvetica', 'normal');
    doc.text('Record the team total the screen is showing and we will fix as needed.', 40, noteY + 48);
    doc.text('The ACCURATE game score for team = (Screen total) - (New bowler game score)', 40, noteY + 58);

    // Feedback prompt + site reference
    doc.setFontSize(10);
    doc.setTextColor(navy);
    doc.setFont('helvetica', 'bold');
    doc.text(
      'Something noteworthy happen on the lanes tonight?',
      40,
      noteY + 76,
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(70);
    doc.text(
      'Head to splitzkrieg.com and look for the speech bubble icon in the bottom right corner.',
      40,
      noteY + 89,
    );
  }

  return doc;
}
