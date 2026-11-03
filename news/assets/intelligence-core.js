/* Shared calculations for the canonical export and its static website consumers. */
(root=>{
 const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 const final=rows=>rows.filter(r=>r.feature&&valid(r.finish)&&Number(r.finish)>0);
 function summary(rows){
  const f=final(rows),known=k=>f.filter(r=>valid(r[k])),starts=known('start').filter(r=>r.start>0),gains=known('gain');
  return {starts:f.length,wins:f.filter(r=>r.finish===1).length,podiums:f.filter(r=>r.finish<=3).length,top5:f.filter(r=>r.finish<=5).length,average:f.length?f.reduce((n,r)=>n+Number(r.finish),0)/f.length:null,best:f.length?Math.min(...f.map(r=>r.finish)):null,averageStart:starts.length?starts.reduce((n,r)=>n+Number(r.start),0)/starts.length:null,startCoverage:starts.length,gained:gains.reduce((n,r)=>n+Number(r.gain),0),gainCoverage:gains.length,laps:known('laps').reduce((n,r)=>n+Number(r.laps),0),lapCoverage:known('laps').length,led:known('led').length?known('led').reduce((n,r)=>n+Number(r.led),0):null,ledCoverage:known('led').length,bestLapCoverage:known('bestLap').length};
 }
 function form(rows){
  const ordered=final(rows).slice().sort((a,b)=>b.entry.event_date.localeCompare(a.entry.event_date)||b.entry.subsession_id-a.entry.subsession_id);
  const streak=predicate=>{let count=0;for(const r of ordered){if(!predicate(r))break;count++;}return count;};
  return {recent:ordered.slice(0,5).map(r=>({id:r.entry.subsession_id,finish:r.finish,date:r.entry.event_date})),winStreak:streak(r=>r.finish===1),podiumStreak:streak(r=>r.finish<=3),top5Streak:streak(r=>r.finish<=5)};
 }
 function compare(a,b){
  const ar=final(a),br=final(b),opponent=new Map(br.map(r=>[String(r.entry.subsession_id),r]));
  const shared=ar.filter(r=>opponent.has(String(r.entry.subsession_id))).map(a=>({a,b:opponent.get(String(a.entry.subsession_id))})).sort((a,b)=>a.a.entry.event_date.localeCompare(b.a.entry.event_date)||a.a.entry.subsession_id-b.a.entry.subsession_id);
  return {a:summary(ar),b:summary(br),sharedA:summary(shared.map(r=>r.a)),sharedB:summary(shared.map(r=>r.b)),shared,aheadA:shared.filter(r=>r.a.finish<r.b.finish).length,aheadB:shared.filter(r=>r.a.finish>r.b.finish).length,ties:shared.filter(r=>r.a.finish===r.b.finish).length};
 }
 root.MMTVIntelligenceCore={valid,summary,form,compare};
})(typeof window==='object'?window:globalThis);
