// Pure identity/profile adapter. Roster evidence never creates results or scoring.
import crypto from 'node:crypto';
export const ALLOWED_PROFILE_FIELDS=['id','firstName','lastName','suffix','country','hometown','team','header','info','bio','latestNews','website','youtube','twitter','twitch','facebook','pictureUrl','createdAt','updatedAt'];
const AUTHOR_FIELDS=ALLOWED_PROFILE_FIELDS.filter(k=>!['id','createdAt','updatedAt'].includes(k));
const EXCLUSION_FLAGS=['isSpectator','spectator','isObserver','observer','isPaceCar','paceCar','isAI','ai','isBroadcaster','broadcaster'];
export const norm=v=>String(v??'').trim().toLowerCase().replace(/\s+/g,' ');
const clone=v=>JSON.parse(JSON.stringify(v));
const validId=v=>Number.isSafeInteger(Number(v))&&Number(v)>0&&/^[1-9]\d{0,9}$/.test(String(v));
const hash=v=>crypto.createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const time=v=>typeof v==='string'?Date.parse(v):NaN;
const stable=v=>JSON.stringify(sort(v));
function sort(v){if(Array.isArray(v))return v.map(sort);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])]));return v}
function text(v,max=128){return typeof v==='string'&&v.trim()&&v.length<=max&&!/[\u0000-\u001f]/.test(v)?v.trim():null}
function fail(reason){throw Error(reason)}
function observe(input,now,settings){
 const raw=typeof input==='string'?input:JSON.stringify(input);if(Buffer.byteLength(raw)>16*1024*1024)fail('snapshot_too_large');const s=JSON.parse(raw),ts=time(s.timestamp);
 if(!Number.isFinite(ts)||now-ts>45000||ts-now>5000)fail('stale_or_invalid_timestamp');
 if(s.snapshot?.retained!==false||s.snapshot.retainedFrom)fail('retained_snapshot');
 if(s.connectionHealth&&s.connectionHealth.isFresh!==true)fail('unfresh_connection');
 const n=s.broadcast?.nativeEventIdentity,r=s.diagnostic?.rawSession,c=s.broadcast?.championship?.sessionCapture?.currentSession;
 const nativeCurrent=s.broadcast?.nativeHistoricalResults?.sessions?.find(x=>x.sessionNum===r?.sessionNum),safety=s.broadcast?.nativeCompletionSafety;
 const independent=!c&&safety?.readOnly===true&&safety.sessionIdentity===n?.eventKey&&safety.nativeCurrentSessionNum===r?.sessionNum&&nativeCurrent?.structureValid===true&&norm(nativeCurrent.sessionName)===norm(r?.sessionName)&&norm(nativeCurrent.sessionType)===norm(r?.sessionType)&&s.broadcast.nativeHistoricalResults.sessionInfoUpdate===n?.nativeUpdate;
 if(!n||n.identityValid!==true||n.leagueConsistent!==true||Number(n.leagueID)!==10402||Number(n.liveLeagueID)!==10402||Number(s.league?.id)!==10402||!validId(n.subSessionID)||!validId(n.sessionID))fail('invalid_native_identity');
 const eventKey=[n.sessionID,n.subSessionID,10402].join('|');if(n.eventKey!==eventKey)fail('native_event_key_mismatch');
 if(!r||!Number.isInteger(r.sessionNum)||r.sessionNum<0||(!independent&&(!c||c.sessionNum!==r.sessionNum||norm(c.name)!==norm(r.sessionName)||norm(c.type)!==norm(r.sessionType)||c.replayBlocked!==false))||s.replayMode===true||r.replayMode===true||s.session?.isReplay===true)fail('session_or_replay_mismatch');
 if(norm(s.session?.name)!==norm(r.sessionName)||Number(s.session?.state)!==Number(r.state))fail('diagnostic_session_mismatch');
 if(s.broadcast.nativeCompletionSafety?.nativeCurrentSessionNum!=null&&s.broadcast.nativeCompletionSafety.nativeCurrentSessionNum!==r.sessionNum)fail('native_session_mismatch');
 const rows=s.diagnostic?.drivers,active=s.drivers;if(!Array.isArray(rows)||!Array.isArray(active)||rows.length>256||active.length>256||(c&&c.driverCount!==active.length))fail('invalid_current_roster');
 const native=s.broadcast.nativeHistoricalResults?.sessions?.find(x=>x.sessionNum===r.sessionNum),nativeRows=native?.results;
 const excluded=new Set(settings.excluded_customer_ids.map(Number)),ids=new Map(),carIndexes=new Map(),accepted=new Map(),rejected=[];
 for(const row of rows){const f=row.fields||{},id=Number(f.userId),idx=f.carIdx;ids.set(id,(ids.get(id)||0)+1);carIndexes.set(idx,(carIndexes.get(idx)||0)+1)}
 for(const row of rows){const f=row.fields||{},id=Number(f.userId),name=text(f.name),number=text(String(f.number??''),6),idx=f.carIdx;
  let reason=null;
  if(!validId(f.userId)||!Number.isInteger(idx)||idx<0||idx>255||!name||!number||!/^[0-9A-Za-z]{1,5}$/.test(number))reason='invalid_driver_identity';
  else if(ids.get(id)!==1||carIndexes.get(idx)!==1)reason='duplicate_id_or_car_index';
  else if(excluded.has(id))reason='broadcaster_excluded';
  else if(f.inSession!==true||!Number.isInteger(f.flags)||(f.flags&512)!==0)reason='not_in_active_world';
  else if([f,row].some(o=>EXCLUSION_FLAGS.some(k=>o[k]===true||o[k]===1||norm(o[k])==='true')||/^(spectator|observer|broadcaster|pace|ai)$/.test(norm(o.role))))reason='excluded_role';
  else if(!validId(f.carId)||!text(f.carName)||/pace|safety.?car/i.test(f.carName+' '+(f.carDisplayName||'')))reason='not_a_racing_car';
  else if(norm(row.name)!==norm(name)||String(row.number)!==number)reason='diagnostic_row_mismatch';
  const matching=active.filter(a=>norm(a.name)===norm(name)&&String(a.number)===number);
  if(!reason&&matching.length!==1)reason='active_row_ambiguous';
  if(!reason&&matching.some(a=>EXCLUSION_FLAGS.some(k=>a[k]===true||a[k]===1)||a.inSession===false))reason='active_row_excluded';
  let rosterProof='sdk_active_timed_driver';
  if(!reason&&Array.isArray(nativeRows)&&nativeRows.length){const m=nativeRows.filter(x=>x.carIdx===idx&&norm(x.name)===norm(name)&&String(x.number)===number);if(m.length!==1)reason='native_roster_mismatch';else rosterProof='native_current_session_roster'}
  if(!reason&&(!Number.isFinite(Number(f.position))||Number(f.position)<1||!(Number(f.laps)>0||Number(f.bestLapTime)>0||Number(f.qualifyingLapTime)>0)))reason='waiting_for_timed_driver_evidence';
  if(reason){rejected.push({id:validId(f.userId)?id:null,reason});continue}
  const champ=s.broadcast.championship,series=champ.enabled===true&&champ.detection?.retainedValidatedEvent===false&&['bomber_stocks','cushion_kings','mini_menaces','dirt_cheap_asphalt_fast','wide_open_revival'].includes(champ.activeSeriesKey)?champ.activeSeriesKey:null;
  const team=text(f.teamName),multi=text(f.multicarTeamName);
  accepted.set(id,{id,car_index:idx,name,number,subsession_id:Number(n.subSessionID),session_id:Number(n.sessionID),session_number:r.sessionNum,session_name:r.sessionName,series_key:series,team_name:team&&norm(team)!==norm(name)?team:null,multicar_team_name:multi,at:s.timestamp,sha256:hash(raw),native_update:n.nativeUpdate,elapsed:Number(r.sessionTimeElapsed),roster_proof:rosterProof});
 }
 return {eventKey,subsession_id:Number(n.subSessionID),session_number:r.sessionNum,at:ts,sha256:hash(raw),accepted,rejected};
}
function registrySeed(ids,profiles,registry){if(registry){if(registry.schema_version!=='MMTV-driver-registry-v1')fail('invalid_registry_schema');return clone(registry)}const drivers={};for(const[id,p]of Object.entries(profiles.drivers||{}))if(validId(id))drivers[id]={id:Number(id),verification:'existing_confirmed',aliases:[],events:{},profile:clone(p.profile),profile_revision:p.profile_revision||p.profile?.updatedAt||null};for(const[n,id]of Object.entries(ids.names)){drivers[id]??={id:Number(id),verification:'existing_confirmed',aliases:[],events:{},profile:null};drivers[id].aliases.push({name:n,normalized:norm(n),source:'existing_confirmed_identity_map'})}return {schema_version:'MMTV-driver-registry-v1',drivers,api:{failures:0,pending_ids:[]},conflicts:[],ever_fresh:false}}
function safeProfile(record){const p={};for(const k of ALLOWED_PROFILE_FIELDS){if(!Object.hasOwn(record,k))continue;const v=record[k];if(k==='id'){p.id=Number(v);continue}if(v!==null&&typeof v!=='string')fail('invalid_profile_field_type');if(typeof v==='string'&&v.length>65536)fail('profile_field_too_large');if(['website','youtube','twitter','twitch','facebook','pictureUrl'].includes(k)&&typeof v==='string'&&/^\s*(javascript|data|file|vbscript):/i.test(v))fail('unsafe_profile_url');p[k]=v}return p}
export function workflow(input){
 const now=time(input.now);if(!Number.isFinite(now))fail('invalid_clock');const ids=clone(input.identities),beforeProfiles=clone(input.profiles),profiles=clone(input.profiles);
 if(ids.schema_version!=='MMTV-driver-identities-v1'||profiles.schema_version!=='MMTV-driver-profiles-v1'||Object.values(ids.names).some(v=>!validId(v)))fail('invalid_public_schema');
 const settings=input.settings||{},reg=registrySeed(ids,profiles,input.registry),originalNames=clone(ids.names),notes=[],api=reg.api,accepted=[],newIds=[],newSubsessions=[];
 api.pending_ids??=[];api.pending_subsessions??=[];let discoveryStatus=settings.enabled?'waiting_for_fresh_pair':'disabled';
 if(settings.enabled){
  if(settings.exclusions_confirmed!==true||!Array.isArray(settings.excluded_customer_ids)||!settings.excluded_customer_ids.length||settings.excluded_customer_ids.some(v=>!validId(v)))discoveryStatus='broadcaster_exclusion_required';
  else try{
   if(!Array.isArray(input.snapshots)||input.snapshots.length!==2)fail('two_complete_observations_required');
   const a=observe(input.snapshots[0],now,settings),b=observe(input.snapshots[1],now,settings);
   if(a.eventKey!==b.eventKey||a.session_number!==b.session_number||b.at-a.at<1000||b.at-a.at>30000||a.sha256===b.sha256)fail('unstable_or_repeated_observation');
   for(const [id,y]of b.accepted){const x=a.accepted.get(id);if(!x||x.car_index!==y.car_index||norm(x.name)!==norm(y.name)||x.number!==y.number||!(y.elapsed>x.elapsed||Number(y.native_update)>Number(x.native_update))){notes.push({id,reason:'unstable_identity_mapping'});continue;}
    const isNew=!reg.drivers[id];if(isNew){newIds.push(id);api.pending_ids.push(id);reg.drivers[id]={id,verification:'sdk_two_fresh_observations',aliases:[],events:{},profile:null,profile_revision:null}}
    const d=reg.drivers[id];d.first_seen??=x.at;d.last_seen=y.at;d.display_name=y.name;
    if(!d.aliases.some(n=>n.normalized===norm(y.name)))d.aliases.push({name:y.name,normalized:norm(y.name),source:'sdk_two_fresh_observations',subsession_id:y.subsession_id,session_number:y.session_number,snapshot_sha256:[x.sha256,y.sha256]});
    const eventKey=y.subsession_id+'|'+y.session_number;if(!d.events[eventKey]){if(!Object.values(d.events).some(e=>e.subsession_id===y.subsession_id))newSubsessions.push(y.subsession_id);d.events[eventKey]={subsession_id:y.subsession_id,session_number:y.session_number,first_seen:x.at,car_numbers:[]}}
    const event=d.events[eventKey];event.last_seen=y.at;event.identity_proof={customer_id:id,car_index:y.car_index,session_id:y.session_id,subsession_id:y.subsession_id,session_number:y.session_number,observations:[{at:x.at,sha256:x.sha256,native_update:x.native_update,elapsed:x.elapsed},{at:y.at,sha256:y.sha256,native_update:y.native_update,elapsed:y.elapsed}],roster_proof:y.roster_proof};if(!event.car_numbers.includes(y.number))event.car_numbers.push(y.number);
    const observation={league_id:10402,subsession_id:y.subsession_id,session_number:y.session_number,session_name:y.session_name,series_key:y.series_key,car_number:y.number,team_name:x.team_name===y.team_name?y.team_name:null,multicar_team_name:x.multicar_team_name===y.multicar_team_name?y.multicar_team_name:null,source:'SDK session observation',participation:'observed_only'};
    const material=hash(observation);if(d.observation_signature!==material){d.observation_signature=material;d.public_observation={...observation,observed_at:y.at,snapshot_sha256:[x.sha256,y.sha256]};event.observations??=event.observation?[event.observation]:[];if(!event.observations.some(o=>hash(Object.fromEntries(Object.entries(o).filter(([k])=>!['observed_at','snapshot_sha256'].includes(k))))===material))event.observations.push(d.public_observation);event.observation=d.public_observation}
    accepted.push(id);
   }
   notes.push(...a.rejected,...b.rejected);if(accepted.length)reg.ever_fresh=true;api.pending_subsessions=[...new Set([...api.pending_subsessions,...newSubsessions])];discoveryStatus=accepted.length?'verified':'no_stable_eligible_driver';
  }catch(e){discoveryStatus='rejected';notes.push({reason:e.message})}
 }
 // Reproject pending verified identities after a failed/dry-run publication; no dependence on current series.
 const nameOwners=new Map();for(const[n,id]of Object.entries(input.classifiedNames||{})){if(validId(id))nameOwners.set(norm(n),new Set([Number(id)]))}
 for(const[n,id]of Object.entries(originalNames)){if(!nameOwners.has(norm(n)))nameOwners.set(norm(n),new Set());nameOwners.get(norm(n)).add(Number(id))}
 for(const d of Object.values(reg.drivers))for(const a of d.aliases||[]){if(!nameOwners.has(a.normalized))nameOwners.set(a.normalized,new Set());nameOwners.get(a.normalized).add(d.id)}
 const ambiguous=[];for(const[n,owners]of nameOwners){if(owners.size>1){ambiguous.push(n);if(!Object.hasOwn(originalNames,n))delete ids.names[n];if(!reg.conflicts.some(c=>c.name===n&&stable(c.ids)===stable([...owners].sort((a,b)=>a-b))))reg.conflicts.push({name:n,ids:[...owners].sort((a,b)=>a-b),status:'alias_ambiguous_no_merge'})}else if(Object.values(reg.drivers).some(d=>d.aliases?.some(a=>a.normalized===n)))ids.names[n]=[...owners][0]}
 if(ambiguous.length)ids.ambiguous_names=[...new Set([...(ids.ambiguous_names||[]),...ambiguous])].sort();
 profiles.names=clone(ids.names);if(ids.ambiguous_names?.length)profiles.ambiguous_names=clone(ids.ambiguous_names);
 const periodic=reg.ever_fresh&&(!api.last_success||now-time(api.last_success)>=(settings.periodic_seconds??21600)*1000);
 const demand=!!input.manual||api.pending_subsessions.length>0||newIds.length>0||api.pending_ids.length>0||periodic;
 const needProfileFetch=demand&&now>=(time(api.next_allowed)||0);let profileStatus=needProfileFetch?'fetch_required':demand?'backoff':'not_due';
 if(needProfileFetch&&input.profileResponse){
  const previousDrivers=clone(reg.drivers);
  try{
   const response=input.profileResponse;if(response.status!==200)fail('profile_api_unavailable');
   const body=typeof response.body==='string'?response.body:JSON.stringify(response.body);if(Buffer.byteLength(body)>16*1024*1024)fail('profile_response_too_large');const rows=JSON.parse(body);
   if(!Array.isArray(rows)||rows.length===0)fail('empty_or_partial_profile_response');
   const seen=new Set();let invalidUnrelated=0;for(const p of rows){if(!p||!validId(p.id)){invalidUnrelated++;continue}if(seen.has(Number(p.id))&&reg.drivers[Number(p.id)])fail('invalid_or_duplicate_profile_id');seen.add(Number(p.id))}if(!seen.size)fail('invalid_or_duplicate_profile_id');if(invalidUnrelated)notes.push({reason:'unrelated_invalid_profile_ids_ignored',count:invalidUnrelated});
   if(api.last_count&&rows.length<api.last_count*0.9)fail('suspicious_partial_profile_response');
   const byId=new Map(rows.filter(p=>p&&validId(p.id)).map(p=>[Number(p.id),p]));for(const d of Object.values(reg.drivers)){
    const row=byId.get(d.id);if(!row){if(d.profile)notes.push({id:d.id,reason:'profile_omission_retained_pending_authoritative_revision'});d.profile_checked=true;continue}
    const incoming=safeProfile(row),revision=time(incoming.updatedAt),previous=time(d.profile_revision||d.profile?.updatedAt);
    if(!Number.isFinite(revision)||revision-now>300000){notes.push({id:d.id,reason:'unverified_profile_revision_retained'});continue}
    if(Number.isFinite(previous)&&revision<previous){notes.push({id:d.id,reason:'older_profile_revision_retained'});continue}
    if(Number.isFinite(previous)&&revision===previous&&d.profile){if(Object.entries(incoming).some(([k,v])=>Object.hasOwn(d.profile,k)&&stable(d.profile[k])!==stable(v)))notes.push({id:d.id,reason:'same_revision_conflict_retained'});d.profile_checked=true;continue}
    const merged={...(d.profile||{}),...incoming};d.profile=AUTHOR_FIELDS.some(k=>merged[k]!=null&&String(merged[k]).trim())?merged:null;d.profile_revision=incoming.updatedAt;d.profile_checked=true;
   }
   api.pending_subsessions=[];api.failures=0;api.last_success=input.now;api.next_allowed=new Date(now+(settings.min_fetch_seconds??60)*1000).toISOString();api.last_count=rows.length;api.last_response_sha256=hash(body);api.pending_ids=api.pending_ids.filter(id=>!reg.drivers[id]?.profile_checked);profileStatus='refreshed';
  }catch(e){reg.drivers=previousDrivers;api.failures=(api.failures||0)+1;api.next_allowed=new Date(now+Math.min(21600,60*2**Math.min(api.failures-1,9))*1000).toISOString();api.last_error=e.message;profileStatus='retained_after_error';notes.push({reason:e.message})}
 }
 for(const d of Object.values(reg.drivers)){
  let row=profiles.drivers[String(d.id)];if(!row){if(d.verification!=='sdk_two_fresh_observations')continue;row={iracing_id:d.id,profile:null,display_name:d.display_name,identity_source:'sdk_two_fresh_observations'}}
  row=clone(row);row.iracing_id=d.id;
  const localRevision=time(d.profile_revision),publicRevision=time(row.profile_revision||row.profile?.updatedAt);
  if(d.profile_checked&&(!Number.isFinite(publicRevision)||localRevision>=publicRevision)){row.profile=clone(d.profile);if(!d.profile&&d.profile_revision){row.profile_revision=d.profile_revision;row.profile_status='driver_cleared'}}
  if(d.public_observation){row.latest_observation=clone(d.public_observation);if(!row.display_name&&d.display_name)row.display_name=d.display_name}
  profiles.drivers[String(d.id)]=row;
 }
 const changed_paths=[];if(stable(ids)!==stable(input.identities))changed_paths.push('news/data/driver-identities.json');if(stable(profiles)!==stable(beforeProfiles))changed_paths.push('news/data/driver-profiles.json');
 if(Buffer.byteLength(JSON.stringify(profiles))>3*1024*1024)fail('public_profile_budget_exceeded');
 reg.api.pending_ids=[...new Set(reg.api.pending_ids)];return {identities:ids,profiles,registry:reg,needProfileFetch:needProfileFetch&&!input.profileResponse,changed_paths,available:Object.values(profiles.drivers).filter(d=>d.profile).length,identified:Object.keys(profiles.drivers).length,new_ids:newIds,accepted_ids:accepted,discovery_status:discoveryStatus,profile_status:profileStatus,notes};
}
