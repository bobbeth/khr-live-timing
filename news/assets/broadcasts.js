window.createMMTVBroadcastLibrary=function({app,entries,seasonName,esc,fmtDay}){
 let pending,renderVersion=0;
 const filters={season:'all',series:'all',round:'all',search:'',order:'newest'};
 function build(index,races){
  const videos=new Map();
  if(index?.schema_version!=='MMTV-broadcast-links-v1'||!index.events)throw Error('Broadcast index unavailable');
  for(const race of new Map(races.map(r=>[String(r.subsession_id),r])).values()){
   const link=index.events[String(race.subsession_id)];
   if(!link||!/^[A-Za-z0-9_-]{11}$/.test(link.video_id||''))continue;
   if(!videos.has(link.video_id))videos.set(link.video_id,{id:link.video_id,races:[]});
   videos.get(link.video_id).races.push({entry:race,link});
  }
  return [...videos.values()].map(v=>({...v,races:v.races.sort((a,b)=>String(a.entry.event_date).localeCompare(String(b.entry.event_date))||a.entry.subsession_id-b.entry.subsession_id),date:v.races.map(r=>String(r.entry.event_date)).sort().at(-1),inferred:v.races.some(r=>r.link.match_status==='schedule_inferred')}));
 }
 async function load(){
  if(!pending)pending=fetch('data/broadcasts.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error();return r.json();}).catch(error=>{pending=null;throw error;});
  return build(await pending,entries());
 }
 const unique=values=>[...new Set(values)];
 const series=v=>unique(v.races.map(r=>r.entry.series));
 const rounds=v=>unique(v.races.map(r=>r.entry.round)).sort((a,b)=>a-b);
 const title=v=>series(v).join(' / ');
 const roundLabel=v=>`${rounds(v).length>1?'Rounds':'Round'} ${rounds(v).join(' / ')}`;
 const dates=v=>unique(v.races.map(r=>r.entry.event_date)).map(fmtDay).join(' / ');
 const watch=id=>'https://www.youtube.com/watch?v='+id;
 const header=(heading,deck)=>`<section class="page-banner"><div class="container"><span class="eyebrow">MUD MULES TV / BOBBETH TV</span><h1>${heading}</h1><p class="deck">${deck}</p></div></section>`;
 function matches(v,f){
  // The same race must satisfy all selected filters in a shared recording.
  return v.races.some(({entry:e})=>(f.season==='all'||seasonName(e)===f.season)&&(f.series==='all'||e.series===f.series)&&(f.round==='all'||String(e.round)===f.round))&&(!f.search||[title(v),roundLabel(v),...v.races.flatMap(r=>[r.entry.track,seasonName(r.entry)])].join(' ').toLowerCase().includes(f.search.toLowerCase()));
 }
 const verification=v=>v.inferred?'Schedule match · Coverage not independently checked':v.races.some(r=>r.link.match_status==='content_verified')?'Broadcast checked · Venue confirmed in race footage':'Matched by broadcast date and series details';
 const raceLinks=v=>v.races.map(({entry:e})=>`<a href="#race/${e.subsession_id}"><strong>${esc(e.series)} · R${esc(e.round)}</strong><span>${esc(e.track)}</span><span>RACE REPORT & RESULTS ↗</span></a>`).join('');
 const choices=(id,label,values,selected,allLabel)=>`<label for="${id}">${label}</label><select id="${id}"><option value="all">${allLabel}</option>${values.map(v=>`<option value="${esc(v)}" ${String(v)===selected?'selected':''}>${esc(v)}</option>`).join('')}</select>`;
 function errorPage(retry=library){app.innerHTML=header('BROADCAST<br>LIBRARY','Catch up on the racing with Mud Mules TV.')+'<div class="container section"><p role="alert">The recordings could not be loaded. Please try again.</p><button class="btn-light" id="broadcast-retry">TRY AGAIN</button> <a class="button-link" href="https://www.youtube.com/@bobbethTV/streams" target="_blank" rel="noopener noreferrer">BOBBETH TV ON YOUTUBE ↗</a></div>';document.getElementById('broadcast-retry').onclick=()=>{pending=null;retry();};}
 async function library(){
  const version=++renderVersion,hash=location.hash;
  app.innerHTML=header('BROADCAST<br>LIBRARY','The races, the drivers and every chequered flag. Find your next replay.')+'<div class="container section loading">Loading the broadcast library…</div>';
  let videos;try{videos=await load();}catch{if(version===renderVersion&&location.hash===hash)errorPage();return;}
  if(version!==renderVersion||location.hash!==hash)return;
  const allRaces=videos.flatMap(v=>v.races.map(r=>r.entry));
  app.innerHTML=header('BROADCAST<br>LIBRARY','The races, the drivers and every chequered flag. Find your next replay.')+`<div class="container section"><div class="section-head"><div><span class="eyebrow">THE ORIGINAL COVERAGE</span><h2>BACK TO THE RACING</h2></div><a class="text-link" href="#commentary">COMMENTARY DESK ↗</a></div><div class="filterbar">${choices('broadcast-season','SEASON',unique(allRaces.map(seasonName)).sort(),filters.season,'All seasons')}${choices('broadcast-series','SERIES',unique(allRaces.map(e=>e.series)),filters.series,'All series')}${choices('broadcast-round','ROUND',unique(allRaces.map(e=>e.round)).sort((a,b)=>a-b),filters.round,'All rounds')}<label for="broadcast-search">SEARCH</label><input id="broadcast-search" type="search" placeholder="Track, series or round" value="${esc(filters.search)}"><label for="broadcast-order">ORDER</label><select id="broadcast-order"><option value="newest" ${filters.order==='newest'?'selected':''}>Newest races first</option><option value="oldest" ${filters.order==='oldest'?'selected':''}>Oldest races first</option></select><button class="btn-light" id="broadcast-clear" type="button">CLEAR FILTERS</button></div><p id="broadcast-count" role="status" class="result-note"></p><div id="broadcast-grid" class="broadcast-grid"></div><p class="result-note">One recording may cover two championships. Dates refer to the linked races, not the recording's upload date. ${entries().length-allRaces.length>0?`${entries().length-allRaces.length} race(s) still await a linked broadcast.`:''}</p></div>`;
  const update=()=>{
   const selected=videos.filter(v=>matches(v,filters)).sort((a,b)=>(filters.order==='newest'?b.date.localeCompare(a.date):a.date.localeCompare(b.date))||a.id.localeCompare(b.id));
   document.getElementById('broadcast-count').textContent=`${selected.length} of ${videos.length} recordings`;
   document.getElementById('broadcast-grid').innerHTML=selected.map(v=>`<article class="broadcast-card"><a class="broadcast-thumbnail" href="#broadcast/${v.id}" aria-label="Watch ${esc(title(v))}, ${esc(roundLabel(v))}"><img src="https://i.ytimg.com/vi/${v.id}/hqdefault.jpg" alt="Broadcast thumbnail" loading="lazy" referrerpolicy="no-referrer"><span class="broadcast-play">▶ WATCH BROADCAST</span></a><div class="broadcast-card-copy"><span class="sub">${esc(roundLabel(v))} · ${esc(unique(v.races.map(r=>seasonName(r.entry))).join(' / '))}</span><h3><a href="#broadcast/${v.id}">${esc(title(v))}</a></h3><p class="broadcast-race-dates">Race dates: ${esc(dates(v))}</p><p>${esc(unique(v.races.map(r=>r.entry.track)).join(' / '))}</p><div class="broadcast-race-links">${raceLinks(v)}</div><p class="result-note">${verification(v)}</p><a class="broadcast-watch" href="#broadcast/${v.id}">WATCH RECORDING ↗</a></div></article>`).join('')||'<div class="empty">No recordings match those filters. Try another series or clear your search.</div>';
  };
  for(const key of ['season','series','round','order'])document.getElementById('broadcast-'+key).onchange=e=>{filters[key]=e.target.value;update();};
  document.getElementById('broadcast-search').oninput=e=>{filters.search=e.target.value;update();};
  document.getElementById('broadcast-clear').onclick=()=>{Object.assign(filters,{season:'all',series:'all',round:'all',search:'',order:'newest'});library();};
  update();
 }
 async function recording(id){
  const version=++renderVersion,hash=location.hash;app.innerHTML=header('THE<br>BROADCAST','The original Mud Mules TV coverage.')+'<div class="container section loading">Loading the recording…</div>';
  let videos;try{videos=await load();}catch{if(version===renderVersion&&location.hash===hash)errorPage(()=>recording(id));return;}
  if(version!==renderVersion||location.hash!==hash)return;
  const v=videos.find(v=>v.id===id);if(!v){app.innerHTML=header('RECORDING<br>NOT FOUND','<a href="#broadcasts">Back to the broadcast library ↗</a>');return;}
  app.innerHTML=header(esc(title(v)),esc(roundLabel(v))+` · <a href="#broadcasts">ALL BROADCASTS ↗</a>`)+`<div class="container section"><div class="library-player"><iframe src="https://www.youtube-nocookie.com/embed/${v.id}?rel=0" title="${esc(title(v))} — ${esc(roundLabel(v))}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div><div class="broadcast-footer"><p>Race dates: ${esc(dates(v))}</p><a href="${watch(v.id)}" target="_blank" rel="noopener noreferrer">WATCH ON YOUTUBE ↗</a></div>${v.inferred?'<p class="stats-notice">This recording was matched using the weekly series schedule and stream listing order. Its race coverage has not been independently checked.</p>':''}<div class="section-head"><div><span class="eyebrow">IN THIS RECORDING</span><h2>THE RACES</h2></div></div><div class="library-coverage">${v.races.map(({entry:e,link})=>{const offset=Number.isSafeInteger(link.start_seconds)&&link.start_seconds>0&&link.start_seconds<=86400?link.start_seconds:null;return `<div class="series-card"><span class="sub">ROUND ${esc(e.round)} · ${esc(fmtDay(e.event_date))}</span><h3>${esc(e.series)}</h3><p>${esc(e.track)}</p><a class="series-go" href="#race/${e.subsession_id}" data-series="${esc(e.series)}">RACE REPORT & RESULTS ↗</a>${link.verification_note?`<p class="result-note">${esc(link.verification_note)}</p>`:''}${offset?`<p><a class="broadcast-watch" href="${watch(v.id)}&amp;t=${offset}s" target="_blank" rel="noopener noreferrer">OPEN SAVED RACE START ↗</a></p>`:'<p class="result-note">Full recording · Race start not bookmarked.</p>'}</div>`;}).join('')}</div><p class="result-note">Only saved race-start bookmarks are shown. No new timestamps have been estimated.</p><a class="button-link" href="#broadcasts">BACK TO THE LIBRARY</a></div>`;
 }
 return {library,recording,build,matches,load};
};
