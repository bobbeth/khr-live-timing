// Read-only field recovery. Native completed classifications always retain precedence.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const numeric=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const same=(a,b)=>numeric(a)&&numeric(b)&&Math.abs(Number(a)-Number(b))<0.00005;
const fingerprint=s=>JSON.stringify((s.results||[]).map(r=>[r.position,String(r.number),r.lapsCompleted]).sort((a,b)=>a[0]-b[0]));
const normalized=s=>String(s||'').replace(/\s+/g,' ').trim().toLowerCase();
const loaded=new Map();
function readLinked(canonicalFile,ref){
 const unified=path.dirname(path.dirname(canonicalFile));
 const dest=path.resolve(unified,ref.file);
 if(!/^live-staging[\\/]/.test(ref.file)||!dest.startsWith(unified+path.sep))throw Error('Unsafe linked capture path');
 if(loaded.has(dest)){const cached=loaded.get(dest);if(cached.sha!==String(ref.sha256).toLowerCase())throw Error('Conflicting canonical-linked capture checksum');return cached;}
 const bytes=fs.readFileSync(dest),sha=crypto.createHash('sha256').update(bytes).digest('hex');
 if(sha!==String(ref.sha256).toLowerCase())throw Error('Canonical-linked capture checksum mismatch');
 const full=JSON.parse(bytes);
 // Cache only the fields needed for validation, not the private broadcast payload.
 const s={sha,timestamp:full.timestamp,session:full.session,snapshot:full.snapshot,identity:full.broadcast?.nativeEventIdentity,
  raw:full.diagnostic?.rawSession,diagnostics:(full.diagnostic?.drivers||[]).map(d=>({number:String(d.number),carIdx:d.fields?.carIdx,userId:d.fields?.userId,bestLap:d.fields?.bestLapTime,start:d.fields?.startPosition,laps:d.fields?.laps})),
  drivers:full.drivers||[],native:full.broadcast?.nativeHistoricalResults?.sessions||[],stable:full.broadcast?.nativeClassificationStability?.sessions||[],
  evidence:full.broadcast?.nativeFinalSessionEvidence,led:full.lapsLedIntegrity,eol:full.broadcast?.eolGridPreview,eolStats:full.broadcast?.eolBroadcastStats,yota:full.broadcast?.yotaEOL,
  replay:full.session?.isReplay===true||full.diagnostic?.calculated?.isReplay===true||full.broadcast?.nativeFinalSessionEvidence?.isReplay===true};
 loaded.set(dest,s);return s;
}
export function validateSample(s,{id,num,raw}){
 const reject=reason=>({valid:false,reason});
 if(!s.identity?.identityValid||Number(s.identity.leagueID)!==10402||Number(s.identity.subSessionID)!==id)return reject('identity_mismatch');
 if(Number(s.raw?.sessionNum)!==num||Number(s.evidence?.nativeCurrentSessionNum)!==num)return reject('session_mismatch');
 if(s.snapshot?.retained!==false)return reject('retained_or_unknown_snapshot');
 const finalProof=s.evidence?.sessions?.find(p=>Number(p.sessionNum)===num);
 const clockProof=finalProof||s.evidence?.sessions?.find(p=>Number(p.replaySessionNum)===num&&same(p.sessionTime,s.raw?.sessionTimeElapsed));
 const proof=clockProof,stable=s.stable?.find(p=>Number(p.sessionNum)===num);
 // The installed diagnostic describes only the final Feature. For earlier sessions,
 // require their own current raw state and clock; never borrow the Feature driver values.
 if(s.replay||/replay|mismatch/i.test(proof?.replayContextClassification||'')&&!/^UNDETERMINED$/i.test(proof?.replayContextClassification||''))return reject('replay_context');
 if(!s.session?.isFinished||s.session.isGreen||![5,6].includes(Number(s.session.state))||![5,6].includes(Number(proof?.nativeSessionState))||![5,6].includes(Number(s.raw?.state))||!proof?.nativeStateCheckeredOrCooldown||Number(proof.replaySessionNum)!==num||!same(proof.sessionTime,s.raw.sessionTimeElapsed))return reject('native_state_not_finished');
 if(!proof.eventIdentityValid||!numeric(s.raw.sessionTimeElapsed)||Number(s.raw.sessionTimeElapsed)<=0||!numeric(proof.replayTimeDifferenceSeconds)||Math.abs(Number(proof.replayTimeDifferenceSeconds))>0.1)return reject('stale_or_mismatched_clock');
 if(!stable?.eventIdentityValid||!stable.classificationUnchanged||stable.acceptedObservations<2||stable.unchangedSeconds<Math.max(5,stable.minimumSeconds||5))return reject('completion_not_stable');
 const native=s.native.find(n=>Number(n.sessionNum)===num);
 if(!native?.completedCandidate||!native.structureValid||native.resultsOfficial!==1||fingerprint(native)!==fingerprint(raw))return reject('classification_mismatch');
 return {valid:true,proof,stable,native};
}
function selectRefs(refs){
 const selected=new Map();
 // Recent captures normally suffice; bounded samples across the catalogue find pre-replay evidence too.
 for(const [i,r] of refs.entries())if(i>=refs.length-32)selected.set(r.file,{...r,order:i});
 for(let i=0;i<40;i++){const n=Math.floor(i*Math.max(0,refs.length-1)/39);if(refs[n])selected.set(refs[n].file,{...refs[n],order:n});}
 return [...selected.values()].sort((a,b)=>b.order-a.order);
}
function fullGrid(s,raw){
 const values=raw.results.map(r=>s.drivers.find(d=>String(d.number)===String(r.number))?.sdkStartPosition);
 return values.every(v=>Number.isInteger(v)&&v>=1&&v<=raw.results.length)&&new Set(values).size===values.length;
}
function noEol(s,{entry,kind,raw,previousWinner}){
 if(['heat','qualifying','consolation','twin_feature_2'].includes(kind))return 'eol_rule_does_not_apply_to_this_session';
 if(Number(entry.round)===1)return 'opening_round_no_previous_winner';
 if(!previousWinner)return null;
 // Native final classification AND the session's complete SDK roster must both show absence.
 if(raw.results.some(r=>String(r.number)===String(previousWinner.car_number)))return null;
 if(s.diagnostics.some(d=>Number(d.userId)===Number(previousWinner.driver_id)))return null;
 if(entry.series==='Yota Outlawz'&&s.yota?.status==='winner_absent_or_not_loaded'&&s.yota.currentDriverPresent===false&&Number(s.yota.previousWinner?.round)===Number(entry.round)-1&&String(s.yota.previousWinner?.number)===String(previousWinner.car_number))return 'previous_winner_absent_eol_expired';
 return null;
}
export function recoverSession({canonical,canonicalFile,id,raw,entry,kind,previousWinner,knownIds,publishedRows=[]}){
 const num=Number(raw.sessionNum),refs=selectRefs((canonical.live?.captures||[]).filter(r=>Number(r.sessionNum)===num));
 const accepted=[],rejected={};
 for(const ref of refs){
  const s=readLinked(canonicalFile,ref),valid=validateSample(s,{id,num,raw});
  if(!valid.valid){rejected[valid.reason]=(rejected[valid.reason]||0)+1;continue}
  accepted.push({s,ref,valid});
  if(accepted.length>=5)break;
 }
 const output=new Map();
 for(const row of raw.results){
  const key=String(row.number),expectedId=Number(knownIds.get(key));if(!Number.isInteger(expectedId)||expectedId<=0||!Number.isInteger(row.carIdx)||row.carIdx<0||!key)continue;
  const result={driver_id:expectedId,values:{},proofs:{}};
  const samples=accepted.map(a=>{
   const diag=a.s.diagnostics.filter(d=>Number(d.carIdx)===Number(row.carIdx)&&d.number===key&&Number(d.userId)===expectedId);
   const drivers=a.s.drivers.filter(d=>String(d.number)===key);
   return diag.length===1&&drivers.length===1?{...a,d:drivers[0],diag:diag[0]}:null;
  }).filter(Boolean);
  const proof=(field,list,certainty=list.length>=2?'corroborated_completed_telemetry':'completed_telemetry_single_snapshot')=>({field,source_kind:'sha_verified_canonical_linked_capture',certainty,subsession_id:id,session_number:num,driver_id:expectedId,car_number:key,capture_sha256:[...new Set(list.map(x=>x.s.sha))].sort(),checks:['league_subsession_session_identity','native_completed_classification','exact_native_carIdx_sdk_userId_car','retained_false','finished_native_state_and_clock','stable_native_completion',list.length>=2?'two_distinct_native_observations':'single_snapshot_native_stable_30s_5_observations'],replay_context:list[0]?.valid.proof.replayContextClassification||'unknown',official:false});
  const stableValue=(field,predicate)=>{
   const eligible=samples.filter(x=>predicate(x));if(!eligible.length)return [];
   const newest=eligible[0],matching=eligible.filter(x=>same(x.d[field],newest.d[field]));
   const observations=new Set(matching.map(x=>String(x.s.evidence.telemetryTick)+'|'+x.valid.stable.acceptedObservations));
   if(matching.length>=2&&observations.size>=2)return matching;
   // A single current SDK frame can supplement a field when its native final
   // classification has already remained unchanged for 30s / five observations.
   // Expose this weaker evidence explicitly; it is never an official result field.
   return eligible.length===1&&newest.valid.stable.unchangedSeconds>=30&&newest.valid.stable.acceptedObservations>=5?[newest]:[];
  };
  const best=stableValue('bestLap',x=>row.lapsCompleted>0&&Number(x.d.lapsCompleted)===Number(row.lapsCompleted)&&numeric(x.d.bestLap)&&x.d.bestLap>0&&same(x.d.bestLap,x.diag.bestLap)&&x.d.bestLap<=Number(x.s.raw.sessionTimeElapsed)&&(numeric(x.d.lastLap)&&x.d.lastLap>0?x.d.bestLap<=x.d.lastLap+0.00005:true));
  if(best.length){result.values.best_lap_seconds=Number(best[0].d.bestLap);result.proofs.best_lap_seconds=proof('drivers.bestLap / diagnostic.fields.bestLapTime',best);}
  const start=stableValue('startPosition',x=>same(x.d.startPosition,x.d.sdkStartPosition)&&same(x.d.sdkStartPosition,x.diag.start)&&!x.d.startPositionOverridden&&fullGrid(x.s,raw)&&!!noEol(x.s,{entry,kind,raw,previousWinner}));
  if(start.length){result.values.start_position=Number(start[0].d.startPosition);result.proofs.start_position={...proof('drivers.startPosition / sdkStartPosition',start),eol_validation:noEol(start[0].s,{entry,kind,raw,previousWinner})};}
  // Explicitly confirmed published post-EOL grids take precedence over an SDK grid.
  const saved=publishedRows.filter(r=>String(r.car_number)===key&&Number(r.driver_id)===expectedId);
  if(saved.length===1&&/^confirmed_eol_/.test(saved[0].start_position_source||'')&&Number.isInteger(saved[0].start_position)&&saved[0].start_position>=1&&saved[0].start_position<=raw.results.length){
   result.values.start_position=saved[0].start_position;result.proofs.start_position={field:'published.start_position',source_kind:'preserved_confirmed_published_eol_grid',certainty:'confirmed_post_eol_start',subsession_id:id,session_number:num,driver_id:expectedId,car_number:key,confirmation:saved[0].start_position_source,published_row_sha256:crypto.createHash('sha256').update(JSON.stringify(saved[0])).digest('hex'),official:false};
  }
  const led=stableValue('lapsLed',x=>x.s.led?.activeVerified===true&&Number(x.s.led.activeRaceDistance)===Number(raw.resultsLapsComplete)&&x.s.led.activeRawTotal<=raw.resultsLapsComplete&&raw.results.every(n=>{const d=x.s.drivers.find(d=>String(d.number)===String(n.number));return !d?n.lapsCompleted===0:Number.isInteger(d.lapsLed)&&d.lapsLed>=0&&d.lapsLed<=n.lapsCompleted;})&&raw.results.reduce((sum,n)=>sum+(x.s.drivers.find(d=>String(d.number)===String(n.number))?.lapsLed||0),0)<=raw.resultsLapsComplete);
  if(led.length){result.values.laps_led=led[0].d.lapsLed;result.proofs.laps_led=proof('drivers.lapsLed / lapsLedIntegrity.activeVerified',led);}
  if(result.values.start_position!=null){result.values.positions_gained=result.values.start_position-Number(row.position);result.proofs.positions_gained={...result.proofs.start_position,field:'verified_start_position - native_finish_position',certainty:'derived_from_verified_start_and_native_finish'};}
  // Supplied native result fields only: never offTracks or championship rule calculations.
  for(const field of ['incidents','champ_points'])if(numeric(row[field])&&Number(row[field])>=0){result.values[field]=Number(row[field]);result.proofs[field]={field:'native_completed.results.'+field,source_kind:'native_completed_result_field',certainty:'native_supplied',subsession_id:id,session_number:num,driver_id:expectedId,car_number:key,official:false};}
  output.set(expectedId,result);
 }
 return {rows:output,audit:{subsession_id:id,session_number:num,captures_considered:refs.length,accepted:accepted.length,rejected,recovered_fields:Object.fromEntries(['best_lap_seconds','start_position','positions_gained','laps_led','incidents','champ_points'].map(f=>[f,[...output.values()].filter(r=>r.values[f]!=null).length]))}};
}
