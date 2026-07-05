/**
 * Maintenance gate used by middleware. Kept as a pure, dependency-free module
 * so the predicate is unit-testable and the HTML has zero runtime/DB coupling.
 *
 * Turn on by setting MAINTENANCE_MODE=on in the Vercel environment.
 */

// Prefixes that must stay reachable while the public site is gated:
// the admin console and every API route (revalidate, cron, admin actions).
const ALLOW_PREFIXES = ['/evillair', '/api', '/_next'];

export function shouldServeMaintenance(
  pathname: string,
  mode: string | undefined,
): boolean {
  if (mode !== 'on') return false;
  if (ALLOW_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return false;
  }
  // Let static assets through (any path whose last segment has a file extension).
  const lastSegment = pathname.split('/').pop() ?? '';
  if (lastSegment.includes('.')) return false;
  return true;
}

export const MAINTENANCE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Splitzkrieg is getting ready for the new season</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #0b0b0f; color: #f5f5f5; text-align: center; padding: 2rem;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  }
  .wrap { max-width: 32rem; }
  h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 1rem; letter-spacing: 0.01em; }
  p { font-size: 1.05rem; line-height: 1.6; color: #c9c9d1; margin: 0.5rem 0; }
  .mark { font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: #ff5a4d; font-size: 0.8rem; margin-bottom: 1.5rem; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="mark">Splitzkrieg</div>
    <h1>We are getting ready for the new season.</h1>
    <p>The site is briefly offline while we roll out something better.</p>
    <p>Check back soon.</p>
  </div>
</body>
</html>`;
