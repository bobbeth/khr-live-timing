import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const text=p=>fs.readFile(path.join(root,p),'utf8');
const read=async p=>JSON.parse(await text(p));
const index=await read('news/data/intelligence/index.json');
const ids=[...(await read('archive/index.json')).events,...(await read('news/data/live/index.json')).events].map(e=>e.subsession_id).sort((a,b)=>a-b);
assert.deepEqual(index.subsession_ids,ids);assert.equal(new Set(ids).size,ids.length);
for(const name of ['drivers','races','venues','championships']){
 const source=await text(`news/data/intelligence/${name}.json`);
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),index.files[name+'.json'].sha256);
 assert.ok(!/(?:[A-Za-z]:[\\/]|nativeHistoricalResults|KHR_GITHUB_TOKEN|carPaint|birthDate|source_path)/i.test(source));
}
const elements=new Map();
const node=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',value:'',textContent:'',addEventListener(){},querySelector(selector){if(['#canonical-intelligence','.loading','.container.section'].includes(selector))return null;return node(id+selector);},querySelectorAll(){return [];},insertAdjacentHTML(position,html){this.innerHTML+=html;}});return elements.get(id);};
const context={URL,TextEncoder,Uint8Array,crypto:crypto.webcrypto,setInterval:()=>0,clearInterval(){},window:{scrollTo(){},addEventListener(){}},location:{protocol:'https:',hash:'#home'},document:{getElementById:node,querySelectorAll(){return [];},addEventListener(){}},navigator:{},console,localStorage:{getItem:()=>null,setItem(){}},fetch:async url=>{
 try{const rel=url.startsWith('../')?url.slice(3):'news/'+url;const source=await text(rel);return {ok:true,text:async()=>source,json:async()=>JSON.parse(source)};}catch{return {ok:false};}
}};
vm.createContext(context);
for(const name of ['result-tables','seed','editorial','intelligence-core','intelligence','progression','stats','broadcasts','newsroom','race-insights','venues','round-reviews','commentary'])vm.runInContext(await text(`news/assets/${name}.js`),context);
const appSource=await text('news/assets/app.js');
vm.runInContext(appSource.replace('init();\n})();','window.tests={driverStats,race,init,championships,raceInsights,roundReviews,route,commentary,venues,getEvent,getMeeting,stageTable,rankSort};\n})();'),context);
await context.window.tests.init();
const intelligence=context.window.MMTVIntelligence,core=context.window.MMTVIntelligenceCore;
assert.ok(intelligence.model,'Static export must pass SHA256/schema validation');
const data=await context.window.tests.driverStats.load();
assert.equal(data.intelligence.revision,index.revision);
const events=intelligence.model.races.races;
assert.equal(events.length,ids.length);
const appearanceCount=events.reduce((n,e)=>n+e.rows.length,0);assert.equal(appearanceCount,data.drivers.reduce((n,d)=>n+core.summary(d.races).starts,0));
for(const event of events){
 assert.equal(event.sessions.filter(s=>['feature','twin_feature_2'].includes(s.kind)).length,1);
 assert.equal(new Set(event.sessions.map(s=>s.simsession_number)).size,event.sessions.length);
 for(const field of ['start_position','laps_completed','laps_led','best_lap_seconds','champ_points'])assert.equal(event.coverage[field].known,event.rows.filter(r=>r[field]!==null&&r[field]!==undefined).length);
 for(const fact of event.facts){assert.ok(fact.source);assert.ok(fact.related_subsessions.every(id=>ids.includes(id)));assert.ok(fact.coverage.known<=fact.coverage.total);}
}
const historical=JSON.parse(execFileSync('git',['-C',root,'show','HEAD:news/data/intelligence/races.json'],{encoding:'utf8',maxBuffer:40e6}));
for(const e of events.filter(e=>e.source.certainty==='official'))for(const [i,row] of historical.races.find(r=>r.entry.subsession_id===e.entry.subsession_id).rows.entries())for(const [key,value] of Object.entries(row))assert.deepEqual(JSON.parse(JSON.stringify(e.rows[i][key])),value,'Existing official Feature field is preserved: '+key);
const r1=events.find(e=>e.entry.subsession_id===88961208);
assert.equal(r1.rows[0].driver,'Jim Reavis');assert.equal(r1.rows[0].laps_completed,25);assert.equal(r1.rows[0].start_position,14);
const yota=events.find(e=>e.entry.subsession_id===89836161);
assert.equal(yota.rows[0].driver_id,925665);assert.equal(yota.rows[0].laps_completed,40);assert.equal(yota.rows.length,10);
for(const row of yota.rows)for(const key of ['laps_led','incidents','champ_points'])assert.equal(row[key],null);
assert.equal(yota.rows[0].best_lap_seconds,16.2876);assert.equal(yota.rows[0].start_position,8);
assert.equal(yota.rows[0].field_provenance.fields.start_position.eol_validation,'previous_winner_absent_eol_expired');
assert.ok(!yota.rows.some(r=>r.driver_id===471386));
const bomber=events.find(e=>e.entry.subsession_id===89810317);
assert.equal(bomber.sessions.filter(s=>s.kind==='twin_feature_1').length,1);assert.equal(bomber.sessions.filter(s=>s.kind==='twin_feature_2').length,1);
for(const d of data.drivers){
 const expected=events.flatMap(e=>e.rows.filter(row=>row.driver_id===d.driver_id&&!/^DNS$/i.test(row.reason_out||'')));
 const actual=core.summary(d.races);
 assert.equal(actual.starts,expected.length);assert.equal(actual.wins,expected.filter(r=>r.finish_position===1).length);assert.equal(actual.podiums,expected.filter(r=>r.finish_position<=3).length);
 assert.equal(new Set(d.races.map(r=>r.entry.subsession_id)).size,d.races.length);
 assert.ok(d.races.every(r=>r.savedPoints+r.provisionalPoints===r.points));
}
const get=id=>data.drivers.find(d=>d.driver_id===id);
const pair=context.window.tests.raceInsights.compare(get(925665),get(186983),'Fall Fest 2026','All series');
const shared=events.filter(e=>e.rows.some(r=>r.driver_id===925665)&&e.rows.some(r=>r.driver_id===186983));
assert.equal(pair.shared.length,shared.length);
assert.equal(pair.aheadA,shared.filter(e=>e.rows.find(r=>r.driver_id===925665).finish_position<e.rows.find(r=>r.driver_id===186983).finish_position).length);
assert.equal(intelligence.model.drivers.names['mike davis'],intelligence.model.drivers.names['mike maddog davis']);
assert.equal(intelligence.model.drivers.names['michael butler14'],intelligence.model.drivers.names['mike butler']);
assert.notEqual(intelligence.model.drivers.names['tom land'],intelligence.model.drivers.names['mathew land']);
for(const id of ids){
 const original=await read((await read('news/data/live/index.json')).events.some(e=>e.subsession_id===id)?`news/data/live/events/${id}.json`:`archive/events/${id}.json`);
 const enriched=intelligence.enrichEvent(original);
 for(const [i,row] of original.feature_results.entries())for(const [key,value] of Object.entries(row))if(value!==null&&value!==undefined)assert.deepEqual(enriched.feature_results[i][key],value,'Existing published value must be preserved '+id+'/'+key);
}
let savedSessionCount=0,savedRowCount=0;
// All existing tables preserve classification and non-null fields; supplements carry per-field proof.
for(const event of events){
 const live=(await read('news/data/live/index.json')).events.some(e=>e.subsession_id===event.entry.subsession_id);
 const p=live?`news/data/live/meetings/${event.entry.subsession_id}.json`:`news/data/meetings/${event.entry.subsession_id}.json`;
 const meeting=await read(p),enriched=intelligence.enrichMeeting(meeting);
 assert.equal(enriched.sessions.length,meeting.sessions.length);
 for(const [i,s] of meeting.sessions.entries()){
  savedSessionCount++;savedRowCount+=s.classification.length;for(const row of s.classification)assert.ok(data.drivers.some(d=>d.id===context.window.tests.driverStats.key(row.driver)),'Every saved driver link resolves to a profile: '+row.driver);
  assert.equal(enriched.sessions[i].classification.length,s.classification.length);
  for(const [j,row] of s.classification.entries())for(const [key,value] of Object.entries(row))if(value!=null)assert.deepEqual(enriched.sessions[i].classification[j][key],value);
  const html=context.window.tests.stageTable(enriched.sessions[i],event.entry);
  if(s.classification.length){const k=/^WARM/i.test(s.name)?'warmup':s.kind;const expected=['practice','warmup'].includes(k)?6:k==='qualifying'?(enriched.sessions[i].classification.some(r=>r.qual_lap_seconds>0)?8:7):10;assert.equal((html.match(/<th>/g)||[]).length,expected,k);for(const body of html.matchAll(/<tr>(.*?)<\/tr>/gs))if(body[1].includes('<td'))assert.equal((body[1].match(/<td(?:>| )/g)||[]).length,expected);}
 }
 if(event.source.certainty!=='official'){
  const max=Math.max(...event.rows.map(r=>r.laps_completed));assert.ok(event.rows.reduce((n,r)=>n+(r.laps_led||0),0)<=max);
  for(const row of [...event.rows,...event.sessions.flatMap(s=>s.classification)])for(const proof of Object.values(row.field_provenance?.fields||{}))if(proof.source_kind)assert.equal(proof.official,false);
 }
}
assert.equal(savedSessionCount,158);assert.equal(savedRowCount,1463);
const screenshotMeeting=await read('news/data/meetings/89495168.json'),practice=screenshotMeeting.sessions.find(s=>s.kind==='practice'&&s.name==='PRACTICE');
assert.equal(practice.classification[0].driver,'Chad Puterbaugh');assert.equal(practice.classification[0].laps_completed,32);assert.equal(practice.classification[0].best_lap_seconds,9.7042);assert.equal(practice.classification[0].incidents,2);
const practiceHtml=context.window.tests.stageTable(practice,events.find(e=>e.entry.subsession_id===89495168).entry);for(const h of ['START','+/-','LED','PTS','STATUS'])assert.ok(!practiceHtml.includes('<th>'+h+'</th>'));
const sortRows=[{finish_position:1,start_position:null,positions_gained:null,laps_led:null},{finish_position:2,start_position:4,positions_gained:2,laps_led:0},{finish_position:3,start_position:1,positions_gained:-2,laps_led:5}];
for(const sort of ['start','gained','led'])assert.equal(context.window.tests.rankSort(sortRows,sort).at(-1).finish_position,1);
const copied=context.window.MMTVResults.copy({series:'Test',round:1,track:'Track'},sortRows.map(r=>({...r,driver:'Driver',car_number:'1',laps_completed:null})),n=>n,'source');assert.ok(!/\b(?:null|undefined|NaN)\b/.test(copied));assert.ok(copied.includes('start —, laps —, led —'));
const oldDrivers=JSON.parse(execFileSync('git',['-C',root,'show','HEAD:news/data/intelligence/drivers.json'],{encoding:'utf8',maxBuffer:40e6}));for(const driver of data.drivers)for(const race of driver.races)assert.equal(race.points,oldDrivers.drivers.find(d=>d.driver_id===driver.driver_id).races.find(r=>r.entry.subsession_id===race.entry.subsession_id).points,'Verified league scoring preserves existing totals');
assert.equal(events.find(e=>e.entry.subsession_id===89302439).sessions.find(s=>s.simsession_number===-2).kind,'consolation');
const cushion=events.find(r=>r.entry.subsession_id===89812470),travis=cushion.rows.find(r=>r.car_number==='88');assert.equal(travis.start_position,11);assert.equal(travis.field_provenance.fields.start_position.certainty,'confirmed_post_eol_start');
const mini=events.find(r=>r.entry.subsession_id===89834758);assert.equal(mini.coverage.best_lap_seconds.known,9);assert.equal(mini.coverage.laps_led.known,9);assert.equal(mini.coverage.start_position.known,0);
assert.ok(!appSource.includes('<th>STATUS</th>'));assert.ok(!appSource.includes('<td>${esc(r.reason_out'));
const bios=await read('news/data/driver-profiles.json');for(const d of data.drivers)if(bios.drivers[String(d.driver_id)])assert.equal(JSON.stringify(d.profile),JSON.stringify(bios.drivers[String(d.driver_id)].profile));
for(const [page,id,detail] of [['race','88961208'],['race','89836161'],['driver','kent mcclain'],['records'],['compare'],['standings'],['round','Fall Fest 2026','6'],['track','oswego-speedway'],['home'],['commentary']]){
 const html=intelligence.contextHtml(page,id,detail);assert.ok(html.includes('canonical-intelligence'),page+' context missing');assert.ok(!html.includes('undefined'));assert.ok(!html.includes('NaN'));
}
for(const d of data.drivers){context.location.hash='#driver/'+encodeURIComponent(d.id);await context.window.tests.driverStats.profile(d.id);assert.ok(node('app').innerHTML.includes('RACE HISTORY'));}
for(const id of ids){context.location.hash='#race/'+id;await context.window.tests.race(id);assert.ok(node('race-details').innerHTML.includes('FINAL FEATURE RESULTS'));}
context.location.hash='#standings';await context.window.tests.driverStats.standings('Bomber Stocks');assert.ok(node('app').innerHTML.includes('BEFORE DROPS'));
context.location.hash='#commentary';await context.window.tests.commentary.screen();assert.ok(node('desk-context').innerHTML.includes('before Round'));
for(const v of intelligence.model.venues.venues){if(v.best_lap)assert.ok(v.configuration&&v.vehicle_classes.length===1);assert.ok(v.past_winners.every(w=>ids.includes(w.subsession_id)));}
// Future seasons and nonparticipants must not inflate scoped or shared totals.
const a=get(925665),b=get(186983),future={...a.races[0],entry:{...a.races[0].entry,competition:'Future season',subsession_id:99900001}};
const before=context.window.tests.raceInsights.compare(a,b,'Fall Fest 2026','All series');
const after=context.window.tests.raceInsights.compare({...a,races:[...a.races,future]},b,'Fall Fest 2026','All series');assert.equal(before.shared.length,after.shared.length);assert.equal(before.a.starts,after.a.starts);
assert.equal(core.compare(a.races,[]).shared.length,0);
const broadcasts=await read('news/data/broadcasts.json'),editorial=JSON.parse((await text('news/assets/editorial.js')).replace(/^\s*window\.MMTV_EDITORIAL\s*=\s*/,'').replace(/;\s*$/,''));
assert.ok(ids.every(id=>broadcasts.events[id]?.video_id&&editorial.events[id]));
const protectedChanges=execFileSync('git',['-C',root,'diff','--name-only','HEAD','--','archive','news/data/live','news/data/broadcasts.json','news/data/driver-profiles.json','news/assets/editorial.js','news/assets/analytics.js','news/privacy.html'],{encoding:'utf8'}).trim();assert.equal(protectedChanges,'');
console.log('PASS all saved results: 29 events, 158 sessions, 1463 rows, kind-specific headers, source-preserving enrichment, screenshot Practice, safe sorts/copy and unchanged championship totals.');
console.log(`PASS canonical intelligence: ${ids.length} unique events, ${appearanceCount} Feature appearances, twins/scoring separated, verified identities, unknowns/denominators, static integrity, private-data exclusion, all profiles/races, H2H scopes and protected content.`);
