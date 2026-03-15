/**
 * Scoresheet PDF generation for league night.
 * Generates printable landscape PDFs with bowler names, averages, and handicaps.
 * Uses jspdf + jspdf-autotable for table layout.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import sql from 'mssql';
import { getDb } from '@/lib/db';

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
  bowlers: ScoresheetBowler[];
}

/**
 * Calculate handicap using the project formula:
 * FLOOR((225 - FLOOR(incomingAvg)) * 0.95)
 */
function calcHandicap(avg: number | null): number | null {
  if (avg == null || avg <= 0) return null;
  return Math.floor((225 - Math.floor(avg)) * 0.95);
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
      team1ID: number;
      team2ID: number;
      matchDate: string | null;
      t1Name: string;
      t2Name: string;
    }>(
      `SELECT sch.scheduleID, sch.team1ID, sch.team2ID, sch.matchDate,
              t1.teamName AS t1Name, t2.teamName AS t2Name
       FROM schedule sch
       JOIN teams t1 ON sch.team1ID = t1.teamID
       JOIN teams t2 ON sch.team2ID = t2.teamID
       WHERE sch.seasonID = @seasonID AND sch.week = @week
         AND sch.team1ID IS NOT NULL AND sch.team2ID IS NOT NULL
       ORDER BY sch.matchNumber`,
    );

  const matches: ScoresheetMatch[] = [];

  for (const sched of scheduleResult.recordset) {
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
          firstName: string | null;
          lastName: string | null;
          position: number;
        }>(
          `SELECT ls.teamID, le.bowlerID, le.newBowlerName, b.firstName, b.lastName, le.position
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
            ? `${row.firstName} ${row.lastName}`
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
            firstName: string;
            lastName: string;
            incomingAvg: number | null;
          }>(
            `SELECT s.bowlerID, s.teamID, b.firstName, b.lastName, s.incomingAvg
             FROM scores s
             JOIN bowlers b ON s.bowlerID = b.bowlerID
             WHERE s.seasonID = @seasonID AND s.week = @prevWeek
               AND s.teamID IN (@team1ID, @team2ID) AND s.isPenalty = 0
             ORDER BY s.teamID, b.lastName`,
          );

        for (const row of prevResult.recordset) {
          const side: 'home' | 'away' =
            row.teamID === sched.team1ID ? 'home' : 'away';
          bowlers.push({
            name: `${row.firstName} ${row.lastName}`,
            side,
            incomingAvg: row.incomingAvg,
            handicap: calcHandicap(row.incomingAvg),
          });
        }
      }
    }

    // If still no bowlers, add empty slots
    if (bowlers.length === 0) {
      for (let i = 0; i < 4; i++) {
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
      bowlers,
    });
  }

  return matches;
}

/**
 * Generate a printable PDF scoresheet from matchup data.
 * One page per match, landscape letter, with home and away team tables.
 */
export function generateScoresheet(matches: ScoresheetMatch[]): jsPDF {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });

  const navy = '#1a1f3d';
  const headerBg = '#1a1f3d';
  const headerText = '#f5f0e8';

  for (let i = 0; i < matches.length; i++) {
    if (i > 0) doc.addPage();
    const match = matches[i];

    // Title
    doc.setFontSize(16);
    doc.setTextColor(navy);
    doc.text(
      `${match.homeTeamName} vs ${match.awayTeamName}`,
      doc.internal.pageSize.getWidth() / 2,
      40,
      { align: 'center' },
    );

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      `Week ${match.week}${match.date ? ` | ${match.date}` : ''}`,
      doc.internal.pageSize.getWidth() / 2,
      56,
      { align: 'center' },
    );

    const homeBowlers = match.bowlers.filter((b) => b.side === 'home');
    const awayBowlers = match.bowlers.filter((b) => b.side === 'away');

    const columns = ['#', 'Bowler', 'Avg', 'HCP', 'Game 1', 'Game 2', 'Game 3', 'Turkeys'];

    function buildRows(
      bowlers: ScoresheetBowler[],
    ): Array<Array<string | number>> {
      // Ensure at least 4 rows
      const rows: Array<Array<string | number>> = [];
      for (let j = 0; j < Math.max(bowlers.length, 4); j++) {
        const b = bowlers[j];
        if (b) {
          rows.push([
            j + 1,
            b.name || '',
            b.incomingAvg != null ? String(Math.floor(b.incomingAvg)) : 'NEW',
            b.handicap != null ? String(b.handicap) : '-',
            '',
            '',
            '',
            '',
          ]);
        } else {
          rows.push([j + 1, '', '', '', '', '', '', '']);
        }
      }
      return rows;
    }

    // Home team table
    autoTable(doc, {
      startY: 75,
      head: [[{ content: match.homeTeamName, colSpan: 8, styles: { halign: 'left', fillColor: headerBg, textColor: headerText, fontSize: 10, fontStyle: 'bold' } }], columns],
      body: buildRows(homeBowlers),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5, lineColor: [180, 180, 180], lineWidth: 0.5 },
      headStyles: { fillColor: [240, 240, 240], textColor: navy, fontSize: 8, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 30, halign: 'center' },
        1: { cellWidth: 160 },
        2: { cellWidth: 50, halign: 'center' },
        3: { cellWidth: 50, halign: 'center' },
        4: { cellWidth: 80, halign: 'center' },
        5: { cellWidth: 80, halign: 'center' },
        6: { cellWidth: 80, halign: 'center' },
        7: { cellWidth: 60, halign: 'center' },
      },
      margin: { left: 40 },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const afterHomeY = (doc as any).lastAutoTable?.finalY ?? 250;

    // Away team table
    autoTable(doc, {
      startY: afterHomeY + 20,
      head: [[{ content: match.awayTeamName, colSpan: 8, styles: { halign: 'left', fillColor: headerBg, textColor: headerText, fontSize: 10, fontStyle: 'bold' } }], columns],
      body: buildRows(awayBowlers),
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5, lineColor: [180, 180, 180], lineWidth: 0.5 },
      headStyles: { fillColor: [240, 240, 240], textColor: navy, fontSize: 8, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 30, halign: 'center' },
        1: { cellWidth: 160 },
        2: { cellWidth: 50, halign: 'center' },
        3: { cellWidth: 50, halign: 'center' },
        4: { cellWidth: 80, halign: 'center' },
        5: { cellWidth: 80, halign: 'center' },
        6: { cellWidth: 80, halign: 'center' },
        7: { cellWidth: 60, halign: 'center' },
      },
      margin: { left: 40 },
    });
  }

  return doc;
}
