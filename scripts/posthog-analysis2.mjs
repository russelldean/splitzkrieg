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

function stripDomain(url) {
  return url.replace(/https?:\/\/(www\.)?splitzkrieg\.(com|org)/, '') || '/';
}

const PF = "properties.$current_url LIKE '%splitzkrieg.com%' OR properties.$current_url LIKE '%www.splitzkrieg.org%'";

async function main() {
  // 1. Top pages
  console.log("\n=== TOP PAGES (production, last 30 days) ===\n");
  const pages = await runQuery(`
    SELECT properties.$current_url as path, count() as views
    FROM events
    WHERE event = '$pageview' AND timestamp > now() - interval 30 day AND (${PF})
    GROUP BY path ORDER BY views DESC LIMIT 50
  `);
  pages.forEach(r => console.log(String(r[1]).padStart(6) + "  " + stripDomain(r[0])));

  // 2. Session depth
  console.log("\n=== SESSION DEPTH ===\n");
  const depth = await runQuery(`
    SELECT pvs, count() as session_count FROM (
      SELECT properties.$session_id as sid, count() as pvs FROM events
      WHERE event = '$pageview' AND timestamp > now() - interval 30 day AND (${PF})
        AND properties.$session_id IS NOT NULL
      GROUP BY sid
    ) GROUP BY pvs ORDER BY pvs ASC
  `);
  console.log("Pages  |  Sessions");
  console.log("-------|----------");
  let total = 0, bounced = 0;
  depth.forEach(r => {
    console.log(String(r[0]).padStart(5) + "  |  " + r[1]);
    total += r[1];
    if (r[0] === 1) bounced = r[1];
  });
  console.log(`\nTotal: ${total} sessions, Bounce rate: ${(bounced/total*100).toFixed(1)}%`);

  // 3. Daily traffic
  console.log("\n=== DAILY TRAFFIC ===\n");
  const daily = await runQuery(`
    SELECT toDate(timestamp) as day, count() as views, count(DISTINCT distinct_id) as visitors
    FROM events
    WHERE event = '$pageview' AND timestamp > now() - interval 30 day AND (${PF})
    GROUP BY day ORDER BY day
  `);
  console.log("Date        |  Views  |  Visitors");
  console.log("------------|---------|----------");
  daily.forEach(r => console.log(r[0] + "  |  " + String(r[1]).padStart(5) + "  |  " + String(r[2]).padStart(5)));

  // 4. Entry pages
  console.log("\n=== ENTRY PAGES ===\n");
  const entry = await runQuery(`
    SELECT first_page, count() as sessions FROM (
      SELECT properties.$session_id as sid, argMin(properties.$current_url, timestamp) as first_page
      FROM events
      WHERE event = '$pageview' AND timestamp > now() - interval 30 day AND (${PF})
        AND properties.$session_id IS NOT NULL
      GROUP BY sid
    ) GROUP BY first_page ORDER BY sessions DESC LIMIT 20
  `);
  entry.forEach(r => console.log(String(r[1]).padStart(6) + "  " + stripDomain(r[0])));

  // 5. Blog traffic
  console.log("\n=== BLOG TRAFFIC ===\n");
  const blog = await runQuery(`
    SELECT properties.$current_url as path, count() as views
    FROM events
    WHERE event = '$pageview' AND timestamp > now() - interval 30 day AND (${PF})
      AND properties.$current_url LIKE '%/blog%'
    GROUP BY path ORDER BY views DESC LIMIT 20
  `);
  if (blog.length === 0) console.log("  (no blog traffic)");
  else blog.forEach(r => console.log(String(r[1]).padStart(6) + "  " + stripDomain(r[0])));

  // 6. Deep/discovery pages
  console.log("\n=== DEEP/DISCOVERY PAGES ===\n");
  const deep = await runQuery(`
    SELECT properties.$current_url as path, count() as views
    FROM events
    WHERE event = '$pageview' AND timestamp > now() - interval 30 day AND (${PF})
      AND (properties.$current_url LIKE '%/resources%' OR properties.$current_url LIKE '%/stats/all-time%'
        OR properties.$current_url LIKE '%/milestones%' OR properties.$current_url LIKE '%/village-lanes%'
        OR properties.$current_url LIKE '%/blog%' OR properties.$current_url LIKE '%game-profiles%'
        OR properties.$current_url LIKE '%/about%')
    GROUP BY path ORDER BY views DESC
  `);
  deep.forEach(r => console.log(String(r[1]).padStart(6) + "  " + stripDomain(r[0])));

  // 7. Top bowler pages
  console.log("\n=== TOP BOWLER PAGES ===\n");
  const bowlers = await runQuery(`
    SELECT properties.$current_url as path, count() as views
    FROM events
    WHERE event = '$pageview' AND timestamp > now() - interval 30 day AND (${PF})
      AND properties.$current_url LIKE '%/bowler/%'
    GROUP BY path ORDER BY views DESC LIMIT 25
  `);
  bowlers.forEach(r => console.log(String(r[1]).padStart(6) + "  " + stripDomain(r[0])));

  // 8. Unique visitors
  console.log("\n=== UNIQUE VISITORS ===\n");
  const visitors = await runQuery(`
    SELECT count(DISTINCT distinct_id) as uv
    FROM events
    WHERE event = '$pageview' AND timestamp > now() - interval 30 day AND (${PF})
  `);
  visitors.forEach(r => console.log(`Unique visitors (30 days): ${r[0]}`));

  // 9. Day of week
  console.log("\n=== TRAFFIC BY DAY OF WEEK ===\n");
  const dow = await runQuery(`
    SELECT toDayOfWeek(timestamp) as dow, count() as views
    FROM events
    WHERE event = '$pageview' AND timestamp > now() - interval 30 day AND (${PF})
    GROUP BY dow ORDER BY dow
  `);
  const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  dow.forEach(r => console.log(String(dayNames[r[0]]).padEnd(12) + "  " + r[1]));

  // 10. Team pages
  console.log("\n=== TOP TEAM PAGES ===\n");
  const teams = await runQuery(`
    SELECT properties.$current_url as path, count() as views
    FROM events
    WHERE event = '$pageview' AND timestamp > now() - interval 30 day AND (${PF})
      AND properties.$current_url LIKE '%/team/%'
    GROUP BY path ORDER BY views DESC LIMIT 15
  `);
  teams.forEach(r => console.log(String(r[1]).padStart(6) + "  " + stripDomain(r[0])));
}

main().catch(console.error);
