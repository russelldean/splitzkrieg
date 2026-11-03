// LeaguePals must carry OUR rolling average. A bowler moved between teams inside one
// event gets a second averages[] row (keyed on league+team) and the lanes may read the
// stale one. This sets every Event C averages[] row to enteringAvg (which
// `lp-prep-night.mjs --verify` proves equals ours) via roster_avg, roster order unchanged.
// Proven 2026-10-05: 4 bowlers fixed, seats/lanes unchanged, no emails.
// Usage: node scripts/lp-fix-dup-avgs.mjs --cookie-file=PATH [--apply]   (dry run by default)
import { readFileSync } from 'fs';
const LP = 'https://www.leaguepals.com';
const LEAGUE = '69ff6fa7d824a6df6ec83597';
const APPLY = process.argv.includes('--apply');
const raw = readFileSync(process.argv.find(a => a.startsWith('--cookie-file=')).split('=')[1], 'utf8').trim();
const H = {
  Accept: 'application/json, text/plain, */*', 'Content-Type': 'application/json',
  Cookie: raw.startsWith('connect.sid=') ? raw : `connect.sid=${raw}`,
  'User-Agent': 'Mozilla/5.0', Origin: LP, Referer: LP + '/all-teams-center',
};
async function lp(path, body) {
  const res = await fetch(LP + path, body ? { method: 'POST', headers: H, body: JSON.stringify(body) } : { headers: H });
  if (!(res.headers.get('content-type') || '').includes('json')) throw new Error(`${path} -> ${res.status} not json`);
  return res.json();
}
const unwrap = r => (r && r.data !== undefined ? r.data : r);
const roster = async id => unwrap(await lp(`/api/loadIndividualTeam?id=${id}&noPre=false`));
const mine = b => (b.averages || []).filter(a => String(a.league || '') === LEAGUE);
const bad = b => mine(b).some(a => Number(a.average ?? 0) !== Number(b.enteringAvg));

const teams = unwrap(await lp(`/loadTeams?fullLoad=true&id=${LEAGUE}&withBowlers=true`)).teams;
let touched = 0;
for (const t of teams) {
  const r = await roster(t._id);
  const fix = r.filter(b => mine(b).length > 1 && bad(b));
  if (!fix.length) continue;
  for (const b of fix) {
    console.log(`${t.name}: ${b.name} entering=${b.enteringAvg} rows=` +
      JSON.stringify(mine(b).map(a => ({ team: a.team, average: a.average }))));
  }
  if (!APPLY) continue;
  const before = r.length;
  const next = r.map(b => (fix.includes(b)
    ? { ...b, averages: b.averages.map(a => (String(a.league || '') === LEAGUE ? { ...a, average: Number(b.enteringAvg) } : a)) }
    : b));
  const res = await lp('/updateTeam', {
    type: 'roster_avg', bowlers: next.filter(m => m.email != null).map(m => m.email),
    roster: next, league: LEAGUE, id: t._id, origin: 'AllTeamsCenter-updateRoster',
  });
  const after = await roster(t._id);
  const still = after.filter(b => mine(b).length > 1 && bad(b));
  console.log(`  -> posted (${JSON.stringify(res).slice(0, 80)}); seats ${before} -> ${after.length}; still wrong: ${still.map(b => b.name).join(', ') || 'none'}`);
  touched++;
}
console.log(APPLY ? `teams pushed: ${touched}` : 'dry run');
