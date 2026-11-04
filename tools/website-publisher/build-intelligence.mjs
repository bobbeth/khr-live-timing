import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {driverAdmission} from './driver-admission.mjs';
import {recoverSession} from './recover-session-fields.mjs';
const root=path.resolve(process.argv[2]);
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
let input='';for await(const chunk of process.stdin)input+=chunk;
const {history,source_event_count,source_catalogue_count,statistics:oracle,adapter_sha256,recovery:recoveryOptions={},driver_eligibility=null,driver_policy={}}=JSON.parse(input.replace(/^\uFEFF/,''));
const ctx={window:{}};vm.createContext(ctx);
for(const name of ['intelligence-core','stats','venues'])vm.runInContext(fs.readFileSync(path.join(root,`news/assets/${name}.js`),'utf8'),ctx);
const core=ctx.window.MMTVIntelligenceCore,legacy=ctx.window.createMMTVStats({displayName:n=>n,entries:()=>[],seasonName:e=>e.competition});
const indexes=['archive/index.json','news/data/live/index.json'];
const entries=new Map(indexes.flatMap(p=>read(p).events.map(e=>[Number(e.subsession_id),e])));
const profiles=read('news/data/driver-profiles.json');
const publicVenue=ctx.window.createMMTVVenues({}).resolver(read('news/data/tracks.json'));
const seasonPolicy=fs.readFileSync(path.join(root,'news/assets/app.js'),'utf8').match(/const seasonName = ([^;\n]+);/);if(!seasonPolicy)throw Error('Existing competition policy not found');vm.runInContext('window.MMTVExportSeasonName = '+seasonPolicy[1],ctx);
const names=Object.fromEntries(Object.entries(history.identityNames).filter(([,ids])=>ids.length===1).map(([name,ids])=>[name,Number(ids[0])]));
const normalize=n=>String(n||'').replace(/\s+/g,' ').trim().toLowerCase();
for(const [name,id] of Object.entries(profiles.names||{})){if(names[normalize(name)]&&names[normalize(name)]!==Number(id))throw Error('Conflicting verified identity: '+name);names[normalize(name)]=Number(id);}
const publicSource=(race,field)=>({field,certainty:race.source==='canonical_official_feature'?'official':'native_completed',canonical_sha256:race.provenance.canonicalSha256.toLowerCase(),official_source_sha256:race.provenance.official?.source_sha256||null,capture_sha256:race.provenance.linkedCaptureSha256?.toLowerCase()||null,subsession_id:race.subSessionID});
const seriesNames={bomber_stocks:'Bomber Stocks',cushion_kings:'Cushion Kings',mini_menaces:'Mini Menaces',dirt_cheap_asphalt_fast:'Yota Outlawz',wide_open_revival:'Wide Open Revival'};
const numericField=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const dns=r=>/^(DNS|Did Not Start)$/i.test(String(r.reason||r.reason_out||''));
let priorRaces=[];try{priorRaces=read('news/data/intelligence/races.json').races}catch{}
const sourceAudit=[],drivers=new Map(),races=[],publicMeetings=[];
const raceKinds=['heat','consolation','twin_feature_1','twin_feature_2','feature'];
function touch(id,name){
 if(!id)return null;
 if(!drivers.has(String(id)))drivers.set(String(id),{driver_id:Number(id),id:legacy.key(name),name:legacy.key(name)==='mike maddog davis'?'Mike Maddog Davis':name,names:[],numbers:[],races:[]});
 const d=drivers.get(String(id));if(!d.names.includes(name))d.names.push(name);return d;
}
function participant(d,event){let r=d.races.find(r=>r.entry.subsession_id===event.subsession_id);if(!r){r={entry:event,finish:null,start:null,laps:null,led:null,bestLap:null,gain:null,feature:false,points:0,savedPoints:0,provisionalPoints:0,scored:0,estimated:0,breakdown:[]};d.races.push(r);}return r;}
for(const race of history.races){
 const id=Number(race.subSessionID),published=entries.get(id);
 if(!published)continue; // The publisher writes the completed event/index first. Never leak unpublished events.
 const canonicalBytes=fs.readFileSync(race.provenance.canonicalFile);
 if(hash(canonicalBytes)!==race.provenance.canonicalSha256.toLowerCase())throw Error('Canonical changed during export: '+id);
 const c=JSON.parse(canonicalBytes);
 const captureBytes=race.provenance.linkedCapture?fs.readFileSync(race.provenance.linkedCapture):null;
 if(captureBytes&&hash(captureBytes)!==race.provenance.linkedCaptureSha256.toLowerCase())throw Error('Linked classification capture changed during export: '+id);
 const capture=captureBytes?JSON.parse(captureBytes):null;
 const entry={subsession_id:id,competition:ctx.window.MMTVExportSeasonName(published),series:seriesNames[race.seriesKey]||published.series||null,round:race.round??published.round??null,track:race.track||published.track,event_date:published.event_date};
 const eventPath=published.verification==='live_captured'?`news/data/live/events/${id}.json`:`archive/events/${id}.json`;
 const originalEvent=read(eventPath);let originalMeeting;try{originalMeeting=read(published.verification==='live_captured'?`news/data/live/meetings/${id}.json`:`news/data/meetings/${id}.json`)}catch{}
 const previous=history.races.filter(r=>{const p=entries.get(Number(r.subSessionID));return p&&ctx.window.MMTVExportSeasonName(p)===entry.competition&&p.series===entry.series&&Number(p.round)===Number(entry.round)-1;});
 const previousRow=previous.length===1?previous[0].results.find(r=>r.position===1):null;
 const previousWinner=previousRow?{driver_id:previousRow.driverId,car_number:previousRow.number}:null;
 const event={entry,recovery_audit:[],source:publicSource(race,'final_feature'),metadata_source:race.metadataUnknown?.length?'canonical_with_exact_published_subsession_metadata':'canonical',rows:[],sessions:[],facts:[],classification_difference:null,coverage:{}};
 event.metadata_provenance={subsession_id:id,series:{source:race.seriesKey?'canonical':'published_index',field:race.seriesKey?'seriesKey':'series',certainty:race.seriesKey?'canonical_identity':'existing_published_subsession_identity'},round:{source:race.round!==null?'canonical':'published_index',field:'round',certainty:race.round!==null?'canonical_identity':'existing_published_subsession_identity'},competition:{source:'existing_site_policy',field:'seasonName',policy_sha256:hash(seasonPolicy[1])},published_index_file:published.verification==='live_captured'?'news/data/live/index.json':'archive/index.json',published_entry_sha256:hash(JSON.stringify(stable(published)))};
 const getId=(r,official=false)=>official?Number(r.cust_id):Number(capture?.diagnostic?.drivers?.find(d=>d.fields?.carIdx===r.carIdx&&String(d.number)===String(r.number))?.fields?.userId)||null;
 for(const rawRow of race.results){
  const row={...rawRow};for(const field of ['startPosition','positionsGained','lapsCompleted','rawLapsLed','bestLap','incidents','champPoints'])row[field]=core.valid(row[field])?Number(row[field]):null;
  const d=touch(row.driverId,row.name);if(!d)throw Error('Unverified Feature identity '+id+'/'+row.number);
  if(!d.numbers.includes(row.number))d.numbers.push(row.number);
  const r=participant(d,entry);Object.assign(r,{feature:!dns(row),finish:row.position,start:row.startPosition,laps:row.lapsCompleted,led:row.rawLapsLed,bestLap:row.bestLap,gain:row.positionsGained,field_provenance:publicSource(race,'final_feature.results')});
  event.rows.push({driver_id:d.driver_id,driver:row.name,car_number:row.number,finish_position:row.position,start_position:row.startPosition,laps_completed:row.lapsCompleted,laps_led:row.rawLapsLed,best_lap_seconds:row.bestLap,positions_gained:row.positionsGained,incidents:row.incidents,champ_points:row.champPoints,reason_out:row.reason,field_provenance:publicSource(race,'final_feature.results')});
 }
 const rawSessions=c.official?.event_result?.data?.session_results||capture?.broadcast?.nativeHistoricalResults?.sessions||[];
 const official=!!c.official?.event_result?.data;
 const seenSessions=new Set();
 for(const raw of rawSessions){
  const name=official?raw.simsession_name:raw.sessionName,num=official?raw.simsession_number:raw.sessionNum;
  const savedKind=originalMeeting?.sessions?.find(s=>Number(s.simsession_number)===Number(num))?.kind;
  const kind=/^WARM/i.test(name)?'warmup':savedKind||(/^FEATURE$/i.test(name)?(entry.series==='Bomber Stocks'?'twin_feature_2':'feature'):/^(B[ -]MAIN|CONSOLATION|TWIN FEATURE 1|FEATURE 1)$/i.test(name)&&entry.series==='Bomber Stocks'?'twin_feature_1':/^HEAT\s*\d+/i.test(name)?'heat':/^CONS|^B[ -]MAIN$/i.test(name)?'consolation':/^QUAL/i.test(name)?'qualifying':/^WARM/i.test(name)?'warmup':/PRACTICE/i.test(name)?'practice':null);
  if(!kind||seenSessions.has(num))continue;
  if(!official&&(!raw.completedCandidate||!raw.structureValid||raw.resultsOfficial!==1))continue;
  const rows=raw.results||[];if(!rows.length)continue;seenSessions.add(num);
  const knownIds=new Map(rows.map(r=>[String(r.number),getId(r,false)]));
  const priorSession=priorRaces.find(r=>r.entry.subsession_id===id)?.sessions.find(s=>s.simsession_number===num);
  const priorSourceHashes=[...new Set((priorSession?.classification||[]).flatMap(r=>Object.values(r.field_provenance?.fields||{}).flatMap(p=>p.capture_sha256||[])))];
  const publishedRows=['feature','twin_feature_2'].includes(kind)?originalEvent.feature_results:(originalMeeting?.sessions?.find(s=>Number(s.simsession_number)===Number(num))?.classification||[]);
  const recovery=official?null:recoverSession({canonical:c,canonicalFile:race.provenance.canonicalFile,id,raw,entry,kind,previousWinner,knownIds,exhaustive:recoveryOptions.exhaustive,priorSourceHashes,publishedRows:publishedRows.map(r=>({...r,driver_id:r.driver_id||names[normalize(r.driver)]}))});
  if(recovery){event.recovery_audit.push(recovery.audit);sourceAudit.push({subsession_id:id,session_number:num,...recovery.audit,...recovery.details});}
  const source={...publicSource(race,`session.${num}`),certainty:official?'official':'native_completed'};
  const session={simsession_number:num,name,kind,available:true,classification:[],source};
  for(const row of rows){
   const driverId=getId(row,official);if(!driverId)continue;
   const name=official?row.display_name:row.name;
   const pos=official?Number(row.finish_position)+1:Number(row.position);
   const number=String(official?row.livery?.car_number:row.number);
   const r={driver_id:driverId,driver:name,car_number:number,position:pos,start_position:official&&raceKinds.includes(kind)&&row.starting_position>=0?row.starting_position+1:null,laps_completed:official?row.laps_complete:row.lapsCompleted,laps_led:official&&raceKinds.includes(kind)&&numericField(row.laps_lead)?Number(row.laps_lead):null,best_lap_seconds:official&&row.best_lap_time>0?row.best_lap_time/10000:null,champ_points:official&&core.valid(row.champ_points)?Number(row.champ_points):null,reason_out:official?row.reason_out:row.reason,field_provenance:source};
   r.incidents=official&&numericField(row.incidents)?Number(row.incidents):null;
   r.qual_lap_seconds=official&&kind==='qualifying'?(row.qual_lap_time>0?row.qual_lap_time/10000:row.best_qual_lap_time>0?row.best_qual_lap_time/10000:null):null;
   r.average_lap_seconds=official&&row.average_lap>0?row.average_lap/10000:null;
   r.reason_out=official?row.reason_out:row.reason;
   r.field_provenance={...source,fields:Object.fromEntries(Object.keys(r).filter(k=>r[k]!=null&&k!=='field_provenance').map(k=>[k,source]))};
   if(official)for(const [field,proof] of Object.entries(r.field_provenance.fields)){r.field_provenance.fields[field]={...proof,session_number:num,driver_id:driverId,car_number:number,field:'official.session_results.results.'+({start_position:'starting_position + 1',positions_gained:'starting_position - finish_position',laps_completed:'laps_complete',laps_led:'laps_lead',best_lap_seconds:'best_lap_time / 10000',average_lap_seconds:'average_lap / 10000',driver:'display_name',position:'finish_position + 1'}[field]||field)};}
   if(r.qual_lap_seconds!==null)r.field_provenance.fields.qual_lap_seconds={...source,field:row.qual_lap_time>0?'official.session_results.results.qual_lap_time':'official.session_results.results.best_qual_lap_time',session_number:num,driver_id:driverId,car_number:number,unit:'seconds_from_iracing_10000ths'};
   const scored=kind==='qualifying'||raceKinds.includes(kind);
   r.league_points=scored&&official&&Number(c.official.event_result.data.league_id)===10402&&numericField(row.league_points)?Number(row.league_points):scored?legacy.points(entry.series,kind,pos):null;
   r.league_points_status=r.league_points===null?'not_applicable':official&&numericField(row.league_points)?'saved_league':'calculated_provisional';
   if(r.league_points!==null)r.field_provenance.fields.league_points={...source,field:r.league_points_status==='saved_league'?'official.session_results.results.league_points':'existing_KHR_series_session_scoring_rules',certainty:r.league_points_status==='saved_league'?'saved_league_points':'calculated_provisional',league_id:10402,session_number:num,driver_id:driverId,car_number:number,position_used:pos,official:r.league_points_status==='saved_league'};
   const supplemental=recovery?.rows.get(driverId);if(supplemental){for(const [field,value] of Object.entries(supplemental.values)){if(r[field]==null&&value!=null){r[field]=value;r.field_provenance.fields[field]=supplemental.proofs[field];}}}
   r.positions_gained=r.start_position===null?null:r.start_position-pos;
   if(r.positions_gained!==null&&!r.field_provenance.fields.positions_gained)r.field_provenance.fields.positions_gained=r.field_provenance.fields.start_position||source;
   r.unavailable_fields={...recovery?.details.drivers.find(d=>d.driver_id===driverId)?.unfilled_reasons};
   for(const field of ['start_position','positions_gained','laps_completed','laps_led','best_lap_seconds','qual_lap_seconds','average_lap_seconds','incidents','champ_points','league_points'])if(r[field]==null&&!r.unavailable_fields[field])r.unavailable_fields[field]=(['start_position','positions_gained','laps_led'].includes(field)&&!raceKinds.includes(kind)||field==='qual_lap_seconds'&&kind!=='qualifying'||['league_points','champ_points'].includes(field)&&!scored)?'not_applicable_to_session':official&&['best_lap_seconds','qual_lap_seconds','average_lap_seconds'].includes(field)?'original_result_has_no_valid_session_time':'not_supplied_by_session_source';
   if(['feature','twin_feature_2'].includes(kind)){
    const final=event.rows.find(row=>row.driver_id===driverId&&row.car_number===number);
    if(final&&!official){final.field_provenance={...final.field_provenance,fields:{...final.field_provenance.fields}};for(const field of ['start_position','positions_gained','best_lap_seconds','laps_led','incidents','champ_points'])if(final[field]==null&&r[field]!=null){final[field]=r[field];final.field_provenance.fields[field]=r.field_provenance.fields[field]||source;}
     const statsRow=drivers.get(String(driverId)).races.find(r=>r.entry.subsession_id===id);Object.assign(statsRow,{start:final.start_position,gain:final.positions_gained,bestLap:final.best_lap_seconds,led:final.laps_led,field_provenance:final.field_provenance});
    }
   }
   session.classification.push(r);
   if(!scored){const observed=touch(driverId,name);if(!observed.numbers.includes(number))observed.numbers.push(number);continue;}
   const d=touch(driverId,name);if(!d.numbers.includes(number))d.numbers.push(number);
   if(dns(r))continue;
   const participation=participant(d,entry),saved=r.league_points_status==='saved_league',score=r.league_points;
   if(score!==null){participation.points+=score;participation.scored++;participation.estimated+=saved?0:1;participation[saved?'savedPoints':'provisionalPoints']+=score;participation.breakdown.push({session:session.name,kind,position:pos,points:score,estimated:!saved,status:r.league_points_status,source:r.field_provenance.fields.league_points});}
  }
  const savedSession=originalMeeting?.sessions?.find(s=>Number(s.simsession_number)===Number(num));
  session.classification_difference=(savedSession?.classification||[]).flatMap(saved=>{const id=saved.driver_id||names[normalize(saved.driver)],row=session.classification.find(r=>r.driver_id===Number(id)&&r.car_number===String(saved.car_number));return row&&Number(saved.position)!==row.position?[{driver_id:row.driver_id,driver:saved.driver,car_number:row.car_number,published_position:saved.position,source_position:row.position}]:[];});
  session.classification.sort((a,b)=>a.position-b.position);event.sessions.push(session);
  if(official)sourceAudit.push({subsession_id:id,session_number:num,source:'original_iracing_event_result',league_id:c.official.event_result.data.league_id,source_sha256:c.official.source_sha256,raw_rows:rows.length,source_fields:Object.fromEntries(['laps_lead','starting_position','best_lap_time','qual_lap_time','best_qual_lap_time','average_lap','incidents','champ_points','league_points','reason_out'].map(f=>[f,rows.filter(r=>r[f]!==null&&r[f]!==undefined).length]))});
 }
 for(const final of event.rows){const session=event.sessions.find(s=>['feature','twin_feature_2'].includes(s.kind)),row=session?.classification.find(r=>r.driver_id===final.driver_id&&r.car_number===final.car_number);if(row){final.league_points=row.league_points;final.league_points_status=row.league_points_status;final.league_points_provenance=row.field_provenance.fields.league_points;}}
 const original=originalEvent.feature_results;
 if(original.length!==event.rows.length||original.some((r,i)=>Number(r.finish_position)!==event.rows[i]?.finish_position||normalize(r.driver)!==normalize(event.rows[i]?.driver))){event.classification_difference={published_rows:original.length,canonical_rows:event.rows.length,note:'Original published classification retained; season statistics use the source-traced canonical classification.'};}
 for(const key of ['start_position','laps_completed','laps_led','best_lap_seconds','champ_points'])event.coverage[key]={known:event.rows.filter(r=>core.valid(r[key])).length,total:event.rows.length};
 event.venue={public_venue_id:publicVenue(published.track).id,public_venue_name:publicVenue(published.track).name,track:entry.track,configuration:official?c.official.event_result.data.track?.config_name||null:capture?.track?.configuration||null,vehicle_classes:[...new Set((official?rawSessions.find(s=>s.simsession_name==='FEATURE')?.results||[]:capture?.drivers||[]).map(r=>official?r.car_name:r.carDisplayName).filter(Boolean))].sort()};
 event.venue.key=[entry.competition,event.venue.track,event.venue.configuration||'unknown layout',...event.venue.vehicle_classes].join('|');
 const feature=event.sessions.filter(s=>['feature','twin_feature_2'].includes(s.kind));assert.equal(feature.length,1,'Exactly one final Feature session required '+id);
 if(entry.series==='Bomber Stocks')assert.ok(event.sessions.filter(s=>s.kind==='twin_feature_1').length<=1);
 races.push(event);publicMeetings.push({entry,event:{subsession_id:id,feature_results:event.rows},meeting:{sessions:event.sessions}});
}
const expectedIds=[...entries.keys()].sort((a,b)=>a-b),ids=races.map(r=>r.entry.subsession_id).sort((a,b)=>a-b);
assert.deepEqual(ids,expectedIds,'Every published event must have canonical intelligence; incomplete export is blocked');
for(const stat of oracle){const d=drivers.get(String(stat.driverId));if(!d)throw Error('Canonical driver missing');const m=core.summary(d.races);for(const key of ['starts','wins','podiums'])assert.equal(m[key],stat[key]);assert.equal(m.top5,stat.top5s);assert.equal(Math.round(m.average*10000)/10000,stat.averageFinish);}
const group=(rows,key)=>Object.fromEntries([...new Set(rows.map(key))].sort().map(k=>[k,{...core.summary(rows.filter(r=>key(r)===k)),...core.form(rows.filter(r=>key(r)===k)),source_subsessions:rows.filter(r=>key(r)===k).map(r=>r.entry.subsession_id),certainty:'derived_from_canonical_classifications'}]));
for(const d of drivers.values()){
 d.races.sort((a,b)=>a.entry.event_date.localeCompare(b.entry.event_date)||a.entry.subsession_id-b.entry.subsession_id);
 d.by_competition=group(d.races,r=>r.entry.competition);
 d.by_series=group(d.races,r=>r.entry.competition+'|'+r.entry.series);
 d.by_venue=group(d.races,r=>r.entry.competition+'|'+r.entry.track);
 d.session_statistics={heats:0,heat_wins:0,qualifying:0,qualifying_wins:0,twin_one_starts:0,twin_one_wins:0};d.session_statistics_by_competition={};
 for(const race of races)for(const session of race.sessions){const row=session.classification.find(r=>r.driver_id===d.driver_id&&!dns(r));if(!row)continue;const p=session.kind==='heat'?'heats':session.kind==='qualifying'?'qualifying':session.kind==='twin_feature_1'?'twin_one_starts':null;if(p){const scoped=d.session_statistics_by_competition[race.entry.competition]??={heats:0,heat_wins:0,qualifying:0,qualifying_wins:0,twin_one_starts:0,twin_one_wins:0};scoped[p]++;d.session_statistics[p]++;if(row.position===1){const win=p==='heats'?'heat_wins':p==='qualifying'?'qualifying_wins':'twin_one_wins';d.session_statistics[win]++;scoped[win]++;}}}
}
for(const race of races){
 const win=race.rows.find(r=>r.finish_position===1),d=drivers.get(String(win.driver_id));
 const before=d.races.filter(r=>r.entry.competition===race.entry.competition&&r.entry.series===race.entry.series&&(r.entry.event_date<race.entry.event_date||(r.entry.event_date===race.entry.event_date&&r.entry.subsession_id<=race.entry.subsession_id)));
 const m=core.summary(before),form=core.form(before);
 race.facts.push({text:`${d.name} made it ${m.wins} final-feature ${m.wins===1?'win':'wins'} from ${m.starts} recorded ${race.entry.series} ${m.starts===1?'appearance':'appearances'} this season.`,driver_id:d.driver_id,source:race.source,coverage:{known:m.starts,total:m.starts},related_subsessions:before.map(r=>r.entry.subsession_id)});
 if(form.winStreak>1)race.facts.push({text:`${d.name} has won their last ${form.winStreak} recorded final-feature appearances in this championship.`,source:race.source,related_subsessions:form.recent.slice(0,form.winStreak).map(r=>r.id),coverage:{known:before.length,total:before.length}});
 const movers=race.rows.filter(r=>core.valid(r.positions_gained)&&r.positions_gained>0).sort((a,b)=>b.positions_gained-a.positions_gained);if(movers.length)race.facts.push({text:`${movers[0].driver} gained ${movers[0].positions_gained} places from the verified starting position to finish P${movers[0].finish_position}.`,source:movers[0].field_provenance.fields?.positions_gained||movers[0].field_provenance,coverage:race.coverage.start_position,related_subsessions:[race.entry.subsession_id]});
}
const venues=Object.values(Object.groupBy(races,r=>r.venue.key)).map(group=>({key:group[0].venue.key,...group[0].venue,competition:group[0].entry.competition,events:group.map(r=>r.entry.subsession_id),past_winners:group.map(r=>({subsession_id:r.entry.subsession_id,driver_id:r.rows[0].driver_id,name:r.rows[0].driver,date:r.entry.event_date})),best_lap:group[0].venue.configuration&&group[0].venue.vehicle_classes.length===1?group.flatMap(r=>r.rows.filter(row=>row.best_lap_seconds>0).map(row=>({seconds:row.best_lap_seconds,driver_id:row.driver_id,subsession_id:r.entry.subsession_id,source:row.field_provenance.fields?.best_lap_seconds||row.field_provenance}))).sort((a,b)=>a.seconds-b.seconds)[0]||null:null}));
const championships=[];
for(const key of [...new Set(races.map(r=>r.entry.competition+'|'+r.entry.series))]){
 const events=races.filter(r=>r.entry.competition+'|'+r.entry.series===key).sort((a,b)=>a.entry.round-b.entry.round);let previous=new Map();
 const rounds=[...new Set(events.map(r=>r.entry.round))].map(round=>{
  const standings=[...drivers.values()].map(d=>{const rr=d.races.filter(r=>r.entry.competition+'|'+r.entry.series===key&&r.entry.round<=round);return {driver_id:d.driver_id,name:d.name,points:rr.reduce((s,r)=>s+r.points,0),saved_points:rr.reduce((s,r)=>s+r.savedPoints,0),provisional_points:rr.reduce((s,r)=>s+r.provisionalPoints,0),...core.summary(rr)};}).filter(d=>d.starts||d.points).sort((a,b)=>b.points-a.points||a.name.localeCompare(b.name));
  let rank=0,last=null;for(const [i,d] of standings.entries()){if(d.points!==last)rank=i+1;last=d.points;d.rank=rank;d.movement=previous.has(d.driver_id)?previous.get(d.driver_id)-rank:null;}previous=new Map(standings.map(d=>[d.driver_id,d.rank]));
  return {round,standings};
 });championships.push({key,competition:events[0].entry.competition,series:events[0].entry.series,status:'provisional_before_drops',drops_applied:false,rounds,missing_sessions:events.filter(r=>!r.sessions.some(s=>s.kind==='qualifying')).map(r=>({subsession_id:r.entry.subsession_id,kind:'qualifying',status:'unknown_not_observed'}))});
}
for(const venue of venues){const wins=new Map();for(const winner of venue.past_winners){const row=wins.get(winner.driver_id)||{driver_id:winner.driver_id,name:winner.name,wins:0,source_subsessions:[]};row.wins++;row.source_subsessions.push(winner.subsession_id);wins.set(winner.driver_id,row);}venue.repeat_winners=[...wins.values()].filter(d=>d.wins>1);}
for(const d of drivers.values())d.personal_bests=venues.filter(v=>v.configuration&&v.vehicle_classes.length===1).map(v=>{const times=races.filter(r=>r.venue.key===v.key).flatMap(r=>r.rows.filter(row=>row.driver_id===d.driver_id&&row.best_lap_seconds>0).map(row=>({seconds:row.best_lap_seconds,subsession_id:r.entry.subsession_id,source:row.field_provenance.fields?.best_lap_seconds||row.field_provenance}))).sort((a,b)=>a.seconds-b.seconds);return times.length?{venue:v.key,competition:v.competition,best:times[0],known:times.length,total:v.events.length}:null;}).filter(Boolean);
const observedNames=new Map();for(const d of drivers.values())for(const name of d.names){const key=normalize(name),ids=observedNames.get(key)||new Set();ids.add(d.driver_id);observedNames.set(key,ids);}for(const [name,ids] of observedNames)if(ids.size===1&&!names[name])names[name]=[...ids][0];
// Project verified profiles only; retain every historical classification row.
const admission=driverAdmission({settings:driver_policy,eligibility:driver_eligibility,identities:{names:profiles.names||{}}});
for(const [id,d]of drivers)if(admission.blocked(id)||(!admission.verified(id)&&!admission.preserve(id)))drivers.delete(id);
for(const name of Object.keys(names))if(!drivers.has(String(names[name])))delete names[name];
const common={schema_version:'MMTV-canonical-intelligence-v1'};
const content={drivers:{...common,names,drivers:[...drivers.values()].sort((a,b)=>a.driver_id-b.driver_id)},races:{...common,races,meetings:publicMeetings},venues:{...common,venues},championships:{...common,championships}};

// Keep the complete export for audits; ship small verified views to ordinary visitors.
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
const rowKeys=['driver_id','driver','car_number','position','finish_position','start_position','positions_gained','laps_completed','laps_led','best_lap_seconds','incidents','champ_points','league_points','league_points_status','reason_out'];
const lightRaces=races.map(r=>({...pick(r,['entry','source','facts','coverage','classification_difference','venue']),rows:r.rows.map(row=>pick(row,rowKeys)),sessions:r.sessions.map(s=>({...pick(s,['simsession_number','name','kind','available']),classification:s.classification.map(row=>pick(row,rowKeys))}))}));
content.catalogue={...common,names,identities:[...drivers.values()].map(d=>pick(d,['driver_id','id','name','names'])),races:lightRaces};
for(const race of races)content['events/'+race.entry.subsession_id]={...common,subsession_id:race.entry.subsession_id,race};

const serialized=Object.fromEntries(Object.entries(content).map(([key,value])=>[key,JSON.stringify(stable(value))+'\n']));
const revision=hash(Object.values(serialized).join(''));
const indexPath='news/data/intelligence/index.json';let prior;try{prior=read(indexPath)}catch{}
const manifest={...common,generated_utc:prior?.revision===revision?prior.generated_utc:new Date().toISOString(),revision,source_event_count:source_event_count??history.archiveCount,source_catalogue_count:source_catalogue_count??history.catalogueCount,published_event_count:ids.length,subsession_ids:ids,adapter_sha256:adapter_sha256.toLowerCase(),coverage:{official_events:races.filter(r=>r.source.certainty==='official').length,native_events:races.filter(r=>r.source.certainty==='native_completed').length,metadata_supplemented:races.filter(r=>r.metadata_source!=='canonical').length,laps_led:{known:races.filter(r=>r.coverage.laps_led.known>0).length,total:races.length},unverified_driver_rows:0},files:Object.fromEntries(Object.entries(serialized).map(([key,value])=>[key+'.json',{sha256:hash(value)}])),counting:'One final Feature per subsession; opening Bomber twins are distinct scoring sessions, not extra events. Starts are classified appearances; DNS is excluded.',delivery:{version:1,catalogue:'catalogue.json',events:Object.fromEntries(ids.map(id=>[id,'events/'+id+'.json']))},privacy:'Public derived fields only; no local paths or raw captures.'};
serialized.index=JSON.stringify(stable(manifest))+'\n';
const changed=[];for(const [name,value] of Object.entries(serialized)){
 if(/(?:[A-Za-z]:[\\/]|\\\\Users\\|KHR_GITHUB_TOKEN|nativeHistoricalResults|carPaint|birthDate|source_path)/i.test(value))throw Error('Public export privacy check failed: '+name);
 const rel=`news/data/intelligence/${name}.json`,dest=path.join(root,rel);let old;try{old=fs.readFileSync(dest,'utf8')}catch{}if(old!==value){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,value);changed.push(rel);}
}
if(recoveryOptions.audit_output){fs.writeFileSync(recoveryOptions.audit_output,JSON.stringify({exhaustive:!!recoveryOptions.exhaustive,adapter_sha256,events:ids,sourceAudit},null,2)+'\n');}
process.stdout.write(JSON.stringify({changed_paths:changed,event_count:ids.length,subsession_ids:ids,revision})+'\n');
