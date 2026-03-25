import https from 'https';

const API_KEY = 'phx_Da7022GCSp8Wu26FvtmGN6EoMQq8sarpfKoFquPh5Mkkctt';

function runQuery(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: { kind: "HogQLQuery", query: sql } });
    const options = {
      hostname: "us.i.posthog.com",
      path: "/api/environments/@current/query/",
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    };
    const req = https.request(options, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try {
          const j = JSON.parse(data);
          if (j.results) resolve(j.results);
          else reject(new Error(JSON.stringify(j)));
        } catch(e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // 1. Session depth distribution
  console.log("\n=== SESSION DEPTH (pages per session, last 30 days) ===\n");
  const depth = await runQuery(`
    SELECT pvs, count() as session_count
    FROM (
      SELECT properties.$session_id as sid, count() as pvs
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - interval 30 day
        AND properties.$current_url LIKE '%splitzkrieg.org%'
        AND properties.$session_id IS NOT NULL
      GROUP BY sid
    )
    GROUP BY pvs
    ORDER BY pvs ASC
  `);
  console.log("Pages  |  Sessions");
  console.log("-------|----------");
  let totalSessions = 0;
  depth.forEach(r => {
    console.log(String(r[0]).padStart(5) + "  |  " + r[1]);
    totalSessions += r[1];
  });
  console.log(`\nTotal sessions: ${totalSessions}`);

  // 2. Blog page traffic
  console.log("\n=== BLOG TRAFFIC (last 30 days) ===\n");
  const blog = await runQuery(`
    SELECT properties.$current_url as path, count() as views
    FROM events
    WHERE event = '$pageview'
      AND timestamp > now() - interval 30 day
      AND properties.$current_url LIKE '%splitzkrieg.org/blog%'
    GROUP BY path
    ORDER BY views DESC
    LIMIT 20
  `);
  if (blog.length === 0) console.log("  (no blog traffic recorded)");
  else blog.forEach(r => console.log(String(r[1]).padStart(6) + "  " + r[0]));

  // 3. Entry pages (first page of session)
  console.log("\n=== TOP ENTRY PAGES (first page in session, last 30 days) ===\n");
  const entry = await runQuery(`
    SELECT first_page, count() as sessions
    FROM (
      SELECT properties.$session_id as sid,
             argMin(properties.$current_url, timestamp) as first_page
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - interval 30 day
        AND properties.$current_url LIKE '%splitzkrieg.org%'
        AND properties.$session_id IS NOT NULL
      GROUP BY sid
    )
    GROUP BY first_page
    ORDER BY sessions DESC
    LIMIT 20
  `);
  entry.forEach(r => console.log(String(r[1]).padStart(6) + "  " + r[0]));

  // 4. Traffic by day of week
  console.log("\n=== TRAFFIC BY DAY OF WEEK (last 30 days) ===\n");
  const dow = await runQuery(`
    SELECT toDayOfWeek(timestamp) as dow, count() as views
    FROM events
    WHERE event = '$pageview'
      AND timestamp > now() - interval 30 day
      AND properties.$current_url LIKE '%splitzkrieg.org%'
    GROUP BY dow
    ORDER BY dow
  `);
  const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  dow.forEach(r => console.log(String(dayNames[r[0]]).padEnd(12) + "  " + r[1]));

  // 5. Bounce rate (single page sessions)
  console.log("\n=== BOUNCE RATE ===\n");
  const bounce = await runQuery(`
    SELECT
      countIf(pvs = 1) as single_page,
      count() as total,
      round(countIf(pvs = 1) * 100.0 / count(), 1) as bounce_pct
    FROM (
      SELECT properties.$session_id as sid, count() as pvs
      FROM events
      WHERE event = '$pageview'
        AND timestamp > now() - interval 30 day
        AND properties.$current_url LIKE '%splitzkrieg.org%'
        AND properties.$session_id IS NOT NULL
      GROUP BY sid
    )
  `);
  bounce.forEach(r => console.log(`Single-page sessions: ${r[0]} of ${r[1]} (${r[2]}%)`));

  // 6. Common page flows (what do people view after homepage?)
  console.log("\n=== AFTER HOMEPAGE: NEXT PAGE VISITED ===\n");
  try {
    const flows = await runQuery(`
      SELECT next_page, count() as times
      FROM (
        SELECT properties.$session_id as sid, properties.$current_url as url,
               leadInFrame(properties.$current_url, 1) OVER (PARTITION BY properties.$session_id ORDER BY timestamp) as next_page
        FROM events
        WHERE event = '$pageview'
          AND timestamp > now() - interval 30 day
          AND properties.$current_url LIKE '%splitzkrieg.org%'
          AND properties.$session_id IS NOT NULL
      )
      WHERE url LIKE '%splitzkrieg.org/'
        AND next_page IS NOT NULL
        AND next_page != ''
      GROUP BY next_page
      ORDER BY times DESC
      LIMIT 15
    `);
    flows.forEach(r => console.log(String(r[1]).padStart(6) + "  " + r[0]));
  } catch(e) {
    console.log("  (window function not supported, skipping)");
  }

  // 7. Bowler page traffic
  console.log("\n=== BOWLER PAGE VIEWS (last 30 days) ===\n");
  const bowlers = await runQuery(`
    SELECT properties.$current_url as path, count() as views
    FROM events
    WHERE event = '$pageview'
      AND timestamp > now() - interval 30 day
      AND properties.$current_url LIKE '%splitzkrieg.org/bowler/%'
    GROUP BY path
    ORDER BY views DESC
    LIMIT 20
  `);
  bowlers.forEach(r => console.log(String(r[1]).padStart(6) + "  " + r[0]));

  // 8. Unique visitors
  console.log("\n=== UNIQUE VISITORS (last 30 days) ===\n");
  const visitors = await runQuery(`
    SELECT count(DISTINCT distinct_id) as unique_visitors
    FROM events
    WHERE event = '$pageview'
      AND timestamp > now() - interval 30 day
      AND properties.$current_url LIKE '%splitzkrieg.org%'
  `);
  visitors.forEach(r => console.log(`Unique visitors: ${r[0]}`));
}

main().catch(console.error);
