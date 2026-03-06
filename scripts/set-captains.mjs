import sql from 'mssql';
import { readFileSync } from 'fs';

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
  options: { encrypt: true, trustServerCertificate: false, connectTimeout: 120000, requestTimeout: 30000 },
};

const captains = [
  ["Thoughts and Spares", "Alex Rubenstein"],
  ["Guttermouths", "Brooke Insley"],
  ["Lucky Strikes", "Russ Dean"],
  ["Stinky Cheese", "Jack Driver"],
  ["Wild Llamas", "Mark Oates"],
  ["The Boom Kings", "Scott Jeffries"],
  ["E-Bowla", "James Hepler"],
  ["Sparadigm Shift", "Jeremy Kumin"],
  ["Gutterglory", "Chuck Samuels"],
  ["Smoke-a-Bowl", "Emma Richardson"],
  ["Living on a Spare", "Ellen Duda"],
  ["Hot Shotz", "Paul Marsh"],
  ["Alley Oops", "Stephen Conrad"],
  ["Pin-Ups", "Christina Pelech"],
  ["Valley of the Balls", "Jenny Peters"],
  ["Fancy Pants", "Fikri Yucel"],
  ["Bowl Durham", "Madelyne Rush"],
  ["Grandma's Teeth", "Mike DePasquale"],
  ["Guttersnipes", "Lloyd Mason"],
  ["HOT FUN", "Vance Woods"],
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const pool = await new sql.ConnectionPool(dbConfig).connect();

  // Load lookups
  const teams = await pool.request().query('SELECT teamID, teamName FROM teams');
  const bowlers = await pool.request().query('SELECT bowlerID, bowlerName FROM bowlers');

  const teamMap = new Map(teams.recordset.map(t => [t.teamName.toLowerCase(), t.teamID]));
  const bowlerMap = new Map(bowlers.recordset.map(b => [b.bowlerName.toLowerCase(), b.bowlerID]));

  // Step 1: Verify all mappings
  console.log('=== Verifying captain mappings ===');
  let allGood = true;
  const mappings = [];
  for (const [teamName, captainName] of captains) {
    const tid = teamMap.get(teamName.toLowerCase());
    const bid = bowlerMap.get(captainName.toLowerCase());
    const issues = [];
    if (!tid) issues.push('TEAM NOT FOUND');
    if (!bid) issues.push('BOWLER NOT FOUND');
    if (issues.length > 0) {
      console.log(`  PROBLEM: ${teamName} -> ${captainName} [${issues.join(', ')}]`);
      allGood = false;
    } else {
      console.log(`  OK: ${teamName} (${tid}) -> ${captainName} (${bid})`);
      mappings.push({ teamID: tid, bowlerID: bid, teamName, captainName });
    }
  }

  if (!allGood) {
    console.log('\nFix issues above before proceeding.');
    await pool.close();
    process.exit(1);
  }

  // Step 2: Add isCaptain column if it doesn't exist
  const colCheck = await pool.request().query(`
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'teamRosters' AND COLUMN_NAME = 'isCaptain'
  `);
  if (colCheck.recordset.length === 0) {
    console.log('\nAdding isCaptain column to teamRosters...');
    if (!dryRun) {
      await pool.request().query(`
        ALTER TABLE teamRosters ADD isCaptain BIT NOT NULL DEFAULT 0
      `);
    }
    console.log('  Done.');
  } else {
    console.log('\nisCaptain column already exists.');
  }

  // Step 3: Set captains for current season (seasonID 35)
  const seasonID = 35;
  console.log(`\nSetting captains for season ${seasonID}...`);

  // First clear any existing captain flags for this season
  if (!dryRun) {
    await pool.request()
      .input('sid', sql.Int, seasonID)
      .query('UPDATE teamRosters SET isCaptain = 0 WHERE seasonID = @sid');
  }

  let updated = 0;
  for (const m of mappings) {
    const result = dryRun ? { rowsAffected: [1] } : await pool.request()
      .input('tid', sql.Int, m.teamID)
      .input('bid', sql.Int, m.bowlerID)
      .input('sid', sql.Int, seasonID)
      .query('UPDATE teamRosters SET isCaptain = 1 WHERE teamID = @tid AND bowlerID = @bid AND seasonID = @sid');

    if (result.rowsAffected[0] === 0) {
      console.log(`  WARNING: No roster row for ${m.captainName} on ${m.teamName} in season ${seasonID}`);
    } else {
      console.log(`  Set: ${m.captainName} -> ${m.teamName}`);
      updated++;
    }
  }

  console.log(`\n=== ${dryRun ? 'Would update' : 'Updated'} ${updated} captain flags ===`);
  await pool.close();
}

main().catch(err => { console.error(err); process.exit(1); });
