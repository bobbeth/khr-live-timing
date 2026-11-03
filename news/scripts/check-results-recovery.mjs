import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {recoverSession,validateSample} from '../../tools/website-publisher/recover-session-fields.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mmtv-recovery-'));
fs.mkdirSync(path.join(dir,'canonical'));fs.mkdirSync(path.join(dir,'live-staging'));
const raw={sessionNum:9,sessionName:'FEATURE',completedCandidate:true,structureValid:true,resultsOfficial:1,resultsLapsComplete:40,results:[{position:1,carIdx:0,number:'75',name:'Known Driver',lapsCompleted:40,reason:'Running'}]};
const base={timestamp:'2026-11-03T00:00:00Z',session:{isFinished:true,isGreen:false,state:6},snapshot:{retained:false},diagnostic:{rawSession:{sessionNum:9,state:6,sessionTimeElapsed:800},drivers:[{number:'75',fields:{carIdx:0,userId:925665,bestLapTime:16.2876,startPosition:1,laps:40}}]},drivers:[{number:'75',lapsCompleted:40,bestLap:16.2876,lastLap:16.5,startPosition:1,sdkStartPosition:1,startPositionOverridden:false,lapsLed:40,offTracks:7}],lapsLedIntegrity:{activeVerified:true,activeRaceDistance:40,activeRawTotal:40},broadcast:{nativeEventIdentity:{identityValid:true,leagueID:10402,subSessionID:89836161},nativeHistoricalResults:{sessions:[raw]},nativeClassificationStability:{sessions:[{sessionNum:9,eventIdentityValid:true,classificationUnchanged:true,acceptedObservations:10,unchangedSeconds:40,minimumSeconds:5}]},nativeFinalSessionEvidence:{nativeCurrentSessionNum:9,telemetryTick:1,sessions:[{sessionNum:9,eventIdentityValid:true,nativeSessionState:6,nativeStateCheckeredOrCooldown:true,telemetrySessionMatches:true,replaySessionNum:9,sessionTime:800,replayTimeDifferenceSeconds:0,replayContextClassification:'UNDETERMINED'}]}}};
let seq=0;
function run(change=()=>{},options={}){const s=structuredClone(base);change(s);const bytes=JSON.stringify(s),file='live-staging/'+(++seq)+'.json';fs.writeFileSync(path.join(dir,file),bytes);const ref={file,sessionNum:9,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};if(options.badHash)ref.sha256='0'.repeat(64);return recoverSession({canonical:{live:{captures:[ref]}},canonicalFile:path.join(dir,'canonical/89836161.json'),id:89836161,raw,entry:{series:'Yota Outlawz',round:1},kind:'feature',knownIds:new Map([['75',925665]]),...options}).rows.get(925665);}
const good=run();assert.equal(good.values.best_lap_seconds,16.2876);assert.equal(good.values.start_position,1);assert.equal(good.values.laps_led,40);assert.equal(good.values.incidents,undefined);assert.equal(good.values.champ_points,undefined);assert.equal(good.proofs.best_lap_seconds.certainty,'completed_telemetry_single_snapshot');assert.equal(good.proofs.best_lap_seconds.official,false);
const invalid=[s=>s.broadcast.nativeEventIdentity.leagueID=9,s=>s.broadcast.nativeEventIdentity.subSessionID=1,s=>s.diagnostic.rawSession.sessionNum=2,s=>s.broadcast.nativeFinalSessionEvidence.nativeCurrentSessionNum=2,s=>s.snapshot.retained=true,s=>s.session.isReplay=true,s=>s.diagnostic.rawSession.state=4,s=>s.broadcast.nativeFinalSessionEvidence.sessions[0].nativeSessionState=4,s=>s.broadcast.nativeFinalSessionEvidence.sessions[0].replayTimeDifferenceSeconds=8,s=>s.broadcast.nativeFinalSessionEvidence.sessions[0].sessionTime=900,s=>s.broadcast.nativeClassificationStability.sessions[0].classificationUnchanged=false,s=>s.broadcast.nativeClassificationStability.sessions[0].unchangedSeconds=2,s=>s.broadcast.nativeHistoricalResults.sessions[0].results[0].lapsCompleted=41,s=>s.diagnostic.drivers[0].fields.userId=471386,s=>s.diagnostic.drivers[0].number='075',s=>s.diagnostic.drivers[0].fields.carIdx=8];
for(const change of invalid)assert.deepEqual(run(change).values,{});
assert.throws(()=>run(()=>{},{badHash:true}),/checksum/);
assert.equal(run(s=>s.drivers[0].lapsCompleted=39).values.best_lap_seconds,undefined);
assert.equal(run(s=>s.drivers[0].bestLap=17).values.best_lap_seconds,undefined);
assert.equal(run(s=>{s.drivers[0].lapsLed=58;s.lapsLedIntegrity.activeRawTotal=58}).values.laps_led,undefined);
assert.equal(run(s=>s.lapsLedIntegrity.activeVerified=false).values.laps_led,undefined);
assert.equal(run(()=>{},{entry:{series:'Cushion Kings',round:6}}).values.start_position,undefined);
const confirmed=run(()=>{},{entry:{series:'Cushion Kings',round:6},publishedRows:[{driver_id:925665,car_number:'75',start_position:1,start_position_source:'confirmed_eol_independent_lane_advancement'}]});assert.equal(confirmed.proofs.start_position.certainty,'confirmed_post_eol_start');
assert.equal(run(()=>{},{knownIds:new Map([['75',471386]])}),undefined);
console.log('PASS recovery guards: identity/car/session, native completion, retained/replay, clocks, stable observations, checksum, final laps, matching best, legal led, EOL, unknown incidents/points and certainty labels.');

// Exhaustive evidence outside the bounded sample must survive later automatic exports.
const corpus=[];for(let i=0;i<100;i++){const s=structuredClone(base);s.broadcast.nativeFinalSessionEvidence.telemetryTick=i+1000;s.broadcast.nativeClassificationStability.sessions[0].acceptedObservations=i+100;if(![1,3].includes(i))s.diagnostic.rawSession.state=4;const bytes=JSON.stringify(s),file='live-staging/corpus-'+i+'.json';fs.writeFileSync(path.join(dir,file),bytes);corpus.push({file,sessionNum:9,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
const options={canonical:{live:{captures:corpus}},canonicalFile:path.join(dir,'canonical/89836161.json'),id:89836161,raw,entry:{series:'Yota Outlawz',round:1},kind:'feature',knownIds:new Map([['75',925665]])};
assert.equal(recoverSession(options).rows.get(925665).values.best_lap_seconds,undefined);
const exhaustive=recoverSession({...options,exhaustive:true});assert.equal(exhaustive.audit.captures_considered,100);assert.equal(exhaustive.details.captures.length,100);assert.equal(exhaustive.rows.get(925665).values.best_lap_seconds,16.2876);
const hashes=exhaustive.rows.get(925665).proofs.best_lap_seconds.capture_sha256;assert.equal(hashes.length,2);
const retained=recoverSession({...options,priorSourceHashes:hashes});assert.equal(retained.rows.get(925665).values.best_lap_seconds,16.2876);assert.ok(retained.audit.captures_considered<100);
console.log('PASS exhaustive recovery and automatic source retention: outside-sample evidence, two distinct observations, complete scan ledger, bounded future revalidation and no regression.');
