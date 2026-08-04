import { readFileSync } from 'fs';
const LP='https://www.leaguepals.com';
const raw=readFileSync(process.argv[2],'utf8').trim();
const cookie=raw.startsWith('connect.sid=')?raw:`connect.sid=${raw}`;
const H={Accept:'application/json, text/plain, */*','Content-Type':'application/json',Cookie:cookie,'User-Agent':'Mozilla/5.0',Origin:LP,Referer:LP+'/league-center'};
const g=async p=>{const r=await fetch(LP+p,{headers:H});return r.json();};
const B='69ff6c824e0fec0b32dcbef8';
const lt=await g(`/loadTeams?fullLoad=true&id=${B}&withBowlers=true`);
const nameOf=new Map(((lt.data&&lt.data.teams)||[]).map(t=>[t._id,t.name]));
const fli=await g(`/fullLeagueInfo?id=${B}`);
const slotOf=new Map();
for(const m of ((fli.data||fli).members)||[]){const ts=m.team||[],ss=m.user_team_id||[];ts.forEach((t,i)=>{if(ss[i]!=null&&!slotOf.has(t))slotOf.set(t,ss[i]);});}
const ln=await g(`/laneSchedule?league_id=${B}`);
const wk=((ln.data||ln).schedule||[]).find(w=>String(w.date).slice(0,10)==='2026-08-03');
// our schedule, match order m16..m20
const OURS=[['Fancy Pants','Gutterglory'],['Guttermouths','Lucky Strikes'],['Living on a Spare','Stinky Cheese'],['HOT FUN','The Boom Kings'],['Sparadigm Shift','Smoke a Bowl']];
console.log('=== LP 8/03 AS ENTERED ===');
const got=[];
for(const m of wk.matches){
  const n1=nameOf.get(m.team1_id)||'?', n2=nameOf.get(m.team2_id)||'?';
  got.push([m.team1_lane,m.team2_lane,n1,n2,slotOf.get(m.team1_id),slotOf.get(m.team2_id)]);
}
got.sort((a,b)=>a[0]-b[0]);
let bad=0;
got.forEach((r,i)=>{
  const [l1,l2,n1,n2,s1,s2]=r;
  const exp=OURS[i];
  const ok = exp && ((n1===exp[0]&&n2===exp[1])||(n1===exp[1]&&n2===exp[0]));
  if(!ok) bad++;
  console.log(`  lanes ${String(l1).padStart(2)}/${String(l2).padStart(2)}: ${n1} (${s1}) vs ${n2} (${s2})   ${ok?'OK':'** MISMATCH, expected '+exp.join(' vs ')+' **'}`);
});
console.log(`\nlane slot order: ${got.flatMap(r=>[r[4],r[5]]).join(' ')}`);
console.log(`expected:        12 4 15 7 14 9 16 10 8 13`);
console.log(`\n${bad?`*** ${bad} MATCH(ES) STILL WRONG ***`:'ALL 5 MATCHES CORRECT'}`);
