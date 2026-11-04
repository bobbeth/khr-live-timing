import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),val=s=>String(s).trim().replace(/^["']|["']$/g,''),yes=v=>/^(?:1|true)$/i.test(String(v));
export function parseNativeSessionInfo(text){
 const lines=text.split(/\r?\n/),week={},drivers=new Map(),sessions=[];let section='',driver=null,session=null,row=null,inRows=false;
 const pushDriver=()=>{if(driver)drivers.set(Number(driver.CarIdx),driver);driver=null},pushRow=()=>{if(row&&session)session.rows.push(row);row=null};
 for(const line of lines){
  const top=line.match(/^([A-Za-z][A-Za-z0-9_]*):/);if(top){pushDriver();pushRow();section=top[1];inRows=false;session=null}
  const pair=line.match(/^\s*(?:-\s*)?([A-Za-z][A-Za-z0-9_]*):\s*(.*?)\s*$/);if(!pair)continue;const key=pair[1],value=val(pair[2]);
  if(section==='WeekendInfo'){week[key]=value;continue}
  if(section==='DriverInfo'){if(/^\s*-\s*CarIdx:/.test(line)){pushDriver();driver={CarIdx:value}}else if(driver)driver[key]=value}
  if(section==='SessionInfo'){
   if(/^\s*-\s*SessionNum:/.test(line)){pushRow();session={SessionNum:value,rows:[]};sessions.push(session);inRows=false}
   else if(session&&key==='ResultsPositions'){pushRow();inRows=true}
   else if(session&&key==='ResultsFastestLap'){pushRow();inRows=false}
   else if(session&&inRows&&/^\s*-\s*Position:/.test(line)){pushRow();row={Position:value}}
   else if(session&&inRows&&row)row[key]=value;
   else if(session&&!inRows)session[key]=value;
  }
 }pushDriver();pushRow();return {week,drivers,sessions};
}
export function nativeNonRaceSessions({canonical,captureRoot,id,admitDriver=()=>false}){
 const sessions=new Map();
 for(const ref of canonical.live?.captures||[]){
  if(!ref.file.startsWith('session-evidence/'+id+'/'))continue;
  const file=path.resolve(captureRoot,ref.file);if(!file.startsWith(path.resolve(captureRoot)+path.sep))throw Error('Unsafe native session evidence path');
  const bytes=fs.readFileSync(file);if(hash(bytes)!==ref.sha256.toLowerCase())throw Error('Session evidence checksum mismatch');
  const frame=JSON.parse(bytes),native=frame.sessionEvidence?.nativeSessionInfo;
  if(!native?.connected||!native.text)continue;if(hash(Buffer.from(native.text))!==native.sha256.toLowerCase())throw Error('Native SessionInfo checksum mismatch');
  const doc=parseNativeSessionInfo(native.text),identity=frame.broadcast?.nativeEventIdentity;
  if(!identity?.identityValid||Number(identity.subSessionID)!==id||Number(identity.leagueID)!==10402||Number(doc.week.SubSessionID)!==id||Number(doc.week.LeagueID)!==10402||frame.session?.isReplay===true||frame.session?.isAI===true||frame.sessionEvidence?.fixture===true||frame.sessionEvidence?.testOnly===true||/AI|Test|Replay/i.test(doc.week.EventType||'')||yes(doc.week.IsAI)||yes(doc.week.AIEnabled))continue;
  for(const s of doc.sessions){
   if(!/practice|qualif|warm/i.test(s.SessionType||s.SessionName)||Number(s.ResultsOfficial)!==1||!s.rows.length)continue;
   const num=Number(s.SessionNum),current=Number(frame.diagnostic?.rawSession?.sessionNum);
   if(!(current>num||current===num&&frame.session?.isFinished&&[5,6].includes(Number(frame.diagnostic.rawSession.state))))continue;
   const rows=s.rows.map(r=>{const d=doc.drivers.get(Number(r.CarIdx)),n=v=>v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;return {position:n(r.Position),carIdx:n(r.CarIdx),number:d?.CarNumber,name:d?.UserName,userId:n(d?.UserID),lapsCompleted:n(r.LapsComplete),reason:r.ReasonOutStr||'',nativeBest:n(r.FastestTime),incidents:n(r.Incidents),champ_points:n(r.ChampPoints),blocked:!d||!admitDriver(n(d?.UserID))||yes(d.IsSpectator)||yes(d.CarIsAI)||yes(d.IsAI)}}).sort((a,b)=>a.position-b.position);
   if(rows.some(r=>r.blocked||!r.userId||r.userId<=0||!r.number||!r.name||!Number.isInteger(r.position)||r.position<1||!Number.isInteger(r.carIdx)||r.carIdx<0)||new Set(rows.map(r=>r.carIdx)).size!==rows.length||new Set(rows.map(r=>r.position)).size!==rows.length)continue;
   const value={sessionNum:num,sessionName:s.SessionName,sessionType:s.SessionType,resultsOfficial:1,structureValid:true,completedCandidate:true,resultsLapsComplete:Number(s.ResultsLapsComplete),results:rows,evidenceSource:{source_kind:'sha_verified_native_session_info',certainty:'native_supplied_session_results',official:false,subsession_id:id,session_number:num,capture_sha256:[ref.sha256.toLowerCase()],native_session_info_sha256:native.sha256.toLowerCase(),checks:['exact_native_league_subsession','separate_native_session_table','positive_native_customer_id_and_car_index','completed_native_results_and_session_transition','no_replay_ai_or_spectator']}};
   const old=sessions.get(num);if(old&&JSON.stringify(old.results)!==JSON.stringify(rows))throw Error('Conflicting completed native non-race classifications');sessions.set(num,value);
  }
 }
 return [...sessions.values()];
}
