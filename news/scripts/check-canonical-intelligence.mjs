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
for(const name of ['seed','editorial','intelligence-core','intelligence','progression','stats','broadcasts','newsroom','race-insights','venues','round-reviews','commentary'])vm.runInContext(await text(`news/assets/${name}.js`),context);
const appSource=await text('news/assets/app.js');
vm.runInContext(appSource.replace('init();\n})();','window.tests={driverStats,race,init,championships,raceInsights,roundReviews,route,commentary,venues,getEvent};\n})();'),context);
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
const r1=events.find(e=>e.entry.subsession_id===88961208);
assert.equal(r1.rows[0].driver,'Jim Reavis');assert.equal(r1.rows[0].laps_completed,25);assert.equal(r1.rows[0].start_position,14);
const yota=events.find(e=>e.entry.subsession_id===89836161);
assert.equal(yota.rows[0].driver_id,925665);assert.equal(yota.rows[0].laps_completed,40);assert.equal(yota.rows.length,10);
for(const row of yota.rows)for(const key of ['start_position','laps_led','best_lap_seconds','champ_points'])assert.equal(row[key],null);
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
console.log(`PASS canonical intelligence: ${ids.length} unique events, ${appearanceCount} Feature appearances, twins/scoring separated, verified identities, unknowns/denominators, static integrity, private-data exclusion, all profiles/races, H2H scopes and protected content.`);
