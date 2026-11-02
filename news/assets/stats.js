/* Season statistics use published results only. Null points are never zero-filled. */
window.createMMTVStats = function({app,entries,seasonName,esc,displayName,getEvent,getMeeting}) {
 // Explicit identity matches; Davis and Butler variants confirmed by the owner.
 const aliases={'travis mcdonald':'travis mcdonald2','tina davis':'tina davis3','mike davis':'mike maddog davis','michael butler14':'michael butler','mike butler':'michael butler'};
 const key=name=>{const n=String(name||'').trim().toLowerCase().replace(/\s+/g,' ');return aliases[n]||n;};
 const preferredNames={'mike maddog davis':'Mike Maddog Davis','michael butler':'Michael Butler'};
 const friendlyName=name=>preferredNames[key(name)]||displayName(name);
 const slug=name=>encodeURIComponent(key(name));
 const driverLink=name=>`<a class="driver-link" href="#driver/${slug(name)}">${esc(friendlyName(name))}</a>`;
 const valid=n=>n!==null&&n!==undefined&&n!==''&&Number.isFinite(Number(n));
 const scoringKinds=['qualifying','heat','consolation','twin_feature_1','twin_feature_2','feature'];
 function points(series,kind,p){
  if(!Number.isInteger(p)||p<1)return null;
  if(series==='Bomber Stocks'){
   if(kind==='qualifying')return p<=10?11-p:0;
   if(kind==='heat')return p<=8?9-p:p<=20?1:0;
   return p<=20?21-p:p<=30?1:0;
  }
  if(kind==='qualifying')return p<=6?7-p:p<=10?1:0;
  if(kind==='heat')return p<=5?9-p:p<=10?2:p<=20?1:0;
  if(kind==='consolation')return p<=10?12-p:p<=15?1:0;
  return p<=43?44-p:0;
 }
 let cache,signature,renderVersion=0;
 async function load(){
  const index=entries(),sig=index.map(e=>e.subsession_id).sort().join(',');
  if(cache&&signature===sig)return cache;
  signature=sig;
  cache=(async()=>{
   const drivers=new Map(),failures=[],sessionGaps=[];
   let profiles=null;
   try{const response=await fetch('data/driver-profiles.json',{cache:'no-store'});if(response.ok){const candidate=await response.json();if(candidate.schema_version==='MMTV-driver-profiles-v1')profiles=candidate;}}catch{}
   const normalize=n=>String(n||'').trim().toLowerCase().replace(/\s+/g,' ');
   const records=await Promise.all(index.map(async entry=>{
    const [event,meeting]=await Promise.all([getEvent(entry.subsession_id),getMeeting(entry.subsession_id)]);
    if(!event){failures.push(entry.subsession_id);return null;}
    return {entry,event,meeting};
   }));
   for(const record of records.filter(Boolean)){
    const {entry,event,meeting}=record,participation=new Map();
    if(!meeting||meeting.sessions.some(s=>scoringKinds.includes(s.kind)&&!s.available))sessionGaps.push(entry.subsession_id);
    const touch=name=>{
     if(!name)return null;
     const id=key(name);
     if(!drivers.has(id))drivers.set(id,{id,name:friendlyName(name),names:new Set(),numbers:new Set(),races:[]});
     const d=drivers.get(id);d.names.add(name);
     const customerId=profiles?.names?.[normalize(name)];
     if(customerId){d.iracing_id=customerId;d.profile=profiles.drivers?.[String(customerId)]?.profile||null;}
     if(!participation.has(id))participation.set(id,{entry,finish:null,start:null,laps:null,led:null,gain:null,points:0,scored:0,estimated:0,breakdown:[],feature:false});
     return {d,r:participation.get(id)};
    };
    for(const row of event.feature_results||[]){
     const x=touch(row.driver);if(!x)continue;
     if(row.car_number)x.d.numbers.add(String(row.car_number));
     Object.assign(x.r,{feature:String(row.reason_out||'').toUpperCase()!=='DNS'&&valid(row.finish_position)&&Number(row.finish_position)>0,finish:row.finish_position,start:row.start_position,laps:row.laps_completed,led:row.laps_led,gain:row.positions_gained});
    }
    let sessions=(meeting?.sessions||[]).filter(s=>s.available&&scoringKinds.includes(s.kind));
    const hasFinal=sessions.some(s=>['feature','twin_feature_2'].includes(s.kind));
    if(!hasFinal)sessions=[...sessions,{kind:entry.series==='Bomber Stocks'?'twin_feature_2':'feature',name:'Feature',classification:(event.feature_results||[]).map(r=>({...r,position:r.finish_position}))}];
    const seen=new Set();
    for(const s of sessions){
     const sessionId=s.simsession_number??(s.kind+':'+s.name);
     if(seen.has(sessionId))continue;seen.add(sessionId);
     const seenDrivers=new Set();
     for(const row of s.classification||[]){
      const x=touch(row.driver);if(!x||seenDrivers.has(x.d.id))continue;seenDrivers.add(x.d.id);
      if(row.car_number)x.d.numbers.add(String(row.car_number));
      const saved=valid(row.champ_points),score=saved?Number(row.champ_points):points(entry.series,s.kind,Number(row.position));
      if(score===null)continue;
      x.r.points+=score;x.r.scored++;if(!saved)x.r.estimated++;
      x.r.breakdown.push({session:s.name||s.kind,position:row.position,points:score,estimated:!saved});
     }
    }
    for(const [id,r] of participation)drivers.get(id).races.push(r);
   }
   return {drivers:[...drivers.values()].sort((a,b)=>a.name.localeCompare(b.name)),failures,sessionGaps};
  })();return cache;
 }
 const starts=races=>races.filter(r=>r.feature);
 function metrics(races){const f=starts(races);return {starts:f.length,wins:f.filter(r=>Number(r.finish)===1).length,podiums:f.filter(r=>Number(r.finish)<=3).length,top5:f.filter(r=>Number(r.finish)<=5).length,average:f.length?(f.reduce((a,r)=>a+Number(r.finish),0)/f.length).toFixed(1):'—',laps:f.filter(r=>valid(r.laps)).reduce((a,r)=>a+Number(r.laps),0)};}
 function safeProfileUrl(value,base=''){
  const raw=String(value||'').trim();if(!raw||(!/^https?:\/\//i.test(raw)&&/\s/.test(raw)))return '';
  try{const url=new URL(/^https?:\/\//i.test(raw)?raw:raw.startsWith('/')?new URL(raw,'https://profiles.sdk-gaming.co.uk').href:raw.includes(':')?'':base?base+raw:'https://'+raw);return ['http:','https:'].includes(url.protocol)?url.href:'';}catch{return '';}
 }
 function profileDetails(d){
  const p=d.profile;if(!p)return '';
  const display=[p.firstName,p.lastName,p.suffix].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  const photo=safeProfileUrl(p.pictureUrl);
  const facts=[['Driver display name',display],['Team',p.team],['Country',p.country],['Hometown',p.hometown]].filter(x=>x[1]);
  const paragraphs=[['About',p.bio],['Driver information',p.info],['Latest news',p.latestNews]].filter(x=>x[1]);
  const links=[['Website',p.website,''],['YouTube',p.youtube,'https://www.youtube.com/user/'],['Twitter / X',p.twitter,'https://twitter.com/'],['Twitch',p.twitch,'https://www.twitch.tv/'],['Facebook',p.facebook,'https://www.facebook.com/']].map(([label,value,base])=>({label,value,url:safeProfileUrl(value,base)})).filter(x=>x.value);
  return '<section class="driver-about"><div class="section-head"><div><span class="eyebrow">IN THEIR OWN WORDS</span><h2>MEET THE DRIVER</h2></div></div><div class="driver-about-grid">'+(photo?'<img class="driver-portrait" src="'+esc(photo)+'" alt="'+esc(display||d.name)+'" loading="lazy" referrerpolicy="no-referrer">':'')+'<div>'+(p.header?'<h3>'+esc(p.header)+'</h3>':'')+'<dl class="driver-facts">'+facts.map(([label,value])=>'<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>').join('')+'</dl>'+paragraphs.map(([label,value])=>'<h3>'+label+'</h3><p class="driver-supplied">'+esc(value)+'</p>').join('')+'<div class="driver-socials">'+links.map(link=>link.url?'<a class="button-link" href="'+esc(link.url)+'" target="_blank" rel="noopener noreferrer">'+link.label+' ↗</a>':'<span class="driver-social-text">'+link.label+': '+esc(link.value)+'</span>').join('')+'</div><p class="result-note">Profile supplied by the driver.'+(p.updatedAt&&Number.isFinite(Date.parse(p.updatedAt))?' Updated '+esc(new Date(p.updatedAt).toLocaleDateString('en-AU'))+'.':'')+'</p></div></div></section>';
 }
 const statsCards=m=>`<div class="stat-cards">${[['FEATURE STARTS',m.starts],['WINS',m.wins],['PODIUMS',m.podiums],['AVERAGE FINISH',m.average]].map(([label,value])=>`<div class="stat"><strong>${esc(value)}</strong><span>${label}</span></div>`).join('')}</div>`;
 const banner=(title,deck)=>`<section class="page-banner"><div class="container"><span class="eyebrow">MUD MULES TV / FALL FEST</span><h1>${title}</h1><p class="deck">${deck}</p></div></section>`;
 const warning=data=>data.failures.length?`<p class="stats-notice" role="status">${data.failures.length} race result(s) could not be loaded. Totals are incomplete. <button type="button" onclick="location.reload()">Try again</button></p>`:data.sessionGaps.length?`<p class="stats-notice">Some session results are missing for ${data.sessionGaps.length} meeting(s). Their points totals are incomplete.</p>`:'';
 function select(id,label,options,current){return `<label for="${id}">${label}</label><select id="${id}">${options.map(v=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(v)}</option>`).join('')}</select>`;}
 const seasons=()=>[...new Set(entries().map(seasonName))].sort();
 function rankings(data,season,series){return data.drivers.map(d=>({d,races:d.races.filter(r=>seasonName(r.entry)===season&&r.entry.series===series)})).filter(d=>d.races.length).map(d=>({...d,points:d.races.reduce((a,r)=>a+r.points,0),estimated:d.races.some(r=>r.estimated>0),...metrics(d.races)})).sort((a,b)=>b.points-a.points||a.d.name.localeCompare(b.d.name));}
 async function championshipLeaders(season,series){
  const data=await load(),rows=rankings(data,season,series);
  let rank=0,last=null;
  const leaders=rows.map((r,i)=>{if(r.points!==last)rank=i+1;last=r.points;return {...r,rank};}).filter(r=>r.rank<=3);
  if(data.failures.length)return '<p class="result-note">Top three unavailable while some race results are missing. Visit the standings to retry.</p>';
  return '<div class="championship-leaders"><span class="sub">CURRENT TOP 3</span>'+ (leaders.length?'<ol>'+leaders.map(r=>'<li><span class="leader-position">'+r.rank+'</span>'+driverLink(r.d.name)+'<strong>'+r.points+(r.estimated?'*':'')+' <small>PTS</small></strong></li>').join('')+'</ol>':'<p class="result-note">No points yet.</p>')+'<p class="result-note">Provisional · Before drops'+(leaders.some(r=>r.estimated)?' · * Calculated points':'')+(data.sessionGaps.length?' · Some session results missing':'')+'</p></div>';
 }
 let selectedSeason='Fall Fest 2026',selectedSeries='Bomber Stocks',search='',rosterSeries='All series';
 async function standings(preferredSeries){
  if(preferredSeries)selectedSeries=preferredSeries;
  const hash=location.hash,version=++renderVersion;app.innerHTML=banner('THE POINTS<br>CHASE','Five championships. Every point counts.')+'<div class="container section loading">Loading the standings…</div>';
  const data=await load();if(location.hash!==hash||version!==renderVersion)return;
  if(!seasons().includes(selectedSeason))selectedSeason=seasons()[0];
  const series=[...new Set(entries().filter(e=>seasonName(e)===selectedSeason).map(e=>e.series))];if(!series.includes(selectedSeries))selectedSeries=series[0];
  const rows=rankings(data,selectedSeason,selectedSeries);
  let rank=0,last=null;const top=rows[0]?.points;
  app.innerHTML=banner('THE POINTS<br>CHASE','Five championships. Every point counts.')+`<div class="container section">${warning(data)}<div class="filterbar">${select('standings-season','SEASON',seasons(),selectedSeason)}${select('standings-series','SERIES',series,selectedSeries)}</div><div class="section-head"><div><span class="eyebrow">BEFORE DROPS · PROVISIONAL</span><h2>${esc(selectedSeries)}</h2></div><span class="chip">${esc(selectedSeason)}</span></div><p class="stats-notice">Drops are applied after Round 8. These totals add the published session points; an asterisk (*) marks totals that include points worked out from the scoring rules. Missing sessions, penalties or league adjustments may change the order.</p><div class="table-wrap"><table><thead><tr><th>POS</th><th>DRIVER</th><th>POINTS</th><th>GAP</th><th>ROUNDS</th><th>STARTS</th><th>WINS</th><th>TOP 3</th><th>AVG FIN</th></tr></thead><tbody>${rows.map((r,i)=>{if(r.points!==last)rank=i+1;last=r.points;return `<tr><td>${rank}</td><td>${driverLink(r.d.name)}</td><td><strong>${r.points}${r.estimated?'*':''}</strong></td><td>${r.points===top?'—':top-r.points}</td><td>${new Set(r.races.map(r=>r.entry.round)).size}</td><td>${r.starts}</td><td>${r.wins}</td><td>${r.podiums}</td><td>${r.average}</td></tr>`;}).join('')}</tbody></table></div>${!rows.length?'<p>No race points yet for this championship.</p>':''}<p class="result-note">Equal points share a position until the league tie-break is confirmed. Click a driver for their race-by-race points and results. Feature starts, wins and average finish refer to the final feature, not heats or the opening twin.</p><div id="standings-progression"></div></div>`;
  window.MMTVProgression.mount({element:document.getElementById('standings-progression'),data,groups:[{season:selectedSeason,series:selectedSeries}],seasonName,esc});
  document.getElementById('standings-season').onchange=e=>{selectedSeason=e.target.value;standings();};document.getElementById('standings-series').onchange=e=>{selectedSeries=e.target.value;standings();};
 }
 async function roster(){
  const hash=location.hash,version=++renderVersion;app.innerHTML=banner('MEET THE<br>DRIVERS','The names and numbers behind the racing.')+'<div class="container section loading">Loading the roster…</div>';
  const data=await load();if(location.hash!==hash||version!==renderVersion)return;
  const all=['All series',...new Set(entries().map(e=>e.series))];
  app.innerHTML=banner('MEET THE<br>DRIVERS','The names and numbers behind the racing.')+`<div class="container section">${warning(data)}<div class="filterbar">${select('roster-series','SERIES',all,rosterSeries)}<label for="driver-search">FIND A DRIVER</label><input id="driver-search" type="search" placeholder="Name or car number" value="${esc(search)}"></div><p class="result-note">Drivers appearing in the published race results. Stats cover the races on this website.</p><div id="driver-grid" class="driver-grid"></div></div>`;
  function cards(){const filtered=data.drivers.filter(d=>(rosterSeries==='All series'||d.races.some(r=>r.entry.series===rosterSeries))&&[...d.names,...d.numbers].some(v=>v.toLowerCase().includes(search.toLowerCase())));document.getElementById('driver-grid').innerHTML=filtered.map(d=>{const races=d.races.filter(r=>rosterSeries==='All series'||r.entry.series===rosterSeries),m=metrics(races);return `<a class="driver-card" href="#driver/${encodeURIComponent(d.id)}"><span class="driver-number">${esc([...d.numbers].map(n=>'#'+n).join(' / '))}</span><h2>${esc(d.name)}</h2><p>${esc([...new Set(races.map(r=>r.entry.series))].join(' · '))}</p><div class="driver-card-stats"><span><b>${m.starts}</b> STARTS</span><span><b>${m.wins}</b> WINS</span><span><b>${m.podiums}</b> PODIUMS</span></div><span class="driver-more">DRIVER PROFILE ↗</span></a>`;}).join('')||'<p>No drivers match your search.</p>';}
  cards();document.getElementById('driver-search').oninput=e=>{search=e.target.value;cards();};document.getElementById('roster-series').onchange=e=>{rosterSeries=e.target.value;cards();};
 }
 function profileNavigation(drivers,current){
  const index=drivers.findIndex(d=>d.id===current.id);
  const previous=drivers[(index+drivers.length-1)%drivers.length],next=drivers[(index+1)%drivers.length];
  const neighbour=(d,direction,label)=>'<a class="profile-neighbour profile-'+direction+'" href="#driver/'+encodeURIComponent(d.id)+'" aria-label="'+label+' driver: '+esc(d.name)+'"><span>'+ (direction==='previous'?'← PREVIOUS DRIVER':'NEXT DRIVER →')+'</span><strong>'+esc(d.name)+'</strong></a>';
  return '<nav class="profile-navigation" aria-label="Driver profiles">'+(drivers.length>1?neighbour(previous,'previous','Previous'):'<span></span>')+'<a class="profile-all" href="#drivers">ALL DRIVERS</a>'+(drivers.length>1?neighbour(next,'next','Next'):'<span></span>')+'</nav>';
 }
 async function profile(id){
  const hash=location.hash,version=++renderVersion;app.innerHTML=banner('DRIVER<br>PROFILE','Their season, race by race.')+'<div class="container section loading">Loading the driver…</div>';
  const data=await load();if(location.hash!==hash||version!==renderVersion)return;
  const d=data.drivers.find(d=>d.id===key(id));if(!d){app.innerHTML=banner('DRIVER NOT FOUND','<a href="#drivers">Back to the roster ↗</a>');return;}
  const races=[...d.races].sort((a,b)=>a.entry.event_date.localeCompare(b.entry.event_date)||a.entry.subsession_id-b.entry.subsession_id);
  const groups=[...new Set(races.map(r=>seasonName(r.entry)+' / '+r.entry.series))];
  const navigation=profileNavigation(data.drivers,d);
  app.innerHTML=banner(esc(d.name),`<span class="driver-profile-numbers">${esc([...d.numbers].map(n=>'#'+n).join(' / '))}</span> · <a href="#drivers">ALL DRIVERS ↗</a>`)+`<div class="container section">${navigation}${warning(data)}${profileDetails(d)}${statsCards(metrics(races))}<p class="result-note">Stats cover published final features. Heat and opening-twin results count toward points where applicable.</p><div class="section-head"><div><span class="eyebrow">THE SEASON SO FAR</span><h2>CHAMPIONSHIP POINTS</h2></div><a href="#standings">VIEW STANDINGS ↗</a></div><div class="series-grid">${groups.map(group=>{const rr=races.filter(r=>seasonName(r.entry)+' / '+r.entry.series===group);return `<div class="series-card"><span class="sub">BEFORE DROPS · PROVISIONAL</span><h3>${esc(group)}</h3><p><strong>${rr.reduce((a,r)=>a+r.points,0)}${rr.some(r=>r.estimated)?'*':''} points</strong> · ${rr.length} rounds</p></div>`;}).join('')}</div><p class="stats-notice">* Includes points calculated from the scoring rules. Totals may change after missing sessions or league adjustments are added. Drops follow Round 8.</p><div id="profile-progression"></div><div class="section-head"><div><span class="eyebrow">EVERY APPEARANCE</span><h2>RACE HISTORY</h2></div></div><div class="table-wrap"><table><thead><tr><th>DATE / RACE</th><th>SERIES</th><th>START</th><th>FINISH</th><th>+/-</th><th>POINTS</th></tr></thead><tbody>${races.map(r=>`<tr><td><a href="#race/${r.entry.subsession_id}">${esc(r.entry.event_date)} · R${esc(r.entry.round)}<br>${esc(r.entry.track)}</a></td><td>${esc(r.entry.series)}</td><td>${esc(r.start??'—')}</td><td>${r.feature?esc(r.finish):'—'}</td><td>${valid(r.gain)?(Number(r.gain)>0?'+':'')+Number(r.gain):'—'}</td><td><details><summary>${r.scored?r.points:'—'}${r.estimated?'*':''}</summary><ul>${r.breakdown.map(b=>`<li>${esc(b.session)} · P${esc(b.position)} · ${b.points}${b.estimated?'*':''} pts</li>`).join('')}</ul></details></td></tr>`).join('')}</tbody></table></div><p class="result-note">Open the points total for a session breakdown, or click a race to read the report and watch the broadcast.</p>${navigation}</div>`;
  const progressionGroups=[...new Map(races.map(r=>[seasonName(r.entry)+' / '+r.entry.series,{season:seasonName(r.entry),series:r.entry.series}])).values()];
  window.MMTVProgression.mount({element:document.getElementById('profile-progression'),data,groups:progressionGroups,driverId:d.id,seasonName,esc});
 }
 return {standings,roster,profile,driverLink,load,points,metrics,key,championshipLeaders,safeProfileUrl,profileDetails,rankings};
};
