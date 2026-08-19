/**
 * Build-time redirects from a recap's old blog URL to its week page.
 *
 * Why this exists: /blog/[slug] is statically prerendered, and redirect() in a
 * prerendered page does NOT produce an HTTP redirect. Next compiles it into the
 * HTML as <meta http-equiv="refresh" content="1;url=...">, so a reader sees the
 * old blog page for a full second before bouncing, and anything that does not
 * execute meta refresh (crawlers, link previews) just sees the old page. Those
 * URLs are in every weekly email ever sent, so they deserve a real 307.
 *
 * Sourced from the database rather than by pattern matching the slug: at least
 * one real recap carries a custom slug that looks nothing like a recap.
 */

export interface RecapRedirect {
  source: string;
  destination: string;
  permanent: boolean;
}

export interface RecapRow {
  slug: string | null;
  seasonSlug: string | null;
  week: number | null;
}

/**
 * Map post rows to redirect entries, skipping anything that is not week-scoped.
 *
 * Never permanent: a 308 would be cached by browsers indefinitely, so moving a
 * recap back to /blog later would be impossible for anyone who had visited it.
 */
export function recapRedirectsFrom(posts: RecapRow[]): RecapRedirect[] {
  const out: RecapRedirect[] = [];
  for (const post of posts) {
    if (!post.slug || !post.seasonSlug || post.week == null) continue;
    out.push({
      source: `/blog/${post.slug}`,
      destination: `/week/${post.seasonSlug}/${post.week}`,
      permanent: false,
    });
  }
  return out;
}

/**
 * Fetch week-scoped posts and build the redirect list, for next.config.
 *
 * Runs at config evaluation time, which is Node, before the build. Failure is
 * deliberately non-fatal: a database hiccup must not fail the whole build, and
 * degrading just means those URLs fall back to the meta refresh they do today.
 * Returns an empty list rather than throwing.
 */
export async function fetchRecapRedirects(): Promise<RecapRedirect[]> {
  const { default: sql } = await import('mssql');
  const config = {
    server: process.env.AZURE_SQL_SERVER as string,
    database: process.env.AZURE_SQL_DATABASE as string,
    user: process.env.AZURE_SQL_USER as string,
    password: process.env.AZURE_SQL_PASSWORD as string,
    options: { encrypt: true, trustServerCertificate: false, connectTimeout: 30000, requestTimeout: 30000 },
  };
  if (!config.server || !config.database) return [];

  let pool: import('mssql').ConnectionPool | undefined;
  try {
    pool = await sql.connect(config);
    const result = await pool.request().query<RecapRow>(
      `SELECT slug, seasonSlug, week FROM blogPosts
       WHERE isPublished = 1 AND seasonSlug IS NOT NULL AND week IS NOT NULL`,
    );
    return recapRedirectsFrom(result.recordset);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[recap-redirects] skipped, falling back to meta refresh: ${message}`);
    return [];
  } finally {
    await pool?.close().catch(() => {});
  }
}
