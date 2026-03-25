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
  // Get all pageview sequences per session
  console.log("=== PAGE SEQUENCES (sessions with 2+ pages, last 30 days) ===\n");
  const sequences = await runQuery(`
    SELECT
      properties.$session_id as sid,
      groupArray(properties.$current_url) as pages
    FROM events
    WHERE event = '$pageview'
      AND timestamp > now() - interval 30 day
      AND properties.$current_url LIKE '%splitzkrieg.org%'
      AND properties.$session_id IS NOT NULL
    GROUP BY sid
    HAVING count() >= 2
    ORDER BY count() DESC
    LIMIT 30
  `);

  sequences.forEach((r, i) => {
    const pages = r[1].map(p => p.replace('https://www.splitzkrieg.org', '').replace(/\?.*/, '') || '/');
    console.log(`Session ${i+1} (${pages.length} pages):`);
    pages.forEach((p, j) => console.log(`  ${j+1}. ${p}`));
    console.log();
  });

  // Traffic by date to see patterns around bowling nights
  console.log("\n=== DAILY TRAFFIC (last 30 days) ===\n");
  const daily = await runQuery(`
    SELECT
      toDate(timestamp) as day,
      count() as views,
      count(DISTINCT distinct_id) as visitors
    FROM events
    WHERE event = '$pageview'
      AND timestamp > now() - interval 30 day
      AND properties.$current_url LIKE '%splitzkrieg.org%'
    GROUP BY day
    ORDER BY day
  `);
  console.log("Date        |  Views  |  Visitors");
  console.log("------------|---------|----------");
  daily.forEach(r => console.log(`${r[0]}  |  ${String(r[1]).padStart(5)}  |  ${String(r[2]).padStart(5)}`));

  // Pages never visited
  console.log("\n=== RESOURCES/EXTRAS/ALL-TIME TRAFFIC ===\n");
  const deep = await runQuery(`
    SELECT properties.$current_url as path, count() as views
    FROM events
    WHERE event = '$pageview'
      AND timestamp > now() - interval 30 day
      AND (
        properties.$current_url LIKE '%/resources%'
        OR properties.$current_url LIKE '%/extras%'
        OR properties.$current_url LIKE '%/stats/all-time%'
        OR properties.$current_url LIKE '%/milestones%'
        OR properties.$current_url LIKE '%/village-lanes%'
        OR properties.$current_url LIKE '%/blog%'
        OR properties.$current_url LIKE '%/game-profiles%'
      )
    GROUP BY path
    ORDER BY views DESC
  `);
  if (deep.length === 0) console.log("  (no traffic to these pages)");
  else deep.forEach(r => console.log(String(r[1]).padStart(6) + "  " + r[0]));
}

main().catch(console.error);
