import { readFileSync } from 'fs';
const LP='https://www.leaguepals.com';
const raw=readFileSync(process.argv[2],'utf8').trim();
const cookie=raw.startsWith('connect.sid=')?raw:`connect.sid=${raw}`;
const H={Accept:'application/json, text/plain, */*','Content-Type':'application/json',Cookie:cookie,'User-Agent':'Mozilla/5.0',Origin:LP,Referer:LP+'/all-teams-center'};
const g=async p=>{const r=await fetch(LP+p,{headers:H});return r.json();};
const B='69ff6c824e0fec0b32dcbef8';
const lt=await g(`/loadTeams?fullLoad=true&id=${B}&withBowlers=true`);
const teams=(lt.data&&lt.data.teams)||[];
const fli=await g(`/fullLeagueInfo?id=${B}`);
const mem=((fli.data||fli).members)||[];
const liveIds=new Set(teams.map(t=>t._id));
const memByEmail=new Map(mem.map(m=>[String(m.email||'').toLowerCase(),m]));

// expected top-4 from our CSV
const csv=readFileSync(process.argv[3]+'/lp-B-0803-FULL.csv','utf8').trim().split('\n').slice(1).map(l=>l.split(','));
const expect={};
for(const c of csv){ (expect[c[3]] ||= []).push({name:c[0],email:c[2],pos:+c[5],avg:c[8]===''?null:+c[8]}); }

let seatNoMember=[], avgBad=[], orderBad=[], seats=0;
console.log('team                 seats  top4(LP)  top4(ours)  lineup order  averages');
for(const t of teams){
  const det=await g(`/api/loadIndividualTeam?id=${t._id}&noPre=false`);
  const arr=((det&&det.data)||det)||[]; seats+=arr.length;
  const exp=(expect[t.name]||[]).sort((a,b)=>a.pos-b.pos);
  // membership coverage
  for(const b of arr){
    const m=memByEmail.get(String(b.email||'').toLowerCase());
    if(!m || !(m.team||[]).some(x=>liveIds.has(x))) seatNoMember.push(`${t.name}: ${b.name}`);
  }
  // averages
  for(const b of arr){
    const e=exp.find(x=>x.email.toLowerCase()===String(b.email||'').toLowerCase());
    if(e && e.avg!=null && Number(b.enteringAvg)!==e.avg) avgBad.push(`${t.name}: ${b.name} LP=${b.enteringAvg} ours=${e.avg}`);
  }
  // order of the first 4
  const lpTop=arr.slice(0,4).map(b=>b.name).join('|');
  const exTop=exp.slice(0,4).map(b=>b.name).join('|');
  const orderOK=lpTop===exTop; if(!orderOK) orderBad.push(`${t.name}\n      LP:   ${lpTop}\n      ours: ${exTop}`);
  const lpT4=arr.slice(0,4).reduce((n,b)=>n+(Number(b.enteringAvg)||0),0);
  const exT4=exp.slice(0,4).reduce((n,b)=>n+(b.avg||0),0);
  console.log(`${t.name.padEnd(20)} ${String(arr.length).padStart(4)}  ${String(lpT4).padStart(8)}  ${String(exT4).padStart(10)}  ${orderOK?'    OK      ':'  ** OFF **'}  ${avgBad.length?'':''}`);
}
console.log(`\nSEATS=${seats}  MEMBERS=${mem.length}`);
const orphans=mem.filter(m=>!(m.team||[]).some(x=>liveIds.has(x)));
console.log(`\n*** CRITICAL: seats with no live membership row: ${seatNoMember.length}`);
seatNoMember.forEach(s=>console.log('   '+s));
console.log(`\nmembership rows with no live team (cosmetic - departed bowlers): ${orphans.length}`);
console.log('   '+orphans.map(m=>m.userName).join(', '));
console.log(`\nentering-average mismatches: ${avgBad.length}`);
avgBad.forEach(s=>console.log('   '+s));
console.log(`\nlineup-order mismatches: ${orderBad.length}`);
orderBad.forEach(s=>console.log('   '+s));
