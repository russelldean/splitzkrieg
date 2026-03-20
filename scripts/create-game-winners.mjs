/**
 * Create the gameWinners table for the Hit the 10 Pin mini-game.
 * Usage: node scripts/create-game-winners.mjs
 */
import sql from 'mssql';
import { readFileSync } from 'fs';

// Load env
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
    requestTimeout: 60000,
  },
};

async function main() {
  console.log('Connecting to Azure SQL...');
  const pool = await sql.connect(dbConfig);

  // Check if table already exists
  const check = await pool.request().query(`
    SELECT OBJECT_ID('gameWinners') AS id
  `);

  if (check.recordset[0].id) {
    console.log('gameWinners table already exists. Skipping creation.');
    await pool.close();
    return;
  }

  console.log('Creating gameWinners table...');
  await pool.request().query(`
    CREATE TABLE gameWinners (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(50) NOT NULL,
      attemptCount INT NOT NULL,
      wonAt DATETIME2 NOT NULL DEFAULT GETDATE()
    )
  `);

  console.log('gameWinners table created successfully.');
  await pool.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
