import sql from 'mssql';
import { readFileSync } from 'fs';

// --- Config ---
const envContent = readFileSync('.env.local', 'utf8');
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const dbConfig = {
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 120000,
    requestTimeout: 30000,
  },
};

// --- Team name aliases (CSV name → DB name for matching) ---
const TEAM_NAME_ALIASES = {
  'Gutter Mouths': 'Guttermouths',
  'Big Bowler Brand': 'Werewolf Splitzers',
  'Valley Of The Balls': 'Valley of the Balls',
  'Valley Of the Balls': 'Valley of the Balls',
  'Smokeable Fernet': 'Smokeabowl Fernet',
};

// --- Parse CLI args ---
const args = process.argv.slice(2);
const csvPath = args.find(a => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const wipe = args.includes('--wipe');
const seasonArg = args.find(a => a.startsWith('--season='));
const maxWeekArg = args.find(a => a.startsWith('--max-week='));
const maxWeek = maxWeekArg ? parseInt(maxWeekArg.split('=')[1]) : null;

if (!csvPath) {
  console.error('Usage: node scripts/import-schedule-csv.mjs <csv-path> [--season=XXII] [--dry-run] [--wipe]');
  console.error('\nIf --season is not provided, the script tries to detect it from the CSV header.');
  process.exit(1);
}

// --- Detect CSV format ---
function detectFormat(lines) {
  // "Structured" format: first data row starts with "1,1," (week,match,team1,team2)
  // "Two-column" format: first data row starts with a date like "16-Jul"
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('SPLITZ') || trimmed.startsWith('Week,') || trimmed.startsWith(',')) continue;
    if (trimmed.match(/^\d+,\d+,/)) return 'structured';
    if (trimmed.match(/^\d{1,2}-[A-Za-z]{3}/)) return 'two-column';
  }
  return 'unknown';
}

// --- Parse structured format: Week,Match,Team1,Team2,... ---
function parseStructuredCSV(csvText, startDate) {
  const lines = csvText.split('\n').map(l => l.replace(/\r$/, ''));
  const weekMap = new Map(); // week# → { matches: [] }

  for (const line of lines) {
    const cols = line.split(',');
    const weekNum = parseInt(cols[0]?.trim());
    const matchNum = parseInt(cols[1]?.trim());
    const team1 = cols[2]?.trim();
    const team2 = cols[3]?.trim();

    if (!weekNum || !matchNum || !team1 || !team2) continue;

    if (!weekMap.has(weekNum)) {
      // Calculate date: biweekly from start date
      const weekDate = startDate ? new Date(startDate.getTime() + (weekNum - 1) * 14 * 86400000) : null;
      weekMap.set(weekNum, { matches: [], fullDate: weekDate });
    }
    weekMap.get(weekNum).matches.push({ team1, team2 });
  }

  return Array.from(weekMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([_, data]) => data);
}

// --- Parse start date from header: "Start Date:,1/14/19" ---
function parseStartDate(csvText) {
  const match = csvText.match(/Start Date:\s*,\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (!match) return null;
  const [m, d, y] = match[1].split('/').map(Number);
  const fullYear = y < 100 ? 2000 + y : y;
  return new Date(fullYear, m - 1, d);
}

// --- Detect column layout from first data row ---
function detectColumnLayout(lines) {
  for (const line of lines) {
    const cols = line.split(',');
    const col0 = cols[0]?.trim();
    if (!col0 || !col0.match(/^\d{1,2}-[A-Za-z]{3}$/)) continue;

    // Find the second date column (right-side date)
    let rightDateIdx = -1;
    for (let i = 1; i < cols.length; i++) {
      if (cols[i]?.trim().match(/^\d{1,2}-[A-Za-z]{3}$/)) {
        rightDateIdx = i;
        break;
      }
    }

    if (rightDateIdx === -1) continue;

    // Detect layout by finding team columns (non-empty, non-date, non-lane)
    const isLane = (s) => /^\d+\/\d+$/.test(s?.trim());
    const leftTeamCols = [];
    for (let i = 1; i < rightDateIdx; i++) {
      const v = cols[i]?.trim();
      if (v && !isLane(v)) leftTeamCols.push(i);
    }
    const rightTeamCols = [];
    for (let i = rightDateIdx + 1; i < cols.length; i++) {
      const v = cols[i]?.trim();
      if (v && !isLane(v)) rightTeamCols.push(i);
    }

    if (leftTeamCols.length >= 2 && rightTeamCols.length >= 2) {
      const layout = {
        leftTeam1: leftTeamCols[0],
        leftTeam2: leftTeamCols[1],
        rightDate: rightDateIdx,
        rightTeam1: rightTeamCols[0],
        rightTeam2: rightTeamCols[1],
      };
      console.log(`  Column layout: leftTeam1=${layout.leftTeam1}, leftTeam2=${layout.leftTeam2}, rightDate=${layout.rightDate}, rightTeam1=${layout.rightTeam1}, rightTeam2=${layout.rightTeam2}`);
      return layout;
    }
  }
  // Fallback to Season XXII layout
  return { leftTeam1: 2, leftTeam2: 3, rightDate: 5, rightTeam1: 6, rightTeam2: 7 };
}

// --- Parse two-column format (multiple layout variants) ---
function parseTwoColumnCSV(csvText, yearHint) {
  const lines = csvText.split('\n').map(l => l.replace(/\r$/, ''));
  const layout = detectColumnLayout(lines);
  const weeks = [];

  let currentLeftDate = null;
  let currentRightDate = null;
  let leftMatches = [];
  let rightMatches = [];

  for (const line of lines) {
    const cols = line.split(',');

    // Skip header rows and blank lines
    if (cols.every(c => !c.trim()) || line.includes('SPLITZKRIEG') || line.includes('Lane')) {
      if (leftMatches.length > 0) {
        weeks.push({ date: currentLeftDate, matches: leftMatches });
        leftMatches = [];
      }
      if (rightMatches.length > 0) {
        weeks.push({ date: currentRightDate, matches: rightMatches });
        rightMatches = [];
      }
      currentLeftDate = null;
      currentRightDate = null;
      continue;
    }

    const leftDate = cols[0]?.trim();
    const leftTeam1 = cols[layout.leftTeam1]?.trim();
    const leftTeam2 = cols[layout.leftTeam2]?.trim();
    const rightDate = cols[layout.rightDate]?.trim();
    const rightTeam1 = cols[layout.rightTeam1]?.trim();
    const rightTeam2 = cols[layout.rightTeam2]?.trim();

    if (leftDate && leftDate.match(/^\d{1,2}-[A-Za-z]{3}$/)) {
      currentLeftDate = leftDate;
    }
    if (rightDate && rightDate.match(/^\d{1,2}-[A-Za-z]{3}$/)) {
      currentRightDate = rightDate;
    }

    if (leftTeam1 && leftTeam2) {
      leftMatches.push({ team1: leftTeam1, team2: leftTeam2 });
    }
    const isInfoText = (t) => /^Playoff|^\d\.|^If you|^bowler |^worst /i.test(t);
    if (rightTeam1 && rightTeam2 && !isInfoText(rightTeam1)) {
      rightMatches.push({ team1: rightTeam1, team2: rightTeam2 });
    }
  }

  if (leftMatches.length > 0) weeks.push({ date: currentLeftDate, matches: leftMatches });
  if (rightMatches.length > 0) weeks.push({ date: currentRightDate, matches: rightMatches });

  const monthMap = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
  for (const week of weeks) {
    if (week.date) {
      const [day, mon] = week.date.split('-');
      const monthNum = monthMap[mon];
      if (monthNum !== undefined) {
        week.fullDate = new Date(yearHint, monthNum, parseInt(day));
      }
    }
  }

  weeks.sort((a, b) => (a.fullDate || new Date(0)) - (b.fullDate || new Date(0)));
  return weeks;
}

// --- Parse the schedule CSV (auto-detect format) ---
function parseScheduleCSV(csvText, yearHint) {
  const lines = csvText.split('\n').map(l => l.replace(/\r$/, ''));
  const format = detectFormat(lines);

  if (format === 'structured') {
    const startDate = parseStartDate(csvText);
    console.log(`  Format: structured (Week,Match,Team1,Team2), start date: ${startDate?.toISOString().split('T')[0] || 'none'}`);
    return parseStructuredCSV(csvText, startDate);
  } else if (format === 'two-column') {
    console.log(`  Format: two-column (Season XXII style)`);
    return parseTwoColumnCSV(csvText, yearHint);
  } else {
    console.error('Could not detect CSV format');
    process.exit(1);
  }
}

// --- Detect season from CSV header ---
function detectSeasonFromCSV(csvText) {
  const match = csvText.match(/SEASON\s+([IVXLCDM]+)/i);
  return match ? match[1] : null;
}

// --- Detect year from season info ---
function getYearFromSeason(displayName) {
  // e.g. "Fall 2018" → 2018, "Spring 2019" → 2019
  const match = displayName.match(/(\d{4})/);
  return match ? parseInt(match[1]) : null;
}

// --- Main ---
async function main() {
  const csvText = readFileSync(csvPath, 'utf8');

  // Determine season roman numeral
  let romanNumeral = seasonArg ? seasonArg.split('=')[1] : detectSeasonFromCSV(csvText);
  if (!romanNumeral) {
    console.error('Could not detect season from CSV. Use --season=XXII');
    process.exit(1);
  }
  console.log(`Season: ${romanNumeral}`);

  const pool = await new sql.ConnectionPool(dbConfig).connect();

  try {
    // Get season info
    const seasonResult = await pool.request()
      .input('rn', sql.VarChar, romanNumeral)
      .query('SELECT seasonID, displayName, weekCount FROM seasons WHERE romanNumeral = @rn');

    if (seasonResult.recordset.length === 0) {
      console.error(`Season ${romanNumeral} not found in DB`);
      process.exit(1);
    }

    const { seasonID, displayName, weekCount } = seasonResult.recordset[0];
    console.log(`Season ID: ${seasonID}, ${displayName}, ${weekCount} weeks`);

    // Check for existing schedule data
    const existingCount = await pool.request()
      .input('sid', sql.Int, seasonID)
      .query('SELECT COUNT(*) as cnt FROM schedule WHERE seasonID = @sid');

    if (existingCount.recordset[0].cnt > 0) {
      if (wipe) {
        // Delete matchResults first (FK), then schedule
        const mrDel = await pool.request()
          .input('sid', sql.Int, seasonID)
          .query('DELETE mr FROM matchResults mr JOIN schedule s ON mr.scheduleID = s.scheduleID WHERE s.seasonID = @sid');
        console.log(`Wiped ${mrDel.rowsAffected[0]} matchResults`);

        const schDel = await pool.request()
          .input('sid', sql.Int, seasonID)
          .query('DELETE FROM schedule WHERE seasonID = @sid');
        console.log(`Wiped ${schDel.rowsAffected[0]} schedule rows`);
      } else {
        console.error(`Season ${romanNumeral} already has ${existingCount.recordset[0].cnt} schedule rows. Use --wipe to replace.`);
        process.exit(1);
      }
    }

    // Get team name mapping for this season
    const teamsResult = await pool.request()
      .input('sid', sql.Int, seasonID)
      .query('SELECT teamID, teamName FROM teamNameHistory WHERE seasonID = @sid');

    const teamNameToID = new Map();
    for (const row of teamsResult.recordset) {
      teamNameToID.set(row.teamName.toLowerCase(), row.teamID);
    }

    // Add aliases
    for (const [alias, canonical] of Object.entries(TEAM_NAME_ALIASES)) {
      const id = teamNameToID.get(canonical.toLowerCase());
      if (id) {
        teamNameToID.set(alias.toLowerCase(), id);
      }
    }

    // Parse CSV
    const year = getYearFromSeason(displayName);
    let weeks = parseScheduleCSV(csvText, year);

    if (maxWeek) {
      weeks = weeks.slice(0, maxWeek);
      console.log(`\nParsed ${weeks.length} weeks from CSV (limited to --max-week=${maxWeek})`);
    } else {
      console.log(`\nParsed ${weeks.length} weeks from CSV`);
    }

    // Validate team names
    const allTeamNames = new Set();
    for (const week of weeks) {
      for (const match of week.matches) {
        allTeamNames.add(match.team1);
        allTeamNames.add(match.team2);
      }
    }

    let hasErrors = false;
    for (const name of allTeamNames) {
      if (!teamNameToID.has(name.toLowerCase())) {
        console.error(`  ❌ Unknown team: "${name}"`);
        hasErrors = true;
      }
    }

    if (hasErrors) {
      console.error('\nFix team name mismatches above before importing.');
      console.error('Add entries to TEAM_NAME_ALIASES in this script, or fix teamNameHistory in DB.');
      await pool.close();
      process.exit(1);
    }

    console.log(`  ✓ All ${allTeamNames.size} team names resolved`);

    // Insert schedule rows (scheduleID is identity — let DB auto-generate)
    let totalInserted = 0;
    for (let w = 0; w < weeks.length; w++) {
      const week = weeks[w];
      const weekNum = w + 1;
      const dateStr = week.fullDate ? week.fullDate.toISOString().split('T')[0] : null;

      console.log(`\nWeek ${weekNum} (${week.date || 'no date'} → ${dateStr}): ${week.matches.length} matches`);

      for (let m = 0; m < week.matches.length; m++) {
        const match = week.matches[m];
        const team1ID = teamNameToID.get(match.team1.toLowerCase());
        const team2ID = teamNameToID.get(match.team2.toLowerCase());
        const matchNumber = m + 1;

        console.log(`  Match ${matchNumber}: ${match.team1} (${team1ID}) vs ${match.team2} (${team2ID})`);

        if (!dryRun) {
          await pool.request()
            .input('seasonID', sql.Int, seasonID)
            .input('week', sql.Int, weekNum)
            .input('matchNumber', sql.Int, matchNumber)
            .input('team1ID', sql.Int, team1ID)
            .input('team2ID', sql.Int, team2ID)
            .input('matchDate', sql.Date, week.fullDate || null)
            .query(`INSERT INTO schedule (seasonID, week, matchNumber, team1ID, team2ID, matchDate)
                    VALUES (@seasonID, @week, @matchNumber, @team1ID, @team2ID, @matchDate)`);
        }
        totalInserted++;
      }
    }

    console.log(`\n${dryRun ? '[DRY RUN] Would insert' : 'Inserted'} ${totalInserted} schedule rows for Season ${romanNumeral}`);

    // Remind to populate matchResults using the correct script
    if (!dryRun && totalInserted > 0) {
      console.log(`\n✅ Schedule imported. Now run:\n  node scripts/populate-match-results.mjs --season=${seasonID}`);
    }
  } finally {
    await pool.close();
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
