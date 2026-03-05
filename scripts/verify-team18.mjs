import sql from 'mssql';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

function parseCSV(text) {
  const lines = text.split('\n');
  const results = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQuotes = !inQuotes; }
      else if (line[i] === ',' && !inQuotes) { fields.push(current.trim()); current = ''; }
      else { current += line[i]; }
    }
    fields.push(current.trim());
    results.push(fields);
  }
  return results;
}

const csvText = readFileSync('docs/Splitzkrieg Database (Apr 2007 - Now) - Data Import (1).csv', 'utf8');
const csvRows = parseCSV(csvText).slice(1);

// Get all bowlers for Team 18 in season III (Spring 2009, seasonID=3)
const team18Bowlers = new Set();
const otsbhBowlers = new Set();
for (const row of csvRows) {
  if (row.length < 15) continue;
  const [week, team, bowler, , , , , , , , , , , , season] = row;
  if (season !== 'III') continue;
  if (!bowler || bowler === 'PENALTY') continue;
  if (team === 'Team 18') team18Bowlers.add(bowler);
  if (team === 'Over the Shoulder Bowler Holders') otsbhBowlers.add(bowler);
}

console.log('Season III (Spring 2009):');
console.log(`  Team 18 bowlers: ${[...team18Bowlers].join(', ')}`);
console.log(`  OTSBH bowlers:   ${[...otsbhBowlers].join(', ')}`);

const overlap = [...team18Bowlers].filter(b => otsbhBowlers.has(b));
console.log(`  Overlap: ${overlap.join(', ') || '(none)'}`);

// Check which weeks each appears
const team18Weeks = new Set();
const otsbhWeeks = new Set();
for (const row of csvRows) {
  if (row.length < 15 || row[14] !== 'III') continue;
  if (row[1] === 'Team 18') team18Weeks.add(row[0]);
  if (row[1] === 'Over the Shoulder Bowler Holders') otsbhWeeks.add(row[0]);
}
console.log(`  Team 18 weeks: ${[...team18Weeks].sort().join(', ')}`);
console.log(`  OTSBH weeks:   ${[...otsbhWeeks].sort().join(', ')}`);
