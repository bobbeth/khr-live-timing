(() => {
'use strict';
const seed = window.MMTV_SEED;
const editorial = window.MMTV_EDITORIAL?.events || {};
const app = document.getElementById('app');
let publishedIndex = seed.index;
const liveIds = new Set();
const eventCache = {...seed.records};
const seriesNames = ['Bomber Stocks','Cushion Kings','Mini Menaces','Yota Outlawz','Wide Open Revival'];
const allSeries = () => [...new Set((publishedIndex.events||[]).map(e=>e.series))].sort((a,b) => (seriesNames.indexOf(a)<0?99:seriesNames.indexOf(a))-(seriesNames.indexOf(b)<0?99:seriesNames.indexOf(b)));
const seasonName = e => e.competition || e.season || (String(e.event_date||'').startsWith('2026') ? 'Fall Fest 2026' : `KHR ${String(e.event_date||'').slice(0,4)} season`);
const state = {season:'all',series:'all',round:'all',search:'',sort:'finish'};
const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDay = d => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const displayName = name => String(name||'').replace(/Mcclain/g,'McClain');
const ids = () => (publishedIndex.events || []).map(e => Number(e.subsession_id));
const eventById = id => (publishedIndex.events||[]).find(e=>Number(e.subsession_id)===Number(id));
const routeRace = id => `#race/${Number(id)}`;
const raceIsFeatured = id => !!seed.articles[String(id)];
const sourceUrl = id => liveIds.has(Number(id)) ? `https://github.com/bobbeth/khr-live-timing/blob/main/news/data/live/events/${encodeURIComponent(id)}.json` : `https://github.com/bobbeth/khr-live-timing/blob/main/archive/events/${encodeURIComponent(id)}.json`;
const sortDate = (a,b) => String(a.event_date||'').localeCompare(String(b.event_date||'')) || a.round-b.round;
const winner = e => displayName(e.winners?.[0]?.driver||'Awaiting result');
function eventList(){return [...publishedIndex.events].sort(sortDate)}
const driverStats=window.createMMTVStats({app,entries:()=>publishedIndex.events,seasonName,esc,displayName,getEvent,getMeeting});
const broadcastLibrary=window.createMMTVBroadcastLibrary({app,entries:()=>publishedIndex.events,seasonName,esc,fmtDay});
function cards(events){return events.map((e,i) => {
 const a=editorial[String(e.subsession_id)]||seed.articles[String(e.subsession_id)],title=a?.headline||`${winner(e)} takes ${e.series} Round ${e.round}`,deck=a?.deck||`${e.track} · Complete race-day coverage and results.`,num=e.winners?.[0]?.car_number|| (seed.records[String(e.subsession_id)]?.feature_results?.[0]?.car_number || String(i+1).padStart(2,'0'));
 return `<a class="story-card" href="${routeRace(e.subsession_id)}"><div class="story-graphic"><span class="flag">ROUND ${esc(e.round)} / ${esc(e.series)}</span><span class="big-number">${esc(num)}</span></div><div class="story-content"><span class="label">${esc(e.series)} &nbsp; / &nbsp; ${esc(e.track)}</span><h3>${esc(title)}</h3><p>${esc(deck)}</p><div class="story-meta"><span>${esc(fmtDay(e.event_date))}</span><b>READ RACE REPORT ↗</b></div></div></a>`;
}).join('')}
const fallFestSeries = [
 {name:'Bomber Stocks',slug:'bomber-stocks',label:'Davis Property Management',secondary:'Presented by Mo Diggin Mafia',show:'BOMBER STOCKS',car:'STOCK CARS'},
 {name:'Cushion Kings',slug:'cushion-kings',label:'KP Plumbing Service',secondary:'Cushion Kings Tour',show:'CUSHION KINGS',car:'UMP MODIFIEDS'},
 {name:'Mini Menaces',slug:'mini-menaces',label:'Bottom Feeder Speed Company',secondary:'600cc Mini Menaces',show:'MINI MENACES',car:'600CC MICROS'},
 {name:'Yota Outlawz',slug:'yota-outlawz',label:'Yota Outlawz',secondary:'Dirt Cheap... Asphalt Fast',show:'YOTA OUTLAWZ',car:'DIRT & ASPHALT'},
 {name:'Wide Open Revival',slug:'wide-open-revival',label:'Baptist Bullet Cheater Engines',secondary:'Wide Open Revival',show:'WIDE OPEN REVIVAL',car:'PRO LATE MODELS'}
];
const newsroom=window.createMMTVNewsroom({app,entries:()=>publishedIndex.events,seasonName,esc,fmtDay,cards,editorial,winner,driverStats,broadcastLibrary,posterCards:(fallEvents)=>{
 const posterCards=fallFestSeries.map((s,i)=>{
  const count=fallEvents.filter(e=>e.series===s.name).length;
  return `<a class="ff-championship-card ff-${esc(s.slug)} series-go" href="#results" data-series="${esc(s.name)}" aria-label="Explore ${esc(s.name)} championship coverage and results">
   <div class="ff-poster-visual">
    <div class="ff-poster-placeholder" aria-hidden="true"><span class="ff-poster-khr">KNUCKLE-HEADZ <i>RACING LEAGUE</i></span><span class="ff-poster-flags">▨ ▨ ▨</span><span class="ff-poster-title">${esc(s.show)}</span><span class="ff-poster-sponsor">${esc(s.label)}</span></div>
    <img class="ff-official-poster" src="assets/posters/${esc(s.slug)}.jpg" alt="KHR Fall Fest promotional artwork for ${esc(s.name)}" loading="lazy" decoding="async">
    <span class="ff-poster-ordinal" aria-hidden="true">0${i+1}</span>
   </div>
   <div class="ff-championship-copy"><span class="ff-championship-type">${esc(s.car)} <span aria-hidden="true">/</span> ${count} RACE REPORTS</span><h3>${esc(s.name)}</h3><p>${esc(s.label)}${s.secondary&&s.secondary!==s.name?' · '+esc(s.secondary):''}</p><span class="ff-explore">Explore championship <span aria-hidden="true">↗</span></span></div>
  </a>`;
 }).join('');
return posterCards;}});
function home(){return newsroom.home();}

function archiveRow(e){return `<a class="archive-row" href="${routeRace(e.subsession_id)}"><span class="round">R${esc(e.round)}</span><span><strong>${esc(displayName(winner(e)))}</strong><small>${esc(e.series)} · ${esc(e.track)}</small></span><span class="end">RESULTS ↗</span></a>`}
function results(){app.innerHTML=`<div class="page-banner"><div class="container"><span class="eyebrow">THE RACE-DAY ARCHIVE</span><h1>RACE RESULTS<br>& ARCHIVE</h1><p class="deck">Find your series, pick a round and catch up on the racing.</p></div></div><div class="container section"><div class="section-head"><div><span class="eyebrow">FALL FEST 2026</span><h2>EVENT DIRECTORY</h2></div><span class="chip">FALL FEST RACE RESULTS</span></div><div class="filterbar"><label for="filter-season">SEASON</label><select id="filter-season"><option value="all">All competitions</option>${[...new Set(eventList().map(seasonName))].map(name=>`<option value="${esc(name)}" ${state.season===name?'selected':''}>${esc(name)}</option>`).join('')}</select><label for="filter-series">SERIES</label><select id="filter-series"><option value="all">All championships</option>${allSeries().map(s=>`<option value="${esc(s)}" ${state.series===s?'selected':''}>${esc(s)}</option>`).join('')}</select><label for="filter-round">ROUND</label><select id="filter-round"><option value="all">All rounds</option>${[...new Set(eventList().map(e=>e.round))].map(n=>`<option value="${n}" ${state.round===String(n)?'selected':''}>Round ${n}</option>`).join('')}</select><input type="search" id="filter-search" placeholder="Search drivers, tracks or series" aria-label="Search race results" value="${esc(state.search)}"><span class="filter-count" id="filter-count"></span></div><div id="filtered-list" class="archive-grid"></div><p class="result-note">Race reports and results from across the season.</p></div>`; updateResults()}
function updateResults(){const matches=eventList().filter(e=>(state.season==='all'||seasonName(e)===state.season)&&(state.series==='all'||e.series===state.series)&&(state.round==='all'||String(e.round)===state.round)&&(!state.search||[e.series,e.track,winner(e),String(e.subsession_id)].join(' ').toLowerCase().includes(state.search.toLowerCase())));const node=document.getElementById('filtered-list');if(node){node.innerHTML=matches.length?matches.map(archiveRow).join(''):'<div class="empty">No race matches those filters.</div>';document.getElementById('filter-count').textContent=`${matches.length} OF ${publishedIndex.events.length} RACES`}}
let championshipRender=0;
async function championships(){const version=++championshipRender;const all=eventList();app.innerHTML=`<div class="page-banner"><div class="container"><span class="eyebrow">MUD MULES TV COVERAGE</span><h1>THE<br>CHAMPIONSHIPS</h1><p class="deck">Five championships. Plenty to race for. Catch up with every series and round.</p></div></div><div class="container section"><div class="section-head"><div><span class="eyebrow">KNUCKLE-HEADZ RACING LEAGUE</span><h2>FALL FEST 2026</h2></div></div><div class="series-grid">${seriesNames.map(s=>{const races=all.filter(e=>e.series===s);return `<div class="series-card"><span class="sub">${races.length} RACE REPORTS · FALL FEST 2026</span><h3>${esc(seed.seriesTitles[s])}</h3><p>${races.map(e=>`R${e.round}: ${e.track}`).join(' · ')}</p><a href="#results" class="series-go" data-series="${esc(s)}">VIEW SERIES RESULTS ↗</a><div id="championship-leaders-${seriesNames.indexOf(s)}"><p class="result-note">Loading the top three…</p></div></div>`}).join('')}</div><div class="empty" style="margin-top:30px">Follow the season with Mud Mules TV. Pick a championship above for race reports and results.</div></div>`;await Promise.all(seriesNames.map(async(s,i)=>{const html=await driverStats.championshipLeaders('Fall Fest 2026',s);if(location.hash==='#championships'&&version===championshipRender){const box=document.getElementById('championship-leaders-'+i);if(box)box.innerHTML=html;}}));}
async function getEvent(id){
 const key=String(id);
 if(location.protocol!=='file:'){
  const path=liveIds.has(Number(id))?`data/live/events/${encodeURIComponent(key)}.json`:`../archive/events/${encodeURIComponent(key)}.json`;
  try{
   const response=await fetch(path,{cache:'no-store'});
   if(response.ok){const j=await response.json();
    if(['official_backed','live_captured'].includes(j.verification) && Number(j.subsession_id)===Number(id) && Array.isArray(j.feature_results)){
     eventCache[key]=j;return j;
    }
   }
  }catch(e){}
 }
 return eventCache[key]||null;
}
// Full meeting records are published separately from the Feature-only archive.
async function getMeeting(id){
 if(location.protocol==='file:')return null;
 try{
   const path=liveIds.has(Number(id))?`data/live/meetings/${encodeURIComponent(id)}.json`:`data/meetings/${encodeURIComponent(id)}.json`;
   const r=await fetch(path,{cache:'no-store'});
   if(!r.ok)return null;
   const j=await r.json();
   if(!['MMTV-official-meeting-v2','MMTV-live-meeting-v1'].includes(j.schema_version) ||
      !['official_backed','live_captured'].includes(j.verification) ||
      Number(j.subsession_id)!==Number(id) || !Array.isArray(j.sessions))return null;
   return j;
 }catch(e){return null}
}
// Broadcast links are keyed to verified iRacing subsession IDs, never guessed from date alone.
const broadcastChannel='https://www.youtube.com/@bobbethTV/streams';
let broadcastLinksPromise;
async function getBroadcast(id){
 if(location.protocol==='file:')return null;
 if(!broadcastLinksPromise){
  broadcastLinksPromise=fetch('data/broadcasts.json',{cache:'no-store'})
   .then(r=>r.ok?r.json():null)
   .catch(()=>null);
 }
 const index=await broadcastLinksPromise;
 if(index?.schema_version!=='MMTV-broadcast-links-v1'||!index.events||typeof index.events!=='object')return null;
 const link=index.events[String(id)];
 if(!link||typeof link!=='object'||!/^[a-zA-Z0-9_-]{11}$/.test(link.video_id||''))return null;
 const seconds=Number(link.start_seconds);
 const start=Number.isSafeInteger(seconds)&&seconds>=0&&seconds<=86400?seconds:0;
 return {video_id:link.video_id,start_seconds:start,title:String(link.title||'Full race broadcast').slice(0,160),match_status:String(link.match_status||'verified')};
}
function broadcastHtml(id,entry,broadcast){
 const head=`<div class="broadcast-heading"><div><span class="eyebrow">MUD MULES TV · THE ORIGINAL COVERAGE</span><h2>WATCH THE RACE BROADCAST</h2></div><span class="chip">ROUND ${esc(entry.round)} / ${esc(entry.series)}</span></div>`;
 if(!broadcast){
  return `<section class="race-broadcast" id="race-broadcast">${head}<div class="broadcast-unlinked"><p>This event's broadcast has not yet been matched to a verified recording.</p><a href="${broadcastChannel}" target="_blank" rel="noopener noreferrer">BROWSE BOBBETH TV BROADCASTS ↗</a></div></section>`;
 }
 const vid=broadcast.video_id,start=broadcast.start_seconds;
 const src=`https://www.youtube-nocookie.com/embed/${vid}?rel=0${start?`&amp;start=${start}`:''}`;
 const watch=`https://www.youtube.com/watch?v=${vid}${start?`&amp;t=${start}s`:''}`;
 return `<section class="race-broadcast" id="race-broadcast">${head}<div class="broadcast-player"><iframe src="${src}" title="${esc(broadcast.title)} — ${esc(entry.series)} Round ${esc(entry.round)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div><div class="broadcast-footer"><p>${broadcast.match_status==='schedule_inferred'?'Broadcast matched using the weekly series schedule and stream listing order. Exact video content and race starting timestamp have not yet been independently verified.':'The original Mud Mules TV coverage of this KHR event. Press play to watch the recording.'}</p><a href="${watch}" target="_blank" rel="noopener noreferrer">WATCH ON YOUTUBE ↗</a></div></section>`;
}
const stageNames={practice:'PRACTICE',qualifying:'QUALIFYING',heat:'HEAT RACING',consolation:'CONSOLATION / B-MAIN',twin_feature_1:'TWIN FEATURE 1',twin_feature_2:'TWIN FEATURE 2',feature:'FEATURE',warmup:'WARM-UP',race:'RACE SESSION',other:'OTHER SESSION'};
const stageStat = (r,k) => Number.isFinite(Number(r[k])) && r[k]!==null ? Number(r[k]) : null;
const cleanBest = r => stageStat(r,'best_lap_seconds') ?? stageStat(r,'qual_lap_seconds');
const stageName = s => {
  if(s.kind==='twin_feature_1')return 'TWIN FEATURE 1 — B-MAIN';
  if(s.kind==='twin_feature_2')return 'TWIN FEATURE 2 — FEATURE';
  return String(s.name||stageNames[s.kind]||'Session');
};
// Mud Mules TV long-form editorial: full meeting storyline, grounded in classified records.
function renderLongformArticle(meeting,event,entry){
 if(!meeting||!Array.isArray(meeting.sessions)||!Array.isArray(event?.feature_results))return '';
 const sessions=meeting.sessions.filter(s=>s.available&&Array.isArray(s.classification)&&s.classification.length).sort((a,b)=>a.simsession_number-b.simsession_number);
 if(!sessions.length)return '';
 const feature=[...event.feature_results].filter(r=>r.finish_position>0).sort((a,b)=>a.finish_position-b.finish_position);
 if(!feature.length)return '';
 const win=feature[0],runner=feature[1],third=feature[2], summary=event.event_summary||{};
 const nm=r=>displayName(r?.driver||'');
 const fmt=n=>Number(n).toFixed(4);
 const valid=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
 const secLap=r=>r&&valid(r.best_lap_seconds)&&Number(r.best_lap_seconds)>0?Number(r.best_lap_seconds):null;
 const position=r=>r&&(r.position!==null&&r.position!==undefined)?Number(r.position):null;
 const sorted=s=>[...(s.classification||[])].filter(r=>position(r)!==null).sort((a,b)=>a.position-b.position);
 const pace=s=>[...(s.classification||[])].filter(r=>secLap(r)!==null).sort((a,b)=>secLap(a)-secLap(b));
 const findDriver=(s,driver)=>s?.classification?.find(r=>String(r.car_number)===String(driver.car_number)&&nm(r)===nm(driver)) || s?.classification?.find(r=>nm(r)===nm(driver)) || null;
 const featurePlace=r=>feature.find(f=>nm(f)===nm(r)&&String(f.car_number)===String(r.car_number))?.finish_position??null;
 const progress=r=>valid(r?.start_position)&&r.start_position>0&&valid(r?.finish_position)&&r.finish_position>0?Number(r.start_position)-Number(r.finish_position):null;
 
 const sections=[];
 const add=(label,ps)=>{const paragraphs=ps.filter(p=>p&&String(p).trim());if(paragraphs.length)sections.push({label,paragraphs})};
 const totalLaps=valid(summary.event_laps_complete)&&summary.event_laps_complete>0?Number(summary.event_laps_complete):(event.verification==='live_captured'?0:Number(win.laps_completed||0));
 const leadCount=Number(win.laps_led)||0;
 const featureFastest=feature.filter(r=>secLap(r)!==null).sort((a,b)=>secLap(a)-secLap(b))[0];
 const biggest=feature.filter(r=>progress(r)>0).sort((a,b)=>progress(b)-progress(a))[0];
 const rivals=feature.filter(r=>r!==win).sort((a,b)=>(Number(b.laps_led)||0)-(Number(a.laps_led)||0))[0];
 const practices=sessions.filter(s=>s.kind==='practice'&&String(s.name).toUpperCase()!=='WARMUP');
 if(practices.length){
  const pp=[];
  for(const s of practices){const fast=pace(s),w=fast[0],r=fast[1],t=fast[2];
   if(w){let txt=`${nm(w)} put the #${w.car_number} at the head of ${s.name.toLowerCase()} with a ${fmt(secLap(w))}-second lap.`;
    if(r)txt+=` ${nm(r)} was next quickest at ${fmt(secLap(r))}, ${fmt(secLap(r)-secLap(w))} seconds adrift${t?`, followed by ${nm(t)} on ${fmt(secLap(t))}`:''}.`;
    if(!r)txt+=` It was the fastest lap from ${s.classification.length} drivers.`;
    pp.push(txt);
    const fin=featurePlace(w);if(fin!==null&&Number(fin)>0&&nm(w)!==nm(win))pp.push(`The early pace setter ${nm(w)} would ultimately finish P${fin} in the Feature.`);
   }
   const fw=findDriver(s,win);
   if(fw&&secLap(fw)!==null&&fast[0]&&nm(fast[0])!==nm(win)){
    const p=fast.findIndex(r=>r===fw)+1;
    if(p>0)pp.push(`Eventual winner ${nm(win)} recorded a ${fmt(secLap(fw))}-second practice lap, ${p===1?'quickest':`ranking ${p}${p===2?'nd':p===3?'rd':'th'} on lap pace`} among the drivers with a time.`);
   }
  }
  add('Practice: the pace setters',pp);
 }

 const qualifying=sessions.filter(s=>s.kind==='qualifying');
 if(qualifying.length){const ps=[];
  for(const s of qualifying){const order=sorted(s),pole=order[0],q2=order[1],q3=order[2];
   if(!pole)continue;
   let txt=`${nm(pole)} topped qualifying in the #${pole.car_number}${secLap(pole)!==null?` with a best lap of ${fmt(secLap(pole))} seconds`:''}.`;
   if(q2)txt+=` ${nm(q2)} qualified second${q3?`, followed by ${nm(q3)} in third`:''}.`;
   ps.push(txt);
   const fin=featurePlace(pole);if(fin!==null&&Number(fin)>0&&nm(pole)!==nm(win))ps.push(`The qualifying pace setter ${nm(pole)} finished the main event in P${fin}.`);
   const qw=findDriver(s,win);
   if(qw&&position(qw)>0&&position(qw)!==1)ps.push(`${nm(win)} qualified P${position(qw)}${secLap(qw)!==null?` with a ${fmt(secLap(qw))}-second lap`:''}, ahead of the heats.`);
  }
  add('Qualifying',ps);
 }

 const heats=sessions.filter(s=>s.kind==='heat');
 if(heats.length){const ps=[];
  for(const heat of heats){const order=sorted(heat),w=order[0],p2=order[1],p3=order[2],fast=pace(heat)[0];if(!w)continue;
   const moved=valid(w.start_position)&&w.start_position>0?Number(w.start_position)-position(w):null;
   let txt=`${heat.name} went to ${nm(w)} in the #${w.car_number}${valid(w.start_position)&&w.start_position>0?`, who started P${w.start_position}`:''}.`;
   if(p2)txt+=` ${nm(p2)} finished second${p3?`, while ${nm(p3)} completed the top three`:''}.`;
   if(moved>0)txt+=` The winner advanced ${moved} position${moved===1?'':'s'}.`;
   if(fast&&secLap(fast)!==null)txt+=` ${nm(fast)} set the quickest lap at ${fmt(secLap(fast))} seconds.`;
   ps.push(txt);
   const movers=order.filter(r=>valid(r.start_position)&&r.start_position>0&&Number(r.start_position)-position(r)>=2).sort((a,b)=>(Number(b.start_position)-position(b))-(Number(a.start_position)-position(a)));
   if(movers[0]&&movers[0].driver!==w.driver){const m=movers[0];ps.push(`${nm(m)} also made ground in ${heat.name}, moving from P${m.start_position} to P${position(m)} — ${m.start_position-position(m)} places gained.`)}
  }
  add('The heats',ps);
 }

 const consis=sessions.filter(s=>s.kind==='consolation');
 if(consis.length){const ps=[];
  for(const s of consis){const order=sorted(s),w=order[0],p2=order[1],p3=order[2],fast=pace(s)[0];if(!w)continue;
   let txt=`${nm(w)} won ${s.name.toLowerCase()}${valid(w.start_position)&&w.start_position>0?` after starting P${w.start_position}`:''}.`;
   if(p2)txt+=` ${nm(p2)} followed in second${p3?`, with ${nm(p3)} third`:''}.`;
   if(fast)txt+=` The quickest lap was ${fmt(secLap(fast))} seconds from ${nm(fast)}.`;
   ps.push(txt);
   const wf=findDriver(s,win);if(wf&&position(wf)>0&&nm(wf)!==nm(w))ps.push(`${nm(win)} finished P${position(wf)} in this session before taking the Feature victory.`);
  }
  add('The road to the main event',ps);
 }

 const firstTwins=sessions.filter(s=>s.kind==='twin_feature_1');
 if(firstTwins.length){const ps=[];
  for(const s of firstTwins){const order=sorted(s),w=order[0],p2=order[1],p3=order[2],fast=pace(s)[0];if(!w)continue;
   let txt=`The Bomber Stocks opening twin Feature was won by ${nm(w)} in the #${w.car_number}${valid(w.start_position)&&w.start_position>0?` from P${w.start_position}`:''}.`;
   if(p2)txt+=` ${nm(p2)} finished second${p3?` and ${nm(p3)} third`:''}.`;
   if(fast)txt+=` ${nm(fast)} posted the quickest lap at ${fmt(secLap(fast))} seconds.`;
   ps.push(txt);
   const fin=featurePlace(w);if(fin!==null&&Number(fin)>0&&nm(w)!==nm(win))ps.push(`${nm(w)} finished P${fin} in the subsequent Feature.`);
   const fw=findDriver(s,win);
   if(fw&&position(fw)>0)ps.push(`The eventual Twin Feature 2 winner, ${nm(win)}, finished P${position(fw)} in the first twin before taking the second twin.`);
  }
  add('Twin Feature 1: the first main event',ps);
 }

 const warmups=sessions.filter(s=>String(s.name).toUpperCase()==='WARMUP');
 if(warmups.length){const ps=[];
  for(const s of warmups){const fast=pace(s),w=fast[0],r=fast[1];if(!w)continue;
   ps.push(`In the final warmup, ${nm(w)} was quickest at ${fmt(secLap(w))} seconds${r?`, with ${nm(r)} next at ${fmt(secLap(r))} seconds`:''}.`);
  }
  add('Final preparations',ps);
 }


 if(!sections.length)return '';
 return `<section class="longform-story" id="race-day-story"><div class="longform-head"><span class="eyebrow">MUD MULES TV / EARLIER IN THE NIGHT</span><h2>BEFORE THE FEATURE</h2><p class="longform-standfirst">${esc(entry.series)} · Round ${esc(entry.round)} · ${esc(entry.track)} · ${esc(fmtDay(entry.event_date))}</p><div class="longform-meta"><span>${sessions.length} sessions covered</span><a href="#race-meeting">Jump to session results ↓</a></div></div><div class="longform-body">${sections.map((section,i)=>`<section class="longform-part"><h3>${esc(section.label)}</h3>${section.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</section>`).join('')}</div></section>`;
}

function stageTable(s){
 const rows=s.classification||[];
 if(!rows.length)return '';
 return `<div class="table-wrap"><table><thead><tr><th>POS</th><th>CAR</th><th>DRIVER</th><th>START</th><th>+/-</th><th>LAPS</th><th>LED</th><th>BEST LAP</th><th>INC</th><th>STATUS</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.position??'—')}</b></td><td><span class="number-tag">${esc(r.car_number||'—')}</span></td><td class="driver-cell">${driverStats.driverLink(r.driver)}</td><td>${esc(r.start_position??'—')}</td><td>${r.positions_gained===null||r.positions_gained===undefined?'—':formatDelta(r.positions_gained)}</td><td>${esc(r.laps_completed??'—')}</td><td>${esc(r.laps_led??'—')}</td><td>${cleanBest(r)?cleanBest(r).toFixed(4)+'s':'—'}</td><td>${esc(r.incidents??'—')}</td><td>${esc(r.reason_out||'—')}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderMeeting(meeting,entry){
 if(!meeting)return '';
 const sessions=[...meeting.sessions].filter(s=>s.available&&Array.isArray(s.classification)&&s.classification.length).sort((a,b)=>a.simsession_number-b.simsession_number);
  const summaries=sessions.map(s=>`${stageNames[s.kind]||s.name}: ${s.classification?.length||0}`).join(' · ');
 return `<section class="meeting-coverage" id="race-meeting"><div class="result-header"><div><span class="eyebrow">THE COMPLETE EVENT</span><h2>FROM PRACTICE TO THE CHEQUERED FLAG</h2></div><span class="chip">${sessions.length} SESSIONS</span></div><p class="meeting-intro">The complete race meeting at ${esc(entry.track)}, from practice through the final chequered flag.</p><div class="meeting-jump">${sessions.map((s,i)=>`<a href="#meeting-stage-${i}" data-stage-jump="${i}">${esc(stageName(s))}</a>`).join('')}</div>${sessions.map((s,i)=>{
 const isFinal=s.kind==='feature'||s.kind==='twin_feature_2';
 const shouldSkipTable=isFinal&&sessions.some(x=>x.kind==='feature'||x.kind==='twin_feature_2');
 return `<section class="meeting-stage" id="meeting-stage-${i}"><div class="stage-heading"><span class="stage-count">${String(i+1).padStart(2,'0')}</span><div><span class="eyebrow">${esc(stageNames[s.kind]||'RACE SESSION')}</span><h3>${esc(stageName(s))}</h3></div><span class="chip">${s.classification?.length||0} DRIVERS</span></div>${shouldSkipTable?'<p class="result-note">Full feature results are below.</p>':stageTable(s)}</section>`
 }).join('')}</section>`;
}
function formatDelta(n){const val=Number(n);if(!Number.isFinite(val))return '—';return `<span class="${val>0?'delta-up':val<0?'delta-down':'delta-flat'}">${val>0?'+':''}${val}</span>`}
function rankSort(rows,by){const output=[...rows];if(by==='start')output.sort((a,b)=>Number(a.start_position)-Number(b.start_position));else if(by==='gained')output.sort((a,b)=>(Number(b.positions_gained??b.start_position-b.finish_position))-(Number(a.positions_gained??a.start_position-a.finish_position)));else if(by==='fastest')output.sort((a,b)=>(Number(a.best_lap_seconds)||Infinity)-(Number(b.best_lap_seconds)||Infinity));else if(by==='led')output.sort((a,b)=>Number(b.laps_led)-Number(a.laps_led));else output.sort((a,b)=>Number(a.finish_position)-Number(b.finish_position));return output}
function tableRows(event){const tbody=document.getElementById('result-body');if(!tbody)return;const rows=rankSort(event.feature_results,state.sort);tbody.innerHTML=rows.map(r=>{const gain=r.positions_gained!==null&&r.positions_gained!==undefined?Number(r.positions_gained):r.start_position!=null?r.start_position-r.finish_position:null;return `<tr><td><b>${esc(r.finish_position)}</b></td><td><span class="number-tag">${esc(r.car_number)}</span></td><td class="driver-cell">${driverStats.driverLink(r.driver)}</td><td>${esc(r.start_position??'—')}</td><td>${gain===null?'—':formatDelta(gain)}</td><td>${esc(r.laps_completed??'—')}</td><td>${esc(r.laps_led??'—')}</td><td>${r.best_lap_seconds!=null&&Number(r.best_lap_seconds)>0?Number(r.best_lap_seconds).toFixed(4)+'s':'—'}</td><td>${esc(r.incidents??'—')}</td><td>${esc(r.champ_points??'—')}</td><td>${esc(r.reason_out||'Not specified')}</td></tr>`}).join('')}
async function race(id){const entry=eventById(id);if(!entry){app.innerHTML='<div class="container section"><div class="empty">This race report is not available yet. <a href="#results">Return to archive ↗</a></div></div>';return}
 const a=editorial[String(id)]||seed.articles[String(id)];const headline=a?.headline||`${winner(entry)} takes ${entry.series} honours at ${entry.track}`;const deck=a?.deck||`Full race coverage from ${entry.track}.`;const bgnum=eventCache[String(id)]?.feature_results?.[0]?.car_number||'KHR';const full=seed.seriesTitles[entry.series]||entry.series;
 app.innerHTML=`<section class="page-banner"><span class="banner-number" aria-hidden="true">${esc(bgnum)}</span><div class="container"><div class="breadcrumb"><a href="#home">THE NEWSROOM</a><span>/</span><a href="#results">RESULTS</a><span>/</span> ROUND ${esc(entry.round)}</div><span class="eyebrow" style="margin-top:23px">${esc(a?.kicker||'MUD MULES TV RACE REPORT')} · ${esc(entry.series)}</span><h1>${esc(headline)}</h1><p class="deck">${esc(deck)}</p><div class="result-meta"><span>${esc(fmtDay(entry.event_date))}</span><span>${esc(entry.track)}</span><span>iRacing #${esc(id)}</span></div></div></section><div id="race-details" class="container section"><div class="loading">Loading race results…</div></div>`;
 const [event,meeting,broadcast]=await Promise.all([getEvent(id),getMeeting(id),getBroadcast(id)]);if(location.hash!==routeRace(id))return;
 if(!event){document.getElementById('race-details').innerHTML=`<div class="empty">The results could not be loaded. Try again in a moment. <a href="${sourceUrl(id)}" target="_blank" rel="noopener">Open the published race record ↗</a></div>`;return}
 const rows=event.feature_results||[];const podium=rows.filter(x=>x.finish_position<=3).sort((a,b)=>a.finish_position-b.finish_position);const validlaps=rows.filter(r=>r.best_lap_seconds!==null&&Number(r.best_lap_seconds)>0),fastest=validlaps.sort((a,b)=>a.best_lap_seconds-b.best_lap_seconds)[0],mostLed=[...rows].sort((a,b)=>b.laps_led-a.laps_led)[0],largest=[...rows].sort((a,b)=>(b.positions_gained??b.start_position-b.finish_position)-(a.positions_gained??a.start_position-a.finish_position))[0];const meta=event.event_summary||{};
 const meetingHtml=renderMeeting(meeting,entry);
 const editorialHtml=Array.isArray(a?.paragraphs)&&a.paragraphs.length?`<section class="mmtv-editorial"><span class="eyebrow">THE MUD MULES TV RACE REPORT</span>${a.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</section>`:'';
 const longformHtml=editorialHtml+renderLongformArticle(meeting,event,entry);
 const paragraphs=(a?.paragraphs||[`${displayName(rows[0]?.driver)} finished first in the published ${entry.series} Round ${entry.round} Feature at ${entry.track}. `]);
 document.getElementById('race-details').innerHTML=`${broadcastHtml(id,entry,broadcast)}<div class="stat-cards"><div class="stat"><strong>${esc(meta.event_laps_complete??'—')}</strong><span>Laps</span></div><div class="stat"><strong>${esc(rows.length)}</strong><span>Feature entries</span></div><div class="stat"><strong>${esc(meta.num_cautions??'—')}</strong><span>Cautions</span></div><div class="stat"><strong>${esc(mostLed?.laps_led??'—')}</strong><span>Most laps led</span></div></div><div class="article-layout"><article class="article-copy">${longformHtml||paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}<div class="result-meta"><span>FASTEST LAP <strong>${fastest?`${Number(fastest.best_lap_seconds).toFixed(4)}s — ${esc(displayName(fastest.driver))}`:'—'}</strong></span><span>BIGGEST GAIN <strong>${largest && (largest.positions_gained!=null || largest.start_position!=null)?`+${largest.positions_gained??largest.start_position-largest.finish_position} — ${esc(displayName(largest.driver))}`:'—'}</strong></span></div></article><aside class="article-side"><div class="panel"><span class="card-label">THE PODIUM</span><h3>TOP THREE</h3>${podium.map(p=>`<div class="podium"><span class="place">${p.finish_position}</span><div><b>${driverStats.driverLink(p.driver)}</b><small>#${esc(p.car_number)} · Started P${esc(p.start_position)}</small></div></div>`).join('')}</div><div class="panel"><span class="card-label">RACE DETAILS</span><h3>THE RESULTS</h3><p class="source">${esc(entry.series)} · Round ${esc(entry.round)}<br>${esc(entry.track)}</p><a href="${sourceUrl(id)}" target="_blank" rel="noopener">VIEW RACE RECORD ↗</a></div></aside></div>${meetingHtml}<section class="result-section" id="classification"><div class="result-header"><div><span class="eyebrow">HOW THEY FINISHED</span><h2>FINAL FEATURE RESULTS</h2></div><span class="chip">${esc(rows.length)} DRIVERS</span></div><div class="table-actions"><label for="table-sort" style="font-size:12px;color:#aaa">SORT BY</label><select id="table-sort"><option value="finish">Finishing position</option><option value="start">Starting position</option><option value="gained">Positions gained</option><option value="fastest">Fastest lap</option><option value="led">Laps led</option></select><button class="btn-light" id="copy-results" type="button">COPY RESULTS</button></div><div class="table-wrap"><table><thead><tr><th>FIN</th><th>CAR</th><th>DRIVER</th><th>START</th><th>+/-</th><th>LAPS</th><th>LED</th><th>BEST LAP</th><th>INC</th><th>PTS</th><th>STATUS</th></tr></thead><tbody id="result-body"></tbody></table></div><p class="result-note">Full session results are listed above.</p><div class="result-meta"><span>COMPETITION <strong>${esc(seasonName(entry))}</strong></span><span>TRACK <strong>${esc(entry.track)}</strong></span></div><div style="margin-top:30px"><a class="button-link" href="#results">MORE RACE RESULTS</a></div></section>`;
 state.sort='finish';tableRows(event);
 document.getElementById('table-sort').addEventListener('change',e=>{state.sort=e.target.value;tableRows(event)});
 document.getElementById('copy-results').addEventListener('click',async()=>{const txt=`${entry.series} R${entry.round} | ${entry.track}\n${rankSort(rows,'finish').map(r=>`${r.finish_position}. #${r.car_number} ${displayName(r.driver)} (start ${r.start_position}, laps ${r.laps_completed}, led ${r.laps_led})`).join('\n')}\nSource: ${sourceUrl(id)}`;try{await navigator.clipboard.writeText(txt);document.getElementById('copy-results').textContent='COPIED ✓'}catch(e){const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();document.getElementById('copy-results').textContent='COPIED ✓'}});
}
function route(){const hash=decodeURIComponent(location.hash.slice(1)||'home');const [page,id]=hash.split('/');document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===(page==='race'?'results':page==='driver'?'drivers':page==='broadcast'?'broadcasts':page)));window.scrollTo({top:0,behavior:'instant'});if(page==='broadcasts')broadcastLibrary.library();else if(page==='broadcast'&&/^[A-Za-z0-9_-]{11}$/.test(id||''))broadcastLibrary.recording(id);else if(page==='standings')driverStats.standings(id);else if(page==='drivers')driverStats.roster();else if(page==='driver'&&id)driverStats.profile(decodeURIComponent(location.hash.slice('#driver/'.length)));else if(page==='results')results();else if(page==='championships')championships();else if(page==='race'&&/^\d{7,12}$/.test(id||''))race(id);else home();}
document.addEventListener('change',e=>{if(e.target.id==='filter-season'){state.season=e.target.value;updateResults()}if(e.target.id==='filter-series'){state.series=e.target.value;updateResults()}if(e.target.id==='filter-round'){state.round=e.target.value;updateResults()}});
document.addEventListener('input',e=>{if(e.target.id==='filter-search'){state.search=e.target.value;updateResults()}});
document.addEventListener('click',e=>{const link=e.target.closest('.series-go');if(link){state.series=link.dataset.series;state.season='all';state.round='all';state.search='';}});
window.addEventListener('hashchange',route);
async function init(){
 route();if(location.protocol==='file:')return;
 let official=seed.index.events;
 try{
  const r=await fetch('../archive/index.json',{cache:'no-store'});
  if(r.ok){const j=await r.json();if(j.status==='published_official_backed'&&Array.isArray(j.events)&&j.events.length>=seed.index.events.length)official=j.events;}
 }catch(e){}
 let live=[];
 try{
  const r=await fetch('data/live/index.json',{cache:'no-store'});
  if(r.ok){const j=await r.json();if(j.schema_version==='MMTV-live-index-v1'&&Array.isArray(j.events))live=j.events.filter(e=>e.verification==='live_captured'&&Number.isInteger(Number(e.subsession_id)));}
 }catch(e){}
 const merged=new Map(official.map(e=>[Number(e.subsession_id),e]));
 live.forEach(e=>{merged.set(Number(e.subsession_id),e);liveIds.add(Number(e.subsession_id));});
 publishedIndex={...seed.index,events:[...merged.values()],event_count:merged.size};
 route();
}
init();
})();
