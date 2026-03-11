/**
 * SessionStart hook — refresh db-schema.md from live DB.
 * Runs silently; errors are non-fatal (stale schema is better than no schema).
 */
const { execSync } = require('child_process');
const path = require('path');

try {
  execSync('node scripts/refresh-schema.mjs', {
    cwd: path.resolve(__dirname, '../..'),
    timeout: 15000,
    stdio: 'pipe',
  });
} catch {
  // Non-fatal — stale schema is fine, don't block the session
}
