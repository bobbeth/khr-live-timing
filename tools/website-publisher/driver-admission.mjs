const validId=v=>Number.isSafeInteger(Number(v))&&Number(v)>0&&/^[1-9]\d{0,9}$/.test(String(v));
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
export function driverAdmission({settings={},eligibility=null,registry={},identities={names:{}}}={}){
 const blocked=new Set([...(settings.excluded_customer_ids||[]),...(settings.quarantined_customer_ids||[]),...(eligibility?.quarantined_customer_ids||[]),...Object.keys(registry.quarantine||{})].filter(validId).map(Number));
 const protectedIds=new Set((settings.protected_customer_ids||eligibility?.protected_customer_ids||Object.values(identities.names||{})).filter(validId).map(Number)),verified=new Map();
 if(eligibility?.schema_version==='MMTV-driver-eligibility-v1'&&eligibility.league_id===10402)for(const [key,d]of Object.entries(eligibility.verified||{})){
  const id=Number(key);if(!validId(key)||d.customer_id!==id||blocked.has(id))continue;
  if(d.basis==='owner_approved'&&d.owner_confirmation?.confirmed===true&&d.owner_confirmation.customer_id===id&&d.owner_confirmation.source)verified.set(id,'owner_approved');
  else if(d.basis==='classified_khr'&&d.proofs?.some(p=>p.customer_id===id&&p.league_id===10402&&validId(p.subsession_id)&&p.source_kind==='official_iracing_classification'&&p.ai===false&&/FEATURE|HEAT|CONSOLATION|RACE/i.test(p.session_name||'')&&digest(p.canonical_sha256)&&digest(p.source_sha256)&&digest(p.row_sha256)))verified.set(id,'classified_khr');
 }
 if(settings.approvals_confirmed===true)for(const id of settings.approved_customer_ids||[])if(validId(id)&&!blocked.has(Number(id)))verified.set(Number(id),'owner_approved');
 return {blocked:id=>blocked.has(Number(id)),verified:id=>verified.has(Number(id)),preserve:id=>protectedIds.has(Number(id))&&!blocked.has(Number(id)),basis:id=>verified.get(Number(id))||null};
}
