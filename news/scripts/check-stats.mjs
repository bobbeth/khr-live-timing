import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFile(path.join(root,rel),'utf8');
const elements=new Map();
const node=id=>{
 if(!elements.has(id))elements.set(id,{innerHTML:'',value:'',textContent:'',addEventListener(){},querySelectorAll(){return [];}});
 return elements.get(id);
};
const context={window:{scrollTo(){},addEventListener(){}},location:{protocol:'https:',hash:'#home'},document:{getElementById:node,querySelectorAll(){return [];},addEventListener(){}},navigator:{},console,fetch:async url=>{
 try {const rel=url.startsWith('../')?url.slice(3):'news/'+url;return {ok:true,json:async()=>JSON.parse(await read(rel))};}
 catch{return {ok:false};}
}};
vm.createContext(context);
for(const name of ['seed','editorial','stats'])vm.runInContext(await read(`news/assets/${name}.js`),context);
const script=await read('news/assets/app.js');
vm.runInContext(script.replace('init();\n})();','window.tests={driverStats,race,init};\n})();'),context);
await context.window.tests.init();
const stats=context.window.tests.driverStats;
const data=await stats.load();
assert.equal(data.failures.length,0);
assert.ok(data.drivers.length>20);
const allRaces=new Set(data.drivers.flatMap(d=>d.races.map(r=>r.entry.subsession_id)));
const historical=JSON.parse(await read('archive/index.json')).events;
const live=JSON.parse(await read('news/data/live/index.json')).events;
const expected=new Set([...historical,...live].map(e=>e.subsession_id));
assert.equal(allRaces.size,expected.size);
assert.equal(stats.points('Bomber Stocks','qualifying',1),10);
assert.equal(stats.points('Bomber Stocks','heat',1),8);
assert.equal(stats.points('Bomber Stocks','twin_feature_1',1),20);
assert.equal(stats.points('Bomber Stocks','twin_feature_2',20),1);
assert.equal(stats.points('Bomber Stocks','feature',31),0);
assert.equal(stats.points('Cushion Kings','qualifying',6),1);
assert.equal(stats.points('Cushion Kings','heat',6),2);
assert.equal(stats.points('Cushion Kings','consolation',1),11);
assert.equal(stats.points('Cushion Kings','feature',1),43);
assert.equal(stats.points('Cushion Kings','feature',0),null);
assert.equal(stats.key('Travis Mcdonald'),stats.key('Travis Mcdonald2'));
assert.equal(stats.key('Mike Davis'),stats.key('Mike Maddog Davis'));
assert.equal(stats.key('Michael Butler14'),stats.key('Michael Butler'));
assert.equal(stats.key('mike butler'),stats.key('Michael Butler'));
for(const [name,variants] of [['Mike Maddog Davis',['Mike Davis','Mike Maddog Davis']],['Michael Butler',['Michael Butler','Michael Butler14','mike butler']]]){
 const driver=data.drivers.find(d=>d.name===name);
 assert.ok(driver);
 for(const variant of variants)assert.ok(driver.names.has(variant));
 assert.equal(data.drivers.filter(d=>variants.some(v=>stats.key(v)===d.id)).length,1);
 const expectedRaces=new Set();
 for(const e of [...JSON.parse(await read('archive/index.json')).events,...JSON.parse(await read('news/data/live/index.json')).events]){
  if(expectedRaces.has(e.subsession_id))continue;
  const m=await read(`news/data/live/meetings/${e.subsession_id}.json`).catch(()=>read(`news/data/meetings/${e.subsession_id}.json`));
  if(JSON.parse(m).sessions.some(s=>(s.classification||[]).some(r=>variants.includes(r.driver))))expectedRaces.add(e.subsession_id);
 }
 assert.equal(driver.races.length,expectedRaces.size);
 assert.equal(new Set(driver.races.map(r=>r.entry.subsession_id)).size,driver.races.length);
}
const chad=data.drivers.find(d=>d.id===stats.key('Chad Puterbaugh'));
const r6=chad.races.find(r=>r.entry.subsession_id===89810317);
assert.equal(r6.finish,1);
assert.equal(r6.gain,10);
assert.ok(r6.estimated>0);
assert.equal(r6.points,r6.breakdown.reduce((a,b)=>a+b.points,0));
assert.equal(new Set(r6.breakdown.map(b=>b.session)).size,r6.breakdown.length);
for(const d of data.drivers){
 assert.equal(new Set(d.races.map(r=>r.entry.subsession_id)).size,d.races.length);
 assert.equal(stats.metrics(d.races).starts,d.races.filter(r=>r.feature).length);
}
// Saved session points must be preserved, including zeros and bonus points.
const jim=data.drivers.find(d=>d.id===stats.key('Jim Reavis'));
const opener=jim.races.find(r=>r.entry.subsession_id===88961208);
const meeting=JSON.parse(await read('news/data/meetings/88961208.json'));
const saved=meeting.sessions.filter(s=>s.available&&['qualifying','heat','twin_feature_1','twin_feature_2','feature','consolation'].includes(s.kind)).flatMap(s=>s.classification.filter(r=>stats.key(r.driver)===jim.id));
assert.equal(opener.points,saved.reduce((sum,r)=>sum+r.champ_points,0));
context.location.hash='#standings';await stats.standings();
assert.ok(node('app').innerHTML.includes('BEFORE DROPS'));
assert.ok(node('app').innerHTML.includes('*'));
for(const series of ['Bomber Stocks','Cushion Kings','Mini Menaces','Yota Outlawz','Wide Open Revival']){
 await node('standings-series').onchange({target:{value:series}});
 // Event handlers start an async render; await the same cached-data render explicitly.
 await stats.standings();
 assert.ok(node('app').innerHTML.includes(`<h2>${series}</h2>`));
}
context.location.hash='#drivers';await stats.roster();
assert.ok(node('driver-grid').innerHTML.includes('Chad Puterbaugh'));
node('driver-search').oninput({target:{value:'NO MATCH EXPECTED'}});
assert.ok(node('driver-grid').innerHTML.includes('No drivers match'));
node('driver-search').oninput({target:{value:'20'}});
assert.ok(node('driver-grid').innerHTML.includes('Chad Puterbaugh'));
for(const d of data.drivers){
 context.location.hash='#driver/'+encodeURIComponent(d.id);await stats.profile(d.id);
 assert.ok(node('app').innerHTML.includes('RACE HISTORY'));
 for(const race of d.races)assert.ok(node('app').innerHTML.includes(`#race/${race.entry.subsession_id}`));
}
context.location.hash='#driver/unknown';await stats.profile('unknown');assert.ok(node('app').innerHTML.includes('DRIVER NOT FOUND'));
for(const id of allRaces){context.location.hash='#race/'+id;await context.window.tests.race(String(id));assert.ok(node('race-details').innerHTML.includes('FINAL FEATURE RESULTS'));assert.ok(node('result-body').innerHTML.includes('#driver/'));}
// A failed result fetch is reported, not silently treated as a zero-point round.
const broken=context.window.createMMTVStats({app:node('app'),entries:()=>[{subsession_id:1,series:'Bomber Stocks'}],seasonName:()=> 'Fall Fest 2026',esc:String,displayName:String,getEvent:async()=>null,getMeeting:async()=>null});
assert.equal((await broken.load()).failures.length,1);
console.log(`PASS: ${data.drivers.length} profiles, ${allRaces.size} race pages, five standings tables, scoring boundaries, saved points, search, aliases, links and fetch failure handling.`);
