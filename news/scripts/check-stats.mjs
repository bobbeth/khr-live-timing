import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=rel=>fs.readFile(path.join(root,rel),'utf8');
const elements=new Map();
const node=id=>{
 if(!elements.has(id))elements.set(id,{innerHTML:'',value:'',textContent:'',addEventListener(){},querySelector(selector){return node(id+' '+selector);},querySelectorAll(){return [];}});
 return elements.get(id);
};
const context={URL,setInterval:()=>0,clearInterval(){},window:{scrollTo(){},addEventListener(){}},location:{protocol:'https:',hash:'#home'},document:{getElementById:node,querySelectorAll(){return [];},addEventListener(){}},navigator:{},console,fetch:async url=>{
 try {const rel=url.startsWith('../')?url.slice(3):'news/'+url;return {ok:true,json:async()=>JSON.parse(await read(rel))};}
 catch{return {ok:false};}
}};
vm.createContext(context);
for(const name of ['seed','editorial','progression','stats','broadcasts','newsroom','race-insights','venues','round-reviews','commentary'])vm.runInContext(await read(`news/assets/${name}.js`),context);
const script=await read('news/assets/app.js');
vm.runInContext(script.replace('init();\n})();','window.tests={driverStats,race,init,championships,raceInsights,roundReviews,route,commentary,venues};\n})();'),context);
await context.window.tests.init();
const stats=context.window.tests.driverStats;
const insights=context.window.tests.raceInsights;
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
const profileFile=JSON.parse(await read('news/data/driver-profiles.json'));
assert.equal(data.drivers.find(d=>d.name==='Mike Maddog Davis').iracing_id,536465);
assert.ok(data.drivers.find(d=>d.name==='Kent McClain').profile.bio);
assert.equal(stats.safeProfileUrl('javascript:alert(1)'), '');
assert.equal(stats.safeProfileUrl('data:text/html,bad'), '');
assert.equal(stats.safeProfileUrl('/images/example'),'https://profiles.sdk-gaming.co.uk/images/example');
const escapedProfile=stats.profileDetails({name:'Example',profile:{bio:'<script>alert(1)</script>',website:'javascript:bad',pictureUrl:'javascript:bad'}});
assert.ok(escapedProfile.includes('&lt;script&gt;'));assert.ok(!escapedProfile.includes('href="javascript:'));
for(const d of data.drivers){if(!d.profile)continue;const fragment=stats.profileDetails(d);for(const field of ['country','hometown','team','header','info','bio','latestNews']){if(d.profile[field])assert.ok(fragment.includes(String(d.profile[field]).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))));}}
for(const series of ['Bomber Stocks','Cushion Kings','Mini Menaces','Yota Outlawz','Wide Open Revival']){
 const progression=context.window.MMTVProgression.build(data,'Fall Fest 2026',series,e=>e.competition||'Fall Fest 2026');
 for(const driver of progression.drivers){const original=data.drivers.find(d=>d.id===driver.id);const total=original.races.filter(r=>r.entry.series===series).reduce((sum,r)=>sum+r.points,0);assert.equal(driver.history.at(-1).points,total);}
}
for(const series of ['Bomber Stocks','Cushion Kings','Mini Menaces','Yota Outlawz','Wide Open Revival']){
 const book=insights.records(data,'Fall Fest 2026',series);
 const expectedWins=data.drivers.flatMap(d=>d.races).filter(r=>r.entry.series===series&&r.feature&&Number(r.finish)===1).length;
 assert.equal(book.drivers.reduce((sum,d)=>sum+d.wins,0),expectedWins);
 assert.equal(book.tracks.flatMap(([,wins])=>wins).length,expectedWins);
}
context.location.hash='#compare';await insights.comparison();assert.ok(node('app').innerHTML.includes('THE SHARED RACES'));
context.location.hash='#records';await insights.seasonRecords();assert.ok(node('app').innerHTML.includes('TRACK WINNERS'));
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
context.location.hash='#championships';await context.window.tests.championships();
for(const [i,series] of ['Bomber Stocks','Cushion Kings','Mini Menaces','Yota Outlawz','Wide Open Revival'].entries()){
 const box=node('championship-leaders-'+i).innerHTML;
 assert.ok(box.includes('CURRENT TOP 3'));
 const totals=data.drivers.map(d=>({d,total:d.races.filter(r=>r.entry.series===series).reduce((a,r)=>a+r.points,0)})).sort((a,b)=>b.total-a.total||a.d.name.localeCompare(b.d.name));
 for(const leader of totals.slice(0,3)){
  assert.ok(box.includes(leader.d.name));
  assert.ok(box.includes('<strong>'+leader.total));
 }
 assert.ok(box.includes('Provisional'));
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
 const i=data.drivers.indexOf(d),previous=data.drivers[(i+data.drivers.length-1)%data.drivers.length],next=data.drivers[(i+1)%data.drivers.length];
 assert.equal((node('app').innerHTML.match(/aria-label="Driver profiles"/g)||[]).length,2);
 assert.ok(node('app').innerHTML.includes('class="profile-previous')||node('app').innerHTML.includes('profile-neighbour profile-previous'));
 assert.ok(node('app').innerHTML.includes('href="#driver/'+encodeURIComponent(previous.id)+'" aria-label="Previous driver:'));
 assert.ok(node('app').innerHTML.includes('href="#driver/'+encodeURIComponent(next.id)+'" aria-label="Next driver:'));
 assert.ok(node('app').innerHTML.includes('class="profile-all" href="#drivers"'));
 for(const race of d.races)assert.ok(node('app').innerHTML.includes(`#race/${race.entry.subsession_id}`));
}
context.location.hash='#driver/unknown';await stats.profile('unknown');assert.ok(node('app').innerHTML.includes('DRIVER NOT FOUND'));
for(const id of allRaces){context.location.hash='#race/'+id;await context.window.tests.race(String(id));assert.ok(node('race-details').innerHTML.includes('FINAL FEATURE RESULTS'));assert.ok(node('result-body').innerHTML.includes('#driver/'));}
// A failed result fetch is reported, not silently treated as a zero-point round.
const broken=context.window.createMMTVStats({app:node('app'),entries:()=>[{subsession_id:1,series:'Bomber Stocks'}],seasonName:()=> 'Fall Fest 2026',esc:String,displayName:String,getEvent:async()=>null,getMeeting:async()=>null});
assert.equal((await broken.load()).failures.length,1);
console.log(`PASS: ${data.drivers.length} profiles, ${allRaces.size} race pages, five standings tables, scoring boundaries, saved points, search, aliases, links and fetch failure handling.`);

// Round reviews stay within the selected round and preserve partial coverage.
const reviews=context.window.tests.roundReviews;
const entries=[...new Map([...historical,...live].map(e=>[e.subsession_id,e])).values()];
const schedule=JSON.parse(await read('news/data/schedule.json'));
const rounds=reviews.build(entries,schedule,data,'Fall Fest 2026');
assert.equal(rounds.length,6);
const six=rounds.find(r=>r.round===6),sixCount=entries.filter(e=>Number(e.round)===6).length;assert.equal(six.events.length,sixCount);assert.equal(six.missing.length,5-sixCount);assert.equal(six.expected.length,5);assert.equal(six.book.movers[0].gain,10);
for(const round of rounds){
 assert.equal(round.statsComplete,true);
 assert.ok(round.book.movers.every(m=>Number(m.race.entry.round)===round.round));
 if(round.round<6){assert.equal(round.missing.length,0);assert.equal(round.events.length,5);}
}
assert.equal(reviews.build([...entries,...entries],schedule,data,'Fall Fest 2026').find(r=>r.round===6).events.length,sixCount);
assert.equal(reviews.build(entries,schedule,data,'Other season').length,0);
assert.equal(reviews.build(entries,schedule,{...data,failures:[89810317]},'Fall Fest 2026').find(r=>r.round===6).statsComplete,false);
context.location.hash='#rounds';await reviews.index();assert.equal((node('app').innerHTML.match(/class="round-review-card"/g)||[]).length,6);
for(const round of [1,5,6]){context.location.hash='#round/Fall%20Fest%202026/'+round;await reviews.review(round,'Fall Fest 2026');
 assert.equal((node('app').innerHTML.match(/class="round-series-report"/g)||[]).length,round===6?sixCount:5);
 assert.ok(node('app').innerHTML.includes('THE BROADCASTS'));assert.ok(!node('app').innerHTML.includes('undefined'));
 if(round===6){assert.ok(node('app').innerHTML.includes('Reports still to come:'));assert.ok(node('app').innerHTML.includes('#broadcast/IyXQ4OjSR3Y'));assert.ok(!node('app').innerHTML.includes('/7'));}
 if(round===1)assert.ok(!node('app').innerHTML.includes('/0'));
}
context.location.hash='#round/Fall%20Fest%202026/99';await reviews.review(99,'Fall Fest 2026');assert.ok(node('app').innerHTML.includes('ROUND NOT FOUND'));
context.location.hash='#round/Unknown/1';await reviews.review(1,'Unknown');assert.ok(node('app').innerHTML.includes('ROUND NOT FOUND'));
console.log('PASS: six round reviews, partial Round 6, source-scoped climbs, broadcast links, deduplication, missing-data states and previous/next boundaries.');

// Commentary briefings must exclude the selected round and all later results.
const desk=context.window.tests.commentary;
const venueData=await context.window.tests.venues.load();
const bomberSix=venueData.rows.find(r=>r.series==='Bomber Stocks'&&r.round===6);
const briefing=desk.build(data,bomberSix,venueData.trackFor);
assert.ok(briefing.rankings.length>0);
for(const row of briefing.rankings){assert.ok(row.races.every(r=>r.entry.series==='Bomber Stocks'&&r.entry.round<6));assert.equal(row.points,row.races.reduce((sum,r)=>sum+r.points,0));}
assert.ok(!briefing.rankings.flatMap(r=>r.races).some(r=>r.entry.subsession_id===89810317));
assert.equal(desk.build(data,{...bomberSix,round:1},venueData.trackFor).rankings.length,0);
const seventh=desk.build(data,{...bomberSix,round:7},venueData.trackFor);
assert.ok(seventh.rankings.flatMap(r=>r.races).some(r=>r.entry.subsession_id===89810317));
const mixed={...data,drivers:data.drivers.map(d=>({...d,races:[...d.races,...d.races.map(r=>({...r,entry:{...r.entry,competition:'Other season'}}))]}))};
assert.equal(desk.build(mixed,bomberSix,venueData.trackFor).rankings.reduce((s,r)=>s+r.points,0),briefing.rankings.reduce((s,r)=>s+r.points,0));
const store=new Map();context.localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
context.location.hash='#commentary';await desk.screen();
assert.ok(node('desk-context').innerHTML.includes('Pre-race briefing'));assert.ok(node('desk-context').innerHTML.includes('before Round'));assert.ok(node('desk-driver').innerHTML.includes('YOUR COMMENTARY NOTES'));
node('desk-notes').value='Private <script> note';node('desk-notes').oninput();assert.equal(store.size,1);
await desk.screen();assert.equal(node('desk-notes').value,'Private <script> note');assert.ok(!node('desk-driver').innerHTML.includes('Private <script> note'));
node('desk-meeting').onchange({target:{value:[bomberSix.season,bomberSix.series,1].join('|')}});assert.ok(node('desk-context').innerHTML.includes('No earlier results'));
node('desk-meeting').onchange({target:{value:[bomberSix.season,bomberSix.series,6].join('|')}});assert.ok(node('desk-driver').innerHTML.includes('RECENT FORM'));assert.equal(node('desk-notes').value,'');
node('desk-search').oninput({target:{value:'no such driver'}});assert.ok(node('desk-drivers').innerHTML.includes('No drivers match'));
const failedDesk=context.window.createMMTVCommentary({app:node('app'),driverStats:{load:async()=>{throw Error();}},venues:{load:async()=>{throw Error();}},broadcastLibrary:{load:async()=>[]}});await failedDesk.screen();assert.ok(node('app').innerHTML.includes('could not be loaded'));
console.log('PASS: commentary pre-race cutoffs, season separation, opening-round empty state, browser-only notes, search and loading failure.');
