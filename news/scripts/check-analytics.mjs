import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const script=await fs.readFile(new URL('../assets/analytics.js',import.meta.url),'utf8');
const ID='G-WLVRGFTMM1',KEY='mmtv.analytics.choice.v1';
function setup({hostname='bobbeth.github.io',consent=null,excluded=false,dnt=false,gpc=false}={}){
 const nodes=new Map(),scripts=[],storage=new Map(),listeners={},clicks={};
 if(consent)storage.set(KEY,JSON.stringify({choice:consent,at:Date.now()}));if(excluded)storage.set('mmtv.analytics.exclude','1');
 const context={URL,location:{href:`https://${hostname}/khr-live-timing/news/#home`,hostname,pathname:'/khr-live-timing/news/',reload(){}},navigator:{doNotTrack:dnt?'1':'0',globalPrivacyControl:gpc},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{currentScript:{src:`https://${hostname}/khr-live-timing/news/assets/analytics.js`},referrer:'https://example.org/private?email=private@example.org',cookie:'',head:{appendChild:e=>scripts.push(e)},body:{appendChild:e=>nodes.set(e.id,e)},createElement:tag=>({tag,setAttribute(){},remove(){nodes.delete(this.id);}}),getElementById:id=>nodes.get(id),querySelector:()=>null,addEventListener:(name,fn)=>clicks[name]=fn},window:{addEventListener:(name,fn)=>listeners[name]=fn},fetch:async()=>({ok:true,json:async()=>({schema_version:'MMTV-driver-identities-v1',names:{'kent mcclain':925665}})})};
 vm.createContext(context);vm.runInContext(script,context);
 return {context,api:context.window.MMTVAnalytics,scripts,nodes,listeners,clicks,storage,events:()=>Array.from(context.window.dataLayer||[],args=>Array.from(args)).filter(a=>a[0]==='event')};
}
const t=setup();await t.api.pageView();
assert.equal(t.scripts.length,0,'No Google requests before consent');assert.ok(t.nodes.has('mmtv-analytics-banner'));
t.api.choose('deny');await t.api.pageView();assert.equal(t.scripts.length,0);assert.equal(t.nodes.has('mmtv-analytics-banner'),false);
t.api.choose('allow');await t.api.pageView();assert.equal(t.scripts.length,1);assert.ok(t.scripts[0].src.endsWith(ID));assert.equal(t.events().length,1);
await t.api.pageView();assert.equal(t.events().length,1,'Repeated init must not duplicate a pageview');
t.context.location.href='https://bobbeth.github.io/khr-live-timing/news/?email=private@example.org#race/89810317';await t.api.pageView();
assert.equal(t.events().length,2);assert.ok(t.events()[1][2].page_location.endsWith('#race/89810317'));assert.ok(!JSON.stringify(t.context.window.dataLayer).includes('private@example.org'));assert.equal(t.events()[0][2].page_referrer,'https://example.org/');
t.context.location.href='https://bobbeth.github.io/khr-live-timing/news/#driver/kent%20mcclain';await t.api.pageView();assert.ok(t.events().at(-1)[2].page_location.endsWith('#driver/925665'));
t.context.location.href='https://bobbeth.github.io/khr-live-timing/news/#driver/someone%40private.test';await t.api.pageView();assert.ok(!JSON.stringify(t.events()).includes('someone'));
const before=t.events().length;t.api.exclude(true);t.context.location.href='https://bobbeth.github.io/khr-live-timing/news/#broadcasts';await t.api.pageView();assert.equal(t.events().length,before);assert.equal(t.context.window['ga-disable-'+ID],true);
t.api.exclude(false);await t.api.pageView();assert.equal(t.events().length,before+1);assert.equal(t.scripts.length,1,'Re-enabling must not add a second Google tag');
const link={href:'https://www.youtube.com/watch?v=abcdefghijk&private=secret'};t.clicks.click({target:{closest:selector=>selector==='a[href]'?link:null}});assert.equal(t.events().at(-1)[1],'youtube_click');assert.ok(!JSON.stringify(t.events()).includes('private=secret'));
t.api.choose('deny');const stopped=t.events().length;await t.api.pageView();assert.equal(t.events().length,stopped);assert.equal(t.context.window['ga-disable-'+ID],true);
for(const options of [{consent:'allow',excluded:true},{consent:'allow',dnt:true},{consent:'allow',gpc:true},{consent:'allow',hostname:'localhost'}]){const blocked=setup(options);await blocked.api.pageView();assert.equal(blocked.scripts.length,0);assert.equal(blocked.events().length,0);}
const config=Array.from(t.context.window.dataLayer,a=>Array.from(a)).find(a=>a[0]==='config');assert.equal(config[1],ID);assert.equal(config[2].send_page_view,false);assert.equal(config[2].allow_google_signals,false);
assert.equal(t.api.routeInfo('https://bobbeth.github.io/khr-live-timing/news/#home').section,'Newsroom');
assert.equal(t.api.routeInfo('https://bobbeth.github.io/khr-live-timing/').section,'Live timing');
console.log('PASS: new KHR ID, opt-in gating, decline/withdrawal, owner exclusion, DNT/GPC, localhost exclusion, pageview deduplication, sanitized content IDs/referrers and outbound events.');
