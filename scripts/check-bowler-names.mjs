import sql from 'mssql';
import { readFileSync } from 'fs';

const env = readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const pool = await new sql.ConnectionPool({
  server: process.env.AZURE_SQL_SERVER,
  database: process.env.AZURE_SQL_DATABASE,
  user: process.env.AZURE_SQL_USER,
  password: process.env.AZURE_SQL_PASSWORD,
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 30000 },
}).connect();

// ── Helper: Levenshtein distance ──
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return dp[m][n];
}

// ── Fetch all bowlers ──
const result = await pool.request().query(`
  SELECT bowlerID, bowlerName, slug, isActive,
         gender,
         (SELECT COUNT(*) FROM scores s WHERE s.bowlerID = b.bowlerID) AS gameWeeks
  FROM bowlers b
  ORDER BY bowlerName
`);
const bowlers = result.recordset;

// ── 1. All distinct bowler names alphabetically ──
console.log('═══════════════════════════════════════════════════════');
console.log('1. ALL BOWLERS (alphabetical)');
console.log('═══════════════════════════════════════════════════════');
console.log(`Total: ${bowlers.length} bowlers\n`);
for (const b of bowlers) {
  const active = b.isActive ? 'ACTIVE' : 'inactive';
  console.log(`  [${String(b.bowlerID).padStart(3)}] ${b.bowlerName.padEnd(30)} ${active.padEnd(8)}  ${b.gameWeeks} weeks  slug: ${b.slug}`);
}

// ── Parse first/last names ──
const parsed = bowlers.map(b => {
  const parts = b.bowlerName.trim().split(/\s+/);
  return {
    ...b,
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
    firstLower: parts[0].toLowerCase(),
    lastLower: parts.slice(1).join(' ').toLowerCase(),
  };
});

// ── 2. Same first name, different last name ──
console.log('\n═══════════════════════════════════════════════════════');
console.log('2. SAME FIRST NAME, DIFFERENT LAST NAME (maiden name changes?)');
console.log('═══════════════════════════════════════════════════════');
const byFirst = new Map();
for (const p of parsed) {
  if (!p.firstLower) continue;
  if (!byFirst.has(p.firstLower)) byFirst.set(p.firstLower, []);
  byFirst.get(p.firstLower).push(p);
}
let foundFirstMatch = false;
for (const [first, group] of [...byFirst.entries()].sort()) {
  if (group.length < 2) continue;
  const lastNames = new Set(group.map(g => g.lastLower));
  if (lastNames.size < 2) continue;
  foundFirstMatch = true;
  console.log(`\n  "${first}":`);
  for (const g of group) {
    console.log(`    [${String(g.bowlerID).padStart(3)}] ${g.bowlerName.padEnd(30)} ${g.isActive ? 'ACTIVE' : 'inactive'}  ${g.gameWeeks} weeks`);
  }
}
if (!foundFirstMatch) console.log('\n  (none found)');

// ── 3. Same last name, different first name ──
console.log('\n═══════════════════════════════════════════════════════');
console.log('3. SAME LAST NAME, DIFFERENT FIRST NAME (nicknames/typos?)');
console.log('═══════════════════════════════════════════════════════');
const byLast = new Map();
for (const p of parsed) {
  if (!p.lastLower) continue;
  if (!byLast.has(p.lastLower)) byLast.set(p.lastLower, []);
  byLast.get(p.lastLower).push(p);
}
let foundLastMatch = false;
for (const [last, group] of [...byLast.entries()].sort()) {
  if (group.length < 2) continue;
  const firstNames = new Set(group.map(g => g.firstLower));
  if (firstNames.size < 2) continue;
  foundLastMatch = true;
  console.log(`\n  "${last}":`);
  for (const g of group) {
    console.log(`    [${String(g.bowlerID).padStart(3)}] ${g.bowlerName.padEnd(30)} ${g.isActive ? 'ACTIVE' : 'inactive'}  ${g.gameWeeks} weeks`);
  }
}
if (!foundLastMatch) console.log('\n  (none found)');

// ── 4. Fuzzy matches (edit distance 1-2) ──
console.log('\n═══════════════════════════════════════════════════════');
console.log('4. SIMILAR NAMES (edit distance <= 2)');
console.log('═══════════════════════════════════════════════════════');
const fuzzyPairs = [];
for (let i = 0; i < parsed.length; i++) {
  for (let j = i + 1; j < parsed.length; j++) {
    const a = parsed[i].bowlerName.toLowerCase();
    const b = parsed[j].bowlerName.toLowerCase();
    // Skip if names are identical
    if (a === b) continue;
    const dist = levenshtein(a, b);
    if (dist <= 2) {
      fuzzyPairs.push({ a: parsed[i], b: parsed[j], dist });
    }
  }
}
if (fuzzyPairs.length === 0) {
  console.log('\n  (none found)');
} else {
  for (const { a, b, dist } of fuzzyPairs.sort((x, y) => x.dist - y.dist)) {
    console.log(`\n  Distance ${dist}:`);
    console.log(`    [${String(a.bowlerID).padStart(3)}] ${a.bowlerName.padEnd(30)} ${a.isActive ? 'ACTIVE' : 'inactive'}  ${a.gameWeeks} weeks`);
    console.log(`    [${String(b.bowlerID).padStart(3)}] ${b.bowlerName.padEnd(30)} ${b.isActive ? 'ACTIVE' : 'inactive'}  ${b.gameWeeks} weeks`);
  }
}

// ── 5. Unusual characters or formatting issues ──
console.log('\n═══════════════════════════════════════════════════════');
console.log('5. FORMATTING ISSUES');
console.log('═══════════════════════════════════════════════════════');

let foundIssues = false;

for (const b of bowlers) {
  const name = b.bowlerName;
  const issues = [];

  // Leading/trailing whitespace
  if (name !== name.trim()) issues.push('leading/trailing whitespace');

  // Double spaces
  if (/\s{2,}/.test(name)) issues.push('double spaces');

  // Non-ASCII characters
  if (/[^\x20-\x7E]/.test(name)) issues.push('non-ASCII characters');

  // Non-standard capitalization (all lower, all upper, mixed weird)
  const parts = name.trim().split(/\s+/);
  for (const part of parts) {
    if (part.length > 1 && part === part.toLowerCase()) issues.push(`lowercase part: "${part}"`);
    if (part.length > 2 && part === part.toUpperCase()) issues.push(`ALL CAPS part: "${part}"`);
  }

  // Only one name part (no last name)
  if (parts.length < 2) issues.push('single name (no last name)');

  // More than 3 name parts (unusual)
  if (parts.length > 3) issues.push(`${parts.length} name parts`);

  // Digits in name
  if (/\d/.test(name)) issues.push('contains digits');

  // Special characters (beyond letters, spaces, hyphens, apostrophes, periods)
  if (/[^a-zA-Z\s\-'.()]/.test(name)) issues.push('unusual characters');

  if (issues.length > 0) {
    foundIssues = true;
    console.log(`\n  [${String(b.bowlerID).padStart(3)}] "${b.bowlerName}"`);
    for (const issue of issues) console.log(`         -> ${issue}`);
  }
}

if (!foundIssues) console.log('\n  (no formatting issues found)');

// ── 6. Bonus: exact duplicate names ──
console.log('\n═══════════════════════════════════════════════════════');
console.log('6. EXACT DUPLICATE NAMES');
console.log('═══════════════════════════════════════════════════════');
const nameMap = new Map();
for (const b of bowlers) {
  const key = b.bowlerName.toLowerCase().trim();
  if (!nameMap.has(key)) nameMap.set(key, []);
  nameMap.get(key).push(b);
}
let foundDupes = false;
for (const [name, group] of [...nameMap.entries()].sort()) {
  if (group.length < 2) continue;
  foundDupes = true;
  console.log(`\n  "${name}":`);
  for (const g of group) {
    console.log(`    [${String(g.bowlerID).padStart(3)}] ${g.bowlerName.padEnd(30)} ${g.isActive ? 'ACTIVE' : 'inactive'}  ${g.gameWeeks} weeks  slug: ${g.slug}`);
  }
}
if (!foundDupes) console.log('\n  (no exact duplicates)');

await pool.close();
console.log('\nDone.');
