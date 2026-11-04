import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import assert from 'node:assert/strict';
import {recoverSession} from '../../tools/website-publisher/recover-session-fields.mjs';
import {nativeNonRaceSessions} from '../../tools/website-publisher/native-session-evidence.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mmtv-session-evidence-')),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),id=99999991;
fs.mkdirSync(path.join(dir,'canonical'));fs.mkdirSync(path.join(dir,'live-staging'));
const raw={sessionNum:2,sessionName:'HEAT 1',completedCandidate:true,structureValid:true,resultsOfficial:1,resultsLapsComplete:10,results:[{position:1,carIdx:3,number:'75',name:'Fixture Driver',lapsCompleted:10,reason:'Running'}]};
const make=(tick,seconds)=>({timestamp:'2026-11-04T01:00:'+String(seconds).padStart(2,'0')+'.000Z',session:{name:'HEAT 1',state:6,isFinished:true,isGreen:false,timeElapsed:180+seconds},snapshot:{retained:false},diagnostic:{rawSession:{sessionNum:2,sessionName:'HEAT 1',state:6,sessionTimeElapsed:180+seconds},drivers:[{number:'75',fields:{carIdx:3,userId:900123456,bestLapTime:17.6399,startPosition:1,laps:10}}]},drivers:[{number:'75',lapsCompleted:10,bestLap:17.6399,lastLap:17.7,startPosition:1,sdkStartPosition:1,startPositionOverridden:false,lapsLed:10}],lapsLedIntegrity:{activeVerified:true,activeRaceDistance:10,activeRawTotal:10},broadcast:{nativeEventIdentity:{identityValid:true,leagueID:10402,subSessionID:id},nativeHistoricalResults:{sessions:[structuredClone(raw),{sessionNum:9,sessionName:'FEATURE'}]},nativeClassificationStability:{sessions:[{sessionNum:2,eventIdentityValid:true,completedCandidate:true,classificationUnchanged:true,acceptedObservations:tick,unchangedSeconds:10}]},nativeFinalSessionEvidence:{nativeCurrentSessionNum:9,telemetryTick:tick,sessions:[{sessionNum:9,replayContextClassification:'UNDETERMINED'}]}}});
let seq=0;
function run(change=()=>{},retained=false){
 const frames=[make(20,1),make(21,2)];if(retained){frames[0].broadcast.nativeClassificationStability.sessions[0].acceptedObservations=1;frames[0].broadcast.nativeClassificationStability.sessions[0].unchangedSeconds=0;frames[1]=structuredClone(frames[0]);frames[1].timestamp='2026-11-04T01:00:08.000Z';frames[1].snapshot={retained:true,retainedFrom:frames[0].timestamp};frames[1].broadcast.nativeClassificationStability.sessions[0].acceptedObservations=8;frames[1].broadcast.nativeClassificationStability.sessions[0].unchangedSeconds=7;frames[1].diagnostic.drivers=[];}
 change(frames);
 const refs=frames.map(f=>{const file='live-staging/'+(++seq)+'.json',b=JSON.stringify(f);fs.writeFileSync(path.join(dir,file),b);return {file,sessionNum:2,sha256:hash(b)}});
 return recoverSession({canonical:{live:{captures:refs}},canonicalFile:path.join(dir,'canonical/'+id+'.json'),id,raw,entry:{series:'Wide Open Revival',round:6},kind:'heat',knownIds:new Map([['75',900123456]]),exhaustive:true});
}
assert.equal(run().rows.get(900123456).values.best_lap_seconds,17.6399);
for(const mutate of [
 f=>f.forEach(s=>s.broadcast.nativeEventIdentity.leagueID=0),
 f=>f.forEach(s=>s.broadcast.nativeEventIdentity.subSessionID=1),
 f=>f.forEach(s=>s.diagnostic.rawSession.sessionNum=9),
 f=>f.forEach(s=>s.session.timeElapsed=9999),
 f=>f.forEach(s=>s.session.isReplay=true),
 f=>f.forEach(s=>s.session.state=4),
 f=>f.forEach(s=>s.broadcast.nativeHistoricalResults.sessions[0].results[0].carIdx=4),
 f=>f.forEach(s=>s.diagnostic.drivers[0].fields.userId=1),
 f=>f.forEach(s=>s.diagnostic.drivers[0].fields.isAI=true),
 f=>f.forEach(s=>s.diagnostic.drivers[0].fields.isSpectator=true)
])assert.deepEqual(run(mutate).rows.get(900123456).values,{});
const retained=run(()=>{},true).rows.get(900123456);assert.equal(retained.values.best_lap_seconds,17.6399);assert.equal(retained.proofs.best_lap_seconds.certainty,'original_terminal_sdk_frame_stable_native_confirmation');assert.equal(retained.proofs.best_lap_seconds.capture_sha256.length,2);
assert.deepEqual(run(f=>f[1].snapshot.retainedFrom='2026-11-03T00:00:00Z',true).rows.get(900123456).values,{});
assert.deepEqual(run(f=>f[1].drivers[0].bestLap=1,true).rows.get(900123456).values,{});
assert.equal(run().rows.get(900123456).values.incidents,undefined);assert.equal(run().rows.get(900123456).proofs.start_position.car_index,3);
let yaml='WeekendInfo:\n SubSessionID: '+id+'\n LeagueID: 10402\n EventType: Race\nDriverInfo:\n Drivers:\n - CarIdx: 3\n   UserID: 900123456\n   CarNumber: "75"\n   UserName: Fixture Driver\nSessionInfo:\n Sessions:\n - SessionNum: 0\n   SessionName: PRACTICE\n   SessionType: Practice\n   ResultsOfficial: 1\n   ResultsLapsComplete: 3\n   ResultsPositions:\n   - Position: 1\n     CarIdx: 3\n     LapsComplete: 3\n     FastestTime: 17.4321\n   ResultsFastestLap:\n';
fs.mkdirSync(path.join(dir,'session-evidence',String(id)),{recursive:true});
function nativeRun(change=()=>{}){
 const f=make(30,3);f.diagnostic.rawSession.sessionNum=2;f.broadcast.nativeEventIdentity.subSessionID=id;f.sessionEvidence={nativeSessionInfo:{connected:true,text:yaml,sha256:hash(yaml)}};change(f);
 const file='session-evidence/'+id+'/'+(++seq)+'.json',b=JSON.stringify(f);fs.writeFileSync(path.join(dir,file),b);return nativeNonRaceSessions({canonical:{live:{captures:[{file,sha256:hash(b),sessionNum:2}]}},captureRoot:dir,id,admitDriver:v=>v===900123456});
}
assert.equal(nativeRun()[0].results[0].nativeBest,17.4321);
assert.equal(nativeRun(f=>f.session.isReplay=true).length,0);
assert.equal(nativeRun(f=>f.broadcast.nativeEventIdentity.leagueID=0).length,0);
assert.throws(()=>nativeRun(f=>f.sessionEvidence.nativeSessionInfo.sha256='0'.repeat(64)),/checksum/);
yaml=yaml.replace('UserID: 900123456','UserID: 900123457');assert.equal(nativeRun().length,0,'Unknown positive AI/test ID without any AI flag must remain private pending independent human confirmation');yaml=yaml.replace('UserID: 900123457','UserID: 900123456');
yaml=yaml.replace('EventType: Race','EventType: AI Race');
assert.equal(nativeRun().length,0,'AI race with positive user ID and no isAI flag must never supply public non-race results');
console.log('PASS session evidence: own terminal clocks/classifications, exact retained anchors, identity/car checks, unknown incidents, native non-race sources, SHA and AI/replay exclusions.');

// A new non-race table is visible only from a separately verified source.
const vm=await import('node:vm'),repo=path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//,'')),'../..');
const site=path.resolve(new URL('../..',import.meta.url).pathname.replace(/^\//,'').replaceAll('%20',' '));
const ctx={window:{},document:{getElementById:()=>null},location:{hash:'#noop'},console,TextEncoder,Uint8Array,crypto:crypto.webcrypto,fetch:async url=>{try{const text=fs.readFileSync(path.join(site,'news',String(url).split('?')[0]),'utf8');return {ok:true,text:async()=>text,json:async()=>JSON.parse(text)}}catch{return {ok:false}}}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(site,'news/assets/intelligence.js'),'utf8'),ctx);await ctx.window.MMTVIntelligence.loadAll();
const api=ctx.window.MMTVIntelligence,real=api.model.races.races.find(r=>r.entry.subsession_id===89859608),meeting=JSON.parse(fs.readFileSync(path.join(site,'news/data/live/meetings/89859608.json'))),count=meeting.sessions.length;
const added={simsession_number:777,name:'PRACTICE',kind:'practice',available:true,classification:[],source:{source_kind:'sha_verified_native_session_info'}};real.sessions.push(added);assert.equal(api.enrichMeeting(meeting).sessions.length,count+1);assert.equal(meeting.sessions.length,count);assert.equal(api.enrichMeeting(api.enrichMeeting(meeting)).sessions.filter(s=>s.simsession_number===777).length,1);real.sessions.push({...added,simsession_number:778,source:{source_kind:'unverified_fixture'}});assert.equal(api.enrichMeeting(meeting).sessions.length,count+1);console.log('PASS native non-race table admission, source gate, duplicate prevention and original meeting preservation.');
