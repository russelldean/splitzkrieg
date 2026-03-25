import https from 'https';

const API_KEY = 'phx_Da7022GCSp8Wu26FvtmGN6EoMQq8sarpfKoFquPh5Mkkctt';
const PF = "properties.$current_url LIKE '%splitzkrieg.com%' OR properties.$current_url LIKE '%www.splitzkrieg.org%'";

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
  console.log("\n=== TODAY'S TRAFFIC (March 24) ===\n");
  const pages = await runQuery(`
    SELECT properties.$current_url as url, count() as views
    FROM events
    WHERE event = '$pageview' AND toDate(timestamp) = '2026-03-24' AND (${PF})
    GROUP BY url ORDER BY views DESC LIMIT 30
  `);
  pages.forEach(r => {
    const path = r[0].replace(/https?:\/\/(www\.)?splitzkrieg\.(com|org)/, '') || '/';
    console.log(String(r[1]).padStart(6) + "  " + path);
  });

  console.log("\n=== TODAY'S UNIQUE VISITORS ===\n");
  const uv = await runQuery(`
    SELECT count(DISTINCT distinct_id) as uv
    FROM events
    WHERE event = '$pageview' AND toDate(timestamp) = '2026-03-24' AND (${PF})
  `);
  uv.forEach(r => console.log(`Unique visitors today: ${r[0]}`));

  console.log("\n=== HOURLY TRAFFIC TODAY ===\n");
  const hourly = await runQuery(`
    SELECT toHour(timestamp) as hr, count() as views, count(DISTINCT distinct_id) as visitors
    FROM events
    WHERE event = '$pageview' AND toDate(timestamp) = '2026-03-24' AND (${PF})
    GROUP BY hr ORDER BY hr
  `);
  hourly.forEach(r => console.log(`${String(r[0]).padStart(2)}:00  |  ${String(r[1]).padStart(4)} views  |  ${r[2]} visitors`));
}

main().catch(console.error);
