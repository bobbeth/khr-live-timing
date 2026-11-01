(() => {
'use strict';
const seed = window.MMTV_SEED;
const app = document.getElementById('app');
let publishedIndex = seed.index;
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
const sourceUrl = id => `https://github.com/bobbeth/khr-live-timing/blob/main/archive/events/${encodeURIComponent(id)}.json`;
const sortDate = (a,b) => a.event_date.localeCompare(b.event_date) || a.round-b.round;
const winner = e => displayName(e.winners?.[0]?.driver||'Awaiting result');
function eventList(){return [...publishedIndex.events].sort(sortDate)}
function cards(events){return events.map((e,i) => {
 const a=seed.articles[String(e.subsession_id)],title=a?.headline||`${winner(e)} takes ${e.series} Round ${e.round}`,deck=a?.deck||`${e.track} · Official-backed Feature classification available.`,num=e.winners?.[0]?.car_number|| (seed.records[String(e.subsession_id)]?.feature_results?.[0]?.car_number || String(i+1).padStart(2,'0'));
 return `<a class="story-card" href="${routeRace(e.subsession_id)}"><div class="story-graphic"><span class="flag">ROUND ${esc(e.round)} / ${esc(e.series)}</span><span class="big-number">${esc(num)}</span></div><div class="story-content"><span class="label">${esc(e.series)} &nbsp; / &nbsp; ${esc(e.track)}</span><h3>${esc(title)}</h3><p>${esc(deck)}</p><div class="story-meta"><span>${esc(fmtDay(e.event_date))}</span><b>READ RACE REPORT ↗</b></div></div></a>`;
}).join('')}
function home(){const round1=eventList().filter(e=>e.round===1).sort((a,b)=>seriesNames.indexOf(a.series)-seriesNames.indexOf(b.series));const lead=round1[0]||eventList()[0];
 app.innerHTML = `<section class="hero"><div class="hero-inner"><div><span class="eyebrow">FALL FEST 2026 / ROUND ONE</span><h1>FIVE SERIES.<br><em>ONE BIG</em><br>OPENING ROUND.</h1><p>From a last-row charge at Oswego to McClain's Round 1 double, Mud Mules TV brings you the stories, classifications and numbers from Knuckle-Headz Racing League.</p><a class="button-link" href="${lead?routeRace(lead.subsession_id):'#results'}">READ THE LEAD STORY</a><div class="hero-stats"><div><strong>05</strong><span>Series covered</span></div><div><strong>${publishedIndex.events.length}</strong><span>Verified races</span></div><div><strong>${new Set(publishedIndex.events.map(e=>e.round)).size.toString().padStart(2,'0')}</strong><span>Rounds archived</span></div></div></div><aside class="week-card"><div class="card-label">OFFICIAL FEATURE WINNERS</div><h2>THE ROUND 1 RECAP</h2><div class="week-list">${round1.map((e,i)=>`<a class="week-link" href="${routeRace(e.subsession_id)}"><span class="num">0${i+1}</span><div><small>${esc(e.series)} · ${esc(e.track)}</small><strong>${esc(winner(e))}</strong></div><span class="arrow">↗</span></a>`).join('')}</div></aside></div></section>
 <section class="section container"><div class="section-head"><div><span class="eyebrow">FROM THE NEWSROOM</span><h2>ROUND 1 HEADLINES</h2></div><p>Complete meeting reports covering practice, qualifying, heats, consolation races and Features wherever official classifications are available.</p></div><div class="story-grid">${cards(round1)}</div></section>
 <section class="strip"><div class="strip-inner"><div><span class="strip-kicker">THE OPENING ROUND</span><h2>BY THE NUMBERS</h2></div><div class="strip-stat"><strong>58</strong><small>Feature classifications</small></div><div class="strip-stat"><strong>24</strong><small>Recorded cautions</small></div><div class="strip-stat"><strong>2</strong><small>McClain victories</small></div></div></section>
 <section class="section container"><div class="section-head"><div><span class="eyebrow">FROM THE VERIFIED ARCHIVE</span><h2>BEYOND ROUND ONE</h2></div><a class="tiny-link" href="#results">EXPLORE ALL RESULTS ↗</a></div><div class="archive-grid">${eventList().filter(e=>e.round>1).slice(0,8).map(archiveRow).join('')}</div></section>`;
}
function archiveRow(e){return `<a class="archive-row" href="${routeRace(e.subsession_id)}"><span class="round">R${esc(e.round)}</span><span><strong>${esc(displayName(winner(e)))}</strong><small>${esc(e.series)} · ${esc(e.track)}</small></span><span class="end">RESULTS ↗</span></a>`}
function results(){app.innerHTML=`<div class="page-banner"><div class="container"><span class="eyebrow">THE OFFICIAL-BACKED DATA</span><h1>RACE RESULTS<br>& ARCHIVE</h1><p class="deck">Find all published KHR race classifications by series or round. Future verified events are pulled from the published archive whenever the site is online.</p></div></div><div class="container section"><div class="section-head"><div><span class="eyebrow">FALL FEST 2026</span><h2>EVENT DIRECTORY</h2></div><span class="chip">OFFICIAL-BACKED CLASSIFICATIONS ONLY</span></div><div class="filterbar"><label for="filter-season">SEASON</label><select id="filter-season"><option value="all">All competitions</option>${[...new Set(eventList().map(seasonName))].map(name=>`<option value="${esc(name)}" ${state.season===name?'selected':''}>${esc(name)}</option>`).join('')}</select><label for="filter-series">SERIES</label><select id="filter-series"><option value="all">All championships</option>${allSeries().map(s=>`<option value="${esc(s)}" ${state.series===s?'selected':''}>${esc(s)}</option>`).join('')}</select><label for="filter-round">ROUND</label><select id="filter-round"><option value="all">All rounds</option>${[...new Set(eventList().map(e=>e.round))].map(n=>`<option value="${n}" ${state.round===String(n)?'selected':''}>Round ${n}</option>`).join('')}</select><input type="search" id="filter-search" placeholder="Search drivers, tracks or series" aria-label="Search race results" value="${esc(state.search)}"><span class="filter-count" id="filter-count"></span></div><div id="filtered-list" class="archive-grid"></div><p class="result-note">Official-backed results only. New events appear after they are verified and published; live-only classifications are intentionally excluded.</p></div>`; updateResults()}
function updateResults(){const matches=eventList().filter(e=>(state.season==='all'||seasonName(e)===state.season)&&(state.series==='all'||e.series===state.series)&&(state.round==='all'||String(e.round)===state.round)&&(!state.search||[e.series,e.track,winner(e),String(e.subsession_id)].join(' ').toLowerCase().includes(state.search.toLowerCase())));const node=document.getElementById('filtered-list');if(node){node.innerHTML=matches.length?matches.map(archiveRow).join(''):'<div class="empty">No verified race matches those filters.</div>';document.getElementById('filter-count').textContent=`${matches.length} OF ${publishedIndex.events.length} RACES`}}
function championships(){const all=eventList();app.innerHTML=`<div class="page-banner"><div class="container"><span class="eyebrow">MUD MULES TV COVERAGE</span><h1>THE<br>CHAMPIONSHIPS</h1><p class="deck">Five KHR racing championships. One independent newsroom. Browse results from every series and every published round.</p></div></div><div class="container section"><div class="section-head"><div><span class="eyebrow">KNUCKLE-HEADZ RACING LEAGUE</span><h2>FALL FEST 2026</h2></div></div><div class="series-grid">${seriesNames.map(s=>{const races=all.filter(e=>e.series===s);return `<div class="series-card"><span class="sub">${races.length} VERIFIED EVENTS · FALL FEST 2026</span><h3>${esc(seed.seriesTitles[s])}</h3><p>${races.map(e=>`R${e.round}: ${e.track}`).join(' · ')}</p><a href="#results" class="series-go" data-series="${esc(s)}">VIEW SERIES RESULTS ↗</a></div>`}).join('')}</div><div class="empty" style="margin-top:30px">Mud Mules TV is designed to cover future KHR championships and older competitions too. Titles for subsequent seasons will be added from verified season metadata rather than assuming they are also called Fall Fest.</div></div>`}
async function getEvent(id){const key=String(id);if(location.protocol !== 'file:'){
 try{const response=await fetch(`../archive/events/${encodeURIComponent(key)}.json`,{cache:'no-store'});if(response.ok){const j=await response.json();if(j.verification==='official_backed'&&Number(j.subsession_id)===Number(id)&&Array.isArray(j.feature_results)){eventCache[key]=j;return j;}}}catch(e){}
}return eventCache[key]||null}
// Full meeting records are published separately from the Feature-only archive.
async function getMeeting(id){
 if(location.protocol==='file:')return null;
 try{
   const r=await fetch(`data/meetings/${encodeURIComponent(id)}.json`,{cache:'no-store'});
   if(!r.ok)return null;
   const j=await r.json();
   if(j.schema_version!=='MMTV-official-meeting-v2'||j.verification!=='official_backed'||Number(j.subsession_id)!==Number(id)||!Array.isArray(j.sessions))return null;
   return j;
 }catch(e){return null}
}
const stageNames={practice:'PRACTICE',qualifying:'QUALIFYING',heat:'HEAT RACING',consolation:'CONSOLATION / B-MAIN',twin_feature_1:'TWIN FEATURE 1',twin_feature_2:'TWIN FEATURE 2',feature:'FEATURE',warmup:'WARM-UP',race:'RACE SESSION',other:'OTHER OFFICIAL SESSION'};
const stageStat = (r,k) => Number.isFinite(Number(r[k])) && r[k]!==null ? Number(r[k]) : null;
const cleanBest = r => stageStat(r,'best_lap_seconds') ?? stageStat(r,'qual_lap_seconds');
const stageName = s => {
  if(s.kind==='twin_feature_1')return 'TWIN FEATURE 1 — B-MAIN';
  if(s.kind==='twin_feature_2')return 'TWIN FEATURE 2 — FEATURE';
  return String(s.name||stageNames[s.kind]||'Official session');
};
function stageNarrative(s){
 const rows=(s.classification||[]).filter(r=>r&&r.driver);
 const order=rows.filter(r=>r.position!=null).sort((a,b)=>a.position-b.position);
 const timed=rows.filter(r=>cleanBest(r)>0).sort((a,b)=>cleanBest(a)-cleanBest(b));
 const winner=order[0], fastest=timed[0], second=order[1], third=order[2];
 const movers=order.filter(r=>stageStat(r,'positions_gained')>0).sort((a,b)=>b.positions_gained-a.positions_gained);
 const leaders=rows.filter(r=>stageStat(r,'laps_led')>0).sort((a,b)=>b.laps_led-a.laps_led);
 const stage=stageName(s), p=[];
 if(s.kind==='practice'){
   if(fastest)p.push(`${displayName(fastest.driver)} topped ${stage.toLowerCase()} with a best lap of ${cleanBest(fastest).toFixed(4)} seconds in the #${fastest.car_number||'—'}.`);
   if(timed[1])p.push(`${displayName(timed[1].driver)} was next quickest at ${cleanBest(timed[1]).toFixed(4)} seconds, ${((cleanBest(timed[1])-cleanBest(fastest))).toFixed(4)} seconds behind.`);
   return p;
 }
 if(s.kind==='qualifying'){
   if(winner)p.push(`${displayName(winner.driver)} headed qualifying in the #${winner.car_number||'—'}${cleanBest(winner)?` with a ${cleanBest(winner).toFixed(4)}-second lap`:''}.`);
   if(second)p.push(`${displayName(second.driver)} qualified second${third?`, ahead of ${displayName(third.driver)} in third`:''}.`);
   return p;
 }
 if(winner)p.push(`${displayName(winner.driver)} won ${stage.toLowerCase()}${second?` ahead of ${displayName(second.driver)}`:''}${third?` and ${displayName(third.driver)} in third`:''}.`);
 if(movers[0])p.push(`${displayName(movers[0].driver)} gained ${movers[0].positions_gained} position${movers[0].positions_gained===1?'':'s'}, moving from P${movers[0].start_position} to P${movers[0].position}.`);
 if(leaders[0])p.push(`${displayName(leaders[0].driver)} led ${leaders[0].laps_led} lap${leaders[0].laps_led===1?'':'s'}${fastest?`, while ${displayName(fastest.driver)} set the fastest lap at ${cleanBest(fastest).toFixed(4)} seconds`:''}.`);
 else if(fastest)p.push(`${displayName(fastest.driver)} set the fastest lap at ${cleanBest(fastest).toFixed(4)} seconds.`);
 return p;
}
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
 const totalLaps=valid(summary.event_laps_complete)&&summary.event_laps_complete>0?Number(summary.event_laps_complete):Number(win.laps_completed||0);
 const leadCount=Number(win.laps_led)||0;
 const featureFastest=feature.filter(r=>secLap(r)!==null).sort((a,b)=>secLap(a)-secLap(b))[0];
 const biggest=feature.filter(r=>progress(r)>0).sort((a,b)=>progress(b)-progress(a))[0];
 const rivals=feature.filter(r=>r!==win).sort((a,b)=>(Number(b.laps_led)||0)-(Number(a.laps_led)||0))[0];
 const opener=[];
 const winStart=Number(win.start_position);
 opener.push(`${nm(win)} emerged from ${entry.track} as the ${entry.series} Round ${entry.round} winner, bringing the #${win.car_number} home first${valid(win.start_position)&&winStart>0?` after starting P${winStart}`:''}. ${runner?`${nm(runner)} took second${third?`, with ${nm(third)} third`:''}.`:''} The result capped a meeting featuring ${sessions.length} classified sessions, from the early running through to the final chequered flag.`);
 if(totalLaps>0)opener.push(`The decisive result came over ${totalLaps} recorded laps. ${leadCount>0?`${nm(win)} was credited with ${leadCount} lap${leadCount===1?'':'s'} out front — ${Math.round(leadCount/totalLaps*100)}% of the race distance.`:''} ${progress(win)>0?`The winning drive was worth ${progress(win)} places gained from the starting position.`:''}`);
 add('The race-day picture',opener);

 const practices=sessions.filter(s=>s.kind==='practice'&&String(s.name).toUpperCase()!=='WARMUP');
 if(practices.length){
  const pp=[];
  for(const s of practices){const fast=pace(s),w=fast[0],r=fast[1],t=fast[2];
   if(w){let txt=`${nm(w)} put the #${w.car_number} at the head of ${s.name.toLowerCase()} with a ${fmt(secLap(w))}-second lap.`;
    if(r)txt+=` ${nm(r)} was next quickest at ${fmt(secLap(r))}, ${fmt(secLap(r)-secLap(w))} seconds adrift${t?`, followed by ${nm(t)} on ${fmt(secLap(t))}`:''}.`;
    if(!r)txt+=` It was the fastest lap from ${s.classification.length} classified entries.`;
    pp.push(txt);
    const fin=featurePlace(w);if(fin!==null&&Number(fin)>0&&nm(w)!==nm(win))pp.push(`The early pace setter ${nm(w)} would ultimately finish P${fin} in the Feature.`);
   }
   const fw=findDriver(s,win);
   if(fw&&secLap(fw)!==null&&fast[0]&&nm(fast[0])!==nm(win)){
    const p=fast.findIndex(r=>r===fw)+1;
    if(p>0)pp.push(`Eventual winner ${nm(win)} recorded a ${fmt(secLap(fw))}-second practice lap, ${p===1?'leading the timing':`ranking ${p}${p===2?'nd':p===3?'rd':'th'} on lap pace`} among the drivers with a time.`);
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
   if(qw&&position(qw)>0&&position(qw)!==1)ps.push(`${nm(win)} qualified P${position(qw)}${secLap(qw)!==null?` with a ${fmt(secLap(qw))}-second lap`:''}, before the preliminary races reshaped the order.`);
  }
  add('Qualifying: the early pecking order',ps);
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
   const fin=featurePlace(w);if(fin!==null&&Number(fin)>0)ps.push(`${nm(w)} went on to finish P${fin} in the night's final Feature.`);
   const movers=order.filter(r=>valid(r.start_position)&&r.start_position>0&&Number(r.start_position)-position(r)>=2).sort((a,b)=>(Number(b.start_position)-position(b))-(Number(a.start_position)-position(a)));
   if(movers[0]&&movers[0].driver!==w.driver){const m=movers[0];ps.push(`${nm(m)} also made ground in ${heat.name}, moving from P${m.start_position} to P${position(m)} — ${m.start_position-position(m)} places gained.`)}
  }
  const winnerHeats=heats.map(s=>({heat:s.name,row:findDriver(s,win)})).filter(x=>x.row&&position(x.row)>0);
  if(winnerHeats.length){const tw=winnerHeats.map(x=>`${x.heat} (P${position(x.row)})`).join(' and ');ps.push(`${nm(win)}'s preliminary results included ${tw}, before lining up P${win.start_position} for the final Feature.`)}
  add('The heats: a place on the grid',ps);
 }

 const consis=sessions.filter(s=>s.kind==='consolation');
 if(consis.length){const ps=[];
  for(const s of consis){const order=sorted(s),w=order[0],p2=order[1],p3=order[2],fast=pace(s)[0];if(!w)continue;
   let txt=`${nm(w)} headed the ${s.name.toLowerCase()} classification${valid(w.start_position)&&w.start_position>0?` after starting P${w.start_position}`:''}.`;
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
   let txt=`The Bomber Stocks opening twin Feature — recorded as the B-Main — was won by ${nm(w)} in the #${w.car_number}${valid(w.start_position)&&w.start_position>0?` from P${w.start_position}`:''}.`;
   if(p2)txt+=` ${nm(p2)} finished second${p3?` and ${nm(p3)} third`:''}.`;
   if(fast)txt+=` ${nm(fast)} posted the quickest lap at ${fmt(secLap(fast))} seconds.`;
   ps.push(txt);
   const fin=featurePlace(w);if(fin!==null&&Number(fin)>0&&nm(w)!==nm(win))ps.push(`${nm(w)} was classified P${fin} in the subsequent Feature.`);
   const fw=findDriver(s,win);
   if(fw&&position(fw)>0)ps.push(`The eventual Twin Feature 2 winner, ${nm(win)}, finished P${position(fw)} in the first twin before the second 25-lap race settled the night's final result.`);
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

 const fp=[];
 const finalLabel=entry.series==='Bomber Stocks'?'Twin Feature 2':'Feature';
 const winGain=progress(win);
 fp.push(`${nm(win)} converted a P${win.start_position} start into the ${finalLabel} victory in the #${win.car_number}.${winGain>0?` That was a gain of ${winGain} position${winGain===1?'':'s'} across the ${totalLaps}-lap contest.`:''}${leadCount>0?` ${nm(win)} also led ${leadCount} laps on the way to the chequered flag.`:''}`);
 if(runner){let txt=`${nm(runner)} took second in the #${runner.car_number}${valid(runner.start_position)&&runner.start_position>0?` after starting P${runner.start_position}`:''}.`;
   if(valid(runner.laps_led)&&runner.laps_led>0)txt+=` The runner-up was credited with ${runner.laps_led} laps in front.`;
   if(third)txt+=` ${nm(third)} completed the podium in the #${third.car_number}${valid(third.start_position)&&third.start_position>0?` from P${third.start_position}`:''}.`;
   fp.push(txt);
 }
 if(feature[3]){const next=feature.slice(3,6);fp.push(`Behind the podium, ${next.map((r,i)=>`${nm(r)} (#${r.car_number}) in P${r.finish_position}`).join(', ').replace(/, ([^,]*)$/,' and $1')} rounded out the next positions in the finishing order.`)}
 if(biggest&&nm(biggest)!==nm(win)){const g=progress(biggest);fp.push(`The largest gain away from the winning car belonged to ${nm(biggest)}, who climbed from P${biggest.start_position} to P${biggest.finish_position} — ${g} places.`)}
 else if(biggest){const secondMover=feature.filter(r=>nm(r)!==nm(win)&&progress(r)>0).sort((a,b)=>progress(b)-progress(a))[0];if(secondMover)fp.push(`${nm(secondMover)} was another notable mover, gaining ${progress(secondMover)} position${progress(secondMover)===1?'':'s'} to finish P${secondMover.finish_position}.`)}
 if(featureFastest)fp.push(`${nm(featureFastest)} had the fastest lap of the final at ${fmt(secLap(featureFastest))} seconds${nm(featureFastest)===nm(win)?', adding the pace-setting lap to the victory':` in the #${featureFastest.car_number}`}.`);
 if(rivals&&Number(rivals.laps_led)>0&&nm(rivals)!==nm(win))fp.push(`${nm(rivals)} was also a significant presence at the front, credited with ${rivals.laps_led} laps led before finishing P${rivals.finish_position}.`);
 if(valid(summary.num_cautions))fp.push(`The final event record lists ${summary.num_cautions} caution${Number(summary.num_cautions)===1?'':'s'}${Number(summary.num_cautions)===0?', completing the meeting without a recorded yellow':' across the meeting'}.`);
 const unfinished=feature.filter(r=>String(r.reason_out||'').toLowerCase()==='disconnected');
 if(unfinished.length)fp.push(`${unfinished.map(r=>`${nm(r)} (P${r.finish_position}, ${r.laps_completed} lap${r.laps_completed===1?'':'s'} completed)`).join('; ')} ${unfinished.length===1?'was':'were'} classified as disconnected.`);
 const short=feature.filter(r=>Number(r.laps_completed)<totalLaps && String(r.reason_out||'').toLowerCase()!=='disconnected');
 if(short.length&&short.length<=4)fp.push(`${short.map(r=>`${nm(r)} (P${r.finish_position}, ${r.laps_completed} laps)`).join('; ')} ${short.length===1?'was':'were'} classified short of the full race distance.`);
 add(`${finalLabel}: the race for the win`,fp);

 const closing=[];
 const full=feature.filter(r=>Number(r.laps_completed)>=totalLaps).length;
 if(full>0)closing.push(`${full} of the ${feature.length} classified Feature drivers completed the full ${totalLaps}-lap distance. ${nm(win)} leaves ${entry.track} with the Round ${entry.round} victory, ${runner?`${nm(runner)} with second place`:''}${third?` and ${nm(third)} with third`:''}.`);
 if(biggest&&winGain>0&&nm(biggest)===nm(win))closing.push(`With ${winGain} places made up on the way to the win, ${nm(win)} also recorded the largest start-to-finish gain of the Feature.`);
 add('The chequered flag and the final word',closing);
 const count=sections.reduce((sum,s)=>sum+s.paragraphs.join(' ').split(/\s+/).filter(Boolean).length,0);
 return `<section class="longform-story" id="race-day-story"><div class="longform-head"><span class="eyebrow">MUD MULES TV / THE COMPLETE RACE DAY</span><h2>THE STORY FROM PRACTICE TO THE FLAG</h2><p class="longform-standfirst">${esc(entry.series)} · Round ${esc(entry.round)} · ${esc(entry.track)} · ${esc(fmtDay(entry.event_date))}</p><div class="longform-meta"><span>${count.toLocaleString('en-AU')} words</span><span>${sessions.length} sessions covered</span><a href="#race-meeting">Jump to session results ↓</a></div></div><div class="longform-body">${sections.map((section,i)=>`<section class="longform-part"><h3>${esc(section.label)}</h3>${section.paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</section>`).join('')}</div></section>`;
}

function stageTable(s){
 const rows=s.classification||[];
 if(!rows.length)return '';
 return `<div class="table-wrap"><table><thead><tr><th>POS</th><th>CAR</th><th>DRIVER</th><th>START</th><th>+/-</th><th>LAPS</th><th>LED</th><th>BEST LAP</th><th>INC</th><th>STATUS</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.position??'—')}</b></td><td><span class="number-tag">${esc(r.car_number||'—')}</span></td><td class="driver-cell">${esc(displayName(r.driver))}</td><td>${esc(r.start_position??'—')}</td><td>${r.positions_gained===null||r.positions_gained===undefined?'—':formatDelta(r.positions_gained)}</td><td>${esc(r.laps_completed??'—')}</td><td>${esc(r.laps_led??'—')}</td><td>${cleanBest(r)?cleanBest(r).toFixed(4)+'s':'—'}</td><td>${esc(r.incidents??'—')}</td><td>${esc(r.reason_out||'—')}</td></tr>`).join('')}</tbody></table></div>`;
}
function meetingOverview(meeting){
 const sessions=(meeting.sessions||[]).filter(s=>s.available && Array.isArray(s.classification));
 const pick=(kind)=>sessions.find(s=>s.kind===kind);
 const practice=pick('practice'),qual=pick('qualifying');
 const heats=sessions.filter(s=>s.kind==='heat');
 const finish=sessions.filter(s=>['feature','twin_feature_2','race'].includes(s.kind)).slice(-1)[0];
 const paragraphs=[];
 if(practice){const best=practice.classification.filter(r=>cleanBest(r)>0).sort((a,b)=>cleanBest(a)-cleanBest(b))[0];
   if(best)paragraphs.push(`The meeting opened with ${displayName(best.driver)} showing the quickest recorded practice pace at ${cleanBest(best).toFixed(4)} seconds. That put the #${best.car_number||'—'} at the top of the available practice timing, before qualifying and the preliminary races established the running order.`);
 }
 if(qual){const order=[...qual.classification].filter(r=>r.position!=null).sort((a,b)=>a.position-b.position);
   if(order.length)paragraphs.push(`In qualifying, ${displayName(order[0].driver)} headed the official order${cleanBest(order[0])?` with a ${cleanBest(order[0]).toFixed(4)}-second lap`:''}. ${order[1]?`${displayName(order[1].driver)} qualified second${order[2]?` ahead of ${displayName(order[2].driver)}`:''}. `:''}`);
 }
 if(heats.length){const wins=heats.map(h=>{const w=h.classification.find(r=>r.position===1);return w?`${displayName(w.driver)} (${h.name})`:null}).filter(Boolean);
   if(wins.length)paragraphs.push(`${heats.length} Heat${heats.length===1?' was':'s were'} recorded. The Heat winners were ${wins.join('; ')}. `);
 }
 if(finish){const order=[...finish.classification].filter(r=>r.position!=null).sort((a,b)=>a.position-b.position),w=order[0];
   if(w)paragraphs.push(`The ${stageName(finish).toLowerCase()} went to ${displayName(w.driver)}${order[1]?`, with ${displayName(order[1].driver)} second`:''}${order[2]?` and ${displayName(order[2].driver)} third`:''}.`);
 }
 return paragraphs.length?`<section class="meeting-overview"><span class="eyebrow">THE STORY OF THE NIGHT</span><h3>HOW THE MEETING UNFOLDED</h3><div class="article-copy">${paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}</div></section>`:'';
}
function renderMeeting(meeting,entry){
 if(!meeting)return '';
 const sessions=[...meeting.sessions].filter(s=>s.available&&Array.isArray(s.classification)&&s.classification.length).sort((a,b)=>a.simsession_number-b.simsession_number);
  const summaries=sessions.map(s=>`${stageNames[s.kind]||s.name}: ${s.classification?.length||0}`).join(' · ');
 return `<section class="meeting-coverage" id="race-meeting"><div class="result-header"><div><span class="eyebrow">THE COMPLETE EVENT</span><h2>FROM PRACTICE TO THE CHEQUERED FLAG</h2></div><span class="chip">${sessions.length} OFFICIAL SESSIONS</span></div><p class="meeting-intro">The complete race meeting at ${esc(entry.track)}, from practice through the final chequered flag.</p>${meetingOverview(meeting)}<div class="meeting-jump">${sessions.map((s,i)=>`<a href="#meeting-stage-${i}" data-stage-jump="${i}">${esc(stageName(s))}</a>`).join('')}</div>${sessions.map((s,i)=>{
 const isFinal=s.kind==='feature'||s.kind==='twin_feature_2';
 const shouldSkipTable=isFinal&&sessions.some(x=>x.kind==='feature'||x.kind==='twin_feature_2');
 return `<section class="meeting-stage" id="meeting-stage-${i}"><div class="stage-heading"><span class="stage-count">${String(i+1).padStart(2,'0')}</span><div><span class="eyebrow">${esc(stageNames[s.kind]||'RACE SESSION')}</span><h3>${esc(stageName(s))}</h3></div><span class="chip">${s.classification?.length||0} DRIVERS</span></div>${stageNarrative(s).length?`<div class="article-copy stage-copy">${stageNarrative(s).map(p=>`<p>${esc(p)}</p>`).join('')}</div>`:''}${shouldSkipTable?'<p class="result-note">The comprehensive final Feature classification follows at the end of this report.</p>':stageTable(s)}</section>`
 }).join('')}</section>`;
}
function formatDelta(n){const val=Number(n);if(!Number.isFinite(val))return '—';return `<span class="${val>0?'delta-up':val<0?'delta-down':'delta-flat'}">${val>0?'+':''}${val}</span>`}
function rankSort(rows,by){const output=[...rows];if(by==='start')output.sort((a,b)=>Number(a.start_position)-Number(b.start_position));else if(by==='gained')output.sort((a,b)=>(Number(b.positions_gained??b.start_position-b.finish_position))-(Number(a.positions_gained??a.start_position-a.finish_position)));else if(by==='fastest')output.sort((a,b)=>(Number(a.best_lap_seconds)||Infinity)-(Number(b.best_lap_seconds)||Infinity));else if(by==='led')output.sort((a,b)=>Number(b.laps_led)-Number(a.laps_led));else output.sort((a,b)=>Number(a.finish_position)-Number(b.finish_position));return output}
function tableRows(event){const tbody=document.getElementById('result-body');if(!tbody)return;const rows=rankSort(event.feature_results,state.sort);tbody.innerHTML=rows.map(r=>{const gain=Number.isFinite(Number(r.positions_gained))?Number(r.positions_gained):r.start_position-r.finish_position;return `<tr><td><b>${esc(r.finish_position)}</b></td><td><span class="number-tag">${esc(r.car_number)}</span></td><td class="driver-cell">${esc(displayName(r.driver))}</td><td>${esc(r.start_position??'—')}</td><td>${formatDelta(gain)}</td><td>${esc(r.laps_completed??'—')}</td><td>${esc(r.laps_led??'—')}</td><td>${r.best_lap_seconds?Number(r.best_lap_seconds).toFixed(4)+'s':'—'}</td><td>${esc(r.incidents??'—')}</td><td>${esc(r.champ_points??'—')}</td><td>${esc(r.reason_out||'Not specified')}</td></tr>`}).join('')}
async function race(id){const entry=eventById(id);if(!entry){app.innerHTML='<div class="container section"><div class="empty">This race has not been published as a verified event. <a href="#results">Return to archive ↗</a></div></div>';return}
 const a=seed.articles[String(id)];const headline=a?.headline||`${winner(entry)} takes ${entry.series} honours at ${entry.track}`;const deck=a?.deck||`Full race coverage from ${entry.track}.`;const bgnum=eventCache[String(id)]?.feature_results?.[0]?.car_number||'KHR';const full=seed.seriesTitles[entry.series]||entry.series;
 app.innerHTML=`<section class="page-banner"><span class="banner-number" aria-hidden="true">${esc(bgnum)}</span><div class="container"><div class="breadcrumb"><a href="#home">THE NEWSROOM</a><span>/</span><a href="#results">RESULTS</a><span>/</span> ROUND ${esc(entry.round)}</div><span class="eyebrow" style="margin-top:23px">${esc(a?.kicker||'OFFICIAL FEATURE RESULTS')} · ${esc(entry.series)}</span><h1>${esc(headline)}</h1><p class="deck">${esc(deck)}</p><div class="result-meta"><span>${esc(fmtDay(entry.event_date))}</span><span>${esc(entry.track)}</span><span>iRacing #${esc(id)}</span></div></div></section><div id="race-details" class="container section"><div class="loading">Loading verified race results…</div></div>`;
 const [event,meeting]=await Promise.all([getEvent(id),getMeeting(id)]);if(location.hash!==routeRace(id))return;
 if(!event){document.getElementById('race-details').innerHTML=`<div class="empty">This event's online classification could not be reached. <a href="${sourceUrl(id)}" target="_blank" rel="noopener">Open the official-backed GitHub record ↗</a></div>`;return}
 const rows=event.feature_results||[];const podium=rows.filter(x=>x.finish_position<=3).sort((a,b)=>a.finish_position-b.finish_position);const validlaps=rows.filter(r=>Number(r.best_lap_seconds)>0),fastest=validlaps.sort((a,b)=>a.best_lap_seconds-b.best_lap_seconds)[0],mostLed=[...rows].sort((a,b)=>b.laps_led-a.laps_led)[0],largest=[...rows].sort((a,b)=>(b.positions_gained??b.start_position-b.finish_position)-(a.positions_gained??a.start_position-a.finish_position))[0];const meta=event.event_summary||{};
 const meetingHtml=renderMeeting(meeting,entry);
 const longformHtml=renderLongformArticle(meeting,event,entry);
 const paragraphs=(a?.paragraphs||[`${displayName(rows[0]?.driver)} finished first in the published ${entry.series} Round ${entry.round} Feature at ${entry.track}. `]);
 document.getElementById('race-details').innerHTML=`<div class="stat-cards"><div class="stat"><strong>${esc(meta.event_laps_complete??'—')}</strong><span>Recorded laps</span></div><div class="stat"><strong>${esc(rows.length)}</strong><span>Feature entries</span></div><div class="stat"><strong>${esc(meta.num_cautions??'—')}</strong><span>Cautions</span></div><div class="stat"><strong>${esc(mostLed?.laps_led??'—')}</strong><span>Most laps led</span></div></div><div class="article-layout"><article class="article-copy">${longformHtml||paragraphs.map(p=>`<p>${esc(p)}</p>`).join('')}<div class="result-meta"><span>FASTEST LAP <strong>${fastest?`${Number(fastest.best_lap_seconds).toFixed(4)}s — ${esc(displayName(fastest.driver))}`:'—'}</strong></span><span>BIGGEST GAIN <strong>${largest?`+${largest.positions_gained??largest.start_position-largest.finish_position} — ${esc(displayName(largest.driver))}`:'—'}</strong></span></div></article><aside class="article-side"><div class="panel"><span class="card-label">THE PODIUM</span><h3>TOP THREE</h3>${podium.map(p=>`<div class="podium"><span class="place">${p.finish_position}</span><div><b>${esc(displayName(p.driver))}</b><small>#${esc(p.car_number)} · Started P${esc(p.start_position)}</small></div></div>`).join('')}</div><div class="panel"><span class="card-label">DATA PROVENANCE</span><h3>VERIFIED SOURCE</h3><p class="source">Classification: <b>official-backed</b><br>Subsession: ${esc(id)}<br>Archive: KHR canonical → published results export.</p><a href="${sourceUrl(id)}" target="_blank" rel="noopener">VIEW SOURCE RECORD ↗</a></div></aside></div>${meetingHtml}<section class="result-section" id="classification"><div class="result-header"><div><span class="eyebrow">THE NUMBERS, NO GUESSWORK</span><h2>FINAL FEATURE CLASSIFICATION</h2></div><span class="chip">${esc(rows.length)} CLASSIFIED DRIVERS</span></div><div class="table-actions"><label for="table-sort" style="font-size:12px;color:#aaa">SORT BY</label><select id="table-sort"><option value="finish">Finishing position</option><option value="start">Starting position</option><option value="gained">Positions gained</option><option value="fastest">Fastest lap</option><option value="led">Laps led</option></select><button class="btn-light" id="copy-results" type="button">COPY RESULTS</button></div><div class="table-wrap"><table><thead><tr><th>FIN</th><th>CAR</th><th>DRIVER</th><th>START</th><th>+/-</th><th>LAPS</th><th>LED</th><th>BEST LAP</th><th>INC</th><th>PTS</th><th>STATUS</th></tr></thead><tbody id="result-body"></tbody></table></div><p class="result-note">Source: official-backed KHR published Feature result. Caution laps do not count. Explore the complete session results above.</p><div class="result-meta"><span>PROVENANCE <strong>KHR PUBLIC RESULTS V1</strong></span><span>COMPETITION <strong>FALL FEST 2026</strong></span><span>TRACK <strong>${esc(entry.track)}</strong></span></div><div style="margin-top:30px"><a class="button-link" href="#results">MORE RACE RESULTS</a></div></section>`;
 state.sort='finish';tableRows(event);
 document.getElementById('table-sort').addEventListener('change',e=>{state.sort=e.target.value;tableRows(event)});
 document.getElementById('copy-results').addEventListener('click',async()=>{const txt=`${entry.series} R${entry.round} | ${entry.track}\n${rankSort(rows,'finish').map(r=>`${r.finish_position}. #${r.car_number} ${displayName(r.driver)} (start ${r.start_position}, laps ${r.laps_completed}, led ${r.laps_led})`).join('\n')}\nSource: ${sourceUrl(id)}`;try{await navigator.clipboard.writeText(txt);document.getElementById('copy-results').textContent='COPIED ✓'}catch(e){const ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();document.getElementById('copy-results').textContent='COPIED ✓'}});
}
function route(){const hash=decodeURIComponent(location.hash.slice(1)||'home');const [page,id]=hash.split('/');document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===(page==='race'?'results':page)));window.scrollTo({top:0,behavior:'instant'});if(page==='results')results();else if(page==='championships')championships();else if(page==='race'&&/^\d{7,12}$/.test(id||''))race(id);else home();}
document.addEventListener('change',e=>{if(e.target.id==='filter-season'){state.season=e.target.value;updateResults()}if(e.target.id==='filter-series'){state.series=e.target.value;updateResults()}if(e.target.id==='filter-round'){state.round=e.target.value;updateResults()}});
document.addEventListener('input',e=>{if(e.target.id==='filter-search'){state.search=e.target.value;updateResults()}});
document.addEventListener('click',e=>{const link=e.target.closest('.series-go');if(link){state.series=link.dataset.series;state.season='all';state.round='all';state.search='';}});
window.addEventListener('hashchange',route);
async function init(){route();if(location.protocol==='file:')return;try{const response=await fetch('../archive/index.json',{cache:'no-store'});if(!response.ok)throw new Error(String(response.status));const j=await response.json();if(j.status==='published_official_backed'&&Array.isArray(j.events)&&j.events.length>=seed.index.events.length){publishedIndex=j;route()}}catch(e){/* Offline or GitHub Pages not configured; use verified seed. */}}
init();
})();
