#!/usr/bin/env node
/**
 * Flag bowlers whose night is far from their entering average — the only signal we
 * have for an unrecorded substitution.
 *
 * LeaguePals carries NO sub data for this league: verified 2026-08-04 that all 80
 * player slots across both week-2 nights are `isDefault:true` with no `subName`,
 * `isSubstitute` or `isLoaned`. The lanes type scores into the pre-loaded lineup, so
 * a sub silently inherits the rostered bowler's name AND their handicap. Norwood Cheek
 * (avg 151) bowled as Lillith Fallon (avg 64) and gained her 147 handicap, which
 * flipped a match 3-0 the wrong way.
 *
 * Usage: node scripts/flag-sub-outliers.mjs --season=36 --week=2 [--threshold=25]
 */
import sql from 'mssql';
import { readFileSync } from 'fs';

const arg=(k,d)=>{const h=process.argv.find(a=>a.startsWith(`--${k}=`));return h?h.split('=')[1]:d;};
const SEASON=parseInt(arg('season','36'),10), WEEK=parseInt(arg('week','2'),10);
const TH=parseInt(arg('threshold','25'),10);
const env=readFileSync('/Users/russdean/Projects/splitzkrieg/.env.local','utf8');
for(const l of env.split('\n')){const m=l.match(/^([^#=]+)=(.*)$/);if(m)process.env[m[1].trim()]=m[2].trim();}
const pool=await sql.connect({server:process.env.AZURE_SQL_SERVER,database:process.env.AZURE_SQL_DATABASE,user:process.env.AZURE_SQL_USER,password:process.env.AZURE_SQL_PASSWORD,options:{encrypt:true,trustServerCertificate:false,connectTimeout:120000,requestTimeout:60000}});
const rows=(await pool.request().query(`
  SELECT b.bowlerName,t.teamName,s.game1,s.game2,s.game3,s.scratchSeries,s.incomingAvg
  FROM scores s JOIN bowlers b ON b.bowlerID=s.bowlerID JOIN teams t ON t.teamID=s.teamID
  WHERE s.seasonID=${SEASON} AND s.week=${WEEK} AND s.isPenalty=0
`)).recordset;
const out=rows.filter(r=>r.incomingAvg!=null).map(r=>({
  ...r, night: r.scratchSeries/3, dev: r.scratchSeries/3 - Number(r.incomingAvg),
})).sort((a,b)=>Math.abs(b.dev)-Math.abs(a.dev));
console.log(`S${SEASON} week ${WEEK} — deviation from entering average (threshold ±${TH})\n`);
console.log('bowler                team                 avg   night    dev');
for(const r of out){
  const flag=Math.abs(r.dev)>=TH?(r.dev>0?'   <<< WAY OVER — sub?':'   <<< way under'):'';
  console.log(`${r.bowlerName.padEnd(22)}${r.teamName.padEnd(21)}${String(r.incomingAvg).padStart(4)}  ${r.night.toFixed(1).padStart(6)}  ${(r.dev>0?'+':'')+r.dev.toFixed(1).padStart(5)}${flag}`);
}
const noAvg=rows.filter(r=>r.incomingAvg==null);
if(noAvg.length) console.log(`\nno entering average (flat 219 rule, not comparable): ${noAvg.map(r=>r.bowlerName).join(', ')}`);
await pool.close();
