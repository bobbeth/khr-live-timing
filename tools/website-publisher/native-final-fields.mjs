// Read-only candidate. No production imports, writes or execution side effects.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
import {parseNativeSessionInfo} from './native-session-evidence.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),yes=v=>/^(1|true)$/i.test(String(v));
export function finalFields({captureRoot,manifest,id,sessionNumber,expectedRows}){
 if(manifest.schema!=='KHR-session-evidence-v1'||Number(manifest.league_id)!==10402||Number(manifest.subsession_id)!==id)throw Error('Manifest identity mismatch');
 if(!Number.isSafeInteger(id)||id<=0||!Number.isInteger(sessionNumber)||!expectedRows.length)throw Error('Invalid expected classification');
 const expected=new Map(expectedRows.map(r=>[Number(r.driver_id),r]));if(expected.size!==expectedRows.length||[...expected.keys()].some(n=>!Number.isSafeInteger(n)||n<=0))throw Error('Expected identities are not unique');
 const accepted=[],rejected={};
 const reject=reason=>{rejected[reason]=(rejected[reason]||0)+1};
 for(const ref of manifest.captures){
  const file=path.resolve(captureRoot,ref.file);if(!ref.file.startsWith('session-evidence/'+id+'/')||!file.startsWith(path.resolve(captureRoot)+path.sep))throw Error('Unsafe capture path');
  const bytes=fs.readFileSync(file);if(sha(bytes)!==String(ref.sha256).toLowerCase())throw Error('Capture hash mismatch');
  const frame=JSON.parse(bytes),native=frame.sessionEvidence?.nativeSessionInfo,identity=frame.broadcast?.nativeEventIdentity;
  if(!native?.connected||!native.text){reject('no_native_document');continue}
  if(sha(Buffer.from(native.text))!==String(native.sha256).toLowerCase())throw Error('Native document hash mismatch');
  const doc=parseNativeSessionInfo(native.text);
  if(!identity?.identityValid||Number(identity.leagueID)!==10402||Number(identity.subSessionID)!==id||Number(doc.week.SubSessionID)!==id||Number(doc.week.LeagueID)!==10402){reject('wrong_identity');continue}
  if(frame.session?.isReplay===true||frame.session?.isAI===true||frame.sessionEvidence?.fixture||frame.sessionEvidence?.testOnly||/AI|Test|Replay/i.test(doc.week.EventType||'')||yes(doc.week.IsAI)||yes(doc.week.AIEnabled)){reject('excluded_context');continue}
  const session=doc.sessions.find(s=>Number(s.SessionNum)===sessionNumber);
  if(!session||Number(session.ResultsOfficial)!==1||!/^race$/i.test(session.SessionType||'')||session.rows.length!==expectedRows.length){reject('not_completed_exact_race');continue}
  const rows=[];let mismatch=false;
  for(const r of session.rows){const d=doc.drivers.get(Number(r.CarIdx)),id=Number(d?.UserID),e=expected.get(id);if(!d||!e||yes(d.IsSpectator)||yes(d.CarIsAI)||yes(d.CarIsPaceCar)||yes(d.IsAI)||String(d.CarNumber)!==String(e.car_number)||Number(r.Position)!==Number(e.finish_position??e.position)||Number(r.LapsComplete)!==Number(e.laps_completed)){mismatch=true;break}
   const field=(key,{integer=false}={})=>r[key]!==undefined&&r[key]!==''&&Number.isFinite(Number(r[key]))&&Number(r[key])>=0&&(!integer||Number.isInteger(Number(r[key])))?Number(r[key]):null;
   rows.push({driver_id:id,car_number:String(d.CarNumber),position:Number(r.Position),laps_completed:Number(r.LapsComplete),best_lap_seconds:field('FastestTime')>0?field('FastestTime'):null,laps_led:field('LapsLed',{integer:true}),incidents:field('Incidents',{integer:true})});
  }
  if(mismatch||new Set(rows.map(r=>r.driver_id)).size!==expectedRows.length||new Set(rows.map(r=>r.position)).size!==expectedRows.length){reject('classification_or_identity_mismatch');continue}
  rows.sort((a,b)=>a.position-b.position);const distance=Number(session.ResultsLapsComplete);
  if(!Number.isInteger(distance)||distance<=0||distance!==Math.max(...rows.map(r=>r.laps_completed))){reject('invalid_distance');continue}
  const ledValid=rows.every(r=>r.laps_led!==null&&r.laps_led<=r.laps_completed)&&rows.reduce((n,r)=>n+r.laps_led,0)===distance;
  if(!ledValid)for(const r of rows)r.laps_led=null;
  accepted.push({rows,capture_sha256:sha(bytes),native_sha256:sha(Buffer.from(native.text)),distance});
 }
 const groups=new Map();for(const a of accepted){const fingerprint=JSON.stringify(a.rows);const g=groups.get(fingerprint)||[];g.push(a);groups.set(fingerprint,g);}
 if(groups.size>1)throw Error('Conflicting completed native final result fields');
 const group=[...groups.values()][0]||[],witnesses=[...new Map(group.map(a=>[a.native_sha256,a])).values()];
 if(witnesses.length<2)return {rows:[],audit:{accepted:accepted.length,distinct_native_documents:witnesses.length,rejected,status:'insufficient_independent_native_documents'}};
 return {rows:group[0].rows,audit:{accepted:accepted.length,distinct_native_documents:witnesses.length,rejected,status:'candidate_verified'},source:{kind:'sha_verified_completed_native_race_fields',official_api:false,league_id:10402,subsession_id:id,session_number:sessionNumber,distance:group[0].distance,capture_sha256:witnesses.slice(0,2).map(w=>w.capture_sha256),native_session_info_sha256:witnesses.slice(0,2).map(w=>w.native_sha256),checks:['outer_and_inner_sha256','native_and_broadcast_league_subsession','completed_race_results','two_distinct_native_documents_agree','exact_published_driver_car_classification_lap_count','no_ai_pace_or_spectator',...(group[0].rows.every(r=>r.laps_led!==null)?['laps_led_sum_equals_race_distance']:[])],scope:'Best laps, native laps led and incidents only. No grid, gains, points, classification or canonical mutations.'}};
}

export function applyNativeFinal(row,result){
 if(result?.audit?.status!=='candidate_verified')return row;
 const source=result.rows.find(r=>r.driver_id===Number(row.driver_id)&&r.car_number===String(row.car_number)&&r.position===Number(row.position??row.finish_position)&&r.laps_completed===Number(row.laps_completed));if(!source)return row;
 const out={...row,field_provenance:{...row.field_provenance,fields:{...row.field_provenance?.fields}}};
 for(const field of ['best_lap_seconds','laps_led','incidents'])if(out[field]==null&&source[field]!=null){out[field]=source[field];out.field_provenance.fields[field]={...result.source,source_kind:result.source.kind,certainty:'native_supplied_session_results',official:false,driver_id:source.driver_id,car_number:source.car_number,field:'native.SessionInfo.ResultsPositions.'+({best_lap_seconds:'FastestTime',laps_led:'LapsLed',incidents:'Incidents'}[field])};if(out.unavailable_fields){out.unavailable_fields={...out.unavailable_fields};delete out.unavailable_fields[field]}}
 return out;
}

export function loadNativeRecoveryIds(file,override){
 const policy=override===undefined?(fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null):{schema:'MMTV-native-final-recovery-v1',enabled:true,subsession_ids:override};
 if(!policy||policy.enabled===false)return [];
 if(policy.schema!=='MMTV-native-final-recovery-v1'||policy.enabled!==true||!Array.isArray(policy.subsession_ids)||policy.subsession_ids.some(id=>!Number.isSafeInteger(id)||id<=0))throw Error('Invalid native final recovery policy');
 return [...new Set(policy.subsession_ids)];
}
