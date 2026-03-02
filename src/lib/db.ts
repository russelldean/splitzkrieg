/**
 * Azure SQL connection pool with exponential retry for cold starts.
 *
 * CRITICAL: This file is server-only. NEVER import from client components.
 * The mssql package uses Node.js net/tls modules that cannot be bundled for
 * the browser. All imports of db.ts must be from server components,
 * generateStaticParams, or API routes only.
 */
import sql from 'mssql';

const config: sql.config = {
  server: process.env.AZURE_SQL_SERVER!,
  database: process.env.AZURE_SQL_DATABASE!,
  user: process.env.AZURE_SQL_USER!,
  password: process.env.AZURE_SQL_PASSWORD!,
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 120000, // 120s for Azure SQL cold start
    requestTimeout: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getDb(): Promise<sql.ConnectionPool> {
  if (pool) return pool;
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      pool = await new sql.ConnectionPool(config).connect();
      return pool;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.min(5000 * Math.pow(2, attempt - 1), 60000);
      console.log(`DB connection attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('Failed to connect to database');
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
  }
}
