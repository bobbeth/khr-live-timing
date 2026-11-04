import fs from 'node:fs';import crypto from 'node:crypto';import path from 'node:path';import {workflow} from './driver-discovery-core.mjs';
let raw='';for await(const c of process.stdin){raw+=c;if(Buffer.byteLength(raw)>64*1024*1024)throw Error('request too large')}
const req=JSON.parse(raw),repo=fs.realpathSync(req.repository),state=path.resolve(req.stateRoot);
function onF(p){if(!/^F:[\\/]/i.test(p))throw Error('Driver workflow requires physical F: storage')}
onF(repo);onF(state);let ancestor=state;while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);onF(fs.realpathSync(ancestor));if(state.toLowerCase().startsWith(repo.toLowerCase()+path.sep))throw Error('Private registry must remain outside the public repository');fs.mkdirSync(state,{recursive:true});onF(fs.realpathSync(state));
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),regfile=path.join(state,'driver-registry.json');
const input={now:req.now||new Date().toISOString(),settings:req.settings||{},manual:!!req.manual,snapshots:req.snapshots,profileResponse:req.profileResponse,identities:read(path.join(repo,'news/data/driver-identities.json')),profiles:read(path.join(repo,'news/data/driver-profiles.json')),registry:fs.existsSync(regfile)?read(regfile):null};
const classified=path.join(repo,'news/data/intelligence/drivers.json');if(fs.existsSync(classified))input.classifiedNames=read(classified).names;
if(req.settings?.eligibility_path){const ep=fs.realpathSync(req.settings.eligibility_path);onF(ep);const raw=fs.readFileSync(ep);if(crypto.createHash('sha256').update(raw).digest('hex').toLowerCase()!==String(req.settings.eligibility_sha256).toLowerCase())throw Error('Private eligibility checksum mismatch');input.eligibility=JSON.parse(raw);}
const out=workflow(input);
function atomic(p,obj){const tmp=p+'.driver-tmp-'+process.pid;fs.writeFileSync(tmp,JSON.stringify(obj,null,2)+'\n');fs.renameSync(tmp,p)}
if(req.apply){for(const relative of out.changed_paths)atomic(path.join(repo,relative),relative.endsWith('driver-identities.json')?out.identities:out.profiles);atomic(regfile,out.registry)}
console.log(JSON.stringify({changed:out.changed_paths.length>0,changed_paths:out.changed_paths,available:out.available,identified:out.identified,new_ids:out.new_ids,accepted_ids:out.accepted_ids,pending_ids:out.pending_ids,discovery_status:out.discovery_status,profile_status:out.profile_status,needProfileFetch:out.needProfileFetch,notes:out.notes}));
