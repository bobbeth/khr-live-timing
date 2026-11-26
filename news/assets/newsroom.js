window.createMMTVNewsroom=function({app,entries,seasonName,esc,fmtDay,cards,editorial,winner,driverStats,broadcastLibrary,posterCards}){
 let version=0,timer=null,schedulePromise;
 const season='Fall Fest 2026';
 const seriesOrder=['Bomber Stocks','Cushion Kings','Mini Menaces','Yota Outlawz','Wide Open Revival'];
 const unique=items=>[...new Set(items)];
 function upcoming(schedule,races,now=new Date()){
  if(schedule?.schema_version!=='MMTV-schedule-v1')return [];
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:schedule.timezone||'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const completed=new Set(races.filter(e=>seasonName(e)===schedule.season).map(e=>e.series+'|'+e.round));
  const remaining=schedule.events.filter(e=>!completed.has(e.series+'|'+e.round)&&e.date>=today&&(!e.start_at||Date.parse(e.start_at)>now.getTime())).sort((a,b)=>a.date.localeCompare(b.date)||(a.start_at||'').localeCompare(b.start_at||'')||seriesOrder.indexOf(a.series)-seriesOrder.indexOf(b.series));
  return remaining.length?remaining.filter(e=>e.date===remaining[0].date):[];
 }
 function dualTime(instant){
  if(!instant||!Number.isFinite(Date.parse(instant)))return '';
  const options={weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'};
  const date=new Date(instant);
  const eastern=new Intl.DateTimeFormat('en-US',{...options,timeZone:'America/New_York'}).format(date);
  const hobart=new Intl.DateTimeFormat('en-AU',{...options,timeZone:'Australia/Hobart'}).format(date);
  return `<dl class="newsroom-times"><dt>US Eastern</dt><dd><time datetime="${esc(instant)}">${esc(eastern)}</time></dd><dt>Hobart</dt><dd><time datetime="${esc(instant)}">${esc(hobart)}</time></dd></dl>`;
 }
 const empty=(text,href,label)=>`<p class="result-note">${text}</p>${href?`<a class="text-link" href="${href}">${label} ↗</a>`:''}`;
 function featureStory(entry,headline,article,video){
  return `<span class="eyebrow">MUD MULES TV</span>${entry?`<p class="newsroom-latest-tag">${esc(entry.series)} · ROUND ${esc(entry.round)}</p>`:''}<h1>${esc(headline)}</h1><p>${esc(article?.deck||'Original dirt-track broadcasts, race reports and results.')}</p><div class="newsroom-actions">${video?`<a class="button-link" href="#broadcast/${video.id}">WATCH FULL REPLAY</a>`:''}${entry?`<a class="${video?'text-link':'button-link'}" href="#race/${entry.subsession_id}">READ RACE REPORT</a>`:''}${video?'':'<a class="text-link" href="#broadcasts">BROWSE BROADCASTS ↗</a>'}</div>${entry?`<span class="newsroom-lead-meta">${esc(fmtDay(entry.event_date))} · ${esc(entry.track)}</span>`:''}`;
 }
 function news(){
  ++version;if(timer){clearInterval(timer);timer=null;}
  const reports=[...entries()].sort((a,b)=>b.event_date.localeCompare(a.event_date)||b.subsession_id-a.subsession_id);
  const reviews=new Map();
  for(const entry of reports){
   const competition=seasonName(entry),round=Number(entry.round);
   if(competition==='Special Events'||!competition||!Number.isInteger(round)||round<1)continue;
   const key=competition+'/'+round;
   if(!reviews.has(key))reviews.set(key,{competition,round});
  }
  const recentReviews=[...reviews.values()].slice(0,6);
  app.innerHTML=`<section class="page-banner"><div class="container"><h1>NEWS</h1><p class="deck">Race reports and round reviews from Mud Mules TV.</p></div></section><div class="container newsroom-content"><section class="newsroom-section"><div class="section-head"><h2>RACE REPORTS</h2><a class="text-link" href="#results">RESULTS &amp; ARCHIVE ↗</a></div><div class="story-grid">${reports.length?cards(reports.slice(0,12)):empty('Race reports will appear here after publication.')}</div></section><section class="newsroom-section"><div class="section-head"><h2>ROUND REVIEWS</h2><a class="text-link" href="#rounds">ALL ROUND REVIEWS ↗</a></div><ul class="newsroom-review-links">${recentReviews.map(r=>`<li><a href="#round/${encodeURIComponent(r.competition)}/${r.round}">${esc(r.competition)} · Round ${r.round} ↗</a></li>`).join('')}</ul></section></div>`;
 }
 async function home(){
  const current=++version;if(timer){clearInterval(timer);timer=null;}
  const events=entries().filter(e=>seasonName(e)===season).sort((a,b)=>b.event_date.localeCompare(a.event_date)||b.subsession_id-a.subsession_id);
  const lead=events[0],recent=events.slice(1,4),article=lead?editorial[String(lead.subsession_id)]:null;
  const leadHeadline=article?.headline||(lead?`${winner(lead)} takes ${lead.series} Round ${lead.round}`:'The next chapter starts here.');
  app.innerHTML=`<section class="newsroom-hero"><div class="container newsroom-hero-grid"><div class="newsroom-lead" id="newsroom-featured-story">${featureStory(lead,leadHeadline,article)}</div><aside id="newsroom-latest-broadcast">${empty('Find race broadcasts and recordings.','#broadcasts','BROWSE BROADCASTS')}</aside></div></section>
<div class="container newsroom-content">
<section class="newsroom-next" id="newsroom-up-next" aria-labelledby="newsroom-up-next-title"><h2 id="newsroom-up-next-title">UP NEXT</h2><p class="result-note">Checking the race calendar…</p></section>
<section class="newsroom-section"><div class="section-head"><h2>LATEST HEADLINES</h2><a class="text-link" href="#news">ALL NEWS ↗</a></div><div class="story-grid">${recent.length?cards(recent):empty('Race reports will appear here as the season gets underway.')}</div></section>
<section class="newsroom-section"><div class="section-head"><h2>CHAMPIONSHIP CENTRAL</h2><a class="text-link" href="#championships">EXPLORE THE CHAMPIONSHIPS ↗</a></div><div class="ff-championship-grid">${posterCards(events)}</div><div id="newsroom-leaders" class="newsroom-leaders"><p class="result-note">Loading championship leaders…</p></div><p class="result-note">Provisional totals before drops. * Includes points calculated from the scoring rules.</p></section>
<section class="newsroom-section" id="newsroom-spotlight"><h2>DRIVER SPOTLIGHT</h2><p class="result-note">Loading the driver spotlight…</p></section>
<section class="newsroom-section"><div class="section-head"><h2>RACE CENTRE</h2></div><div class="newsroom-quick-links"><a class="text-link" href="#results">RESULTS &amp; ARCHIVE ↗</a><a class="text-link" href="#rounds">ROUND REVIEWS ↗</a><a class="text-link" href="#records">STATS &amp; RECORDS ↗</a><a class="text-link" href="#broadcasts">BROWSE BROADCASTS ↗</a></div><div class="newsroom-highlights" id="newsroom-highlights" aria-label="Latest round in numbers"><p class="result-note">Loading the latest round highlights…</p></div></section>
</div>`;
  const alive=()=>current===version&&['','#home'].includes(location.hash);
  const target=id=>alive()?document.getElementById(id):null;
  const getSchedule=()=>{if(!schedulePromise)schedulePromise=fetch('data/schedule.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>{schedulePromise=null;return null;});return schedulePromise;};
  const calendarTask=(async()=>{
   const schedule=await getSchedule(),box=target('newsroom-up-next');if(!box)return;
   const next=upcoming(schedule,events);
   const start=next.find(e=>Number.isFinite(Date.parse(e.start_at)))?.start_at;
   const day=next[0]?.date;
   const header=`<header class="newsroom-next-header"><h2 id="newsroom-up-next-title">UP NEXT</h2>${day?`<p class="newsroom-next-date"><time datetime="${esc(day)}">${esc(fmtDay(day))}</time> in Hobart</p>`:''}</header>`;
   const races=next.map(e=>{
    const track=e.track_id?`<a href="#track/${encodeURIComponent(e.track_id)}">${esc(e.track)}</a>`:esc(e.track);
    const times=dualTime(e.start_at)||'<p>Start times to be confirmed.</p>';
    return `<article class="newsroom-next-race"><span>Round ${esc(e.round)}</span><h3>${esc(e.series)}</h3><p>${track}</p>${times}</article>`;
   }).join('');
   const status=next.length
    ? (schedule.status==='weekly_schedule'?'Weekly schedule. Check league announcements for changes.':'')
    : (schedule?'No upcoming races are listed.':'Race schedule currently unavailable.');
   box.innerHTML=header
    +(races?`<div class="newsroom-next-races">${races}</div>`:'')
    +(status?`<p class="result-note">${status}</p>`:'')
    +`<div class="newsroom-next-footer">${start?'<p id="newsroom-countdown" class="newsroom-countdown" role="timer"></p>':''}<a class="text-link" href="https://www.youtube.com/@bobbethTV/streams" target="_blank" rel="noopener noreferrer">BobbethTV on YouTube ↗</a><a class="text-link" href="#calendar">Full season calendar ↗</a></div>`;
   if(start){
    const tick=()=>{
     if(!alive()){clearInterval(timer);timer=null;return;}
     const left=Math.max(0,Math.ceil((Date.parse(start)-Date.now())/1000));
     const days=Math.floor(left/86400),hours=Math.floor(left%86400/3600),minutes=Math.floor(left%3600/60);
     const duration=[days&&days+'d',hours&&hours+'h',minutes&&minutes+'m'].filter(Boolean).join(' ');
     const node=document.getElementById('newsroom-countdown');
     if(node)node.textContent=left===0?'Scheduled start time reached':`Next race starts in ${duration||left+'s'}`;
     if(!left){clearInterval(timer);timer=null;}
    };
    timer=setInterval(tick,1000);tick();
   }
  })();
  const broadcastTask=(async()=>{
   let videos;try{videos=await broadcastLibrary.load();}catch{}
   const box=target('newsroom-latest-broadcast');if(!box)return;
   const v=videos?.filter(v=>!v.inferred&&/^[A-Za-z0-9_-]{11}$/.test(v.id)&&v.races.some(r=>seasonName(r.entry)===season)).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id))[0];
   if(!v)return;
   const featured=v.races.filter(r=>seasonName(r.entry)===season).sort((a,b)=>b.entry.event_date.localeCompare(a.entry.event_date)||b.entry.subsession_id-a.entry.subsession_id)[0].entry;
   const report=editorial[String(featured.subsession_id)];
   const story=target('newsroom-featured-story');
   if(story)story.innerHTML=featureStory(featured,report?.headline||`${winner(featured)} takes ${featured.series} Round ${featured.round}`,report,v);
   box.innerHTML=`<a class="newsroom-broadcast newsroom-featured-replay" href="#broadcast/${v.id}"><div><img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="" referrerpolicy="no-referrer"><span>▶ WATCH THE REPLAY</span></div><section><h2>${esc(featured.track)}</h2><p>${esc(fmtDay(featured.event_date))} · Full broadcast</p></section></a>`;

  })();
  const statsTask=(async()=>{
   let data;try{data=await driverStats.load();}catch{}
   if(!alive())return;
   const leaders=target('newsroom-leaders'),spotlight=target('newsroom-spotlight'),highlights=target('newsroom-highlights');
   if(!data||data.failures.length){if(leaders)leaders.innerHTML=empty('The latest standings could not be loaded.','#standings','VIEW STANDINGS');if(spotlight)spotlight.innerHTML=empty('Meet the drivers and explore their race histories.','#drivers','DRIVER ROSTER');if(highlights)highlights.innerHTML=empty('Catch up with the latest racing.','#results','RACE RESULTS');return;}
   const standings=seriesOrder.map(series=>({series,rows:driverStats.rankings(data,season,series)}));
   if(leaders)leaders.innerHTML=standings.map(({series,rows})=>`<a class="newsroom-leader" href="#standings/${encodeURIComponent(series)}"><span class="sub">${esc(series)}</span>${rows.length?`<h3>${esc(rows[0].d.name)}</h3><strong>${rows[0].points}${rows[0].estimated?'*':''} <small>POINTS</small></strong><p>${rows[1]?`${rows[0].points-rows[1].points} points ${rows[0].points===rows[1].points?'between the joint leaders':'ahead of '+esc(rows[1].d.name)}`:'The first points are on the board.'}</p>`:'<p>No points yet.</p>'}<span class="text-link">FOLLOW THE CHASE ↗</span></a>`).join('');
   const active=data.drivers.filter(d=>d.profile?.pictureUrl&&d.races.some(r=>seasonName(r.entry)===season)).sort((a,b)=>a.name.localeCompare(b.name));
   // Rotate daily, rather than inventing an editorial endorsement or personal quote.
   const day=Math.floor(Date.now()/86400000),driver=active.length?active[day%active.length]:null;
   if(spotlight)spotlight.innerHTML=`<div class="section-head"><div><span class="eyebrow">THE PEOPLE BEHIND THE NUMBERS</span><h2>DRIVER SPOTLIGHT</h2></div><a class="text-link" href="#drivers">MEET THE DRIVERS ↗</a></div>`+(driver?(()=>{const p=driver.profile,photo=driverStats.safeProfileUrl(p.pictureUrl),races=driver.races.filter(r=>seasonName(r.entry)===season),m=driverStats.metrics(races),bio=String(p.bio||p.info||'').trim();return `<div class="newsroom-spotlight"><img src="${esc(photo)}" alt="${esc(driver.name)}" loading="lazy" referrerpolicy="no-referrer"><div><span class="eyebrow">${esc([...driver.numbers].map(n=>'#'+n).join(' / '))}</span><h3>${esc(driver.name)}</h3><p class="spotlight-team">${esc([p.team,p.hometown,p.country].filter(Boolean).join(' · '))}</p>${bio?`<p>${esc(bio.length>240?bio.slice(0,237)+'…':bio)}</p><span class="result-note">From the driver's supplied profile.</span>`:''}<div class="newsroom-spotlight-stats"><span><b>${m.starts}</b> STARTS</span><span><b>${m.wins}</b> WINS</span><span><b>${m.podiums}</b> PODIUMS</span></div><div class="newsroom-recent-form"><span class="eyebrow">RECENT RESULTS</span>${races.filter(r=>r.feature&&r.finish!=null).sort((a,b)=>b.entry.event_date.localeCompare(a.entry.event_date)||b.entry.subsession_id-a.entry.subsession_id).slice(0,3).map(r=>`<a href="#race/${r.entry.subsession_id}"><b>P${esc(r.finish)}</b> ${esc(r.entry.series)} · R${esc(r.entry.round)}</a>`).join('')}</div><a class="button-link" href="#driver/${encodeURIComponent(driver.id)}">MEET ${esc(driver.name)}</a></div></div>`;})():empty('Explore the drivers, their results and their stories.','#drivers','DRIVER ROSTER'));
   const round=events.length?Math.max(...events.map(e=>Number(e.round))):null,latest=events.filter(e=>Number(e.round)===round);
   const latestIds=new Set(latest.map(e=>e.subsession_id));
   const movers=data.drivers.flatMap(d=>d.races.filter(r=>latestIds.has(r.entry.subsession_id)&&r.feature&&r.gain!==null&&Number(r.gain)>0).map(r=>({name:d.name,gain:Number(r.gain)}))).sort((a,b)=>b.gain-a.gain);
   const closest=standings.filter(s=>s.rows.length>1).map(s=>({...s,gap:s.rows[0].points-s.rows[1].points})).sort((a,b)=>a.gap-b.gap)[0];
   if(highlights)highlights.innerHTML=round?`<div><span class="eyebrow">ROUND ${round} SO FAR</span><strong>${latest.length} / ${seriesOrder.length}</strong><p>Championship meetings published</p></div><div><span class="eyebrow">THE ROUND'S WINNERS</span><strong>${unique(latest.map(winner)).length}</strong><p>${esc(unique(latest.map(winner)).join(' · '))}</p></div><div><span class="eyebrow">BIGGEST CLIMB · ROUND ${round}</span><strong>${movers.length?'+'+movers[0].gain:'—'}</strong><p>${movers.length?esc(unique(movers.filter(m=>m.gain===movers[0].gain).map(m=>m.name)).join(' · ')):'No start-to-finish gain available yet.'}</p></div><div><span class="eyebrow">CLOSEST POINTS CHASE</span><strong>${closest?closest.gap+' PTS':'—'}</strong><p>${closest?esc(closest.series):'Standings to come.'}</p></div>`:empty('Round highlights will appear as results arrive.');
  })();
  await Promise.allSettled([calendarTask,broadcastTask,statsTask]);
 }
 return {home,news,upcoming,dualTime};
};
