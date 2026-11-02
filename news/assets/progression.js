/* Round-by-round totals use the same race points as the standings. */
window.MMTVProgression={
 build(data,season,series,seasonName){
  const competitors=data.drivers.map(d=>({id:d.id,name:d.name,races:d.races.filter(r=>seasonName(r.entry)===season&&r.entry.series===series)})).filter(d=>d.races.length);
  const rounds=[...new Set(competitors.flatMap(d=>d.races.map(r=>Number(r.entry.round))))].filter(r=>Number.isInteger(r)&&r>0).sort((a,b)=>a-b);
  const drivers=competitors.map(d=>({...d,history:[]}));
  for(const round of rounds){
   const active=drivers.filter(d=>d.races.some(r=>Number(r.entry.round)<=round)).map(d=>{
    const through=d.races.filter(r=>Number(r.entry.round)<=round),current=through.filter(r=>Number(r.entry.round)===round);
    return {d,points:through.reduce((sum,r)=>sum+r.points,0),earned:current.reduce((sum,r)=>sum+r.points,0),raced:current.length>0,estimated:through.some(r=>r.estimated>0)};
   }).sort((a,b)=>b.points-a.points||a.d.name.localeCompare(b.d.name));
   let rank=0,last=null;
   active.forEach((a,i)=>{if(a.points!==last)rank=i+1;last=a.points;a.d.history.push({round,points:a.points,earned:a.earned,raced:a.raced,estimated:a.estimated,rank});});
  }
  drivers.sort((a,b)=>b.history.at(-1).points-a.history.at(-1).points||a.name.localeCompare(b.name));
  return {rounds,drivers};
 },
 mount({element,data,groups,driverId,seasonName,esc}){
  if(!element||!groups.length)return;
  const colours=['#ff9c42','#73c9ff','#a8e693','#ec9ef6','#ffe477','#8fe5d9'];
  let groupIndex=0,metric='points',chosen=null;
  const groupKey='progression-'+element.id;
  const draw=()=>{
   const group=groups[groupIndex],model=this.build(data,group.season,group.series,seasonName);
   if(chosen===null)chosen=driverId?[driverId]:model.drivers.slice(0,5).map(d=>d.id);
   const visible=model.drivers.filter(d=>chosen.includes(d.id));
   element.innerHTML=`<section class="progression-section"><div class="section-head"><div><span class="eyebrow">ROUND BY ROUND</span><h2>CHAMPIONSHIP PROGRESSION</h2></div></div><div class="filterbar">${groups.length>1?`<label for="${groupKey}-series">CHAMPIONSHIP</label><select id="${groupKey}-series">${groups.map((g,i)=>`<option value="${i}" ${i===groupIndex?'selected':''}>${esc(g.season)} · ${esc(g.series)}</option>`).join('')}</select>`:`<span>${esc(group.season)} · ${esc(group.series)}</span>`}<label for="${groupKey}-metric">SHOW</label><select id="${groupKey}-metric"><option value="points" ${metric==='points'?'selected':''}>Cumulative points</option><option value="rank" ${metric==='rank'?'selected':''}>Championship position</option></select></div>${!driverId?`<details class="progression-picker"><summary>Choose drivers to compare (up to 6)</summary><fieldset><legend>Drivers shown</legend>${model.drivers.map(d=>`<label><input type="checkbox" value="${esc(d.id)}" ${chosen.includes(d.id)?'checked':''}> ${esc(d.name)}</label>`).join('')}</fieldset></details>`:''}<div class="progression-plot"></div><div class="progression-legend">${visible.map((d,i)=>`<span><i style="background:${colours[i%colours.length]}"></i>${esc(d.name)}</span>`).join('')}</div><p class="result-note">Provisional totals before drops. Positions use every driver in this championship, including those not shown. Ties share a position. Missed rounds carry points forward; lines start at a driver's first appearance. * Includes calculated points.</p><details class="progression-values"><summary>View round-by-round numbers</summary><div class="table-wrap"><table><thead><tr><th>ROUND</th>${driverId?'<th>ROUND POINTS</th><th>TOTAL POINTS</th><th>POSITION</th>':visible.map(d=>`<th>${esc(d.name)}</th>`).join('')}</tr></thead><tbody>${model.rounds.map(round=>`<tr><td>R${round}</td>${driverId?(()=>{const h=visible[0]?.history.find(h=>h.round===round);return h?`<td>${h.raced?h.earned:'Did not race'}</td><td>${h.points}${h.estimated?'*':''}</td><td>P${h.rank}</td>`:'<td colspan="3">Not yet entered</td>';})():visible.map(d=>{const h=d.history.find(h=>h.round===round);return `<td>${h?(metric==='rank'?'P'+h.rank:h.points+(h.estimated?'*':'')):'—'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div></details><p class="progression-status" role="status"></p></section>`;
   const plot=element.querySelector('.progression-plot');
   if(!visible.length||!model.rounds.length){plot.innerHTML='<p class="result-note">Select a driver to see their progression.</p>';}
   else {
    const width=800,height=300,left=62,right=25,top=25,bottom=45;
    const max=metric==='rank'?Math.max(2,...model.drivers.flatMap(d=>d.history.map(h=>h.rank))):Math.max(1,...visible.flatMap(d=>d.history.map(h=>h.points)));
    const x=round=>left+(model.rounds.length===1?(width-left-right)/2:model.rounds.indexOf(round)/(model.rounds.length-1)*(width-left-right));
    const y=value=>top+(metric==='rank'?(value-1)/(max-1):1-value/max)*(height-top-bottom);
    const ticks=metric==='rank'?[...new Set([1,Math.round((max+1)/2),max])]:[0,max/4,max/2,max*3/4,max];
    plot.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${metric==='rank'?'Championship positions':'Cumulative championship points'} by round"><title>${esc(group.series)} progression</title><desc>Round-by-round ${metric==='rank'?'positions, with first place at the top':'points'}. Exact values are available in the table below.</desc>${ticks.map(t=>`<line x1="${left}" y1="${y(t)}" x2="${width-right}" y2="${y(t)}" stroke="#3b3e48"/><text x="${left-12}" y="${y(t)+5}" text-anchor="end">${metric==='rank'?'P'+t:Math.round(t*10)/10}</text>`).join('')}${model.rounds.map(r=>`<text x="${x(r)}" y="${height-12}" text-anchor="middle">R${r}</text>`).join('')}${visible.map((d,i)=>`<polyline points="${d.history.map(h=>`${x(h.round)},${y(metric==='rank'?h.rank:h.points)}`).join(' ')}" fill="none" stroke="${colours[i]}" stroke-width="3"/>${d.history.map(h=>`<circle cx="${x(h.round)}" cy="${y(metric==='rank'?h.rank:h.points)}" r="5" fill="${colours[i]}" stroke="#111" stroke-width="2"><title>${esc(d.name)} · R${h.round}: ${h.points}${h.estimated?'*':''} points · P${h.rank}${h.raced?'':' · Did not race'}</title></circle>`).join('')}`).join('')}</svg>`;
   }
   const metricSelect=element.querySelector(`#${groupKey}-metric`);metricSelect.onchange=e=>{metric=e.target.value;draw();};
   const groupSelect=element.querySelector(`#${groupKey}-series`);if(groupSelect)groupSelect.onchange=e=>{groupIndex=Number(e.target.value);chosen=null;draw();};
   element.querySelectorAll('input[type="checkbox"]').forEach(input=>input.onchange=()=>{
    if(input.checked&&chosen.length>=6){input.checked=false;element.querySelector('.progression-status').textContent='Choose up to six drivers. Uncheck one to add another.';return;}
    chosen=input.checked?[...chosen,input.value]:chosen.filter(id=>id!==input.value);
    draw();
   });
  };
  draw();
 }
};
