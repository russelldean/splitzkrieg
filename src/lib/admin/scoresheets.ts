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

export interface ScoresheetBowler {
  name: string;
  side: 'home' | 'away';
  incomingAvg: number | null;
  handicap: number | null;
}

export interface ScoresheetMatch {
  homeTeamName: string;
  awayTeamName: string;
  week: number;
  date: string;
  matchNumber: number;
  bowlers: ScoresheetBowler[];
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

  const matches: ScoresheetMatch[] = [];

  for (let idx = 0; idx < scheduleResult.recordset.length; idx++) {
    const sched = scheduleResult.recordset[idx];
    const bowlers: ScoresheetBowler[] = [];

    if (source === 'lineups') {
      // Try lineup submissions first
      const lineupResult = await db
        .request()
        .input('seasonID', sql.Int, seasonID)
        .input('week', sql.Int, week)
        .input('team1ID', sql.Int, sched.team1ID)
        .input('team2ID', sql.Int, sched.team2ID)
        .query<{
          teamID: number;
          bowlerID: number | null;
          newBowlerName: string | null;
          bowlerName: string | null;
          position: number;
        }>(
          `SELECT ls.teamID, le.bowlerID, le.newBowlerName, b.bowlerName, le.position
           FROM lineupSubmissions ls
           JOIN lineupEntries le ON ls.id = le.submissionID
           LEFT JOIN bowlers b ON le.bowlerID = b.bowlerID
           WHERE ls.seasonID = @seasonID AND ls.week = @week
             AND ls.teamID IN (@team1ID, @team2ID)
           ORDER BY ls.teamID, le.position`,
        );

      if (lineupResult.recordset.length > 0) {
        for (const row of lineupResult.recordset) {
          const name = row.bowlerID
            ? (row.bowlerName || 'TBD')
            : row.newBowlerName || 'TBD';
          const side: 'home' | 'away' =
            row.teamID === sched.team1ID ? 'home' : 'away';

          // Get incoming average for known bowlers
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

          bowlers.push({
            name,
            side,
            incomingAvg: avg,
            handicap: calcHandicap(avg),
          });
        }
      }
    }

    // Fallback: use last week's scores for roster
    if (bowlers.length === 0) {
      const prevWeek = week - 1;
      if (prevWeek >= 1) {
        const prevResult = await db
          .request()
          .input('seasonID', sql.Int, seasonID)
          .input('prevWeek', sql.Int, prevWeek)
          .input('team1ID', sql.Int, sched.team1ID)
          .input('team2ID', sql.Int, sched.team2ID)
          .query<{
            bowlerID: number;
            teamID: number;
            bowlerName: string;
            incomingAvg: number | null;
          }>(
            `SELECT s.bowlerID, s.teamID, b.bowlerName, s.incomingAvg
             FROM scores s
             JOIN bowlers b ON s.bowlerID = b.bowlerID
             WHERE s.seasonID = @seasonID AND s.week = @prevWeek
               AND s.teamID IN (@team1ID, @team2ID) AND s.isPenalty = 0
             ORDER BY s.teamID, b.bowlerName`,
          );

        for (const row of prevResult.recordset) {
          const side: 'home' | 'away' =
            row.teamID === sched.team1ID ? 'home' : 'away';
          bowlers.push({
            name: row.bowlerName,
            side,
            incomingAvg: row.incomingAvg,
            handicap: calcHandicap(row.incomingAvg),
          });
        }
      }
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

    matches.push({
      homeTeamName: sched.t1Name,
      awayTeamName: sched.t2Name,
      week,
      date: dateStr,
      matchNumber: idx + 1,
      bowlers,
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
  const grey = [220, 220, 220] as [number, number, number];
  const lightGrey = [245, 245, 245] as [number, number, number];

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

    // Home team name
    const centerY = pageH * 0.38;
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

    // Bottom decorative line
    doc.setDrawColor(navy);
    doc.setLineWidth(2);
    doc.line(50, pageH - 80, pageW - 50, pageH - 80);

    // Splitzkrieg branding
    doc.setFontSize(10);
    doc.setTextColor(180);
    doc.text('splitzkrieg.com', pageW / 2, pageH - 55, { align: 'center' });

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

    // Turkey emoji above home team's turkeys column
    const tkSize = 24;
    doc.addImage(TURKEY_PNG, 'PNG', turkeyColX + (turkeyColW - tkSize) / 2, 50 - tkSize - 4, tkSize, tkSize);

    // Home team table
    const homeRows = buildRows(match.homeTeamName, homeBowlers);
    autoTable(doc, {
      startY: 50,
      head: [columns],
      body: [
        ...homeRows,
        [{ content: '', colSpan: 4, styles: { fillColor: lightGrey } }, { content: 'total w/ hdcp', colSpan: 1, styles: { halign: 'right' as const, fontStyle: 'bolditalic' as const, fillColor: lightGrey } }, '', '', ''],
        [{ content: '', colSpan: 5, styles: { fillColor: [255, 255, 255] as [number, number, number] } }, { content: 'win/loss', colSpan: 1, styles: { halign: 'right' as const, fontStyle: 'italic' as const } }, '', ''],
      ],
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 8,
        lineColor: [180, 180, 180],
        lineWidth: 0.5,
        textColor: navy,
      },
      headStyles: {
        fillColor: grey,
        textColor: navy,
        fontSize: 9,
        fontStyle: 'bold',
        cellPadding: 6,
      },
      columnStyles: {
        0: { cellWidth: 95 },
        1: { cellWidth: 100 },
        2: { cellWidth: 45, halign: 'center' },
        3: { cellWidth: 45, halign: 'center' },
        4: { cellWidth: 72, halign: 'center', fillColor: lightGrey },
        5: { cellWidth: 72, halign: 'center', fillColor: lightGrey },
        6: { cellWidth: 72, halign: 'center', fillColor: lightGrey },
        7: { cellWidth: 50, halign: 'center' },
      },
      margin: { left: 35, right: 35 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterHomeY = (doc as any).lastAutoTable?.finalY ?? 300;

    // Turkey emoji above away team's turkeys column
    const awayTableY = afterHomeY + 25;
    doc.addImage(TURKEY_PNG, 'PNG', turkeyColX + (turkeyColW - tkSize) / 2, awayTableY - tkSize - 4, tkSize, tkSize);

    // Away team table
    const awayRows = buildRows(match.awayTeamName, awayBowlers);
    autoTable(doc, {
      startY: afterHomeY + 25,
      head: [columns],
      body: [
        ...awayRows,
        [{ content: '', colSpan: 4, styles: { fillColor: lightGrey } }, { content: 'total w/ hdcp', colSpan: 1, styles: { halign: 'right' as const, fontStyle: 'bolditalic' as const, fillColor: lightGrey } }, '', '', ''],
        [{ content: '', colSpan: 5, styles: { fillColor: [255, 255, 255] as [number, number, number] } }, { content: 'win/loss', colSpan: 1, styles: { halign: 'right' as const, fontStyle: 'italic' as const } }, '', ''],
      ],
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 8,
        lineColor: [180, 180, 180],
        lineWidth: 0.5,
        textColor: navy,
      },
      headStyles: {
        fillColor: grey,
        textColor: navy,
        fontSize: 9,
        fontStyle: 'bold',
        cellPadding: 6,
      },
      columnStyles: {
        0: { cellWidth: 95 },
        1: { cellWidth: 100 },
        2: { cellWidth: 45, halign: 'center' },
        3: { cellWidth: 45, halign: 'center' },
        4: { cellWidth: 72, halign: 'center', fillColor: lightGrey },
        5: { cellWidth: 72, halign: 'center', fillColor: lightGrey },
        6: { cellWidth: 72, halign: 'center', fillColor: lightGrey },
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
  }

  return doc;
}
