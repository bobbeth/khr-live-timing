// Private immutable evidence catalogue; never modifies canonical source files.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
export function sessionCatalogue({canonical,canonicalPath,captureRoot,id}){
 let refs=[...(canonical.live?.captures||[])],proofs=[];
 const add=(record,file,bytes)=>{
  if(Number(record.subsession_id)!==Number(id))throw Error('Supplemental catalogue identity mismatch');
  for(const r of record.live?.captures||record.captures||[]){if(!Number.isInteger(Number(r.sessionNum))||!/^[a-f0-9]{64}$/i.test(r.sha256)||!r.file.startsWith('live-staging/'+id+'/')&&!r.file.startsWith('session-evidence/'+id+'/'))throw Error('Invalid session evidence reference');refs.push(r)}
  proofs.push({sha256:sha(bytes),kind:file});
 };
 if(canonicalPath&&fs.existsSync(canonicalPath)){const b=fs.readFileSync(canonicalPath);add(JSON.parse(b),'current_canonical_capture_catalogue',b)}
 const index=path.join(captureRoot,'session-evidence',String(id),'index.json');
 if(fs.existsSync(index)){const b=fs.readFileSync(index),doc=JSON.parse(b);if(doc.schema!=='KHR-session-evidence-v1'||doc.league_id!==10402)throw Error('Invalid private session evidence catalogue');add(doc,'immutable_session_evidence_catalogue',b)}
 const seen=new Map();for(const r of refs){const old=seen.get(r.file);if(old&&old.sha256.toLowerCase()!==r.sha256.toLowerCase())throw Error('Conflicting supplemental capture checksum');seen.set(r.file,r)}
 return {canonical:{...canonical,live:{...canonical.live,captures:[...seen.values()]}},proofs};
}
