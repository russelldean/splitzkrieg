import { readFileSync } from 'fs';

const csv = readFileSync('docs/standings-comparison.csv', 'utf8');
const lines = csv.split('\n').slice(1).filter(l => l.trim());

const rows = lines.map(l => {
  const cols = l.split(',');
  let team = cols[2];
  if (team.startsWith('"')) team = team.slice(1, -1);
  return {
    season: cols[0],
    division: cols[1],
    team,
    csvRank: parseInt(cols[3]),
    csvTotal: parseFloat(cols[6]),
    compTotal: cols[9] ? parseFloat(cols[9]) : null,
    compRank: cols[13] ? parseInt(cols[13]) : null,
  };
});

// Group by season + division
const groups = {};
for (const r of rows) {
  const key = r.season + '|' + r.division;
  if (!groups[key]) groups[key] = [];
  groups[key].push(r);
}

let impactCount = 0;
const impacts = [];

for (const [key, teams] of Object.entries(groups)) {
  const [season, div] = key.split('|');

  // CSV top 2 by csvRank
  const csvSorted = [...teams].sort((a, b) => a.csvRank - b.csvRank);
  const csvTop2 = new Set();
  csvSorted.slice(0, 2).forEach(t => csvTop2.add(t.team));
  // Include ties at rank 2
  const csvRank2Val = csvSorted[1]?.csvRank;
  for (const t of csvSorted.slice(2)) {
    if (t.csvRank === csvRank2Val) csvTop2.add(t.team);
  }

  // Computed top 2 by compTotal desc
  const withComp = teams.filter(t => t.compTotal !== null && !isNaN(t.compTotal));
  if (withComp.length === 0) continue;
  const compSorted = [...withComp].sort((a, b) => b.compTotal - a.compTotal);
  const compTop2 = new Set();
  compSorted.slice(0, 2).forEach(t => compTop2.add(t.team));
  const compRank2Val = compSorted[1]?.compTotal;
  for (const t of compSorted.slice(2)) {
    if (t.compTotal === compRank2Val) compTop2.add(t.team);
  }

  const csvArr = [...csvTop2].sort();
  const compArr = [...compTop2].sort();
  const same = csvArr.length === compArr.length && csvArr.every((v, i) => v === compArr[i]);

  if (!same) {
    impactCount++;
    const csvOnly = csvArr.filter(t => !compTop2.has(t));
    const compOnly = compArr.filter(t => !csvTop2.has(t));

    const topDisplay = compSorted.slice(0, 5).map(t => {
      const tags = [];
      if (csvTop2.has(t.team)) tags.push('CSV-playoff');
      if (compTop2.has(t.team)) tags.push('COMP-playoff');
      const tagStr = tags.length > 0 ? '  [' + tags.join(', ') + ']' : '';
      return '    ' + t.team.padEnd(25) +
        'CSV: ' + String(t.csvTotal).padEnd(5) + ' (#' + t.csvRank + ')' +
        '   Comp: ' + String(t.compTotal).padEnd(5) + ' (#' + t.compRank + ')' +
        tagStr;
    });

    impacts.push({ season, div, csvOnly: csvOnly.join(', '), compOnly: compOnly.join(', '), detail: topDisplay });
  }
}

console.log('PLAYOFF IMPACT ANALYSIS');
console.log('Top 2 teams per division make playoffs');
console.log('='.repeat(85));
console.log('');

if (impacts.length === 0) {
  console.log('No playoff impacts found! CSV and computed top-2 match in every division.');
} else {
  for (const imp of impacts) {
    console.log('Season ' + imp.season + ' Division ' + imp.div + ':');
    console.log('  Would NOT have made playoffs: ' + imp.csvOnly);
    console.log('  Would have made playoffs:     ' + imp.compOnly);
    for (const d of imp.detail) console.log(d);
    console.log('');
  }
}

console.log('='.repeat(85));
console.log('Divisions with different playoff teams: ' + impactCount + ' / ' + Object.keys(groups).length);
