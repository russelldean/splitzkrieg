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
import announcements from '../../../content/announcements';

export interface ScoresheetBowler {
  name: string;
  side: 'home' | 'away';
  incomingAvg: number | null;
  handicap: number | null;
  rosterSource?: 'lineup' | 'lastweek';
}

export interface H2HMeeting {
  season: string;
  week: number;
  date: string;
  homeWins: number;
  awayWins: number;
  tie: boolean;
}

export interface StandingsEntry {
  teamName: string;
  totalPts: number;
  rank: number;
}

export interface ScoresheetMatch {
  homeTeamName: string;
  awayTeamName: string;
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
 * Get matchups for a given week with bowler info.
 * Uses lineup submissions if available, otherwise falls back to previous week scores.
 */
export async function getMatchupsForWeek(
  seasonID: number,
  week: number,
  source: 'lineups' | 'lastweek' = 'lineups',
): Promise<ScoresheetMatch[]> {
  const db = await getDb();

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
    }>(
      `SELECT sch.scheduleID, sch.matchNumber, sch.team1ID, sch.team2ID, sch.matchDate,
              t1.teamName AS t1Name, t2.teamName AS t2Name
       FROM schedule sch
       JOIN teams t1 ON sch.team1ID = t1.teamID
       JOIN teams t2 ON sch.team2ID = t2.teamID
       WHERE sch.seasonID = @seasonID AND sch.week = @week
         AND sch.team1ID IS NOT NULL AND sch.team2ID IS NOT NULL
       ORDER BY sch.matchNumber`,
    );

  // Query current standings (through previous week)
  const prevWeek = week - 1;
  let standings: StandingsEntry[] = [];
  if (prevWeek >= 1) {
    const standingsResult = await db
      .request()
      .input('seasonID', sql.Int, seasonID)
      .input('prevWeek', sql.Int, prevWeek)
      .query<{ teamName: string; totalPts: number }>(
        `SELECT t.teamName, SUM(pts.gamePts + pts.bonusPts) AS totalPts
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
         GROUP BY t.teamName
         ORDER BY totalPts DESC`,
      );
    standings = standingsResult.recordset.map((row, idx) => ({
      teamName: row.teamName,
      totalPts: row.totalPts,
      rank: idx + 1,
    }));
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

          let avg: number | null = null;
          if (row.bowlerID) {
            const avgResult = await db
              .request()
              .input('bowlerID', sql.Int, row.bowlerID)
              .input('seasonID', sql.Int, seasonID)
              .input('week', sql.Int, week)
              .query<{ incomingAvg: number }>(
                `SELECT TOP 1 incomingAvg
                 FROM scores
                 WHERE bowlerID = @bowlerID AND seasonID = @seasonID AND week < @week AND isPenalty = 0
                 ORDER BY week DESC`,
              );
            avg = avgResult.recordset[0]?.incomingAvg ?? null;
          }

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
              incomingAvg: number | null;
            }>(
              `SELECT s.bowlerID, b.bowlerName, s.incomingAvg
               FROM scores s
               JOIN bowlers b ON s.bowlerID = b.bowlerID
               WHERE s.seasonID = @seasonID AND s.week = @prevWeek
                 AND s.teamID = @teamID AND s.isPenalty = 0
               ORDER BY b.bowlerName`,
            );

          for (const row of prevResult.recordset) {
            teamBowlers.push({
              name: row.bowlerName,
              side,
              incomingAvg: row.incomingAvg,
              handicap: calcHandicap(row.incomingAvg),
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
        seasonID: number;
        week: number;
        matchDate: Date | null;
        romanNumeral: string;
        team1ID: number;
        t1Total: number;
        t2Total: number;
      }>(
        `SELECT s.seasonID, s.week, s.matchDate, se.romanNumeral, s.team1ID,
                (mr.team1GamePts + mr.team1BonusPts) AS t1Total,
                (mr.team2GamePts + mr.team2BonusPts) AS t2Total
         FROM matchResults mr
         JOIN schedule s ON mr.scheduleID = s.scheduleID
         JOIN seasons se ON s.seasonID = se.seasonID
         WHERE (s.team1ID = @t1ID AND s.team2ID = @t2ID)
            OR (s.team1ID = @t2ID AND s.team2ID = @t1ID)
         ORDER BY s.seasonID DESC, s.week DESC`,
      );

    let homeWins = 0;
    let awayWins = 0;
    let ties = 0;
    const meetings: H2HMeeting[] = [];

    for (const row of h2hResult.recordset) {
      // Normalize so "home" always = sched.team1ID for this matchup
      const homeIsT1 = row.team1ID === sched.team1ID;
      const homePts = homeIsT1 ? row.t1Total : row.t2Total;
      const awayPts = homeIsT1 ? row.t2Total : row.t1Total;

      if (homePts > awayPts) homeWins++;
      else if (awayPts > homePts) awayWins++;
      else ties++;

      const mDate = row.matchDate
        ? new Date(row.matchDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '';

      meetings.push({
        season: row.romanNumeral,
        week: row.week,
        date: mDate,
        homeWins: homePts,
        awayWins: awayPts,
        tie: homePts === awayPts,
      });
    }

    matches.push({
      homeTeamName: sched.t1Name,
      awayTeamName: sched.t2Name,
      homeTeamID: sched.team1ID,
      awayTeamID: sched.team2ID,
      week,
      date: dateStr,
      matchNumber: idx + 1,
      bowlers,
      h2h: meetings.length > 0 ? { homeWins, awayWins, ties, meetings } : undefined,
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
export function generateScoresheet(matches: ScoresheetMatch[]): jsPDF {
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
    doc.setTextColor(120);
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

    // Home team name (moved up)
    const centerY = 120;
    doc.setFontSize(52);
    doc.setTextColor(navy);
    doc.text(match.homeTeamName, pageW / 2, centerY, { align: 'center' });

    // "vs."
    doc.setFontSize(28);
    doc.setTextColor(150);
    doc.text('vs.', pageW / 2, centerY + 55, { align: 'center' });

    // Away team name
    doc.setFontSize(52);
    doc.setTextColor(navy);
    doc.text(match.awayTeamName, pageW / 2, centerY + 115, { align: 'center' });

    // H2H history
    if (match.h2h && match.h2h.meetings.length > 0) {
      const h2h = match.h2h;
      const h2hStartY = centerY + 160;

      // Record summary
      doc.setFontSize(11);
      doc.setTextColor(navy);
      doc.setFont('helvetica', 'bold');
      const recordParts: string[] = [];
      if (h2h.homeWins > h2h.awayWins) {
        recordParts.push(`${match.homeTeamName} lead ${h2h.homeWins}-${h2h.awayWins}`);
      } else if (h2h.awayWins > h2h.homeWins) {
        recordParts.push(`${match.awayTeamName} lead ${h2h.awayWins}-${h2h.homeWins}`);
      } else {
        recordParts.push(`Tied ${h2h.homeWins}-${h2h.awayWins}`);
      }
      if (h2h.ties > 0) recordParts[0] += `-${h2h.ties}`;
      recordParts[0] += ' all-time';
      doc.text(recordParts[0], pageW / 2, h2hStartY, { align: 'center' });

      // Meeting history table
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120);

      // Two-column layout: 5 rows per column, 10 most recent meetings
      const recent = h2h.meetings.slice(0, 10);
      const leftCol = recent.slice(0, 5);
      const rightCol = recent.slice(5, 10);

      const col1X = 80;
      const col2X = pageW / 2 + 30;

      let rowY = h2hStartY + 22;
      doc.setFont('helvetica', 'bold');
      doc.text('Date', col1X, rowY);
      doc.text('Result', col1X + 130, rowY);
      if (rightCol.length > 0) {
        doc.text('Date', col2X, rowY);
        doc.text('Result', col2X + 130, rowY);
      }
      doc.setFont('helvetica', 'normal');
      rowY += 4;
      doc.setDrawColor(180);
      doc.setLineWidth(0.5);
      doc.line(col1X, rowY, col1X + 180, rowY);
      if (rightCol.length > 0) doc.line(col2X, rowY, col2X + 180, rowY);
      rowY += 11;

      for (let j = 0; j < 5; j++) {
        const left = leftCol[j];
        const right = rightCol[j];
        if (left) {
          const result = left.homeWins > left.awayWins
            ? `W ${left.homeWins}-${left.awayWins}`
            : left.awayWins > left.homeWins
            ? `L ${left.homeWins}-${left.awayWins}`
            : `T ${left.homeWins}-${left.awayWins}`;
          doc.text(left.date || `S${left.season} W${left.week}`, col1X, rowY);
          doc.text(`${result}  (S${left.season})`, col1X + 130, rowY);
        }
        if (right) {
          const result = right.homeWins > right.awayWins
            ? `W ${right.homeWins}-${right.awayWins}`
            : right.awayWins > right.homeWins
            ? `L ${right.homeWins}-${right.awayWins}`
            : `T ${right.homeWins}-${right.awayWins}`;
          doc.text(right.date || `S${right.season} W${right.week}`, col2X, rowY);
          doc.text(`${result}  (S${right.season})`, col2X + 130, rowY);
        }
        rowY += 14;
      }
    }

    // Current Standings (two columns of 10)
    if (match.standings && match.standings.length > 0) {
      const standingsY = pageH * 0.58;

      doc.setDrawColor(180);
      doc.setLineWidth(0.5);
      doc.line(60, standingsY - 10, pageW - 60, standingsY - 10);

      doc.setFontSize(11);
      doc.setTextColor(navy);
      doc.setFont('helvetica', 'bold');
      doc.text(`Standings through Week ${match.week - 1}`, pageW / 2, standingsY + 5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      const sCol1X = 80;
      const sCol2X = pageW / 2 + 30;
      const leftStandings = match.standings.slice(0, 10);
      const rightStandings = match.standings.slice(10, 20);

      // Column headers
      let sRowY = standingsY + 22;
      doc.setTextColor(140);
      doc.setFont('helvetica', 'bold');
      doc.text('#', sCol1X, sRowY);
      doc.text('Team', sCol1X + 18, sRowY);
      doc.text('Pts', sCol1X + 165, sRowY);
      if (rightStandings.length > 0) {
        doc.text('#', sCol2X, sRowY);
        doc.text('Team', sCol2X + 18, sRowY);
        doc.text('Pts', sCol2X + 165, sRowY);
      }
      doc.setFont('helvetica', 'normal');
      sRowY += 4;
      doc.setDrawColor(200);
      doc.line(sCol1X, sRowY, sCol1X + 185, sRowY);
      if (rightStandings.length > 0) doc.line(sCol2X, sRowY, sCol2X + 185, sRowY);
      sRowY += 11;

      doc.setTextColor(80);
      for (let j = 0; j < 10; j++) {
        const left = leftStandings[j];
        const right = rightStandings[j];
        if (left) {
          const isMatchTeam = left.teamName === match.homeTeamName || left.teamName === match.awayTeamName;
          if (isMatchTeam) doc.setFont('helvetica', 'bold');
          doc.text(`${left.rank}.`, sCol1X, sRowY);
          doc.text(left.teamName, sCol1X + 18, sRowY);
          doc.text(String(left.totalPts), sCol1X + 165, sRowY);
          if (isMatchTeam) doc.setFont('helvetica', 'normal');
        }
        if (right) {
          const isMatchTeam = right.teamName === match.homeTeamName || right.teamName === match.awayTeamName;
          if (isMatchTeam) doc.setFont('helvetica', 'bold');
          doc.text(`${right.rank}.`, sCol2X, sRowY);
          doc.text(right.teamName, sCol2X + 18, sRowY);
          doc.text(String(right.totalPts), sCol2X + 165, sRowY);
          if (isMatchTeam) doc.setFont('helvetica', 'normal');
        }
        sRowY += 14;
      }
    }

    // Bottom decorative line
    doc.setDrawColor(navy);
    doc.setLineWidth(2);
    doc.line(50, pageH - 50, pageW - 50, pageH - 50);

    // Find more data CTA
    doc.setFontSize(10);
    doc.setTextColor(navy);
    doc.setFont('helvetica', 'bold');
    doc.text('Find more data at splitzkrieg.com', pageW / 2, pageH - 32, { align: 'center' });
    doc.setFont('helvetica', 'normal');

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
        const b = bowlers[j];
        if (b) {
          rows.push([
            teamName,
            b.name || '',
            b.incomingAvg != null ? String(Math.floor(b.incomingAvg)) : '',
            b.handicap != null ? String(b.handicap) : '',
            '',
            '',
            '',
            '',
          ]);
        } else {
          rows.push([teamName, '', '', '', '', '', '', '']);
        }
      }
      return rows;
    }

    // Header (week only, lanes are on cover page)
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Week ${match.week}`, 40, 30);

    // Active announcements
    const today = new Date().toISOString().slice(0, 10);
    const activeAnnouncements = announcements.filter(
      (a) => !a.expires || a.expires > today,
    );
    let announcementEndY = 30;
    if (activeAnnouncements.length > 0) {
      doc.setFontSize(9);
      doc.setTextColor(navy);
      doc.setFont('helvetica', 'bold');
      for (const a of activeAnnouncements) {
        announcementEndY += 14;
        const icon = a.type === 'urgent' ? '!  ' : '';
        doc.text(`${icon}${a.message}`, pageW / 2, announcementEndY, { align: 'center' });
      }
      doc.setFont('helvetica', 'normal');
      announcementEndY += 10;
    }

    // Check roster source per team
    const homeSource = homeBowlers[0]?.rosterSource;
    const awaySource = awayBowlers[0]?.rosterSource;
    const fallbackMsg = "Last Week's Lineup - Please Submit Lineups before 5pm Monday";

    // Home team fallback warning
    let homeTableY = Math.max(50, announcementEndY + 6);
    if (homeSource === 'lastweek') {
      doc.setFontSize(8);
      doc.setTextColor(180, 100, 0);
      doc.setFont('helvetica', 'italic');
      doc.text(fallbackMsg, 40, 42);
      doc.setFont('helvetica', 'normal');
      homeTableY = 54;
    }

    // Turkey emoji above home team's turkeys column (facing left - default)
    const tkSize = 24;
    const tkX = turkeyColX + (turkeyColW - tkSize) / 2;
    doc.addImage(TURKEY_PNG, 'PNG', tkX, homeTableY - tkSize - 4, tkSize, tkSize);

    // Home team table
    const homeRows = buildRows(match.homeTeamName, homeBowlers);
    autoTable(doc, {
      startY: homeTableY,
      head: [columns],
      body: [
        ...homeRows,
        [{ content: '', colSpan: 4, styles: { fillColor: white } }, { content: 'total w/ hdcp', colSpan: 1, styles: { halign: 'right' as const, fontStyle: 'bolditalic' as const, fillColor: white } }, '', '', ''],
        [{ content: '', colSpan: 5, styles: { fillColor: [255, 255, 255] as [number, number, number] } }, { content: 'win/loss', colSpan: 1, styles: { halign: 'right' as const, fontStyle: 'italic' as const } }, '', ''],
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
    const awayGap = 40;
    let awayTableY = afterHomeY + awayGap;
    if (awaySource === 'lastweek') {
      doc.setFontSize(8);
      doc.setTextColor(180, 100, 0);
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
        [{ content: '', colSpan: 4, styles: { fillColor: white } }, { content: 'total w/ hdcp', colSpan: 1, styles: { halign: 'right' as const, fontStyle: 'bolditalic' as const, fillColor: white } }, '', '', ''],
        [{ content: '', colSpan: 5, styles: { fillColor: [255, 255, 255] as [number, number, number] } }, { content: 'win/loss', colSpan: 1, styles: { halign: 'right' as const, fontStyle: 'italic' as const } }, '', ''],
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
    const noteY = afterAwayY + 30;
    doc.setFontSize(8);
    doc.setTextColor(100);
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

    // Feedback prompt
    doc.setFontSize(10);
    doc.setTextColor(navy);
    doc.setFont('helvetica', 'bold');
    doc.text(
      'Something noteworthy happen on the lanes tonight?',
      40,
      noteY + 80,
    );
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(
      'Tell us at splitzkrieg.com - look for the speech bubble icon in the bottom right corner.',
      40,
      noteY + 93,
    );
  }

  return doc;
}
