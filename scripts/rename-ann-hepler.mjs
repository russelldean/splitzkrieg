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

// Find Ann Hepler
const check = await pool.request().query(`
  SELECT bowlerID, bowlerName, slug
  FROM bowlers
  WHERE bowlerName = 'Ann Hepler'
`);

if (check.recordset.length === 0) {
  console.log('Ann Hepler not found in bowlers table');
  await pool.close();
  process.exit(0);
}

const bowler = check.recordset[0];
console.log('Found:', bowler);

// Update name and slug
await pool.request()
  .input('id', bowler.bowlerID)
  .query(`
    UPDATE bowlers
    SET bowlerName = 'Ann McCaffrey',
        slug = 'ann-mccaffrey'
    WHERE bowlerID = @id
  `);

// Verify
const verify = await pool.request()
  .input('id', bowler.bowlerID)
  .query('SELECT bowlerID, bowlerName, slug FROM bowlers WHERE bowlerID = @id');

console.log('Updated to:', verify.recordset[0]);

await pool.close();
