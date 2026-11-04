/* Static public JSON only. This client never contacts the local Bridge. */
window.MMTVIntelligence=(()=>{
 let promise,model,corePromise,allPromise,ready=false;const detailRequests=new Map(),detailReady=new Set();
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const normalize=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');

 async function checked(index,name){
  if(!/^(drivers|races|venues|championships|catalogue)\.json$|^events\/[0-9]{6,12}\.json$/.test(name)||!/^([a-f0-9]{64})$/.test(index.files?.[name]?.sha256||''))throw Error('Invalid intelligence file manifest');
  if(!globalThis.crypto?.subtle)throw Error('SHA256 verification unavailable');
  const expected=index.files[name].sha256,url='data/intelligence/'+name+'?v='+expected;
  for(const cache of ['default','reload']){
   const response=await fetch(url,{cache});if(!response.ok)throw Error('Intelligence file unavailable: '+name);const text=await response.text();
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));const sha=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
   if(sha!==expected){if(cache==='default')continue;throw Error('Intelligence revision mismatch: '+name);}
   const value=JSON.parse(text);if(value.schema_version!==index.schema_version)throw Error('Intelligence schema mismatch');return value;
  }
 }
 const asMeeting=r=>({entry:r.entry,event:{subsession_id:r.entry.subsession_id,feature_results:r.rows},meeting:{subsession_id:r.entry.subsession_id,sessions:r.sessions}});
 function checkRaces(index,races){if(!Array.isArray(races)||races.length!==index.published_event_count||new Set(races.map(r=>Number(r.entry.subsession_id))).size!==index.published_event_count||races.some(r=>!index.subsession_ids.includes(Number(r.entry.subsession_id))))throw Error('Intelligence event coverage mismatch');}
 async function core(){
  if(corePromise)return corePromise;
  corePromise=(async()=>{try{
   const response=await fetch('data/intelligence/index.json',{cache:'no-store'});if(!response.ok)throw Error('Intelligence index unavailable');const index=await response.json();
   if(index.schema_version!=='MMTV-canonical-intelligence-v1'||!Array.isArray(index.subsession_ids)||new Set(index.subsession_ids).size!==index.published_event_count)throw Error('Invalid intelligence index');
   if(!index.delivery){const values=await Promise.all(['drivers','races','venues','championships'].map(n=>checked(index,n+'.json')));checkRaces(index,values[1].races);model={index,...Object.fromEntries(['drivers','races','venues','championships'].map((n,i)=>[n,values[i]]))};ready=true;index.subsession_ids.forEach(id=>detailReady.add(Number(id)));return model;}
   if(index.delivery.version!==1||index.delivery.catalogue!=='catalogue.json')throw Error('Unsupported intelligence delivery');
   const catalogue=await checked(index,'catalogue.json');checkRaces(index,catalogue.races);
   for(const id of index.subsession_ids)if(index.delivery.events?.[id]!=='events/'+id+'.json')throw Error('Invalid race delivery mapping');
   model={index,drivers:{schema_version:index.schema_version,names:catalogue.names,drivers:catalogue.identities},races:{schema_version:index.schema_version,races:catalogue.races,meetings:catalogue.races.map(asMeeting)},venues:{venues:[]},championships:{championships:[]}};
   decorate();return model;
  }catch(error){console.warn('Race intelligence unavailable; published results remain available.',error.message);corePromise=null;return null;}})();return corePromise;
 }
 async function load(){
  if(promise)return promise;
  promise=(async()=>{try{const base=await core();if(!base){promise=null;return null;}if(ready)return model;
   const values=await Promise.all(['drivers','venues','championships'].map(n=>checked(model.index,n+'.json')));
   for(const [i,n] of ['drivers','venues','championships'].entries())model[n]=values[i];ready=true;decorate();return model;
  }catch(error){console.warn('Season intelligence unavailable; published results remain available.',error.message);promise=null;return null;}})();return promise;
 }
 async function loadRace(id){
  id=Number(id);if(!Number.isInteger(id))return null;if(detailRequests.has(id))return detailRequests.get(id);
  const task=(async()=>{try{if(!await core()||!model.index.subsession_ids.includes(id)){detailRequests.delete(id);return null;}if(detailReady.has(id))return model.races.races.find(r=>r.entry.subsession_id===id);
   const result=await checked(model.index,model.index.delivery.events[id]);if(Number(result.subsession_id)!==id||Number(result.race?.entry?.subsession_id)!==id||!Array.isArray(result.race.rows)||!Array.isArray(result.race.sessions))throw Error('Race intelligence identity mismatch');
   const i=model.races.races.findIndex(r=>r.entry.subsession_id===id);model.races.races[i]=result.race;model.races.meetings[i]=asMeeting(result.race);detailReady.add(id);return result.race;
  }catch(error){console.warn('Detailed race intelligence unavailable; published results remain available.',error.message);detailRequests.delete(id);return null;}})();detailRequests.set(id,task);return task;
 }
 async function loadAll(){
  if(allPromise)return allPromise;
  allPromise=(async()=>{try{if(!await load())return null;if(!model.index.delivery)return model;const races=await checked(model.index,'races.json');checkRaces(model.index,races.races);model.races=races;model.index.subsession_ids.forEach(id=>detailReady.add(id));return model;}catch(error){console.warn('Full archive unavailable; verified route data remains available.',error.message);allPromise=null;return null;}})();return allPromise;
 }
 function statsData(profiles){
  if(!model||!ready)return null;
  return {drivers:model.drivers.drivers.map(d=>({...d,iracing_id:d.driver_id,names:new Set(d.names),numbers:new Set(d.numbers),profile:profiles?.drivers?.[String(d.driver_id)]?.profile||null,races:d.races.map(r=>({...r}))})),meetings:model.races.meetings,failures:[],sessionGaps:[...new Set(model.championships.championships.flatMap(c=>c.missing_sessions.map(s=>s.subsession_id)))],intelligence:model.index};
 }
 function enrichRow(row,rows){
  const exact=rows.filter(r=>normalize(r.driver)===normalize(row.driver)&&r.car_number===String(row.car_number));
  const id=row.driver_id||model.drivers.names[normalize(row.driver)]||(exact.length===1?exact[0].driver_id:null);
  const verified=rows.find(r=>r.driver_id===Number(id)&&r.car_number===String(row.car_number));if(!verified)return row;
  const output={...row,driver_id:verified.driver_id,field_provenance:{...row.field_provenance}};
  for(const field of ['start_position','positions_gained','laps_completed','laps_led','best_lap_seconds','incidents','champ_points','qual_lap_seconds','average_lap_seconds','league_points','league_points_status','reason_out']){
   const proof=verified.field_provenance?.fields?.[field]||verified.field_provenance;
   if(row[field]==null&&verified[field]!=null){output[field]=verified[field];output.field_provenance[field]=proof;}
   else if(row[field]!=null&&verified[field]===row[field]&&proof){output.field_provenance[field]??=proof;}
  }
  if(verified.unavailable_fields)output.unavailable_fields={...verified.unavailable_fields,...row.unavailable_fields};
  if(verified.league_points_provenance)output.league_points_provenance=verified.league_points_provenance;
  return output;
 }
 function enrichEvent(event){
  if(!model||!detailReady.has(Number(event.subsession_id)))return event;
  const source=model.races.races.find(r=>r.entry.subsession_id===Number(event.subsession_id));if(!source)return event;
  return {...event,intelligence_source:source.source,classification_difference:source.classification_difference,feature_results:event.feature_results.map(row=>enrichRow(row,source.rows))};
 }
 function enrichMeeting(meeting){
  if(!model||!detailReady.has(Number(meeting.subsession_id)))return meeting;
  const source=model.races.races.find(r=>r.entry.subsession_id===Number(meeting.subsession_id));if(!source)return meeting;
  return {...meeting,sessions:meeting.sessions.map(session=>{const verified=source.sessions.find(s=>Number(s.simsession_number)===Number(session.simsession_number)&&(s.kind===session.kind||/^WARM/i.test(s.name)&&/^WARM/i.test(session.name)));return verified?{...session,classification_difference:verified.classification_difference,classification:(session.classification||[]).map(row=>enrichRow(row,verified.classification))}:session;})};
 }
 const raceLink=(id,text)=>`<a href="#race/${Number(id)}">${esc(text||'Race report')} ↗</a>`;
 function recoverySources(r){
  const labels={start_position:'Start',positions_gained:'Places gained',best_lap_seconds:'Best lap',laps_led:'Laps led',incidents:'Incidents',champ_points:'Supplied points'};
  const list=r.sessions.flatMap(s=>s.classification.flatMap(row=>Object.entries(row.field_provenance?.fields||{}).filter(([field,p])=>labels[field]&&p.source_kind).map(([field,p])=>`<li>${esc(s.name)} · #${esc(row.car_number)} ${esc(row.driver)} · ${labels[field]}: ${esc(row[field])}. Source: ${esc(p.source_kind.replaceAll('_',' '))}; certainty: ${esc(p.certainty.replaceAll('_',' '))}. ${p.replay_context?'Live/replay context: '+esc(p.replay_context)+'. ':''}<span style="overflow-wrap:anywhere">SHA256 ${esc(p.capture_sha256?.join(', ')||p.published_row_sha256||r.source.canonical_sha256)}</span></li>`)));
  return list.length?`<details class="result-note"><summary>† Supplemented result sources</summary><p>† marks a supplemented value. These are source-checked additions, not saved official result fields. A single verified snapshot is labelled separately from corroborated captures. Unknown values remain —. Live/replay context can remain undetermined even where session identity, clocks and completion agree.</p><ul>${list.join('')}</ul></details>`:'';
 }
 function contextHtml(page,id,detail){
  if(!model)return '';
  let title='',body='';const selectedCompetition=['profile-season','standings-season','insights-season','reviews-season'].map(id=>document.getElementById(id)?.value).find(Boolean);const comp=selectedCompetition||model.races.races.slice().sort((a,b)=>b.entry.event_date.localeCompare(a.entry.event_date))[0]?.entry.competition;
  if(page==='race'){
   const r=model.races.races.find(r=>r.entry.subsession_id===Number(id));if(!r)return '';
   title='THE STORY SO FAR';body=r.facts.map(f=>`<p>${esc(f.text)}</p>`).join('')+`<p class="result-note">Verified starting positions: ${r.coverage.start_position.known}/${r.coverage.start_position.total}. Laps led: ${r.coverage.laps_led.known}/${r.coverage.laps_led.total}. Unavailable values remain —.</p><details><summary>Session progression & sources</summary><ul>${r.sessions.map(s=>`<li>${esc(s.name)} · ${s.classification.length} classified · ${esc(s.classification.find(r=>r.position===1)?.driver||'Winner unavailable')}${s.kind==='twin_feature_1'?' · Opening twin, scored separately':''}</li>`).join('')}</ul><p class="result-note">${esc(r.source.certainty)} classification · canonical SHA256 ${esc(r.source.canonical_sha256)}. ${r.classification_difference?esc(r.classification_difference.note):'Final-feature totals count this event once.'}</p></details>${recoverySources(r)}`;
  }else if(page==='driver'){
   const driverId=model.drivers.names[normalize(id)]||Number(id),d=model.drivers.drivers.find(d=>d.driver_id===driverId||d.id===normalize(id));if(!d)return '';
   title='FORM GUIDE';const ss=d.session_statistics_by_competition[comp]||{heat_wins:0,heats:0,qualifying_wins:0,qualifying:0},f=d.by_competition[comp];if(!f)return '';
   body=`<p>${esc(comp)} · ${f.starts} final-feature appearances · ${f.wins} wins · ${f.top5} top fives.</p><p>Current recorded appearance streak: ${f.winStreak} ${f.winStreak===1?'win':'wins'} · ${f.podiumStreak} ${f.podiumStreak===1?'podium':'podiums'} · ${f.top5Streak} ${f.top5Streak===1?'top five':'top fives'}.</p><div class="canonical-form">${f.recent.map(r=>raceLink(r.id,'P'+r.finish+' · '+r.date)).join(' ')}</div><h3>BY CHAMPIONSHIP</h3><ul>${Object.entries(d.by_series).filter(([key])=>key.startsWith(comp+'|')).map(([key,s])=>`<li>${esc(key.slice(comp.length+1))}: ${s.wins} wins / ${s.starts} appearances · average finish ${s.average?.toFixed(2)??'—'} · verified starts ${s.startCoverage}/${s.starts} · laps led ${s.ledCoverage}/${s.starts}</li>`).join('')}</ul><details><summary>Personal best laps · compatible layouts and classes</summary>${d.personal_bests.filter(p=>p.competition===comp).length?'<ul>'+d.personal_bests.filter(p=>p.competition===comp).map(p=>'<li>'+esc(p.venue.split('|').slice(1).join(' · '))+': '+Number(p.best.seconds).toFixed(4)+'s · '+raceLink(p.best.subsession_id)+' · '+p.known+'/'+p.total+' recorded meetings with supplied laps</li>').join('')+'</ul>':'<p>— Comparable layout, class and lap evidence is not available.</p>'}</details><h3>AT THE TRACKS</h3><ul>${Object.entries(d.by_venue).filter(([key])=>key.startsWith(comp+'|')).map(([key,s])=>`<li>${esc(key.slice(comp.length+1))}: ${s.wins} wins / ${s.starts} appearances · best finish ${s.best?'P'+s.best:'—'}</li>`).join('')}</ul><p class="result-note">Recorded heat wins: ${ss.heat_wins}/${ss.heats} heats. Qualifying wins: ${ss.qualifying_wins}/${ss.qualifying} classified qualifying sessions. Missing sessions are unknown, not zero-performance claims. Venue lap records are separated by layout and vehicle class.</p>`;
  }else if(['standings','championships','round','rounds'].includes(page)){
   title='THE POINTS MOVED';const round=page==='round'?Number(detail):null;
   body=model.championships.championships.filter(c=>c.competition===(page==='round'?id:comp)).map(c=>{const r=round?c.rounds.find(r=>r.round===round):c.rounds.at(-1);if(!r)return '';return `<details><summary>${esc(c.series)} · Round ${r.round}</summary><ul>${r.standings.slice(0,5).map(d=>`<li>${d.rank}. ${esc(d.name)} — ${d.points} pts (${d.saved_points} supplied + ${d.provisional_points} provisional) · ${d.movement===null?'No previous rank':d.movement>0?'↑ '+d.movement:d.movement<0?'↓ '+Math.abs(d.movement):'Unchanged'}</li>`).join('')}</ul><p class="result-note">Before drops. ${c.missing_sessions.length} meeting(s) have unobserved qualifying; totals may be incomplete. Equal points share a rank.</p></details>`;}).join('');
  }else if(['track','track-name','tracks'].includes(page)){
   title='TRACK NOTEBOOK';const slug=s=>normalize(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
   const groups=model.venues.venues.filter(v=>v.competition===comp&&(page==='tracks'||v.public_venue_id===id||slug(v.public_venue_name)===slug(id)||slug(v.track)===slug(id)));
   body=groups.map(v=>`<details><summary>${esc(v.track)} · ${esc(v.configuration||'Layout unknown')} · ${esc(v.vehicle_classes.join(' / ')||'Class unknown')}</summary><p>${v.events.length} recorded meetings.</p><ul>${v.past_winners.map(w=>`<li>${raceLink(w.subsession_id,w.date+' · '+w.name)}</li>`).join('')}</ul><p>${v.repeat_winners.map(w=>esc(w.name)+' · '+w.wins+' wins').join(' / ')||'No repeat winner recorded in this configuration/class group.'}</p><p>Best supplied lap: ${v.best_lap?Number(v.best_lap.seconds).toFixed(4)+'s':'— (compatible layout/class evidence required)'}</p></details>`).join('');
  }else if(['home','commentary','records','compare'].includes(page)){
   title=page==='home'?'ON A ROLL':'THE FORM BOOK';
   body=model.races.races.filter(r=>r.entry.competition===comp).slice().sort((a,b)=>b.entry.event_date.localeCompare(a.entry.event_date)||b.entry.subsession_id-a.entry.subsession_id).slice(0,3).map(r=>`<p>${raceLink(r.entry.subsession_id,r.entry.series+' · Round '+r.entry.round)}<br>${esc(r.facts[0]?.text)}</p>`).join('')+`<p class="result-note">${model.index.published_event_count} source-traced race events. Laps led available in ${model.index.coverage.laps_led.known}/${model.index.coverage.laps_led.total} events. Records use each final Feature once; opening Bomber twins remain separate scoring sessions. ${esc(comp)} by default; use existing season/scope filters for opt-in comparisons.</p>`;
  }
  return body?`<section id="canonical-intelligence" class="canonical-intelligence"><span class="eyebrow">${esc(comp)} · RECORDED RESULTS</span><h2>${title}</h2>${body}</section>`:'';
 }
 function decorate(){
  const app=document.getElementById('app');if(!model||!app||app.querySelector('#canonical-intelligence')||app.querySelector('.loading'))return;
  const [page,id,detail]=decodeURIComponent(location.hash.slice(1)||'home').split('/');
  const html=contextHtml(page,id,detail);if(!html)return;
  if(page==='race'){
   const details=app.querySelector('#race-details')||document.getElementById('race-details');
   const video=details?.querySelector('.race-broadcast');
   if(video)video.insertAdjacentHTML('afterend',html);else if(details)details.insertAdjacentHTML('afterbegin',html);
  }else (app.querySelector('.container.section')||app).insertAdjacentHTML('beforeend',html);
 }
 if(typeof MutationObserver!=='undefined')new MutationObserver(decorate).observe(document.getElementById('app'),{childList:true,subtree:true});
 return {load,loadRace,loadAll,statsData,enrichEvent,enrichMeeting,contextHtml,decorate,get model(){return model;}};
})();
