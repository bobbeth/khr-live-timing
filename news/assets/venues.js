window.createMMTVVenues=function({app,entries,seasonName,esc,fmtDay,winner,driverStats,broadcastLibrary,dualTime}){
 let pending,version=0,season='Fall Fest 2026',series='All series',status='scheduled',round='all',query='';
 const normalize=s=>String(s||'').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ');
 function resolver(registry){
  const lookup=new Map();for(const t of registry.tracks||[])for(const alias of [t.name,...t.aliases]){const key=normalize(alias);if(lookup.has(key)&&lookup.get(key).id!==t.id)throw Error('Ambiguous track alias');lookup.set(key,t);}
  return name=>lookup.get(normalize(name))||{id:'archive-'+normalize(name).replace(/[^a-z0-9]+/g,'-'),name:String(name),aliases:[String(name)]};
 }
 function build(registry,schedule,races,now=new Date()){
  const trackFor=resolver(registry),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'}).format(now),used=new Set(),rows=[];
  const published=[...new Map(races.map(e=>[String(e.subsession_id),e])).values()];
  for(const planned of schedule.events||[]){
   const reports=published.filter(e=>seasonName(e)===schedule.season&&e.series===planned.series&&Number(e.round)===Number(planned.round));
   for(const report of reports.length?reports:[null]){
    if(report)used.add(String(report.subsession_id));
    const late=planned.start_at?Date.parse(planned.start_at)<=now.getTime():planned.date<today;
    rows.push({season:schedule.season,series:planned.series,round:Number(planned.round),date:planned.date,start_at:planned.start_at,plannedTrack:planned.track,label:report?.track||planned.track,track:trackFor(report?.track||planned.track),report,status:report?'completed':late?'awaiting':'scheduled'});
   }
  }
  for(const report of published.filter(e=>!used.has(String(e.subsession_id))))rows.push({season:seasonName(report),series:report.series,round:Number(report.round),date:report.event_date,start_at:null,plannedTrack:null,label:report.track,track:trackFor(report.track),report,status:'completed'});
  rows.sort((a,b)=>a.date.localeCompare(b.date)||(a.start_at||'').localeCompare(b.start_at||'')||a.series.localeCompare(b.series));
  const tracks=[...new Map(rows.map(r=>[r.track.id,r.track])).values()].sort((a,b)=>a.name.localeCompare(b.name));
  return {rows,tracks,trackFor};
 }
 async function load(){
  if(!pending)pending=Promise.all(['tracks','schedule'].map(name=>fetch('data/'+name+'.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}))).then(([registry,schedule])=>{if(registry.schema_version!=='MMTV-tracks-v1'||schedule.schema_version!=='MMTV-schedule-v1')throw Error();return {registry,schedule};}).catch(error=>{pending=null;throw error;});
  const source=await pending;return {...source,...build(source.registry,source.schedule,entries())};
 }
 function matches(row,f){return (f.season==='All seasons'||row.season===f.season)&&(f.series==='All series'||row.series===f.series)&&(f.status==='all'||row.status===f.status)&&(f.round==='all'||String(row.round)===f.round)&&(!f.query||[row.track.name,row.label,row.series].join(' ').toLowerCase().includes(f.query.toLowerCase()));}
 const unique=a=>[...new Set(a)];
 const select=(id,label,values,current)=>`<label for="${id}">${label}</label><select id="${id}">${values.map(v=>`<option value="${esc(v)}" ${String(v)===current?'selected':''}>${esc(v)}</option>`).join('')}</select>`;
 const banner=(title,deck)=>`<section class="page-banner"><div class="container"><span class="eyebrow">MUD MULES TV / WHERE WE RACE</span><h1>${title}</h1><p class="deck">${deck}</p></div></section>`;
 const trackLink=(t,text=t.name)=>`<a class="driver-link" href="#track/${encodeURIComponent(t.id)}">${esc(text)}</a>`;
 const section=(title,kicker)=>`<div class="section-head venues-section-head"><div><span class="eyebrow">${kicker}</span><h2>${title}</h2></div></div>`;
 const times=row=>row.start_at?`<div class="venue-times">${dualTime(row.start_at)}</div>`:`<p class="result-note">Hobart season date: ${esc(fmtDay(row.date))}. US Eastern start time not recorded.</p>`;
 function reportLinks(row,videos){
  if(!row.report)return '<a class="text-link" href="https://www.youtube.com/@bobbethTV/streams" target="_blank" rel="noopener noreferrer">BOBBETH TV CHANNEL ↗</a>';
  const video=videos?.find(v=>v.races.some(r=>String(r.entry.subsession_id)===String(row.report.subsession_id)));
  return `<a class="text-link" href="#race/${row.report.subsession_id}">RACE REPORT & RESULTS ↗</a>${video?`<a class="text-link" href="#broadcast/${video.id}">WATCH BROADCAST ↗</a>`:''}`;
 }
 const labelStatus={scheduled:'UPCOMING',completed:'RESULTS PUBLISHED',awaiting:'AWAITING RESULTS'};
 function calendarCard(row,videos){return `<article class="calendar-meeting"><div class="calendar-date"><span>${esc(fmtDay(row.date))}</span><small>HOBART SEASON DATE</small><b>${labelStatus[row.status]}</b></div><div><span class="eyebrow">${esc(row.season)} · ROUND ${row.round}</span><h3>${esc(row.series)}</h3><p>${trackLink(row.track)}${row.label!==row.track.name?` <span class="venue-layout">${esc(row.label)}</span>`:''}</p>${row.report?`<p class="calendar-winner">Winner: ${esc(winner(row.report))}</p>`:''}${row.report&&row.report.event_date!==row.date?`<p class="result-note">The linked race report is dated ${esc(fmtDay(row.report.event_date))}.</p>`:''}${row.report&&row.plannedTrack&&row.track.id!==resolverCache(row.plannedTrack)?.id?`<p class="result-note">Schedule listed ${esc(row.plannedTrack)}; the published result places this race at ${esc(row.report.track)}.</p>`:''}${row.start_at?'<span class="venue-time-label">SCHEDULED START</span>':''}${times(row)}<div class="venue-actions">${reportLinks(row,videos)}</div></div></article>`;}
 let resolverCache=()=>null;
 function calendarFile(rows,now=new Date()){
  const escape=value=>String(value).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const utc=value=>new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Mud Mules TV//KHR Season Calendar//EN','CALSCALE:GREGORIAN'];
  for(const row of rows.filter(r=>r.status==='scheduled'&&r.start_at&&Date.parse(r.start_at)>now.getTime()))lines.push('BEGIN:VEVENT','UID:'+escape(row.series.replace(/\W+/g,'-')+'-'+row.season.replace(/\W+/g,'-')+'-'+row.round+'@bobbeth.github.io'),'DTSTAMP:'+utc(now),'DTSTART:'+utc(row.start_at),'SUMMARY:'+escape(row.series+' Round '+row.round),'LOCATION:'+escape(row.label),'DESCRIPTION:'+escape('Scheduled KHR race. Check league announcements for changes.'),'URL:https://bobbeth.github.io/khr-live-timing/news/#track/'+encodeURIComponent(row.track.id),'END:VEVENT');
  lines.push('END:VCALENDAR');return lines.map(line=>line.match(/.{1,73}/gu)?.join('\r\n ')||'').join('\r\n')+'\r\n';
 }
 async function screen(kind,id){
  const current=++version,hash=location.hash;app.innerHTML=banner(kind==='calendar'?'THE SEASON<br>AHEAD':kind==='track'?'TRACK<br>HISTORY':'THE TRACKS','From the next green flag to the races already run.')+'<div class="container section loading">Loading the season calendar…</div>';
  let data;try{data=await load();}catch{if(version===current&&location.hash===hash)app.innerHTML=banner('RACE CALENDAR','The calendar could not be loaded. Please reload to try again.');return;}
  if(version!==current||location.hash!==hash)return;resolverCache=data.trackFor;
  const seasons=['All seasons',...unique(data.rows.map(r=>r.season)).sort()];if(!seasons.includes(season))season=data.schedule.season;
  const filterHtml=select('venues-season','SEASON',seasons,season)+select('venues-series','SERIES',['All series',...unique(data.rows.map(r=>r.series))],series);
  let videos=null;try{videos=await broadcastLibrary.load();}catch{}
  if(version!==current||location.hash!==hash)return;
  const tabs=`<div class="insights-tabs"><a href="#calendar" ${kind==='calendar'?'aria-current="page"':''}>SEASON CALENDAR</a><a href="#tracks" ${kind!=='calendar'?'aria-current="page"':''}>TRACK DIRECTORY</a></div>`;
  if(kind==='calendar'){
   app.innerHTML=banner('THE SEASON<br>AHEAD','Pick a round, find your championship and get ready for the green flag.')+`<div class="container section">${tabs}<div class="filterbar">${filterHtml}<label for="calendar-status">SHOW</label><select id="calendar-status">${[['scheduled','Upcoming races'],['completed','Completed races'],['awaiting','Awaiting results'],['all','Full season']].map(([v,t])=>`<option value="${v}" ${v===status?'selected':''}>${t}</option>`).join('')}</select><label for="calendar-round">ROUND</label><select id="calendar-round"><option value="all">All rounds</option>${unique(data.rows.map(r=>r.round)).sort((a,b)=>a-b).map(r=>`<option value="${r}" ${String(r)===round?'selected':''}>${r}</option>`).join('')}</select><label for="calendar-search">SEARCH</label><input type="search" id="calendar-search" value="${esc(query)}" placeholder="Track or championship"></div><p class="stats-notice">US Eastern and Hobart times are shown for confirmed starts. These are scheduled times; check league announcements for postponements or venue changes. Historical start times have not been guessed.</p><div class="calendar-toolbar"><p id="calendar-count" role="status"></p><a class="button-link" id="calendar-download" download="KHR-upcoming-races.ics">DOWNLOAD UPCOMING RACES</a></div><div id="calendar-meetings"></div></div>`;
   const draw=()=>{const rows=data.rows.filter(r=>matches(r,{season,series,status,round,query}));document.getElementById('calendar-count').textContent=`${rows.length} meeting(s) · ${data.rows.filter(r=>r.status==='completed').length} published results across the full calendar`;document.getElementById('calendar-meetings').innerHTML=rows.map(r=>calendarCard(r,videos)).join('')||'<div class="empty">No meetings match this selection.</div>';const next=data.rows.filter(r=>matches(r,{season,series,status:'scheduled',round,query})&&r.start_at);const download=document.getElementById('calendar-download');download.href='data:text/calendar;charset=utf-8,'+encodeURIComponent(calendarFile(next));download.hidden=!next.length;};
   document.getElementById('calendar-status').onchange=e=>{status=e.target.value;draw();};document.getElementById('calendar-round').onchange=e=>{round=e.target.value;draw();};document.getElementById('calendar-search').oninput=e=>{query=e.target.value;draw();};draw();
  }else if(kind==='tracks'){
   app.innerHTML=banner('THE TRACKS','The venues, the winners and the nights worth watching again.')+`<div class="container section">${tabs}<div class="filterbar">${filterHtml}<label for="track-search">FIND A TRACK</label><input id="track-search" type="search" placeholder="Track or layout" value="${esc(query)}"></div><div class="venue-directory" id="venue-directory"></div></div>`;
   const draw=()=>{const rows=data.rows.filter(r=>matches(r,{season,series,status:'all',round:'all',query}));document.getElementById('venue-directory').innerHTML=data.tracks.filter(t=>rows.some(r=>r.track.id===t.id)).map(t=>{const meetings=rows.filter(r=>r.track.id===t.id),past=meetings.filter(r=>r.report),future=meetings.filter(r=>r.status==='scheduled');return `<a class="venue-card" href="#track/${t.id}"><span class="eyebrow">${unique(meetings.map(r=>r.series)).length} CHAMPIONSHIP(S)</span><h2>${esc(t.name)}</h2><p>${past.length} published meeting(s) · ${future.length} upcoming</p><p>${esc(unique(meetings.map(r=>r.series)).join(' · '))}</p><span class="text-link">EXPLORE THE TRACK ↗</span></a>`;}).join('')||'<div class="empty">No tracks match this selection.</div>';};document.getElementById('track-search').oninput=e=>{query=e.target.value;draw();};draw();
  }else{
   const track=data.tracks.find(t=>t.id===(kind==='trackName'?data.trackFor(id).id:id));if(!track){app.innerHTML=banner('TRACK NOT FOUND','<a href="#tracks">Back to the track directory ↗</a>');return;}
   const meetings=data.rows.filter(r=>r.track.id===track.id),past=meetings.filter(r=>r.report),future=meetings.filter(r=>r.status==='scheduled');
   app.innerHTML=banner(esc(track.name),'<a href="#tracks">ALL TRACKS ↗</a> · <a href="#calendar">SEASON CALENDAR ↗</a>')+`<div class="container section">${tabs}<div class="stat-cards"><div class="stat"><strong>${past.length}</strong><span>PUBLISHED MEETINGS</span></div><div class="stat"><strong>${future.length}</strong><span>UPCOMING MEETINGS</span></div><div class="stat"><strong>${unique(meetings.map(r=>r.series)).length}</strong><span>CHAMPIONSHIPS</span></div></div><p class="result-note">Venue history may include different layouts, surfaces and cars. Meeting labels retain the supplied details; lap times across those configurations are not compared.</p>${section('NEXT AT THIS TRACK','THE NEXT GREEN FLAG')}${future.length?future.map(r=>calendarCard(r,videos)).join(''):'<p>No upcoming meetings are currently listed for this venue.</p>'}${section('PAST WINNERS & RACE HISTORY','THE RACES ALREADY RUN')}${past.length?`<div class="table-wrap"><table><thead><tr><th>REPORT DATE</th><th>CHAMPIONSHIP</th><th>WINNER</th><th>REPORT / BROADCAST</th></tr></thead><tbody>${past.map(r=>`<tr><td>${esc(fmtDay(r.report.event_date))}</td><td>${esc(r.series)} · R${r.round}<br><small>${esc(r.report.track)}</small></td><td>${driverStats.driverLink(winner(r.report))}</td><td><div class="venue-actions">${reportLinks(r,videos)}</div></td></tr>`).join('')}</tbody></table></div>`:'<p>No published race results at this venue yet.</p>'}${section('WINNING DRIVERS','FINAL-FEATURE VICTORIES')}<div id="venue-winners"><p class="result-note">Loading venue statistics…</p></div>${section('THE BROADCASTS','WATCH IT BACK')}<div class="venue-videos">${videos?videos.filter(v=>v.races.some(r=>data.trackFor(r.entry.track).id===track.id)).map(v=>`<a class="venue-video" href="#broadcast/${v.id}"><img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="Race broadcast thumbnail" loading="lazy" referrerpolicy="no-referrer"><span>${esc(unique(v.races.filter(r=>data.trackFor(r.entry.track).id===track.id).map(r=>r.entry.series+' · R'+r.entry.round)).join(' / '))} ↗</span></a>`).join('')||'<p>No linked broadcasts at this venue yet.</p>':'<p>The broadcast links could not be loaded. Visit the library to retry.</p>'}</div><a class="button-link" href="#tracks">BACK TO ALL TRACKS</a></div>`;
   let stats;try{stats=await driverStats.load();}catch{}
   if(version!==current||location.hash!==hash)return;
   const wins=stats?.drivers.map(d=>({d,count:d.races.filter(r=>r.feature&&Number(r.finish)===1&&data.trackFor(r.entry.track).id===track.id).length})).filter(d=>d.count>0).sort((a,b)=>b.count-a.count||a.d.name.localeCompare(b.d.name));
   document.getElementById('venue-winners').innerHTML=stats&&!stats.failures.length?(wins.length?`<div class="venue-winners">${wins.map(w=>`<a href="#driver/${encodeURIComponent(w.d.id)}"><strong>${w.count}</strong><span>${esc(w.d.name)}<small>FINAL-FEATURE WIN(S)</small></span></a>`).join('')}</div>`:'<p>No final-feature winners recorded yet.</p>'):'<p>Venue statistics could not be loaded completely.</p>';
   return;
  }
  document.getElementById('venues-season').onchange=e=>{season=e.target.value;screen(kind);};document.getElementById('venues-series').onchange=e=>{series=e.target.value;screen(kind);};
 }
 return {build,resolver,matches,calendarFile,calendar:()=>screen('calendar'),tracks:()=>screen('tracks'),track:id=>screen('track',id),trackByName:name=>screen('trackName',name),trackUrl:name=>'#track-name/'+encodeURIComponent(name),load};
};
