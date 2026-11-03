window.createMMTVRaceInsights=function({app,entries,seasonName,esc,driverStats}){
 const valid=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n));
 const unique=items=>[...new Set(items)];
 let season='Fall Fest 2026',series='Bomber Stocks',first=null,second=null,scope='shared',version=0;
 const inScope=(e,s,c)=>seasonName(e)===s&&(c==='All series'||e.series===c);
 function summary(races){
  if(window.MMTVIntelligence?.model)return window.MMTVIntelligenceCore.summary(races);
  const f=races.filter(r=>r.feature&&valid(r.finish)&&Number(r.finish)>0);
  const starts=f.filter(r=>valid(r.start)&&Number(r.start)>0),gains=f.filter(r=>valid(r.gain));
  return {starts:f.length,wins:f.filter(r=>Number(r.finish)===1).length,podiums:f.filter(r=>Number(r.finish)<=3).length,top5:f.filter(r=>Number(r.finish)<=5).length,average:f.length?f.reduce((a,r)=>a+Number(r.finish),0)/f.length:null,averageStart:starts.length?starts.reduce((a,r)=>a+Number(r.start),0)/starts.length:null,startCoverage:starts.length,gained:gains.reduce((a,r)=>a+Number(r.gain),0),gainCoverage:gains.length,best:f.length?Math.min(...f.map(r=>Number(r.finish))):null};
 }
 function compare(a,b,s,c){
  if(window.MMTVIntelligence?.model)return window.MMTVIntelligenceCore.compare(a.races.filter(r=>inScope(r.entry,s,c)),b.races.filter(r=>inScope(r.entry,s,c)));
  const ar=a.races.filter(r=>r.feature&&inScope(r.entry,s,c)),br=b.races.filter(r=>r.feature&&inScope(r.entry,s,c));
  const opponent=new Map(br.map(r=>[String(r.entry.subsession_id),r]));
  const shared=ar.filter(r=>opponent.has(String(r.entry.subsession_id))).map(a=>({a,b:opponent.get(String(a.entry.subsession_id))})).sort((a,b)=>a.a.entry.event_date.localeCompare(b.a.entry.event_date)||a.a.entry.subsession_id-b.a.entry.subsession_id);
  return {a:summary(ar),b:summary(br),sharedA:summary(shared.map(r=>r.a)),sharedB:summary(shared.map(r=>r.b)),shared,aheadA:shared.filter(r=>Number(r.a.finish)<Number(r.b.finish)).length,aheadB:shared.filter(r=>Number(r.b.finish)<Number(r.a.finish)).length,ties:shared.filter(r=>Number(r.a.finish)===Number(r.b.finish)).length};
 }
 function records(data,s,c){
  const drivers=data.drivers.map(d=>({d,races:d.races.filter(r=>inScope(r.entry,s,c)),heats:0,heatStarts:0,fastest:0,lapLed:null,ledCoverage:0})).filter(d=>d.races.length);
  const byId=new Map(drivers.map(d=>[d.d.id,d]));
  for(const record of data.meetings||[]){
   if(!inScope(record.entry,s,c))continue;
   const seen=new Set();
   for(const session of record.meeting?.sessions||[]){
    if(!session.available||session.kind!=='heat')continue;
    const id=session.simsession_number??session.name;if(seen.has(id))continue;seen.add(id);
    const seenDrivers=new Set();
    for(const row of session.classification||[]){const d=byId.get(driverStats.key(row.driver));if(!d||seenDrivers.has(d.d.id)||!valid(row.position)||Number(row.position)<1||String(row.reason_out||'').toUpperCase()==='DNS')continue;seenDrivers.add(d.d.id);d.heatStarts++;if(Number(row.position)===1)d.heats++;}
   }
   const times=(record.event.feature_results||[]).filter(r=>valid(r.best_lap_seconds)&&Number(r.best_lap_seconds)>0&&String(r.reason_out||'').toUpperCase()!=='DNS');
   if(times.length){const best=Math.min(...times.map(r=>Number(r.best_lap_seconds)));const awarded=new Set();for(const row of times.filter(r=>Number(r.best_lap_seconds)===best)){const d=byId.get(driverStats.key(row.driver));if(d&&!awarded.has(d.d.id)){d.fastest++;awarded.add(d.d.id);}}}
  }
  const movers=[];
  for(const d of drivers){Object.assign(d,summary(d.races));for(const r of d.races.filter(r=>r.feature)){if(valid(r.led)){d.lapLed=(d.lapLed??0)+Number(r.led);d.ledCoverage++;}if(valid(r.gain)&&Number(r.gain)>0)movers.push({d:d.d,race:r,gain:Number(r.gain)});}}
  movers.sort((a,b)=>b.gain-a.gain||a.d.name.localeCompare(b.d.name)||a.race.entry.subsession_id-b.race.entry.subsession_id);
  const tracks=new Map();for(const d of drivers)for(const r of d.races.filter(r=>r.feature&&Number(r.finish)===1)){if(!tracks.has(r.entry.track))tracks.set(r.entry.track,[]);tracks.get(r.entry.track).push({d:d.d,race:r});}
  return {drivers,movers,tracks:[...tracks].sort((a,b)=>a[0].localeCompare(b[0]))};
 }
 const number=v=>v===null||v===undefined?'—':Number.isInteger(v)?v:Number(v).toFixed(2);
 const driverLink=d=>`<a class="driver-link" href="#driver/${encodeURIComponent(d.id)}">${esc(d.name)}</a>`;
 const raceLink=r=>`<a href="#race/${r.entry.subsession_id}">${esc(r.entry.series)} · R${esc(r.entry.round)}<br>${esc(r.entry.track)}</a>`;
 const banner=(title,deck)=>`<section class="page-banner"><div class="container"><span class="eyebrow">MUD MULES TV / THE RACING</span><h1>${title}</h1><p class="deck">${deck}</p></div></section>`;
 const option=(id,label,values,current)=>`<label for="${id}">${label}</label><select id="${id}">${values.map(v=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(v)}</option>`).join('')}</select>`;
 function filters(){const seasons=unique(entries().map(seasonName)).sort();if(!seasons.includes(season))season=seasons.at(-1);const choices=['All series',...unique(entries().filter(e=>seasonName(e)===season).map(e=>e.series))];if(!choices.includes(series))series=choices[1]||'All series';return option('insights-season','SEASON',seasons,season)+option('insights-series','SERIES',choices,series);}
 const warning=data=>data.failures.length?`<p class="stats-notice" role="status">${data.failures.length} race result(s) could not be loaded. These statistics are incomplete. Reload to try again.</p>`:'';
 async function screen(kind,preferred){
  if(preferred)first=driverStats.key(preferred);
  const current=++version,hash=location.hash;
  app.innerHTML=banner(kind==='compare'?'HEAD TO<br>HEAD':'THE SEASON<br>RECORD BOOK',kind==='compare'?'Same races. Two drivers. How do they stack up?':'The wins, the climbs and the drivers setting the pace.')+'<div class="container section loading">Loading the race statistics…</div>';
  let data;try{data=await driverStats.load();}catch{if(current===version&&location.hash===hash)app.innerHTML=banner('RACE STATS','The results could not be loaded. Please reload to try again.');return;}
  if(current!==version||location.hash!==hash)return;
  const filterHtml=filters();
  const eligible=data.drivers.filter(d=>d.races.some(r=>r.feature&&inScope(r.entry,season,series)));
  if(!eligible.some(d=>d.id===first))first=eligible[0]?.id;
  if(!eligible.some(d=>d.id===second)||second===first)second=eligible.find(d=>d.id!==first)?.id;
  const a=eligible.find(d=>d.id===first),b=eligible.find(d=>d.id===second);
  const base=banner(kind==='compare'?'HEAD TO<br>HEAD':'THE SEASON<br>RECORD BOOK',kind==='compare'?'Same races. Two drivers. How do they stack up?':'The wins, the climbs and the drivers setting the pace.');
  const picker=(id,label,selected)=>`<label for="${id}">${label}</label><select id="${id}">${eligible.map(d=>`<option value="${esc(d.id)}" ${d.id===selected?'selected':''}>${esc(d.name)}</option>`).join('')}</select>`;
  app.innerHTML=base+`<div class="container section">${warning(data)}<div class="insights-tabs"><a href="#compare" ${kind==='compare'?'aria-current="page"':''}>DRIVER COMPARISON</a><a href="#records" ${kind==='records'?'aria-current="page"':''}>SEASON RECORDS</a></div><div class="filterbar">${filterHtml}${kind==='compare'?picker('compare-first','DRIVER ONE',first)+picker('compare-second','DRIVER TWO',second)+`<label for="compare-scope">COMPARE STATS FROM</label><select id="compare-scope"><option value="shared" ${scope==='shared'?'selected':''}>Shared races only</option><option value="all" ${scope==='all'?'selected':''}>All appearances</option></select>`:''}</div><p class="result-note">Published race results only. Championship points, drop rounds and league tie-breaks are not used. Feature stats count the final feature once per meeting; opening twins are excluded from feature wins. Heat wins have their own category. All series combines championships; use the series filter for like-for-like summaries.</p><div id="insights-body">${kind==='compare'?(a&&b?comparisonHtml(a,b):'<div class="empty">Two drivers with final-feature results are needed for this selection.</div>'):recordsHtml(data)}</div></div>`;
  document.getElementById('insights-season').onchange=e=>{season=e.target.value;screen(kind);};document.getElementById('insights-series').onchange=e=>{series=e.target.value;screen(kind);};
  if(kind==='compare'){document.getElementById('compare-first').onchange=e=>{const selected=e.target.value;if(selected===second)second=first;first=selected;screen(kind);};document.getElementById('compare-second').onchange=e=>{const selected=e.target.value;if(selected===first)first=second;second=selected;screen(kind);};document.getElementById('compare-scope').onchange=e=>{scope=e.target.value;screen(kind);};}
 }
 function comparisonHtml(a,b){
  const result=compare(a,b,season,series),as=scope==='shared'?result.sharedA:result.a,bs=scope==='shared'?result.sharedB:result.b;
  const rows=[['Feature starts','starts'],['Wins','wins'],['Podiums','podiums'],['Top-five finishes','top5'],['Average finish','average'],['Best finish','best'],['Average start','averageStart']];
  return `<div class="head-to-head-score"><div>${driverLink(a)}<strong>${result.aheadA}</strong><span>FINISHED AHEAD</span></div><div><b>${result.shared.length}</b><span>SHARED FEATURES</span>${result.ties?`<small>${result.ties} tied finish(es)</small>`:''}</div><div>${driverLink(b)}<strong>${result.aheadB}</strong><span>FINISHED AHEAD</span></div></div>${!result.shared.length?'<p class="stats-notice">These drivers have no shared final-feature results in this selection. Choose All appearances to compare their individual results.</p>':''}<div class="table-wrap"><table class="comparison-table"><thead><tr><th>STATISTIC</th><th>${esc(a.name)}</th><th>${esc(b.name)}</th></tr></thead><tbody>${rows.map(([label,key])=>`<tr><td>${label}</td><td>${number(as[key])}</td><td>${number(bs[key])}</td></tr>`).join('')}<tr><td>Net positions gained</td><td>${as.gainCoverage?number(as.gained):'—'} <small>(${as.gainCoverage}/${as.starts} starts known)</small></td><td>${bs.gainCoverage?number(bs.gained):'—'} <small>(${bs.gainCoverage}/${bs.starts} starts known)</small></td></tr></tbody></table></div><p class="result-note">${scope==='shared'?'Summary statistics use only the shared final features below.':'Summary statistics use all selected appearances; the head-to-head score still uses shared features only.'} Average starts exclude missing grids (${as.startCoverage}/${as.starts} and ${bs.startCoverage}/${bs.starts} known). Finishing ahead is a result comparison, not a claim about an on-track pass.</p><div class="section-head insights-section-head"><div><span class="eyebrow">RACE BY RACE</span><h2>THE SHARED RACES</h2></div></div><div class="table-wrap"><table><thead><tr><th>DATE / RACE</th><th>${esc(a.name)}</th><th>${esc(b.name)}</th><th>FINISHED AHEAD</th></tr></thead><tbody>${result.shared.map(({a:ar,b:br})=>`<tr><td>${esc(ar.entry.event_date)}<br>${raceLink(ar)}</td><td>P${ar.finish}${valid(ar.start)&&ar.start>0?` · started P${ar.start}`:''}</td><td>P${br.finish}${valid(br.start)&&br.start>0?` · started P${br.start}`:''}</td><td>${Number(ar.finish)===Number(br.finish)?'Tied finish':driverLink(Number(ar.finish)<Number(br.finish)?a:b)}</td></tr>`).join('')}</tbody></table></div>`;
 }
 function recordsHtml(data){
  const result=records(data,season,series);
  function board(title,field,limit=10,{ascending=false,minimum=0,annotation=''}={}){
   const rows=result.drivers.filter(r=>r[field]!==null&&Number.isFinite(r[field])&&r.starts>=minimum&&(ascending||r[field]>0)).sort((a,b)=>(ascending?a[field]-b[field]:b[field]-a[field])||a.d.name.localeCompare(b.d.name));
   const cutoff=rows[Math.min(limit,rows.length)-1]?.[field];const shown=rows.filter((r,i)=>i<limit||r[field]===cutoff);let rank=0,last=null;
   return `<section class="record-board"><h3>${title}</h3>${annotation?`<p class="result-note">${annotation}</p>`:''}${shown.length?`<ol>${shown.map((r,i)=>{if(r[field]!==last)rank=i+1;last=r[field];return `<li><span>${rank}</span><div>${driverLink(r.d)}<small>${r.starts} final-feature starts${field==='heats'?` · ${r.heatStarts} heats recorded`:field==='lapLed'?` · laps led known in ${r.ledCoverage}/${r.starts}`:''}</small></div><strong>${number(r[field])}</strong></li>`;}).join('')}</ol>`:'<p class="result-note">No recorded results for this category yet.</p>'}</section>`;
  }
  return `<div class="record-grid">${board('MOST FEATURE WINS','wins')}${board('MOST PODIUMS','podiums')}${board('MOST TOP-FIVE FINISHES','top5')}${board('BEST AVERAGE FINISH','average',10,{ascending:true,minimum:3,annotation:'Minimum three final-feature starts. Lower is better.'})}${board('MOST HEAT WINS','heats',10,{annotation:'Available heat results only; excludes opening twins and finals.'})}${board('QUICKEST FEATURE LAPS','fastest',10,{annotation:'Number of features with the quickest recorded lap. Missing lap times can affect these counts; raw lap times from different tracks are not compared.'})}${board('MOST RECORDED LAPS LED','lapLed',10,{annotation:'Partial totals where laps-led figures exist. Missing values are not zero.'})}</div><div class="section-head insights-section-head"><div><span class="eyebrow">MAKING GROUND</span><h2>BIGGEST FEATURE CLIMBS</h2></div></div><div class="table-wrap"><table><thead><tr><th>DRIVER</th><th>RACE</th><th>START</th><th>FINISH</th><th>GAIN</th></tr></thead><tbody>${result.movers.filter((m,i)=>i<10||m.gain===result.movers[9]?.gain).map(m=>`<tr><td>${driverLink(m.d)}</td><td>${raceLink(m.race)}</td><td>P${m.race.start}</td><td>P${m.race.finish}</td><td>+${m.gain}</td></tr>`).join('')}</tbody></table></div>${result.movers.length?'':'<p class="result-note">No recorded start-to-finish gains yet.</p>'}<div class="section-head insights-section-head"><div><span class="eyebrow">WHO WON WHERE</span><h2>TRACK WINNERS</h2></div></div><div class="table-wrap"><table><thead><tr><th>TRACK</th><th>FINAL-FEATURE WINNERS</th></tr></thead><tbody>${result.tracks.map(([track,wins])=>`<tr><td>${esc(track)}</td><td>${wins.sort((a,b)=>a.race.entry.event_date.localeCompare(b.race.entry.event_date)).map(w=>`${driverLink(w.d)} · <a href="#race/${w.race.entry.subsession_id}">${esc(w.race.entry.series)} R${w.race.entry.round}</a>`).join('<br>')}</td></tr>`).join('')}</tbody></table></div><p class="result-note">Records cover published results in this selection. Equal values share a rank; tied entries at the tenth place are included. Track names follow the race archive.</p>`;
 }
 return {compare,summary,records,comparison:preferred=>screen('compare',preferred),seasonRecords:()=>screen('records')};
};
